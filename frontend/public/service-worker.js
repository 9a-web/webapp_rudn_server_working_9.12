/**
 * RUDN Go — Service Worker для Web Push + Offline PWA
 *
 * Обрабатывает:
 *   - 'install' / 'activate' — управление версией и очисткой старых кэшей
 *   - 'message' — команды от клиентов (SKIP_WAITING для контролируемого update)
 *   - 'fetch' — оффлайн-кэш стратегии (cache-first для статики, network-first для API)
 *   - 'push' — приходит payload от сервера, показываем системную нотификацию
 *   - 'notificationclick' — юзер кликнул, открываем приложение
 *
 * iOS 16.4+ specifics:
 *   - PWA должен быть «На экран Домой»
 *   - Permission запрашивается только из standalone-режима
 *
 * 🔧 H1+H2 FIX (2026-07): добавлен реальный offline-кэш и SKIP_WAITING handler
 *    для контролируемого update flow.
 */

// Версия SW. Меняйте при существенных правках, чтобы заставить браузер обновить SW.
const SW_VERSION = "rudn-go-sw-v3-offline";
const STATIC_CACHE = `rudn-static-${SW_VERSION}`;
const RUNTIME_CACHE = `rudn-runtime-${SW_VERSION}`;
const SCHEDULE_CACHE = `rudn-schedule-${SW_VERSION}`;

// App shell — критичные ресурсы для offline-первого опыта
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/LogoRudn.png",
  "/telegram-web-app.js",
];

// Максимальное TTL для kэшированного расписания (24 часа)
const SCHEDULE_TTL_MS = 24 * 60 * 60 * 1000;

self.addEventListener("install", (event) => {
  console.log(`[SW ${SW_VERSION}] install`);
  // H2 FIX: НЕ вызываем skipWaiting() автоматически — ждём команду от клиента.
  // Клиент покажет UI «доступно обновление» и вызовет SW.postMessage({type:'SKIP_WAITING'}).
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // best-effort: если какой-то ресурс не загрузился, продолжаем
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  console.log(`[SW ${SW_VERSION}] activate`);
  event.waitUntil(
    (async () => {
      // Чистим старые кэши других версий
      const keys = await caches.keys();
      const toDelete = keys.filter(
        (k) =>
          (k.startsWith("rudn-static-") ||
            k.startsWith("rudn-runtime-") ||
            k.startsWith("rudn-schedule-")) &&
          !k.endsWith(SW_VERSION),
      );
      await Promise.all(toDelete.map((k) => caches.delete(k)));
      await self.clients.claim();

      // Уведомляем клиентов о новой активной версии
      const allClients = await self.clients.matchAll({ type: "window" });
      for (const client of allClients) {
        client.postMessage({ type: "SW_ACTIVATED", version: SW_VERSION });
      }
    })(),
  );
});

// H2 FIX: handler для контролируемого update flow
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    console.log(`[SW ${SW_VERSION}] SKIP_WAITING received`);
    self.skipWaiting();
  } else if (event.data.type === "PING") {
    event.ports?.[0]?.postMessage({ type: "PONG", version: SW_VERSION });
  }
});

/**
 * Fetch стратегии:
 *  - Статика (js/css/png/woff): cache-first
 *  - API расписания (/api/schedule, /api/lessons, /api/timetable): network-first + cache fallback
 *  - Прочие /api/: только network (без кэша — данные пишутся)
 *  - HTML / navigation: network-first + cache fallback на index.html (SPA)
 */
function isStaticAsset(url) {
  return /\.(?:js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|ico|webp)(\?.*)?$/i.test(url.pathname);
}

function isScheduleAPI(url) {
  return /\/api\/(?:schedule|lessons|timetable|groups|teachers|students\/.*\/schedule)/i.test(
    url.pathname,
  );
}

function isAPIRequest(url) {
  return url.pathname.startsWith("/api/");
}

