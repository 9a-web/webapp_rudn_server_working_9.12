/**
 * Web Push helper — registers SW, requests permission, subscribes via PushManager,
 * sends subscription to backend.
 *
 * Использование:
 *   import { initWebPush } from "./utils/webpush";
 *   initWebPush({ telegram_id, uid });
 *
 * Поведение (MVP, "aggressive prompt"):
 *   - Если permission уже granted и подписка есть в SW → синхронизируем с backend
 *   - Если permission default (не запрошен) → запрашиваем СРАЗУ
 *   - Если permission denied → ничего не делаем (юзер сам должен включить в настройках)
 *
 * iOS-specifics:
 *   - Web Push работает только в standalone-режиме (PWA на Home Screen).
 *     В обычной Safari-вкладке `Notification.requestPermission` отдаст denied или вообще выкинет.
 *   - Поэтому добавляем guard: проверяем `window.matchMedia("(display-mode: standalone)")`.
 *
 * Backend контракт:
 *   GET  /api/push/vapid-public-key → { public_key }
 *   POST /api/push/subscribe        → { status: ok, subscription_id }
 *   POST /api/push/unsubscribe      → { status: ok, removed }
 */

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

/**
 * Конвертирует base64url-строку в Uint8Array (формат, который требует PushManager.subscribe).
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Конвертирует ArrayBuffer в base64url.
 */
function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Проверяет, поддерживает ли браузер Web Push.
 */
export function isWebPushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Проверяет: запущено ли приложение в standalone-режиме (для iOS обязательно).
 * Android Chrome тоже учитывает, но там обычно push работает и в браузере.
 */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia &&
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/**
 * Определяет, iOS-устройство ли это.
 */
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Регистрирует service worker, если ещё не зарегистрирован.
 */
async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  // Не регистрируем SW внутри Telegram WebApp (это контейнер Telegram, push не нужен)
  // Можно проверить window.Telegram?.WebApp?.initData — если есть, это TG WebApp
  try {
    const reg = await navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
    });
    // Дожидаемся активации
    if (reg.installing) {
      await new Promise((resolve) => {
        reg.installing.addEventListener("statechange", (e) => {
          if (e.target.state === "activated") resolve();
        });
      });
    }
    return reg;
  } catch (e) {
    console.warn("[webpush] SW register failed:", e);
    return null;
  }
}

/**
 * Получить VAPID public key с backend.
 */
async function fetchVapidPublicKey() {
  try {
    const r = await fetch(`${BACKEND_URL}/api/push/vapid-public-key`);
    if (!r.ok) return null;
    const json = await r.json();
    return json.public_key || null;
  } catch (e) {
    console.warn("[webpush] vapid fetch failed:", e);
    return null;
  }
}

/**
 * Отправить подписку на backend.
 */
async function sendSubscriptionToBackend({ subscription, telegram_id, uid }) {
  const subJson = subscription.toJSON();
  const body = {
    telegram_id: telegram_id ?? null,
    uid: uid ?? null,
    endpoint: subJson.endpoint,
    keys: subJson.keys,
    user_agent: navigator.userAgent || "",
  };
  try {
    const r = await fetch(`${BACKEND_URL}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.warn("[webpush] backend subscribe failed:", r.status);
      return false;
    }
    const json = await r.json();
    console.log("[webpush] subscribed:", json.subscription_id);
    return true;
  } catch (e) {
    console.warn("[webpush] backend subscribe error:", e);
    return false;
  }
}

/**
 * Удалить подписку с backend.
 */
async function removeSubscriptionFromBackend(endpoint) {
  try {
    await fetch(`${BACKEND_URL}/api/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
  } catch (e) {
    console.warn("[webpush] backend unsubscribe error:", e);
  }
}

/**
 * Главная инициализация — вызывайте при загрузке приложения с известными идентификаторами.
 *
 * @param {Object} opts
 * @param {number|null} opts.telegram_id - реальный TG id или pseudo_tid (10^10+uid)
 * @param {string|null} opts.uid - UID юзера
 * @param {boolean} opts.autoPrompt - запрашивать permission сразу (MVP: true)
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export async function initWebPush({ telegram_id, uid, autoPrompt = true } = {}) {
  // 1. Базовая поддержка
  if (!isWebPushSupported()) {
    return { success: false, reason: "not_supported" };
  }

  // 2. На iOS — только в standalone (PWA на Home Screen)
  if (isIOS() && !isStandalone()) {
    console.log(
      "[webpush] iOS detected but not in standalone — push не сработает. " +
        "Юзеру нужно добавить сайт на главный экран.",
    );
    return { success: false, reason: "ios_not_standalone" };
  }

  // 3. SW
  const registration = await ensureServiceWorker();
  if (!registration) {
    return { success: false, reason: "sw_failed" };
  }

  // 4. Permission
  let permission = Notification.permission;
  if (permission === "default") {
    if (!autoPrompt) {
      return { success: false, reason: "permission_default" };
    }
    try {
      permission = await Notification.requestPermission();
    } catch (e) {
      console.warn("[webpush] requestPermission failed:", e);
      return { success: false, reason: "permission_error" };
    }
  }
  if (permission !== "granted") {
    return { success: false, reason: `permission_${permission}` };
  }

  // 5. VAPID public key
  const vapidPublic = await fetchVapidPublicKey();
  if (!vapidPublic) {
    return { success: false, reason: "no_vapid_key" };
  }

  // 6. Subscribe (или используем существующую подписку)
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      });
    } catch (e) {
      console.warn("[webpush] subscribe failed:", e);
      return { success: false, reason: "subscribe_error" };
    }
  }

  // 7. Отправляем подписку на backend (idempotent)
  const ok = await sendSubscriptionToBackend({ subscription, telegram_id, uid });
  if (!ok) {
    return { success: false, reason: "backend_subscribe_failed" };
  }

  // 8. Подписываемся на сообщения от SW (notification click)
  if (!window.__rudn_webpush_listener_attached) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "NOTIFICATION_CLICK") {
        const url = event.data.url || "/";
        try {
          // Если уже на нужной странице — ничего не делаем
          if (window.location.pathname + window.location.search !== url) {
            // Используем react-router если есть, иначе fallback на window.location
            window.location.href = url;
          }
        } catch (e) {
          // ignore
        }
      }
    });
    window.__rudn_webpush_listener_attached = true;
  }

  return { success: true };
}

/**
 * Отписаться от web push (для UI «выключить push»).
 */
export async function disableWebPush() {
  if (!isWebPushSupported()) return { success: false };
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return { success: true };
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { success: true };
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch (e) {
    console.warn("[webpush] unsubscribe failed:", e);
  }
  await removeSubscriptionFromBackend(endpoint);
  return { success: true };
}

/**
 * Получить текущий статус: есть ли активная подписка.
 */
export async function getWebPushStatus() {
  if (!isWebPushSupported()) return { supported: false };
  if (isIOS() && !isStandalone()) {
    return {
      supported: true,
      requires_pwa_install: true,
      permission: Notification.permission,
      subscribed: false,
    };
  }
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) {
    return {
      supported: true,
      permission: Notification.permission,
      subscribed: false,
    };
  }
  const sub = await reg.pushManager.getSubscription();
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!sub,
  };
}
