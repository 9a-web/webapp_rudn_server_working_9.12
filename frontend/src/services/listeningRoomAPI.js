/**
 * API для совместного прослушивания музыки (Listening Rooms)
 * 
 * Улучшения v2:
 * - Поддержка queue (очередь треков)
 * - Поддержка history (история прослушивания)
 * - initiated_by (кто включил трек)
 * - Retry логика для HTTP запросов
 * - Улучшенный polling с адаптивным интервалом
 */

import { getBackendURL } from './api';

// Retry wrapper для HTTP запросов
const fetchWithRetry = async (url, options = {}, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && response.status >= 500 && i < retries - 1) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
};

/**
 * Создать комнату совместного прослушивания
 */
export const createListeningRoom = async (userData, roomName = 'Совместное прослушивание', controlMode = 'everyone') => {
  const backendUrl = getBackendURL();
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms`, {
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
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/${roomId}?telegram_id=${telegramId}`);
  
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
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/join/${inviteCode}`, {
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
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/${roomId}/leave?telegram_id=${telegramId}`, {
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
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/${roomId}?telegram_id=${telegramId}`, {
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
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/${roomId}/settings?telegram_id=${telegramId}`, {
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
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/user/${telegramId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get rooms');
  }
  
  return response.json();
};

/**
 * Получить состояние комнаты (HTTP polling)
 */
export const getListeningRoomState = async (roomId) => {
  const backendUrl = getBackendURL();
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/${roomId}/state`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get room state');
  }
  
  return response.json();
};

/**
 * Получить очередь треков комнаты
 */
export const getListeningRoomQueue = async (roomId, telegramId) => {
  const backendUrl = getBackendURL();
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/${roomId}/queue?telegram_id=${telegramId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get queue');
  }
  
  return response.json();
};

/**
 * Получить историю прослушивания комнаты
 */
export const getListeningRoomHistory = async (roomId, telegramId, limit = 20) => {
  const backendUrl = getBackendURL();
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/${roomId}/history?telegram_id=${telegramId}&limit=${limit}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get history');
  }
  
  return response.json();
};

/**
 * Добавить трек в очередь (HTTP)
 */
export const addToListeningRoomQueue = async (roomId, telegramId, track) => {
  const backendUrl = getBackendURL();
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/${roomId}/queue/add?telegram_id=${telegramId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(track)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to add to queue');
  }
  
  return response.json();
};

/**
 * Синхронизировать состояние комнаты через HTTP
 */
export const syncListeningRoomState = async (roomId, telegramId, event, track = null, position = 0) => {
  const backendUrl = getBackendURL();
  const params = new URLSearchParams({
    telegram_id: telegramId.toString(),
    event,
    position: position.toString()
  });
  
  const response = await fetchWithRetry(`${backendUrl}/api/music/rooms/${roomId}/sync?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: track ? JSON.stringify(track) : '{}'
  }, 2, 500); // Меньше retry для sync
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to sync state');
  }
  
  return response.json();
};

/**
 * Создать HTTP polling соединение для комнаты (fallback для WebSocket)
 * Улучшено: адаптивный интервал polling, лучшая обработка ошибок
 */