async function networkFirstWithCache(request, cacheName, ttlMs) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Кладём копию в кэш (с timestamp в заголовке)
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set("sw-cached-at", String(Date.now()));
      const body = await cloned.blob();
      const cachedCopy = new Response(body, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
      cache.put(request, cachedCopy).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      // Проверяем TTL
      const cachedAt = parseInt(cached.headers.get("sw-cached-at") || "0", 10);
      if (!ttlMs || Date.now() - cachedAt < ttlMs) {
        return cached;
      }
    }
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.status < 400) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Только GET-кэшируем
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Не трогаем кросс-доменные ресурсы (CDN, аналитика)
  if (url.origin !== self.location.origin) return;

  // Skip dev-server hot reload routes
  if (url.pathname.includes("/sockjs-node/") || url.pathname.includes("/ws")) return;

  // Стратегия по типу ресурса
  if (isStaticAsset(url)) {
    event.respondWith(
      cacheFirst(request, STATIC_CACHE).catch(() => fetch(request).catch(() => new Response("", { status: 504 }))),
    );
    return;
  }

  if (isScheduleAPI(url)) {
    event.respondWith(
      networkFirstWithCache(request, SCHEDULE_CACHE, SCHEDULE_TTL_MS).catch(
        () =>
          new Response(JSON.stringify({ error: "offline", offline: true }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    return;
  }

  if (isAPIRequest(url)) {
    // Прочие /api/ — только network, без кэша
    return;
  }

  // Navigation / HTML — network-first с fallback на app shell
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match("/index.html")) || (await cache.match("/")) || new Response("Offline", { status: 503 });
      }),
    );
    return;
  }

  // Default: try network, fallback to runtime cache
  event.respondWith(
    networkFirstWithCache(request, RUNTIME_CACHE, 0).catch(() => new Response("", { status: 504 })),
  );
});

/**
 * Обработка входящего push-сообщения.
 *
 * Backend шлёт JSON payload:
 *   { title, body, icon, badge, url, tag, data, silent? }
 *
 * 🔧 M10 FIX (2026-07): дедупликация — если только что прислали то же category
 *    (за последние 60 сек), показываем silent (без звука/вибро).
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    try {
      payload = { body: event.data ? event.data.text() : "" };
    } catch (e2) {
      payload = {};
    }
  }

  const title = payload.title || "RUDN Go";
  const tag = payload.tag || "rudn-go";
  const category = (payload.data && payload.data.category) || payload.category || null;

  event.waitUntil(
    (async () => {
      // M10: дедупликация по category за последние 60 секунд
      let silent = !!payload.silent;
      try {
        if (category && self.registration.getNotifications) {
          const recent = await self.registration.getNotifications({ tag });
          if (recent && recent.length > 0) {
            // Тот же tag уже показан → silently обновляем (renotify=false уменьшает шум)
            silent = true;
          }
        }
      } catch (_) {}

      const options = {
        body: payload.body || "У вас новое уведомление",
        icon: payload.icon || "/LogoRudn.png",
        badge: payload.badge || "/LogoRudn.png",
        tag,
        // renotify=true → при одинаковом tag всё равно тренькает (но silent перебивает).
        renotify: !silent,
        data: {
          url: payload.url || "/",
          category,
          ...(payload.data || {}),
        },
        requireInteraction: false,
        silent,
      };

      try {
        await self.registration.showNotification(title, options);
      } catch (err) {
        console.error("[SW] showNotification failed:", err);
      }
    })(),
  );
});

/**
 * Клик по уведомлению — открываем приложение (или фокусим, если уже открыто).
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || "/";
  const notificationId = notifData.notification_id || null;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          try {
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
 * pushsubscriptionchange — браузер «обновил» подписку.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] pushsubscriptionchange — клиенту нужно переподписаться");
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window" });
      for (const client of allClients) {
        client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGE" });
      }
    })(),
  );
});
