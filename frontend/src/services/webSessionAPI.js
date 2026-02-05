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
 * Уведомить об отсканированном QR-коде (показ модального окна)
 * @param {string} sessionToken - токен сессии
 * @param {Object} userData - данные пользователя
 */
export const notifySessionScanned = async (sessionToken, userData) => {
  const backendUrl = getBackendURL();
  try {
    await fetch(`${backendUrl}/api/web-sessions/${sessionToken}/scanned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        telegram_id: userData.telegram_id,
        first_name: userData.first_name,
        photo_url: userData.photo_url
      })
    });
  } catch (e) {
    console.warn('Scanned notification failed:', e);
  }
};

/**
 * Уведомить об отклонении подключения
 * @param {string} sessionToken - токен сессии
 */
export const notifySessionRejected = async (sessionToken) => {
  const backendUrl = getBackendURL();
  try {
    await fetch(`${backendUrl}/api/web-sessions/${sessionToken}/rejected`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    console.warn('Rejected notification failed:', e);
  }
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
        case 'scanned':
          console.log('📱 Session scanned, waiting for confirmation...');
          onScanned?.(data.data);
          break;
        case 'linked':
          console.log('✅ Session linked!', data.data);
          onLinked?.(data.data);
          break;
        case 'rejected':
          console.log('❌ Session rejected by user');
          onRejected?.();
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
  const url = `${backendUrl}/api/web-sessions/${sessionToken}?telegram_id=${telegramId}`;
  
  console.log('🗑️ revokeDevice request:', { url, sessionToken, telegramId });
  
  const response = await fetch(url, {
    method: 'DELETE'
  });
  
  console.log('🗑️ revokeDevice response status:', response.status, response.statusText);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('🗑️ revokeDevice error response:', errorText);
    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = { detail: errorText };
    }
    throw new Error(error.detail || 'Failed to revoke device');
  }
  
  const result = await response.json();
  console.log('🗑️ revokeDevice success:', result);
  return result;
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
 * Отправить heartbeat для сессии и проверить её валидность
 * @param {string} sessionToken - токен сессии
 * @returns {Promise<{valid: boolean}>} - валидна ли сессия
 */
export const sendHeartbeat = async (sessionToken) => {
  const backendUrl = getBackendURL();
  try {
    const response = await fetch(`${backendUrl}/api/web-sessions/${sessionToken}/heartbeat`, {
      method: 'POST'
    });
    
    // Сохраняем статус до любых операций с response
    const status = response.status;
    
    // Если 404 - сессия не найдена (удалена)
    if (status === 404) {
      console.log('🔌 Heartbeat: session not found (404)');
      return { valid: false, reason: 'not_found' };
    }
    
    // Если другая ошибка
    if (status >= 400) {
      console.log('🔌 Heartbeat: error status', status);
      return { valid: false, reason: 'error' };
    }
    
    return { valid: true };
  } catch (e) {
    // При сетевой ошибке "Response body is already used" от rrweb - 
    // проверяем есть ли сессия в localStorage
    if (e.message?.includes('Response body is already used')) {
      console.warn('Heartbeat: Response already used, checking localStorage...');
      const sessionExists = localStorage.getItem('session_token') === sessionToken;
      // Делаем дополнительную проверку через простой HEAD запрос
      try {
        const checkResp = await fetch(`${backendUrl}/api/web-sessions/${sessionToken}/status`, {
          method: 'HEAD'
        });
        if (checkResp.status === 404) {
          console.log('🔌 Session confirmed deleted via HEAD check');
          return { valid: false, reason: 'not_found' };
        }
      } catch {
        // Игнорируем ошибки вторичной проверки
      }
    }
    console.warn('Heartbeat failed:', e.message);
    return { valid: true }; // При других сетевых ошибках считаем сессию валидной
  }
};

/**
 * Создать WebSocket соединение для мониторинга текущей сессии (revoked, etc)
 * С автоматическим fallback на HTTP polling при ошибке WebSocket
 * @param {string} sessionToken - токен сессии
 * @param {Object} callbacks - колбэки событий
 * @returns {Object} - объект с методом close()
 */
export const createSessionMonitorWebSocket = (sessionToken, { onRevoked, onError }) => {
  const backendUrl = getBackendURL();
  const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
  const wsHost = backendUrl.replace(/^https?:\/\//, '');
  const wsUrl = `${wsProtocol}://${wsHost}/api/ws/session/${sessionToken}`;
  
  console.log('🔌 Connecting monitor WebSocket:', wsUrl);
  
  let isClosed = false;
  let pollingInterval = null;
  let wsConnected = false;
  
  // HTTP polling fallback - проверяем статус сессии
  const startPolling = () => {
    if (pollingInterval) return;
    
    console.log('🔄 Starting HTTP polling fallback for session monitoring...');
    
    pollingInterval = setInterval(async () => {
      if (isClosed) {
        clearInterval(pollingInterval);
        return;
      }
      
      try {
        const response = await fetch(`${backendUrl}/api/web-sessions/${sessionToken}/status`);
        
        // Сохраняем статус сразу
        const status = response.status;
        
        // Если 404 - сессия удалена (revoked)
        if (status === 404) {
          console.log('🔌 Session not found (revoked) via polling - status 404');
          clearInterval(pollingInterval);
          pollingInterval = null;
          onRevoked?.();
          return;
        }
        
        // Если другая ошибка - пропускаем
        if (status >= 400) {
          console.log('🔌 Session polling error status:', status);
          return;
        }
        
        // Пытаемся прочитать JSON только для успешных ответов
        try {
          const data = await response.json();
          
          // Проверяем статус сессии
          if (data.status === 'expired' || data.status === 'revoked') {
            console.log('🔌 Session revoked/expired via polling - status:', data.status);
            clearInterval(pollingInterval);
            pollingInterval = null;
            onRevoked?.();
          }
        } catch (jsonErr) {
          // Игнорируем ошибки парсинга JSON
          console.warn('📡 Session polling JSON parse error:', jsonErr.message);
        }
      } catch (err) {
        // Обрабатываем ошибку "Response body is already used"
        if (err.message?.includes('Response body is already used') || err.message?.includes('clone')) {
          console.warn('📡 Session polling: Response already used, doing HEAD check...');
          // Делаем HEAD запрос для проверки существования сессии
          try {
            const headResp = await fetch(`${backendUrl}/api/web-sessions/${sessionToken}/status`, {
              method: 'HEAD'
            });
            if (headResp.status === 404) {
              console.log('🔌 Session confirmed deleted via HEAD check');
              clearInterval(pollingInterval);
              pollingInterval = null;
              onRevoked?.();
              return;
            }
          } catch {
            // Игнорируем ошибки HEAD запроса
          }
        } else {
          console.warn('📡 Session monitor polling error:', err.message);
        }
        // Продолжаем polling при сетевых ошибках
      }
    }, 5000); // Проверяем каждые 5 секунд для быстрой реакции
  };
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('✅ Session monitor WebSocket connected');
    wsConnected = true;
  };
  
  ws.onmessage = (event) => {
    try {
      if (event.data === 'ping') {
        ws.send('pong');
        return;
      }
      
      const data = JSON.parse(event.data);
      console.log('📨 Monitor WebSocket message:', data);
      
      if (data.event === 'revoked') {
        console.log('🔌 Session revoked!');
        onRevoked?.();
      } else if (data.event === 'error') {
        onError?.(data.message);
      }
    } catch (e) {
      console.log('📨 Monitor WebSocket raw message:', event.data);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ Monitor WebSocket error:', error);
    // Если WebSocket не подключился - переключаемся на polling
    if (!wsConnected && !pollingInterval && !isClosed) {
      startPolling();
    }
  };
  
  ws.onclose = (event) => {
    console.log('🔌 Monitor WebSocket closed, code:', event.code);
    // Если WebSocket закрылся до подключения или неожиданно - переключаемся на polling
    if (!wsConnected && !pollingInterval && !isClosed) {
      startPolling();
    } else if (wsConnected && !isClosed && !pollingInterval) {
      // WebSocket был подключен, но закрылся - переключаемся на polling
      console.log('⚠️ WebSocket disconnected, switching to polling...');
      startPolling();
    }
  };
  
  // Таймаут для переключения на polling если WebSocket не подключается
  setTimeout(() => {
    if (!wsConnected && !pollingInterval && !isClosed) {
      console.log('⚠️ WebSocket connection timeout, switching to HTTP polling...');
      startPolling();
    }
  }, 5000); // 5 секунд таймаут
  
  return {
    close: () => {
      isClosed = true;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
  };
};

export default {
  createWebSession,
  getWebSessionStatus,
  linkWebSession,
  notifySessionScanned,
  notifySessionRejected,
  createSessionWebSocket,
  createSessionMonitorWebSocket,
  getUserDevices,
  revokeDevice,
  revokeAllDevices,
  sendHeartbeat
};
