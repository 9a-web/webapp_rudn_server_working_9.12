/**
 * ListeningRoomModal - Модальное окно совместного прослушивания музыки
 * 
 * Улучшения v2:
 * - Исправлен race condition при создании комнаты
 * - Исправлены memory leaks в reconnect
 * - Улучшена логика определения seek
 * - Добавлена очередь треков
 * - Добавлена история прослушивания
 * - Добавлен индикатор "сейчас играет" с именем
 * - Улучшен UX при потере соединения
 * - Добавлен QR-код для приглашения
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, Copy, Check, Share2, Crown, 
  Settings, UserPlus, LogOut, Trash2,
  Play, Pause, Music, Radio, QrCode, ScanLine,
  ChevronRight, ChevronLeft, Loader2, Volume2,
  ListMusic, History, Plus, SkipForward, Clock,
  Wifi, WifiOff, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTelegram } from '../../contexts/TelegramContext';
import { usePlayer } from './PlayerContext';
import { isSameUser } from '../../utils/userIdentity';
import {
  createListeningRoom,
  joinListeningRoom,
  leaveListeningRoom,
  deleteListeningRoom,
  getUserListeningRooms,
  updateListeningRoomSettings,
  createListeningRoomConnection,
  getListeningRoomPreview
} from '../../services/listeningRoomAPI';
import { fetchBotInfo } from '../../utils/botInfo';

const ListeningRoomModal = ({ isOpen, onClose, telegramId, onActiveRoomChange, pendingInviteCode, onInviteHandled }) => {
  const { hapticFeedback, user } = useTelegram();
  const { 
    currentTrack, isPlaying, progress, play, pause, seek,
    enterListeningRoomMode, exitListeningRoomMode, updateListeningRoomQueue
  } = usePlayer();
  
  const [view, setView] = useState('main'); // main, create, join, room
  const [subView, setSubView] = useState('info'); // info, queue, history (внутри room)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [botUsername, setBotUsername] = useState('bot');

  // Получаем username бота из API (зависит от ENV)
  useEffect(() => {
    fetchBotInfo().then(info => setBotUsername(info.username));
  }, []);
  
  // Состояние комнат
  const [myRooms, setMyRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [canControl, setCanControl] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  
  // Новые состояния для очереди и истории
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [initiatedBy, setInitiatedBy] = useState(null);
  const [initiatedByName, setInitiatedByName] = useState('');
  
  // Уведомляем родительский компонент об активной комнате
  useEffect(() => {
    onActiveRoomChange?.(isConnected ? currentRoom : null);
  }, [currentRoom, isConnected, onActiveRoomChange]);
  
  // Состояние создания комнаты
  const [roomName, setRoomName] = useState('Совместное прослушивание');
  const [controlMode, setControlMode] = useState('everyone');
  
  // Состояние присоединения
  const [inviteCode, setInviteCode] = useState('');
  
  // Состояние модалки подтверждения QR-подключения
  const [qrJoinConfirm, setQrJoinConfirm] = useState({
    isOpen: false,
    inviteCode: null,
    roomData: null,
    loading: false
  });
  
  // WebSocket и синхронизация
  const wsRef = useRef(null);
  const ignoreUntilRef = useRef(0);
  const lastRemoteEventRef = useRef(0);
  const prevProgressRef = useRef(0);
  const seekDebounceRef = useRef(null);
  const lastSeekTimeRef = useRef(0);
  const isMountedRef = useRef(true); // Отслеживание монтирования
  
  // Reconnect логика
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 10;
  const shouldReconnectRef = useRef(false);
  const currentRoomIdRef = useRef(null);
  
  // Ref для callback в плеере (обновляется позже)
  const playNextCallbackRef = useRef(null);
  
  // Cleanup при размонтировании
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      shouldReconnectRef.current = false;
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);
  
  // Загрузка комнат пользователя
  const loadMyRooms = useCallback(async () => {
    if (!telegramId) return;
    
    try {
      const result = await getUserListeningRooms(telegramId);
      if (isMountedRef.current) {
        setMyRooms(result.rooms || []);
      }
    } catch (err) {
      console.error('Failed to load rooms:', err);
    }
  }, [telegramId]);
  
  useEffect(() => {
    if (isOpen && telegramId) {
      loadMyRooms();
      if (currentRoom && wsRef.current) {
        setView('room');
      }
    }
  }, [isOpen, telegramId, loadMyRooms, currentRoom]);
  
  // Авто-присоединение по invite_code из чата
  const pendingInviteProcessedRef = useRef(null);
  useEffect(() => {
    if (!isOpen || !telegramId || !user || !pendingInviteCode) return;
    // Не обрабатываем повторно тот же код
    if (pendingInviteProcessedRef.current === pendingInviteCode) return;
    pendingInviteProcessedRef.current = pendingInviteCode;
    
    const autoJoin = async () => {
      setLoading(true);
      setError(null);
      setView('main'); // Показываем main с loading пока идёт подключение
      try {
        const result = await joinListeningRoom(pendingInviteCode.trim(), {
          telegram_id: telegramId,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          username: user.username || '',
          photo_url: user.photo_url || null
        });
        
        if (result.success && result.room) {
          hapticFeedback?.('notification', 'success');
          // Открываем комнату
          const room = {
            ...result.room,
            is_host: result.room.host_id === telegramId,
            online_count: result.room.online_count || 0
          };
          setCurrentRoom(room);
          setIsConnected(false);
          setConnectionStatus('disconnected');
          setOnlineCount(room.online_count || 0);
          setQueue(room.queue || []);
          setHistory(room.history || []);
          setSubView('info');
          setView('room');
          
          // Подключаемся к WebSocket
          await new Promise(resolve => setTimeout(resolve, 100));
          if (isMountedRef.current) {
            shouldReconnectRef.current = true;
            currentRoomIdRef.current = room.id;
            reconnectAttemptRef.current = 0;
            setConnectionStatus('connecting');
            wsRef.current = createListeningRoomConnection(room.id, telegramId, createSyncHandlers(room.id));
          }
        } else {
          setError(result.message || 'Не удалось присоединиться к комнате');
          hapticFeedback?.('notification', 'error');
        }
      } catch (err) {
        console.error('Auto-join room error:', err);
        setError(err.message || 'Ошибка присоединения');
        hapticFeedback?.('notification', 'error');
      } finally {
        setLoading(false);
        onInviteHandled?.();
      }
    };
    
    autoJoin();
  }, [isOpen, telegramId, user, pendingInviteCode, onInviteHandled]);

  // Открыть комнату для просмотра
  const openRoom = useCallback((room) => {
    setCurrentRoom(room);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setOnlineCount(room.online_count || 0);
    setQueue(room.queue || []);
    setHistory(room.history || []);
    setSubView('info');
    setView('room');
  }, []);
  
  // Polling для обновления информации о комнате (когда не подключён к WebSocket)
  useEffect(() => {
    if (!currentRoom || isConnected || view !== 'room') {
      return;
    }
    
    const pollRoomInfo = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL}/api/music/rooms/${currentRoom.id}?telegram_id=${telegramId}`
        );
        if (response.ok) {
          const data = await response.json();
          if (isMountedRef.current) {
            // online_count теперь приходит напрямую из response
            setOnlineCount(data.online_count || 0);
            
            if (data.room) {
              setCurrentRoom(prev => prev ? {
                ...prev,
                participants: data.room.participants || prev.participants,
                participants_count: data.room.participants?.length || prev.participants_count,
                queue: data.room.queue || prev.queue,
                state: data.room.state || prev.state
              } : prev);
              if (data.room.queue) {
                setQueue(data.room.queue);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Room info polling error:', err);
      }
    };
    
    // Первый запрос сразу
    pollRoomInfo();
    
    // Polling каждые 3 секунды
    const interval = setInterval(pollRoomInfo, 3000);
    
    return () => clearInterval(interval);
  }, [currentRoom?.id, isConnected, view, telegramId]);
  
  // Создаём handlers для WebSocket
  const createSyncHandlers = useCallback((roomId) => ({
    onConnected: () => {
      if (!isMountedRef.current) return;
      console.log('✅ Connected to listening room sync');
      setIsConnected(true);
      setConnectionStatus('connected');
      reconnectAttemptRef.current = 0;
      hapticFeedback?.('notification', 'success');
      
      // Активируем режим listening room в плеере
      enterListeningRoomMode(queue, {
        playNextFromQueue: () => playNextCallbackRef.current?.()
      });
    },
    onStateSync: (state, canCtrl, onlineCountFromServer, queueFromServer, historyFromServer) => {
      if (!isMountedRef.current) return;
      
      if (canCtrl !== undefined) {
        setCanControl(canCtrl);
      }
      if (onlineCountFromServer !== undefined) {
        setOnlineCount(onlineCountFromServer);
      }
      if (queueFromServer) {
        setQueue(queueFromServer);
        updateListeningRoomQueue(queueFromServer);
      }
      if (historyFromServer) {
        setHistory(historyFromServer);
      }
      
      // Обновляем initiated_by
      if (state?.initiated_by) {
        setInitiatedBy(state.initiated_by);
        setInitiatedByName(state.initiated_by_name || '');
      }
      
      // Синхронизируем состояние плеера (ТИХАЯ синхронизация - не отправляем события)
      if (state && state.current_track) {
        console.log('📥 Initial sync:', state.current_track.title, 'playing:', state.is_playing, 'position:', state.position);
        // Устанавливаем ignore на 3 секунды для полной синхронизации без отправки событий
        ignoreUntilRef.current = Date.now() + 3000;
        lastSeekTimeRef.current = Date.now();
        lastRemoteEventRef.current = Date.now();
        
        play(state.current_track, [state.current_track]);
        
        // Seek к актуальной позиции после небольшой задержки
        if (state.position > 0) {
          setTimeout(() => {
            if (isMountedRef.current) {
              seek(state.position);
            }
          }, 200);
        }
        
        // Если на паузе - ставим на паузу
        if (!state.is_playing) {
          setTimeout(() => {
            if (isMountedRef.current) {
              pause();
            }
          }, 300);
        }
      } else {
        // Нет текущего трека — автоматически запускаем первый трек из очереди
        const availableQueue = queueFromServer || [];
        if (availableQueue.length > 0 && canCtrl !== false) {
          const firstTrack = availableQueue[0];
          console.log('🎵 Auto-playing first track from queue:', firstTrack.title);
          ignoreUntilRef.current = Date.now() + 2000;
          lastRemoteEventRef.current = Date.now();
          lastSeekTimeRef.current = Date.now();
          
          setTimeout(() => {
            if (isMountedRef.current) {
              play(firstTrack, [firstTrack]);
            }
          }, 500);
        }
      }
    },
    onPlay: (track, position, triggeredBy, triggeredByName) => {
      if (!isMountedRef.current) return;
      if (triggeredBy === telegramId) {
        console.log('🔇 Ignoring own play event');
        return;
      }
      
      console.log('🎵 Remote play:', track?.title, 'from:', triggeredByName || triggeredBy);
      ignoreUntilRef.current = Date.now() + 1000;
      lastRemoteEventRef.current = Date.now();
      lastSeekTimeRef.current = Date.now();
      
      setInitiatedBy(triggeredBy);
      setInitiatedByName(triggeredByName || '');
      
      if (track) {
        play(track, [track]);
        if (position > 0) {
          setTimeout(() => {
            if (isMountedRef.current) seek(position);
          }, 150);
        }
      }
      hapticFeedback?.('impact', 'light');
    },
    onPause: (position, triggeredBy, triggeredByName) => {
      if (!isMountedRef.current) return;
      if (triggeredBy === telegramId) {
        console.log('🔇 Ignoring own pause event');
        return;
      }
      
      console.log('⏸️ Remote pause from:', triggeredByName || triggeredBy);
      ignoreUntilRef.current = Date.now() + 1000;
      lastRemoteEventRef.current = Date.now();
      pause();
      hapticFeedback?.('impact', 'light');
    },
    onSeek: (position, triggeredBy) => {
      if (!isMountedRef.current) return;
      if (triggeredBy === telegramId) return;
      console.log('⏩ Remote seek:', position);
      ignoreUntilRef.current = Date.now() + 1000;
      lastRemoteEventRef.current = Date.now();
      lastSeekTimeRef.current = Date.now();
      seek(position);
      hapticFeedback?.('impact', 'light');
    },
    onTrackChange: (track, triggeredBy, triggeredByName, fromQueue) => {
      if (!isMountedRef.current) return;
      if (triggeredBy === telegramId) {
        console.log('🔇 Ignoring own track change');
        return;
      }
      
      if (track) {
        console.log('🔄 Remote track change:', track.title, 'from:', triggeredByName || triggeredBy, fromQueue ? '(from queue)' : '');
        ignoreUntilRef.current = Date.now() + 1000;
        lastRemoteEventRef.current = Date.now();
        lastSeekTimeRef.current = Date.now();
        
        setInitiatedBy(triggeredBy);
        setInitiatedByName(triggeredByName || '');
        
        play(track, [track]);
        hapticFeedback?.('impact', 'medium');
      }
    },
    onQueueUpdated: (newQueue, action, track, triggeredBy, triggeredByName) => {
      if (!isMountedRef.current) return;
      console.log('📋 Queue updated:', action, newQueue?.length, 'tracks');
      setQueue(newQueue || []);
      
      // Синхронизируем очередь с плеером
      updateListeningRoomQueue(newQueue || []);
      
      if (action === 'add' && triggeredBy !== telegramId) {
        hapticFeedback?.('notification', 'success');
      }
    },
    onUserJoined: (newUser, participantsCount, onlineCountFromServer) => {
      if (!isMountedRef.current) return;
      console.log('👤 User joined room:', newUser?.first_name);
      if (onlineCountFromServer !== undefined) {
        setOnlineCount(onlineCountFromServer);
      }
      setCurrentRoom(prev => prev ? {
        ...prev,
        participants: [...(prev.participants || []), newUser],
        participants_count: participantsCount || (prev.participants_count || 0) + 1
      } : prev);
      hapticFeedback?.('notification', 'success');
    },
    onUserLeft: (leftUserId, onlineCountFromServer) => {
      if (!isMountedRef.current) return;
      console.log('👤 User disconnected:', leftUserId);
      if (onlineCountFromServer !== undefined) {
        setOnlineCount(onlineCountFromServer);
      } else {
        setOnlineCount(prev => Math.max(0, prev - 1));
      }
    },
    onOnlineCount: (count) => {
      if (!isMountedRef.current) return;
      console.log('📊 Online count updated:', count);
      setOnlineCount(count);
    },
    onSettingsChanged: (settings) => {
      if (!isMountedRef.current) return;
      console.log('⚙️ Settings changed:', settings);
      setCurrentRoom(prev => prev ? { ...prev, ...settings } : prev);
    },
    onRoomClosed: (message) => {
      if (!isMountedRef.current) return;
      console.log('🚪 Room closed:', message);
      shouldReconnectRef.current = false;
      hapticFeedback?.('notification', 'warning');
      setCurrentRoom(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setView('main');
      loadMyRooms();
    },
    onError: (message) => {
      if (!isMountedRef.current) return;
      console.error('❌ Room error:', message);
      setError(message);
      setConnectionStatus('error');
    },
    onDisconnected: () => {
      if (!isMountedRef.current) return;
      console.log('🔌 Disconnected from room');
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      if (shouldReconnectRef.current && currentRoomIdRef.current) {
        setConnectionStatus('connecting');
        attemptReconnect(roomId);
      }
    }
  }), [telegramId, play, pause, seek, hapticFeedback, loadMyRooms]);
  
  // Reconnect с exponential backoff
  const attemptReconnect = useCallback((roomId) => {
    if (!shouldReconnectRef.current || !isMountedRef.current) return;
    if (reconnectAttemptRef.current >= maxReconnectAttempts) {
      console.log('❌ Max reconnect attempts reached');
      if (isMountedRef.current) {
        setError('Не удалось восстановить соединение. Попробуйте переподключиться.');
        setConnectionStatus('error');
      }
      shouldReconnectRef.current = false;
      return;
    }
    
    reconnectAttemptRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current - 1), 30000);
    
    console.log(`🔄 Reconnect attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts} in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!shouldReconnectRef.current || !isMountedRef.current) return;
      
      console.log('🔄 Attempting reconnect...');
      
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) { /* ignore */ }
      }
      
      wsRef.current = createListeningRoomConnection(roomId, telegramId, createSyncHandlers(roomId));
    }, delay);
  }, [telegramId, createSyncHandlers]);
  
  // Подключиться к синхронизации
  const connectToSync = useCallback(() => {
    if (!currentRoom) return;
    
    setConnectionStatus('connecting');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) { /* ignore */ }
    }
    
    shouldReconnectRef.current = true;
    currentRoomIdRef.current = currentRoom.id;
    reconnectAttemptRef.current = 0;
    
    wsRef.current = createListeningRoomConnection(currentRoom.id, telegramId, createSyncHandlers(currentRoom.id));
  }, [currentRoom, telegramId, createSyncHandlers]);
  
  // Отключиться от синхронизации
  const disconnectFromSync = useCallback(() => {
    shouldReconnectRef.current = false;
    currentRoomIdRef.current = null;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) { /* ignore */ }
      wsRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
    
    // Отключаем режим listening room в плеере
    exitListeningRoomMode();
  }, [exitListeningRoomMode]);
  
  // Создание комнаты (ИСПРАВЛЕН race condition)
  const handleCreateRoom = async () => {
    if (!telegramId || !user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await createListeningRoom(
        {
          telegram_id: telegramId,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          photo_url: user.photo_url
        },
        roomName,
        controlMode
      );
      
      hapticFeedback?.('notification', 'success');
      
      const newRoom = {
        id: result.room_id,
        name: roomName,
        invite_code: result.invite_code,
        invite_link: result.invite_link,
        host_id: telegramId,
        is_host: true,
        participants_count: 1,
        online_count: 1,
        control_mode: controlMode,
        participants: [{
          telegram_id: telegramId,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username
        }],
        queue: [],
        history: []
      };
      
      setCurrentRoom(newRoom);
      setView('room');
      setSubView('info');
      setCanControl(true);
      setQueue([]);
      setHistory([]);
      
      // Подключаемся с небольшой задержкой после установки состояния
      // Используем Promise для гарантии последовательности
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (isMountedRef.current) {
        shouldReconnectRef.current = true;
        currentRoomIdRef.current = result.room_id;
        reconnectAttemptRef.current = 0;
        setConnectionStatus('connecting');
        
        wsRef.current = createListeningRoomConnection(result.room_id, telegramId, createSyncHandlers(result.room_id));
      }
      
    } catch (err) {
      console.error('Create room error:', err);
      if (isMountedRef.current) {
        setError(err.message);
      }
      hapticFeedback?.('notification', 'error');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Присоединение к комнате
  const handleJoinRoom = async () => {
    if (!telegramId || !user || !inviteCode.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await joinListeningRoom(inviteCode.trim(), {
        telegram_id: telegramId,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        photo_url: user.photo_url
      });
      
      if (result.success && result.room) {
        hapticFeedback?.('notification', 'success');
        openRoom({
          ...result.room,
          is_host: result.room.host_id === telegramId,
          online_count: result.room.online_count || 0
        });
      } else {
        setError(result.message || 'Не удалось присоединиться');
        hapticFeedback?.('notification', 'error');
      }
    } catch (err) {
      console.error('Join room error:', err);
      setError(err.message);
      hapticFeedback?.('notification', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // QR-сканирование для присоединения к комнате
  const handleScanQR = () => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp?.showScanQrPopup) {
      setError('QR-сканер недоступен');
      return;
    }
    
    hapticFeedback?.('impact', 'medium');
    
    webApp.showScanQrPopup(
      { text: 'Наведите камеру на QR-код комнаты' },
      async (scannedText) => {
        if (!scannedText) return;
        
        // Извлекаем invite_code из URL или текста
        const match = scannedText.match(/listen_([a-zA-Z0-9]+)/);
        if (!match) {
          // Пробуем как голый код (если просто набор символов)
          const cleanCode = scannedText.trim().toUpperCase();
          if (/^[A-Z0-9]{4,12}$/.test(cleanCode)) {
            webApp.closeScanQrPopup();
            hapticFeedback?.('notification', 'success');
            showQrJoinConfirm(cleanCode);
            return true;
          }
          return false; // не распознан — сканер остаётся открытым
        }
        
        const code = match[1];
        webApp.closeScanQrPopup();
        hapticFeedback?.('notification', 'success');
        showQrJoinConfirm(code);
        return true;
      }
    );
  };
  
  // Показать модалку подтверждения подключения
  const showQrJoinConfirm = async (code) => {
    setQrJoinConfirm({ isOpen: true, inviteCode: code, roomData: null, loading: true });
    
    try {
      const preview = await getListeningRoomPreview(code);
      setQrJoinConfirm(prev => ({
        ...prev,
        roomData: preview.found ? preview : null,
        loading: false
      }));
      if (!preview.found) {
        hapticFeedback?.('notification', 'error');
      }
    } catch (err) {
      console.error('Error loading room preview:', err);
      setQrJoinConfirm(prev => ({ ...prev, roomData: null, loading: false }));
      hapticFeedback?.('notification', 'error');
    }
  };
  
  // Подтвердить присоединение из QR-модалки
  const handleQrJoinConfirm = async () => {
    const code = qrJoinConfirm.inviteCode;
    setQrJoinConfirm({ isOpen: false, inviteCode: null, roomData: null, loading: false });
    
    if (!code || !telegramId || !user) return;
    
    setInviteCode(code);
    setLoading(true);
    setError(null);
    
    try {
      const result = await joinListeningRoom(code, {
        telegram_id: telegramId,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        username: user.username || '',
        photo_url: user.photo_url || null
      });
      
      if (result.success && result.room) {
        hapticFeedback?.('notification', 'success');
        openRoom({
          ...result.room,
          is_host: result.room.host_id === telegramId,
          online_count: result.room.online_count || 0
        });
      } else {
        setError(result.message || 'Не удалось присоединиться');
        hapticFeedback?.('notification', 'error');
      }
    } catch (err) {
      console.error('QR Join room error:', err);
      setError(err.message);
      hapticFeedback?.('notification', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleQrJoinCancel = () => {
    setQrJoinConfirm({ isOpen: false, inviteCode: null, roomData: null, loading: false });
  };
  
  // Выход из комнаты
  const handleLeaveRoom = async () => {
    if (!currentRoom) return;
    
    shouldReconnectRef.current = false;
    currentRoomIdRef.current = null;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    try {
      await leaveListeningRoom(currentRoom.id, telegramId);
      hapticFeedback?.('notification', 'success');
      
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) { /* ignore */ }
        wsRef.current = null;
      }
      
      // Отключаем режим listening room в плеере
      exitListeningRoomMode();
      
      setCurrentRoom(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setOnlineCount(0);
      setQueue([]);
      setHistory([]);
      setView('main');
      loadMyRooms();
    } catch (err) {
      console.error('Leave room error:', err);
      setError(err.message);
    }
  };
  
  // Свернуть комнату
  const handleMinimizeRoom = () => {
    setView('main');
    loadMyRooms();
  };
  
  // Добавить трек в очередь
  const handleAddToQueue = useCallback((track) => {
    if (!wsRef.current || !canControl) return;
    
    wsRef.current.sendQueueAdd(track);
    hapticFeedback?.('impact', 'light');
  }, [canControl, hapticFeedback]);
  
  // Удалить трек из очереди
  const handleRemoveFromQueue = useCallback((index) => {
    if (!wsRef.current || !canControl) return;
    
    wsRef.current.sendQueueRemove(index);
    hapticFeedback?.('impact', 'light');
  }, [canControl, hapticFeedback]);
  
  // Воспроизвести следующий из очереди
  const handlePlayNextFromQueue = useCallback(() => {
    if (!wsRef.current || !canControl || queue.length === 0) return;
    
    wsRef.current.sendQueuePlayNext();
    hapticFeedback?.('impact', 'medium');
  }, [canControl, queue.length, hapticFeedback]);
  
  // Обновляем ref при изменении callback
  useEffect(() => {
    playNextCallbackRef.current = handlePlayNextFromQueue;
  }, [handlePlayNextFromQueue]);
  
  // Копирование ссылки
  const handleCopyInvite = async () => {
    if (!currentRoom?.invite_code) return;
    
    const inviteLink = `https://t.me/${botUsername}/app?startapp=listen_${currentRoom.invite_code}`;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      hapticFeedback?.('notification', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };
  
  // Поделиться в Telegram
  const handleShare = () => {
    if (!currentRoom?.invite_code) return;
    
    const inviteLink = `https://t.me/${botUsername}/app?startapp=listen_${currentRoom.invite_code}`;
    const text = `🎵 Присоединяйся к совместному прослушиванию "${currentRoom.name}"!`;
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`);
    } else {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`, '_blank');
    }
    
    hapticFeedback?.('impact', 'medium');
  };
  
  // Отслеживание изменений воспроизведения
  const prevIsPlayingRef = useRef(isPlaying);
  const prevTrackIdRef = useRef(currentTrack?.id);
  
  // Отправка событий воспроизведения
  useEffect(() => {
    if (!wsRef.current || !currentRoom || !canControl || !isConnected) {
      // Всё равно обновляем refs чтобы не было ложных срабатываний позже
      prevIsPlayingRef.current = isPlaying;
      prevTrackIdRef.current = currentTrack?.id;
      return;
    }
    
    const playStateChanged = prevIsPlayingRef.current !== isPlaying;
    const trackChanged = prevTrackIdRef.current !== currentTrack?.id;
    
    // ВАЖНО: обновляем refs ПЕРЕД проверкой ignore
    // чтобы после истечения ignore не было ложного срабатывания
    prevIsPlayingRef.current = isPlaying;
    prevTrackIdRef.current = currentTrack?.id;
    
    // Если в режиме ignore - не отправляем события (тихая синхронизация)
    if (Date.now() < ignoreUntilRef.current) {
      console.log('🔇 Ignoring event (silent sync mode)');
      return;
    }
    
    if (!playStateChanged && !trackChanged) {
      return;
    }
    
    if (!currentTrack) {
      return;
    }
    
    const trackData = {
      id: currentTrack.id,
      title: currentTrack.title,
      artist: currentTrack.artist,
      duration: currentTrack.duration || 0,
      cover: currentTrack.cover,
      url: currentTrack.url
    };
    
    // Отправляем только track_change если трек изменился
    // play/pause отправляем только если трек НЕ изменился
    if (trackChanged) {
      console.log('📤 Sending track change:', trackData.title);
      wsRef.current.sendTrackChange(trackData);
    } else if (playStateChanged) {
      if (isPlaying) {
        console.log('📤 Sending play event');
        wsRef.current.sendPlay(trackData, progress);
      } else {
        console.log('📤 Sending pause event');
        wsRef.current.sendPause(progress);
      }
    }
  }, [isPlaying, currentTrack?.id, currentRoom, canControl, isConnected, progress]);
  
  // Периодическая синхронизация позиции
  useEffect(() => {
    if (!wsRef.current || !currentRoom || !canControl || !isPlaying || !currentTrack || !isConnected) {
      return;
    }
    
    const syncPosition = () => {
      if (Date.now() < ignoreUntilRef.current || !isMountedRef.current) return;
      
      const trackData = {
        id: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        duration: currentTrack.duration || 0,
        cover: currentTrack.cover,
        url: currentTrack.url
      };
      
      wsRef.current.sendPlay(trackData, progress);
    };
    
    const interval = setInterval(syncPosition, 5000);
    
    return () => clearInterval(interval);
  }, [isPlaying, currentRoom, canControl, currentTrack, progress, isConnected]);
  
  // Отслеживание seek (УЛУЧШЕННАЯ ЛОГИКА)
  useEffect(() => {
    if (!wsRef.current || !currentRoom || !canControl || !isConnected) {
      prevProgressRef.current = progress;
      return;
    }
    
    if (Date.now() < ignoreUntilRef.current) {
      prevProgressRef.current = progress;
      return;
    }
    
    // Защита от ложных срабатываний при буферизации
    const timeSinceLastSeek = Date.now() - lastSeekTimeRef.current;
    if (timeSinceLastSeek < 600) {
      prevProgressRef.current = progress;
      return;
    }
    
    const progressDiff = Math.abs(progress - prevProgressRef.current);
    
    // Перемотка: разница > 2.5 сек и < 5 минут (защита от некорректных значений)
    const isSeek = progressDiff > 2.5 && progressDiff < 300;
    
    if (isSeek && currentTrack) {
      console.log('📤 Detected seek:', prevProgressRef.current.toFixed(1), '->', progress.toFixed(1), 'diff:', progressDiff.toFixed(1));
      
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current);
      }
      
      seekDebounceRef.current = setTimeout(() => {
        if (wsRef.current && Date.now() >= ignoreUntilRef.current && isMountedRef.current) {
          console.log('📤 Sending seek event:', progress.toFixed(1));
          lastSeekTimeRef.current = Date.now();
          wsRef.current.sendSeek(progress);
        }
      }, 200);
    }
    
    prevProgressRef.current = progress;
  }, [progress, currentRoom, canControl, isConnected, currentTrack]);
  
  if (!isOpen) return null;
  
  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && onClose?.()}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-hidden"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#1C1C1E] px-4 py-4 border-b border-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {view !== 'main' && (
                  <button
                    onClick={() => {
                      if (view === 'room') {
                        handleMinimizeRoom();
                      } else {
                        setView('main');
                        setError(null);
                      }
                    }}
                    className="p-2 rounded-full bg-gray-800/50 text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <Radio className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {view === 'main' && 'Совместное прослушивание'}
                    {view === 'create' && 'Создать комнату'}
                    {view === 'join' && 'Присоединиться'}
                    {view === 'room' && (currentRoom?.name || 'Комната')}
                  </h2>
                  {view === 'room' && currentRoom && (
                    <div className="flex items-center gap-2 text-xs">
                      {connectionStatus === 'connected' ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <Wifi className="w-3 h-3" />
                          {onlineCount} онлайн
                        </span>
                      ) : connectionStatus === 'connecting' ? (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Подключение...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400">
                          <WifiOff className="w-3 h-3" />
                          Не подключен
                        </span>
                      )}
                      <span className="text-gray-500">/ {currentRoom.participants_count || 1} участников</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-gray-800/50 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-4">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
            
            {/* Main View */}
            {view === 'main' && (
              <div className="space-y-4">
                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setView('create')}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                  >
                    <div className="p-3 rounded-xl bg-purple-500/20">
                      <Music className="w-6 h-6 text-purple-400" />
                    </div>
                    <span className="text-white font-medium">Создать</span>
                    <span className="text-xs text-gray-400">Новая комната</span>
                  </button>
                  
                  <button
                    onClick={() => setView('join')}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 hover:border-blue-500/40 transition-all"
                  >
                    <div className="p-3 rounded-xl bg-blue-500/20">
                      <UserPlus className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-white font-medium">Войти</span>
                    <span className="text-xs text-gray-400">По коду</span>
                  </button>
                </div>
                
                {/* My Rooms */}
                {myRooms.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Мои комнаты</h3>
                    <div className="space-y-2">
                      {myRooms.map(room => (
                        <button
                          key={room.id}
                          onClick={() => openRoom(room)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors"
                        >
                          <div className={`p-2 rounded-lg ${room.is_playing ? 'bg-green-500/20' : 'bg-gray-700/50'}`}>
                            {room.is_playing ? (
                              <Volume2 className="w-5 h-5 text-green-400" />
                            ) : (
                              <Music className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{room.name}</span>
                              {room.is_host && (
                                <Crown className="w-4 h-4 text-yellow-400" />
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              <span className="text-green-400">{room.online_count || 0} онлайн</span>
                              <span className="text-gray-500"> / {room.participants_count} участник{room.participants_count === 1 ? '' : 'ов'}</span>
                              {room.current_track && ` • ${room.current_track.title}`}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Info */}
                <div className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/30">
                  <p className="text-sm text-gray-400">
                    🎵 Создайте комнату и пригласите друзей для совместного прослушивания музыки в реальном времени.
                    Когда один включает трек — он играет у всех!
                  </p>
                </div>
              </div>
            )}
            
            {/* Create View */}
            {view === 'create' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Название комнаты
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Совместное прослушивание"
                    className="w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Кто может управлять воспроизведением
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: 'everyone', label: 'Все участники', desc: 'Любой может включать и переключать треки' },
                      { id: 'host_only', label: 'Только я', desc: 'Только вы можете управлять воспроизведением' },
                    ].map(option => (
                      <button
                        key={option.id}
                        onClick={() => setControlMode(option.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          controlMode === option.id
                            ? 'bg-purple-500/10 border-purple-500/30'
                            : 'bg-gray-800/30 border-gray-700/30 hover:border-gray-600/50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          controlMode === option.id ? 'border-purple-500 bg-purple-500' : 'border-gray-600'
                        }`}>
                          {controlMode === option.id && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-white font-medium">{option.label}</p>
                          <p className="text-xs text-gray-400">{option.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={handleCreateRoom}
                  disabled={loading || !roomName.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Music className="w-5 h-5" />
                      Создать комнату
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* Join View */}
            {view === 'join' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Код комнаты
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="ABCD1234"
                    maxLength={8}
                    className="w-full px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 text-center text-xl tracking-widest font-mono"
                  />
                </div>
                
                <button
                  onClick={handleJoinRoom}
                  disabled={loading || inviteCode.length < 6}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Присоединиться
                    </>
                  )}
                </button>
                
                {/* Разделитель */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-700/50" />
                  <span className="text-xs text-gray-500">или</span>
                  <div className="flex-1 h-px bg-gray-700/50" />
                </div>
                
                {/* Кнопка QR-сканера */}
                {window.Telegram?.WebApp?.showScanQrPopup && (
                  <button
                    onClick={handleScanQR}
                    className="w-full py-3 rounded-xl bg-white/5 border border-gray-700/50 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition-all active:scale-[0.98]"
                  >
                    <ScanLine className="w-5 h-5 text-purple-400" />
                    Сканировать QR-код
                  </button>
                )}
                
                <p className="text-sm text-gray-400 text-center">
                  Введите код или отсканируйте QR-код комнаты
                </p>
              </div>
            )}
            
            {/* Room View */}
            {view === 'room' && currentRoom && (
              <div className="space-y-4">
                {/* Connection Status & Button */}
                <div className={`p-4 rounded-2xl ${isConnected 
                  ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30' 
                  : 'bg-gradient-to-br from-gray-700/30 to-gray-800/30 border border-gray-600/30'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <>
                          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-green-400 font-medium">Синхронизация активна</span>
                        </>
                      ) : connectionStatus === 'connecting' ? (
                        <>
                          <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
                          <span className="text-yellow-400 font-medium">Подключение...</span>
                        </>
                      ) : (
                        <>
                          <div className="w-3 h-3 rounded-full bg-gray-500" />
                          <span className="text-gray-400 font-medium">Не подключен</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                      <Users className="w-3 h-3" />
                      {onlineCount} онлайн
                    </div>
                  </div>
                  
                  {!isConnected ? (
                    <button
                      onClick={connectToSync}
                      disabled={connectionStatus === 'connecting'}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
                    >
                      {connectionStatus === 'connecting' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Radio className="w-5 h-5" />
                      )}
                      Подключиться
                    </button>
                  ) : (
                    <button
                      onClick={disconnectFromSync}
                      className="w-full py-2.5 rounded-xl bg-gray-700/50 text-gray-300 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Отключиться от синхронизации
                    </button>
                  )}
                </div>
                
                {/* Current Track with "Initiated By" */}
                {currentTrack && isConnected && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gray-800 overflow-hidden flex-shrink-0">
                        {currentTrack.cover ? (
                          <img src={currentTrack.cover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-pink-500/30">
                            <Music className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{currentTrack.title}</p>
                        <p className="text-sm text-gray-400 truncate">{currentTrack.artist}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {isPlaying ? (
                            <div className="flex items-center gap-1 text-green-400 text-xs">
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                              Играет
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                              <Pause className="w-3 h-3" />
                              Пауза
                            </div>
                          )}
                          {initiatedByName && (
                            <span className="text-xs text-gray-500">
                              • включил {initiatedByName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {!currentTrack && isConnected && (
                  <div className="p-6 rounded-2xl bg-gray-800/30 border border-gray-700/30 text-center">
                    <Music className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Выберите трек для прослушивания</p>
                    {canControl && (
                      <p className="text-xs text-gray-500 mt-1">
                        Перейдите в раздел Музыка и включите любой трек
                      </p>
                    )}
                  </div>
                )}
                
                {/* Sub-navigation tabs (Queue, History) */}
                {isConnected && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSubView('info')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        subView === 'info' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800/50 text-gray-400 hover:text-white'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      Участники
                    </button>
                    <button
                      onClick={() => setSubView('queue')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        subView === 'queue' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800/50 text-gray-400 hover:text-white'
                      }`}
                    >
                      <ListMusic className="w-4 h-4" />
                      Очередь {queue.length > 0 && `(${queue.length})`}
                    </button>
                    <button
                      onClick={() => setSubView('history')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        subView === 'history' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800/50 text-gray-400 hover:text-white'
                      }`}
                    >
                      <History className="w-4 h-4" />
                      История
                    </button>
                  </div>
                )}
                
                {/* Queue Sub-view */}
                {isConnected && subView === 'queue' && (
                  <div className="space-y-2">
                    {queue.length > 0 ? (
                      <>
                        {canControl && (
                          <button
                            onClick={handlePlayNextFromQueue}
                            className="w-full py-2 px-3 rounded-xl bg-green-500/10 text-green-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-green-500/20 transition-colors"
                          >
                            <SkipForward className="w-4 h-4" />
                            Воспроизвести следующий
                          </button>
                        )}
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {queue.map((track, index) => (
                            <div
                              key={`${track.id}-${index}`}
                              className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/30 group"
                            >
                              <span className="w-6 text-center text-xs text-gray-500">{index + 1}</span>
                              <div className="w-10 h-10 rounded bg-gray-700 overflow-hidden">
                                {track.cover ? (
                                  <img src={track.cover} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Music className="w-4 h-4 text-gray-500" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{track.title}</p>
                                <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                              </div>
                              {canControl && (
                                <button
                                  onClick={() => handleRemoveFromQueue(index)}
                                  className="p-1.5 rounded text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="p-6 text-center text-gray-500">
                        <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Очередь пуста</p>
                        <p className="text-xs mt-1">Добавьте треки из раздела Музыка</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* History Sub-view */}
                {isConnected && subView === 'history' && (
                  <div className="space-y-2">
                    {history.length > 0 ? (
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {history.map((item, index) => (
                          <div
                            key={`${item.track?.id}-${index}`}
                            className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/30"
                          >
                            <div className="w-10 h-10 rounded bg-gray-700 overflow-hidden">
                              {item.track?.cover ? (
                                <img src={item.track.cover} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Music className="w-4 h-4 text-gray-500" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{item.track?.title}</p>
                              <p className="text-xs text-gray-400 truncate">{item.track?.artist}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">{formatDate(item.played_at)}</p>
                              {item.played_by_name && (
                                <p className="text-xs text-gray-600">{item.played_by_name}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-gray-500">
                        <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">История пуста</p>
                        <p className="text-xs mt-1">Здесь будут последние прослушанные треки</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Participants Sub-view (default) */}
                {(!isConnected || subView === 'info') && (
                  <>
                    {/* Invite Section */}
                    <div className="p-4 rounded-xl bg-gray-800/50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-400">Код комнаты</span>
                        <span className="text-lg font-mono font-bold text-white tracking-wider">
                          {currentRoom.invite_code}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyInvite}
                          className="flex-1 py-2 rounded-xl bg-gray-700/50 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4 text-green-400" />
                              Скопировано
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Копировать
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleShare}
                          className="flex-1 py-2 rounded-xl bg-blue-500/20 text-blue-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-500/30 transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                          Поделиться
                        </button>
                        <button
                          onClick={() => {
                            setShowQRModal(true);
                            hapticFeedback?.('impact', 'light');
                          }}
                          className="py-2 px-3 rounded-xl bg-purple-500/20 text-purple-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-purple-500/30 transition-colors"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Participants */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Участники комнаты
                      </h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {(currentRoom.participants || []).map(participant => (
                          <div
                            key={participant.telegram_id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/30"
                          >
                            <div className="relative">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium">
                                {participant.first_name?.[0] || '?'}
                              </div>
                              {isSameUser(participant, { telegram_id: telegramId }) && isConnected && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#1C1C1E]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">
                                {participant.first_name} {participant.last_name}
                              </p>
                            </div>
                            {isSameUser(participant, { telegram_id: currentRoom.host_id, uid: currentRoom.host_uid }) && (
                              <Crown className="w-4 h-4 text-yellow-400" />
                            )}
                            {isSameUser(participant, { telegram_id: telegramId }) && (
                              <span className="text-xs text-gray-400">Вы</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                {/* Controls Info */}
                {isConnected && subView === 'info' && (
                  <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-700/30">
                    <p className="text-xs text-gray-400">
                      {canControl 
                        ? '✅ Вы можете управлять воспроизведением'
                        : '🔒 Управление только у хоста комнаты'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Нажмите ← чтобы свернуть, вы останетесь подключены к комнате
                    </p>
                  </div>
                )}
                
                {/* Leave Button */}
                <button
                  onClick={handleLeaveRoom}
                  className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  {currentRoom.is_host ? 'Закрыть комнату' : 'Выйти из комнаты'}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
      
      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && currentRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1C1C1E] rounded-3xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">QR-код комнаты</h3>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="p-2 rounded-full bg-gray-800/50 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="bg-white rounded-2xl p-4 mb-4">
                <QRCodeSVG
                  value={`https://t.me/${botUsername}/app?startapp=listen_${currentRoom.invite_code}`}
                  size={250}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#1a1a1a"
                  className="w-full h-auto"
                />
              </div>
              
              <div className="text-center mb-4">
                <p className="text-white font-medium mb-1">{currentRoom.name}</p>
                <p className="text-gray-400 text-sm">
                  Отсканируйте камерой Telegram
                </p>
                <p className="text-purple-400 font-mono text-lg mt-2 tracking-wider">
                  {currentRoom.invite_code}
                </p>
              </div>
              
              <button
                onClick={() => {
                  // Скачать QR-код как изображение
                  const svg = document.querySelector('.bg-white.rounded-2xl svg');
                  if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.drawImage(img, 0, 0);
                      const link = document.createElement('a');
                      link.download = `room-${currentRoom.invite_code}.png`;
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                  }
                  hapticFeedback?.('notification', 'success');
                }}
                className="w-full py-3 rounded-xl bg-purple-500/20 text-purple-400 font-medium flex items-center justify-center gap-2 hover:bg-purple-500/30 transition-colors"
              >
                <Download className="w-5 h-5" />
                Сохранить QR-код
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Join Confirm Modal */}
      <AnimatePresence>
        {qrJoinConfirm.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
            onClick={handleQrJoinCancel}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{
                backgroundColor: 'rgba(30, 30, 30, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="text-center mb-5">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
                  >
                    {qrJoinConfirm.loading ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (
                      <Music className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Подключиться к комнате?
                  </h3>
                  {qrJoinConfirm.loading ? (
                    <p className="text-gray-400 text-sm">Загрузка информации...</p>
                  ) : qrJoinConfirm.roomData ? (
                    <div>
                      <p className="text-white font-semibold text-base mb-1">
                        {qrJoinConfirm.roomData.name}
                      </p>
                      <p className="text-gray-400 text-sm">
                        Создатель: {qrJoinConfirm.roomData.host_name}
                      </p>
                      <div className="flex items-center justify-center gap-3 mt-2 text-xs text-gray-500">
                        <span>👥 {qrJoinConfirm.roomData.participants_count} участн.</span>
                        <span className="text-green-400">● {qrJoinConfirm.roomData.online_count} онлайн</span>
                      </div>
                      {qrJoinConfirm.roomData.current_track && (
                        <p className="text-gray-400 text-xs mt-2 truncate">
                          ▶ {qrJoinConfirm.roomData.current_track.artist} — {qrJoinConfirm.roomData.current_track.title}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-red-400 text-sm">Комната не найдена или закрыта</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleQrJoinCancel}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 transition-all active:scale-95"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleQrJoinConfirm}
                    disabled={qrJoinConfirm.loading || !qrJoinConfirm.roomData}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
                  >
                    {qrJoinConfirm.loading ? 'Загрузка...' : 'Подключиться'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};

export default ListeningRoomModal;