export const createListeningRoomPolling = (roomId, telegramId, handlers) => {
  let pollInterval = null;
  let lastState = null;
  let isStopped = false;
  let consecutiveErrors = 0;
  let currentInterval = 1000; // Начинаем с 1 секунды
  const maxInterval = 5000; // Максимум 5 секунд
  const minInterval = 500; // Минимум 500мс при активном воспроизведении
  
  console.log('🔄 Starting HTTP polling for listening room:', roomId);
  
  const poll = async () => {
    if (isStopped) return;
    
    try {
      const state = await getListeningRoomState(roomId);
      consecutiveErrors = 0; // Сбрасываем счётчик ошибок
      
      // Адаптивный интервал: быстрее при воспроизведении
      currentInterval = state.is_playing ? minInterval : 2000;
      
      // Сравниваем с предыдущим состоянием
      if (lastState) {
        // Проверяем смену трека
        if (state.current_track?.id !== lastState.current_track?.id) {
          handlers.onTrackChange?.(state.current_track, state.initiated_by, state.initiated_by_name);
        }
        // Проверяем изменения play/pause
        else if (state.is_playing !== lastState.is_playing) {
          if (state.is_playing) {
            handlers.onPlay?.(state.current_track, state.position, state.initiated_by, state.initiated_by_name);
          } else {
            handlers.onPause?.(state.position, state.initiated_by);
          }
        }
        // Проверяем рассинхронизацию позиции (если разница > 5 секунд)
        else if (state.is_playing && state.current_track?.id === lastState.current_track?.id) {
          const expectedPosition = lastState.position + (currentInterval / 1000);
          const positionDiff = Math.abs(state.position - expectedPosition);
          // Учитываем drift + сетевую задержку
          if (positionDiff > 5) {
            console.log('🔄 Position drift detected:', positionDiff.toFixed(1), 'sec, syncing...');
            handlers.onSeek?.(state.position, null);
          }
        }
      } else {
        // Первая синхронизация
        handlers.onStateSync?.(state, true);
      }
      
      lastState = state;
      
      // Перезапускаем с новым интервалом
      if (!isStopped) {
        pollInterval = setTimeout(poll, currentInterval);
      }
    } catch (error) {
      console.error('Polling error:', error);
      consecutiveErrors++;
      
      if (error.message.includes('не найдена') || error.message.includes('404')) {
        handlers.onRoomClosed?.('Комната закрыта');
        isStopped = true;
        return;
      }
      
      // Экспоненциальный backoff при ошибках
      if (consecutiveErrors > 5) {
        handlers.onError?.('Ошибка соединения с сервером');
        isStopped = true;
        return;
      }
      
      const backoffDelay = Math.min(1000 * Math.pow(2, consecutiveErrors), maxInterval);
      if (!isStopped) {
        pollInterval = setTimeout(poll, backoffDelay);
      }
    }
  };
  
  // Первый запрос сразу
  poll();
  handlers.onConnected?.();
  
  return {
    sendPlay: async (track, position = 0) => {
      try {
        await syncListeningRoomState(roomId, telegramId, 'play', track, position);
      } catch (e) {
        console.error('Failed to sync play:', e);
      }
    },
    
    sendPause: async (position = 0) => {
      try {
        await syncListeningRoomState(roomId, telegramId, 'pause', null, position);
      } catch (e) {
        console.error('Failed to sync pause:', e);
      }
    },
    
    sendSeek: async (position) => {
      try {
        await syncListeningRoomState(roomId, telegramId, 'seek', null, position);
      } catch (e) {
        console.error('Failed to sync seek:', e);
      }
    },
    
    sendTrackChange: async (track) => {
      try {
        await syncListeningRoomState(roomId, telegramId, 'track_change', track, 0);
      } catch (e) {
        console.error('Failed to sync track change:', e);
      }
    },
    
    sendQueueAdd: async (track) => {
      try {
        await addToListeningRoomQueue(roomId, telegramId, track);
      } catch (e) {
        console.error('Failed to add to queue:', e);
      }
    },
    
    requestSync: poll,
    
    close: () => {
      isStopped = true;
      if (pollInterval) {
        clearTimeout(pollInterval);
        pollInterval = null;
      }
    },
    
    get readyState() {
      return isStopped ? 3 : 1; // CLOSED or OPEN
    }
  };
};

/**
 * Создать WebSocket соединение для комнаты
 * Улучшено: поддержка queue, history, initiated_by, triggered_by_name
 */
export const createListeningRoomWebSocket = (roomId, telegramId, handlers) => {
  const backendUrl = getBackendURL();
  
  // Формируем WebSocket URL
  let wsUrl;
  if (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
    wsUrl = `ws://localhost:8001/api/ws/listening-room/${roomId}/${telegramId}`;
  } else {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${wsProtocol}//${window.location.host}/api/ws/listening-room/${roomId}/${telegramId}`;
  }
  
  console.log('🎵 Connecting to listening room WebSocket:', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  let pingInterval = null;
  let isClosed = false;
  
  ws.onopen = () => {
    console.log('✅ Listening room WebSocket connected');
    handlers.onConnected?.();
    
    // Heartbeat каждые 25 секунд (меньше чем timeout сервера)
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'ping' }));
      }
    }, 25000);
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('🎵 Listening room message:', data.event, data.online_count !== undefined ? `(online: ${data.online_count})` : '');
      
      switch (data.event) {
        case 'connected':
          // Передаём все данные: state, can_control, online_count, queue, history
          handlers.onStateSync?.(data.state, data.can_control, data.online_count, data.queue, data.history);
          break;
        case 'play':
          handlers.onPlay?.(data.track, data.position, data.triggered_by, data.triggered_by_name);
          break;
        case 'pause':
          handlers.onPause?.(data.position, data.triggered_by, data.triggered_by_name);
          break;
        case 'seek':
          handlers.onSeek?.(data.position, data.triggered_by);
          break;
        case 'track_change':
          handlers.onTrackChange?.(data.track, data.triggered_by, data.triggered_by_name, data.from_queue);
          break;
        case 'sync_state':
          handlers.onStateSync?.(data.state, undefined, undefined, data.queue, data.history);
          break;
        case 'queue_updated':
          handlers.onQueueUpdated?.(data.queue, data.action, data.track, data.triggered_by, data.triggered_by_name);
          break;
        case 'user_joined':
          handlers.onUserJoined?.(data.user, data.participants_count, data.online_count);
          break;
        case 'user_connected':
          // Пользователь подключился к sync
          handlers.onOnlineCount?.(data.online_count);
          break;
        case 'user_left':
        case 'user_disconnected':
          handlers.onUserLeft?.(data.telegram_id, data.online_count);
          if (data.online_count !== undefined) {
            handlers.onOnlineCount?.(data.online_count);
          }
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
          // Heartbeat response - ничего не делаем
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
    handlers.onError?.('Ошибка подключения к комнате');
  };
  
  ws.onclose = (event) => {
    console.log('🔌 Listening room WebSocket closed:', event.code, event.reason);
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    if (!isClosed) {
      handlers.onDisconnected?.();
    }
  };
  
  return {
    sendPlay: (track, position = 0) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'play', track, position }));
      }
    },
    
    sendPause: (position = 0) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'pause', position }));
      }
    },
    
    sendSeek: (position) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'seek', position }));
      }
    },
    
    sendTrackChange: (track) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'track_change', track }));
      }
    },
    
    sendQueueAdd: (track) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'queue_add', track }));
      }
    },
    
    sendQueueRemove: (index) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'queue_remove', index }));
      }
    },
    
    sendQueueClear: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'queue_clear' }));
      }
    },
    
    sendQueuePlayNext: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'queue_play_next' }));
      }
    },
    
    requestSync: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'sync_request' }));
      }
    },
    
    close: () => {
      isClosed = true;
      if (pingInterval) clearInterval(pingInterval);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
    
    get readyState() {
      return ws.readyState;
    }
  };
};

