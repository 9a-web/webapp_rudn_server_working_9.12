/**
 * API для работы с веб-сессиями (связка Telegram профиля)
 */

import { getBackendURL } from './api';

/**
 * Создать новую веб-сессию
 * @returns {Promise<{session_token: string, qr_url: string, expires_at: string, status: string}>}
 */
export const createWebSession = async () => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/web-sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to create web session');
  }
  
  return response.json();
};

/**
 * Получить статус веб-сессии
 * @param {string} sessionToken - токен сессии
 * @returns {Promise<Object>}
 */
export const getWebSessionStatus = async (sessionToken) => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/web-sessions/${sessionToken}/status`);
  
  if (!response.ok) {
    throw new Error('Failed to get session status');
  }
  
  return response.json();
};

/**
 * Связать сессию с Telegram профилем
 * @param {string} sessionToken - токен сессии
 * @param {Object} userData - данные пользователя
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const linkWebSession = async (sessionToken, userData) => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/web-sessions/${sessionToken}/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });
  
  if (!response.ok) {
    throw new Error('Failed to link session');
  }
  
  return response.json();
};

/**
 * Создать WebSocket соединение для отслеживания связки сессии
 * С автоматическим fallback на HTTP polling при ошибке WebSocket
 * @param {string} sessionToken - токен сессии
 * @param {Function} onLinked - колбэк при успешной связке
 * @param {Function} onError - колбэк при ошибке
 * @param {Function} onExpired - колбэк при истечении сессии
 * @returns {Object} - объект с методом close() для закрытия соединения/polling
 */
export const createSessionWebSocket = (sessionToken, { onLinked, onError, onExpired, onConnected, onScanned, onRejected }) => {
  // Определяем WebSocket URL
  const backendUrl = getBackendURL();
  const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
  const wsHost = backendUrl.replace(/^https?:\/\//, '');
  // Используем /api/ws/ для правильной маршрутизации через ingress
  const wsUrl = `${wsProtocol}://${wsHost}/api/ws/session/${sessionToken}`;
  
  console.log('🔌 Connecting to WebSocket:', wsUrl);
  
  let pollingInterval = null;
  let isClosed = false;
  
  // Функция для HTTP polling (fallback)
  const startPolling = () => {
    console.log('🔄 Starting HTTP polling fallback for session status...');
    
    pollingInterval = setInterval(async () => {
      if (isClosed) {
        clearInterval(pollingInterval);
        return;
      }
      
      try {
        const response = await fetch(`${backendUrl}/api/web-sessions/${sessionToken}/status`);
        if (!response.ok) {
          if (response.status === 404) {
            console.log('⏰ Session expired (polling)');
            onExpired?.();
            clearInterval(pollingInterval);
          }
          return;
        }
        
        const data = await response.json();
        console.log('📡 Polling status:', data.status);
        
        if (data.status === 'linked') {
          console.log('✅ Session linked (polling)!', data);
          onLinked?.({
            telegram_id: data.telegram_id,
            first_name: data.first_name,
            last_name: data.last_name,
            username: data.username,
            photo_url: data.photo_url,
            user_settings: data.user_settings
          });
          clearInterval(pollingInterval);
        } else if (data.status === 'expired') {
          console.log('⏰ Session expired (polling)');
          onExpired?.();
          clearInterval(pollingInterval);
        }
      } catch (err) {
        console.warn('📡 Polling error:', err.message);
        // Продолжаем polling при сетевых ошибках
      }
    }, 2000); // Проверяем каждые 2 секунды
  };
  
  const ws = new WebSocket(wsUrl);
  let wsConnected = false;
  let wsErrorOccurred = false;
  
  ws.onopen = () => {
    console.log('✅ WebSocket connected');
    wsConnected = true;
  };
  
  ws.onmessage = (event) => {
    try {
      // Проверяем, это JSON или простой текст (ping/pong)
      if (event.data === 'ping') {
        ws.send('pong');
        return;
      }
      
      const data = JSON.parse(event.data);
      console.log('📨 WebSocket message:', data);
      
      switch (data.event) {
        case 'connected':
          console.log('🔗 Session WebSocket ready');
          onConnected?.();
          break;
        case 'linked':
          console.log('✅ Session linked!', data.data);
          onLinked?.(data.data);
          break;
        case 'expired':
          console.log('⏰ Session expired');
          onExpired?.();
          break;
        case 'error':
          console.error('❌ Session error:', data.message);
          onError?.(data.message);
          break;
        default:
          console.log('Unknown event:', data.event);
      }
    } catch (e) {
      // Не JSON - возможно pong или другое сообщение
      console.log('📨 WebSocket raw message:', event.data);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
    wsErrorOccurred = true;
    
    // Если WebSocket не подключился - переключаемся на polling
    if (!wsConnected && !pollingInterval) {
      console.log('⚠️ WebSocket failed, switching to HTTP polling...');
      startPolling();
      onConnected?.(); // Сигнализируем что "соединение" установлено (через polling)
    }
  };
  
  ws.onclose = (event) => {
    console.log('🔌 WebSocket closed, code:', event.code, 'reason:', event.reason);
    
    // Если WebSocket закрылся с ошибкой до подключения - переключаемся на polling
    if (!wsConnected && !pollingInterval && !isClosed) {
      console.log('⚠️ WebSocket closed before connecting, switching to HTTP polling...');
      startPolling();
      onConnected?.();
    }
  };
  
  // Таймаут для переключения на polling если WebSocket не подключается
  setTimeout(() => {
    if (!wsConnected && !pollingInterval && !isClosed) {
      console.log('⚠️ WebSocket connection timeout, switching to HTTP polling...');
      startPolling();
      onConnected?.();
    }
  }, 5000); // 5 секунд таймаут
  
  // Возвращаем объект с методом close для совместимости
  return {
    close: () => {
      isClosed = true;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
    // Для совместимости с проверками типа ws.readyState
    get readyState() {
      return ws.readyState;
    }
  };
};

/**
 * Получить список устройств пользователя
 * @param {number} telegramId - ID пользователя в Telegram
 * @param {string} currentToken - токен текущей сессии (опционально)
 * @returns {Promise<{devices: Array, total: number}>}
 */
export const getUserDevices = async (telegramId, currentToken = null) => {
  const backendUrl = getBackendURL();
  let url = `${backendUrl}/api/web-sessions/user/${telegramId}/devices`;
  if (currentToken) {
    url += `?current_token=${currentToken}`;
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to get devices');
  }
  
  return response.json();
};

/**
 * Отключить устройство (отозвать сессию)
 * @param {string} sessionToken - токен сессии
 * @param {number} telegramId - ID пользователя в Telegram
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const revokeDevice = async (sessionToken, telegramId) => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/web-sessions/${sessionToken}?telegram_id=${telegramId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to revoke device');
  }
  
  return response.json();
};

/**
 * Отключить все устройства пользователя
 * @param {number} telegramId - ID пользователя в Telegram
 * @returns {Promise<{success: boolean, message: string, deleted_count: number}>}
 */
export const revokeAllDevices = async (telegramId) => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/web-sessions/user/${telegramId}/all`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to revoke all devices');
  }
  
  return response.json();
};

/**
 * Отправить heartbeat для сессии
 * @param {string} sessionToken - токен сессии
 */
export const sendHeartbeat = async (sessionToken) => {
  const backendUrl = getBackendURL();
  try {
    await fetch(`${backendUrl}/api/web-sessions/${sessionToken}/heartbeat`, {
      method: 'POST'
    });
  } catch (e) {
    console.warn('Heartbeat failed:', e);
  }
};

export default {
  createWebSession,
  getWebSessionStatus,
  linkWebSession,
  createSessionWebSocket,
  getUserDevices,
  revokeDevice,
  revokeAllDevices,
  sendHeartbeat
};
