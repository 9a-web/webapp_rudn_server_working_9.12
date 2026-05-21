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
 *
 * Bug L fix: явные скобки вокруг && и || — для читаемости и защиты от
 * случайного редактирования.
 */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  const matchStandalone =
    !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  const iosStandalone = window.navigator && window.navigator.standalone === true;
  return matchStandalone || iosStandalone;
}

/**
 * Определяет, iOS-устройство ли это.
 */
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Bug B fix: определяет, запущено ли приложение внутри Telegram WebApp.
 *
 * Внутри TG WebView (мобильный/Desktop TG-клиент) Web Push НЕ работает:
 *   - PushManager либо отсутствует, либо subscribe() возвращает ошибку
 *   - В iOS-TG нельзя установить PWA на главный экран
 *   - Юзеру не нужен web push в TG — он уже получит TG-bot push
 *
 * Поэтому в TG-контексте мы НЕ регистрируем SW и не запрашиваем permission —
 * иначе юзер видит лишний модал и в логах появляются ошибки subscribe.
 *
 * Что проверяем:
 *   1. window.Telegram.WebApp существует и initData/initDataUnsafe непустые
 *      (это значит юзер реально открыл WebApp через бота)
 *   2. userAgent содержит "Telegram" (часть TG-клиентов добавляет)
 */
export function isTelegramWebApp() {
  if (typeof window === "undefined") return false;
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg) {
      // initData может быть пустым, если открыли вне бота — тогда это просто браузер
      if (tg.initData && tg.initData.length > 0) return true;
      // initDataUnsafe может быть с user → значит реально через бота
      if (tg.initDataUnsafe && tg.initDataUnsafe.user) return true;
    }
  } catch (e) { /* ignore */ }
  // Дополнительная эвристика: User-Agent
  try {
    if (navigator && navigator.userAgent && /Telegram/i.test(navigator.userAgent)) {
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

/**
 * VK Mini App detection — для будущего использования.
 * Внутри VK MiniApp Web Push тоже не работает, нужны VK SDK callbacks.
 */
export function isVKMiniApp() {
  if (typeof window === "undefined") return false;
  try {
    // VK Bridge кладёт глобал window.vkBridge или window.vk
    if (window.vkBridge || (window.vk && window.vk.bridge)) return true;
    // VK Mini App открывается в iframe с url-параметром vk_user_id
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("vk_user_id")) return true;
  } catch (e) { /* ignore */ }
  return false;
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
  // Bug B fix: внутри Telegram WebApp / VK Mini App web push НЕ работает.
  // Скипаем сразу, чтобы не дёргать SW и не вызывать permission prompt.
  if (isTelegramWebApp()) {
    console.log("[webpush] Telegram WebApp detected — skip web push (use bot push instead)");
    return { success: false, reason: "telegram_webapp" };
  }
  if (isVKMiniApp()) {
    console.log("[webpush] VK Mini App detected — skip web push (use VK SDK instead)");
    return { success: false, reason: "vk_miniapp" };
  }

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

  // 8. Подписываемся на сообщения от SW (notification click).
  // Improvement 2 (cross-channel dedup): после клика по push помечаем
  // соответствующее in-app как прочитанное, чтобы бейдж в UI не висел.
  if (!window.__rudn_webpush_listener_attached) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "NOTIFICATION_CLICK") {
        const url = event.data.url || "/";
        const notificationId = event.data.notificationId || null;

        // Помечаем in-app как read через backend API (fire-and-forget).
        if (notificationId && telegram_id) {
          try {
            const apiBase = (typeof process !== "undefined" && process.env && process.env.REACT_APP_BACKEND_URL)
              || (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.REACT_APP_BACKEND_URL)
              || "";
            fetch(`${apiBase}/api/notifications/${encodeURIComponent(notificationId)}/read?telegram_id=${encodeURIComponent(telegram_id)}`, {
              method: "PATCH",
            }).catch(() => { /* ignore */ });
            // Уведомляем фронт-стейт, чтобы бейдж обновился без перезагрузки
            window.dispatchEvent(new CustomEvent("notification-marked-read", {
              detail: { notificationId },
            }));
          } catch (e) {
            // ignore
          }
        }

        try {
          // Если уже на нужной странице — ничего не делаем
          if (window.location.pathname + window.location.search !== url) {
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
  // Bug B fix: в TG/VK web push неприменим — отдаём явный статус
  if (isTelegramWebApp()) {
    return { supported: false, reason: "telegram_webapp", subscribed: false };
  }
  if (isVKMiniApp()) {
    return { supported: false, reason: "vk_miniapp", subscribed: false };
  }
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
