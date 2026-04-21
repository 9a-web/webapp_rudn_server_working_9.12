/**
 * useFriendEvents — SSE хук для real-time обновлений дружбы
 * Подключается к /api/friends/events/{telegramId}
 * При получении событий вызывает callback для обновления UI
 */

import { useEffect, useRef, useCallback } from 'react';
import { getBackendURL } from '../utils/config';

/**
 * Типы событий:
 * - friend_request_received    — кто-то отправил нам заявку
 * - friend_request_accepted    — наша исходящая заявка принята
 * - friend_request_accepted_self — мы приняли заявку (подтверждение)
 * - friend_request_rejected    — наша исходящая заявка отклонена
 * - friend_request_cancelled   — входящая заявка нам отменена отправителем
 * - friend_request_mutual_accepted — взаимная заявка → автоматическая дружба
 * - friend_removed             — нас удалили из друзей
 * - friend_removed_self        — мы удалили друга (подтверждение)
 * - user_blocked               — нас заблокировали
 */

export const useFriendEvents = (telegramId, onEvent) => {
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const retriesRef = useRef(0);
  const MAX_RETRIES = 15;
  const BASE_DELAY = 2000;

  // Обновляем ref при изменении callback
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!telegramId) return;
    // Проверяем поддержку EventSource
    if (typeof EventSource === 'undefined') return;

    // Закрываем предыдущее соединение
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const backendUrl = getBackendURL();
    if (!backendUrl) return;
    const url = `${backendUrl}/api/friends/events/${telegramId}`;

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        retriesRef.current = 0; // Сброс счётчика при успешном подключении
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ping' || data.type === 'connected') return;
          // Вызываем callback с типом события и данными
          onEventRef.current?.(data.type, data.data || {});
        } catch (err) {
          // Невалидный JSON — игнорируем
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        // Переподключение с экспоненциальной задержкой
        if (retriesRef.current < MAX_RETRIES) {
          const delay = Math.min(BASE_DELAY * Math.pow(1.5, retriesRef.current), 30000);
          retriesRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };
    } catch (err) {
      console.error('[useFriendEvents] Connection error:', err);
    }
  }, [telegramId]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);

  return null;
};

export default useFriendEvents;
