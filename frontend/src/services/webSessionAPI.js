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
 * @param {string} sessionToken - токен сессии
 * @param {Function} onLinked - колбэк при успешной связке
 * @param {Function} onError - колбэк при ошибке
 * @param {Function} onExpired - колбэк при истечении сессии
 * @returns {WebSocket}
 */
export const createSessionWebSocket = (sessionToken, { onLinked, onError, onExpired, onConnected }) => {
  // Определяем WebSocket URL
  const backendUrl = getBackendURL();
  const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
  const wsHost = backendUrl.replace(/^https?:\/\//, '');
  // Используем /api/ws/ для правильной маршрутизации через ingress
  const wsUrl = `${wsProtocol}://${wsHost}/api/ws/session/${sessionToken}`;
  
  console.log('🔌 Connecting to WebSocket:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('✅ WebSocket connected');
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
    onError?.('Ошибка соединения');
  };
  
  ws.onclose = () => {
    console.log('🔌 WebSocket closed');
  };
  
  return ws;
};

export default {
  createWebSession,
  getWebSessionStatus,
  linkWebSession,
  createSessionWebSocket
};
