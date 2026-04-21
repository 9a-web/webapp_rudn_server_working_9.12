/**
 * Утилита для получения информации о Telegram боте.
 * Username бота определяется динамически через API (getMe).
 * Кэшируется на время сессии.
 */
import { getBackendURL } from './config';

let _botInfoCache = null;
let _fetchPromise = null;

/**
 * Получает информацию о боте с бэкенда (кэшируется).
 * @returns {Promise<{username: string, first_name: string, bot_id: number, env: string}>}
 */
export const fetchBotInfo = async () => {
  if (_botInfoCache) return _botInfoCache;
  
  // Предотвращаем параллельные запросы
  if (_fetchPromise) return _fetchPromise;
  
  _fetchPromise = (async () => {
    try {
      const backendUrl = getBackendURL();
      const response = await fetch(`${backendUrl}/api/bot-info`);
      if (response.ok) {
        const data = await response.json();
        if (data.username) {
          _botInfoCache = data;
          console.log(`🤖 Bot info loaded: @${data.username} (env=${data.env})`);
          return data;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch bot info:', err);
    }
    // fallback
    return { username: 'bot', first_name: '', bot_id: 0, env: 'unknown' };
  })();
  
  const result = await _fetchPromise;
  _fetchPromise = null;
  return result;
};

/**
 * Получает username бота (синхронно из кэша, или fallback).
 * Для использования в не-async контекстах.
 * @returns {string}
 */
export const getBotUsername = () => {
  return _botInfoCache?.username || 'bot';
};

/**
 * Сбрасывает кэш (при смене окружения и т.п.)
 */
export const resetBotInfoCache = () => {
  _botInfoCache = null;
  _fetchPromise = null;
};