/**
 * Создать соединение для комнаты (автоматически выбирает WebSocket или HTTP polling)
 */
export const createListeningRoomConnection = (roomId, telegramId, handlers) => {
  let wsConnection = null;
  let pollingConnection = null;
  let usePolling = false;
  let fallbackTimeout = null;
  
  const wrappedHandlers = {
    ...handlers,
    onConnected: () => {
      console.log('✅ Connection established (WebSocket)');
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
      }
      handlers.onConnected?.();
    },
    onError: (message) => {
      console.warn('⚠️ WebSocket error, may fall back to HTTP polling');
      if (!usePolling && wsConnection) {
        usePolling = true;
        try { wsConnection.close(); } catch (e) { /* ignore */ }
        
        pollingConnection = createListeningRoomPolling(roomId, telegramId, {
          ...handlers,
          onConnected: () => {
            console.log('✅ Connection established (HTTP polling)');
            handlers.onConnected?.();
          }
        });
      } else {
        handlers.onError?.(message);
      }
    }
  };
  
  wsConnection = createListeningRoomWebSocket(roomId, telegramId, wrappedHandlers);
  
  // Таймаут для переключения на polling (5 секунд)
  fallbackTimeout = setTimeout(() => {
    if (!usePolling && wsConnection.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocket timeout, falling back to HTTP polling');
      usePolling = true;
      try { wsConnection.close(); } catch (e) { /* ignore */ }
      
      pollingConnection = createListeningRoomPolling(roomId, telegramId, {
        ...handlers,
        onConnected: () => {
          console.log('✅ Connection established (HTTP polling fallback)');
          handlers.onConnected?.();
        }
      });
    }
  }, 5000);
  
  return {
    sendPlay: (track, position) => {
      if (usePolling && pollingConnection) {
        pollingConnection.sendPlay(track, position);
      } else {
        wsConnection.sendPlay(track, position);
      }
    },
    sendPause: (position) => {
      if (usePolling && pollingConnection) {
        pollingConnection.sendPause(position);
      } else {
        wsConnection.sendPause(position);
      }
    },
    sendSeek: (position) => {
      if (usePolling && pollingConnection) {
        pollingConnection.sendSeek(position);
      } else {
        wsConnection.sendSeek(position);
      }
    },
    sendTrackChange: (track) => {
      if (usePolling && pollingConnection) {
        pollingConnection.sendTrackChange(track);
      } else {
        wsConnection.sendTrackChange(track);
      }
    },
    sendQueueAdd: (track) => {
      if (usePolling && pollingConnection) {
        pollingConnection.sendQueueAdd?.(track);
      } else {
        wsConnection.sendQueueAdd(track);
      }
    },
    sendQueueRemove: (index) => {
      if (!usePolling) {
        wsConnection.sendQueueRemove(index);
      }
    },
    sendQueueClear: () => {
      if (!usePolling) {
        wsConnection.sendQueueClear();
      }
    },
    sendQueuePlayNext: () => {
      if (!usePolling) {
        wsConnection.sendQueuePlayNext();
      }
    },
    requestSync: () => {
      if (usePolling && pollingConnection) {
        pollingConnection.requestSync();
      } else {
        wsConnection.requestSync();
      }
    },
    close: () => {
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (pollingConnection) pollingConnection.close();
      if (wsConnection) wsConnection.close();
    },
    get readyState() {
      if (usePolling && pollingConnection) {
        return pollingConnection.readyState;
      }
      return wsConnection.readyState;
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
  getListeningRoomState,
  getListeningRoomQueue,
  getListeningRoomHistory,
  addToListeningRoomQueue,
  syncListeningRoomState,
  createListeningRoomPolling,
  createListeningRoomWebSocket,
  createListeningRoomConnection
};
