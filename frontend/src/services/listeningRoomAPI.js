/**
 * API для совместного прослушивания музыки (Listening Rooms)
 */

import { getBackendURL } from './api';

/**
 * Создать комнату совместного прослушивания
 */
export const createListeningRoom = async (userData, roomName = 'Совместное прослушивание', controlMode = 'everyone') => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/music/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegram_id: userData.telegram_id,
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      username: userData.username || '',
      photo_url: userData.photo_url || null,
      name: roomName,
      control_mode: controlMode
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create room');
  }
  
  return response.json();
};

/**
 * Получить информацию о комнате
 */
export const getListeningRoom = async (roomId, telegramId) => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/music/rooms/${roomId}?telegram_id=${telegramId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get room');
  }
  
  return response.json();
};

/**
 * Присоединиться к комнате по коду
 */
export const joinListeningRoom = async (inviteCode, userData) => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/music/rooms/join/${inviteCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      telegram_id: userData.telegram_id,
      first_name: userData.first_name || '',
      last_name: userData.last_name || '',
      username: userData.username || '',
      photo_url: userData.photo_url || null
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to join room');
  }
  
  return response.json();
};

/**
 * Выйти из комнаты
 */
export const leaveListeningRoom = async (roomId, telegramId) => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/music/rooms/${roomId}/leave?telegram_id=${telegramId}`, {
    method: 'POST'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to leave room');
  }
  
  return response.json();
};

/**
 * Удалить комнату (только для хоста)
 */
export const deleteListeningRoom = async (roomId, telegramId) => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/music/rooms/${roomId}?telegram_id=${telegramId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete room');
  }
  
  return response.json();
};

/**
 * Изменить настройки комнаты
 */
export const updateListeningRoomSettings = async (roomId, telegramId, settings) => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/music/rooms/${roomId}/settings?telegram_id=${telegramId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update settings');
  }
  
  return response.json();
};

/**
 * Получить активные комнаты пользователя
 */
export const getUserListeningRooms = async (telegramId) => {
  const backendUrl = getBackendURL();
  const response = await fetch(`${backendUrl}/api/music/rooms/user/${telegramId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get rooms');
  }
  
  return response.json();
};

/**
 * Создать WebSocket соединение для комнаты
 */
export const createListeningRoomWebSocket = (roomId, telegramId, handlers) => {
  const backendUrl = getBackendURL();
  
  // Формируем WebSocket URL
  // В production используем тот же хост, что и для HTTP
  let wsUrl;
  if (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
    // Локальная разработка
    wsUrl = `ws://localhost:8001/api/ws/listening-room/${roomId}/${telegramId}`;
  } else {
    // Production - используем wss и текущий домен
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${wsProtocol}//${window.location.host}/api/ws/listening-room/${roomId}/${telegramId}`;
  }
  
  console.log('🎵 Connecting to listening room WebSocket:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  let pingInterval = null;
  let isClosed = false;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  
  ws.onopen = () => {
    console.log('✅ Listening room WebSocket connected');
    reconnectAttempts = 0;
    handlers.onConnected?.();
    
    // Периодический ping для поддержания соединения
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'ping' }));
      }
    }, 30000);
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('🎵 Listening room message:', data.event);
      
      switch (data.event) {
        case 'connected':
          handlers.onStateSync?.(data.state, data.can_control);
          break;
        case 'play':
          handlers.onPlay?.(data.track, data.position, data.triggered_by);
          break;
        case 'pause':
          handlers.onPause?.(data.position, data.triggered_by);
          break;
        case 'seek':
          handlers.onSeek?.(data.position, data.triggered_by);
          break;
        case 'track_change':
          handlers.onTrackChange?.(data.track, data.triggered_by);
          break;
        case 'sync_state':
          handlers.onStateSync?.(data.state);
          break;
        case 'user_joined':
          handlers.onUserJoined?.(data.user);
          break;
        case 'user_left':
        case 'user_disconnected':
          handlers.onUserLeft?.(data.telegram_id);
          break;
        case 'settings_changed':
          handlers.onSettingsChanged?.(data.settings);
          break;
        case 'room_closed':
          handlers.onRoomClosed?.(data.message);
          break;
        case 'error':
          handlers.onError?.(data.message);
          break;
        case 'pong':
          // Ignore pong
          break;
        default:
          console.log('Unknown listening room event:', data.event);
      }
    } catch (e) {
      console.warn('Failed to parse listening room message:', e);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ Listening room WebSocket error:', error);
    handlers.onError?.('WebSocket connection error');
  };
  
  ws.onclose = (event) => {
    console.log('🔌 Listening room WebSocket closed:', event.code);
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    if (!isClosed) {
      handlers.onDisconnected?.();
    }
  };
  
  return {
    // Отправить событие воспроизведения
    sendPlay: (track, position = 0) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          event: 'play',
          track,
          position
        }));
      }
    },
    
    // Отправить событие паузы
    sendPause: (position = 0) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          event: 'pause',
          position
        }));
      }
    },
    
    // Отправить событие перемотки
    sendSeek: (position) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          event: 'seek',
          position
        }));
      }
    },
    
    // Отправить событие смены трека
    sendTrackChange: (track) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          event: 'track_change',
          track
        }));
      }
    },
    
    // Запросить синхронизацию состояния
    requestSync: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'sync_request' }));
      }
    },
    
    // Закрыть соединение
    close: () => {
      isClosed = true;
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
    
    get readyState() {
      return ws.readyState;
    }
  };
};

export default {
  createListeningRoom,
  getListeningRoom,
  joinListeningRoom,
  leaveListeningRoom,
  deleteListeningRoom,
  updateListeningRoomSettings,
  getUserListeningRooms,
  createListeningRoomWebSocket
};
