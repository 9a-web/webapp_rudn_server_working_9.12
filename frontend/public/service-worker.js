/**
 * RUDN Go — Service Worker для Web Push (PWA)
 *
 * Обрабатывает два события:
 *   - 'push' — приходит payload от сервера, показываем системную нотификацию
 *   - 'notificationclick' — юзер кликнул, открываем приложение
 *
 * Также (опционально) кэширует основные ассеты для офлайн-первого опыта.
 * В этой минимальной версии — без оффлайн-кэша (focus на push).
 *
 * iOS 16.4+ specifics:
 *   - PWA должен быть «На экран Домой»
 *   - Permission запрашивается только из standalone-режима
 */

// Версия SW. Меняйте при существенных правках, чтобы заставить браузер обновить SW.
const SW_VERSION = "rudn-go-sw-v2";

self.addEventListener("install", (event) => {
  console.log(`[SW ${SW_VERSION}] install`);
  // Сразу активируемся, не ждём перезагрузки
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log(`[SW ${SW_VERSION}] activate`);
  // Берём контроль над всеми открытыми клиентами немедленно
  event.waitUntil(self.clients.claim());
});

/**
 * Обработка входящего push-сообщения.
 *
 * Backend шлёт JSON payload:
 *   { title, body, icon, badge, url, tag, data }
 *
 * Если payload пустой (некоторые тесты могут прислать пустоту) — показываем дефолт.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    // payload не JSON — пробуем как text
    try {
      payload = { body: event.data ? event.data.text() : "" };
    } catch (e2) {
      payload = {};
    }
  }

  const title = payload.title || "RUDN Go";
  const options = {
    body: payload.body || "У вас новое уведомление",
    icon: payload.icon || "/LogoRudn.png",
    badge: payload.badge || "/LogoRudn.png",
    tag: payload.tag || "rudn-go",
    // renotify=true → при одинаковом tag всё равно тренькает.
    // Полезно для нескольких уведомлений о разных парах с tag="study".
    renotify: true,
    // Сохраняем data для notificationclick
    data: {
      url: payload.url || "/",
      ...(payload.data || {}),
    },
    // На iOS vibrate игнорируется, на Android — звук+вибро по умолчанию
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error("[SW] showNotification failed:", err);
    }),
  );
});

/**
 * Клик по уведомлению — открываем приложение (или фокусим, если уже открыто).
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || "/";
  // Improvement 2: cross-channel dedup. Backend кладёт `notification_id` (in-app ID)
  // в payload web push. SW передаёт его клиенту, который вызывает markAsRead → в UI
  // больше не висит «непрочитанный» бейдж после того, как юзер открыл уведомление через push.
  const notificationId = notifData.notification_id || null;

  event.waitUntil(
    (async () => {
      // Ищем уже открытое окно/таб приложения
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Пытаемся найти существующее окно с нашим scope
      for (const client of allClients) {
        if ("focus" in client) {
          try {
            // Сообщаем клиенту, что нужно перейти на targetUrl и пометить уведомление прочитанным
            client.postMessage({
              type: "NOTIFICATION_CLICK",
              url: targetUrl,
              notificationId,
              category: notifData.category || null,
              notifType: notifData.type || null,
            });
            return client.focus();
          } catch (e) {
            // ignore
          }
        }
      }

      // Не нашли — открываем новое окно. notification_id передаём через URL
      // фрагмент, чтобы фронт мог пометить read после загрузки.
      if (self.clients.openWindow) {
        const url = notificationId
          ? `${targetUrl}${targetUrl.includes("?") ? "&" : "?"}nid=${encodeURIComponent(notificationId)}`
          : targetUrl;
        return self.clients.openWindow(url);
      }
    })(),
  );
});

/**
 * pushsubscriptionchange — браузер «обновил» подписку (например при ротации ключей).
 * Здесь имеет смысл пере-подписаться, но это редкое событие. Пока — просто логируем.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] pushsubscriptionchange — клиенту нужно переподписаться");
  // Уведомляем клиентов, чтобы они инициировали re-subscribe при следующей загрузке
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window" });
      for (const client of allClients) {
        client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGE" });
      }
    })(),
  );
});
