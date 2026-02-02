/**
 * ListeningRoomModal - Модальное окно совместного прослушивания музыки
 * Позволяет создавать комнаты, приглашать друзей и синхронно слушать музыку
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, Copy, Check, Share2, Crown, 
  Settings, UserPlus, LogOut, Trash2,
  Play, Pause, Music, Radio, QrCode,
  ChevronRight, ChevronLeft, Loader2, Volume2
} from 'lucide-react';
import { useTelegram } from '../../contexts/TelegramContext';
import { usePlayer } from './PlayerContext';
import {
  createListeningRoom,
  joinListeningRoom,
  leaveListeningRoom,
  deleteListeningRoom,
  getUserListeningRooms,
  updateListeningRoomSettings,
  createListeningRoomConnection
} from '../../services/listeningRoomAPI';

const ListeningRoomModal = ({ isOpen, onClose, telegramId, onActiveRoomChange }) => {
  const { hapticFeedback, user } = useTelegram();
  const { currentTrack, isPlaying, progress, play, pause, seek } = usePlayer();
  
  const [view, setView] = useState('main'); // main, create, join, room
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  
  // Состояние комнат
  const [myRooms, setMyRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [canControl, setCanControl] = useState(false);
  const [isConnected, setIsConnected] = useState(false); // Подключён ли к синхронизации
  const [onlineCount, setOnlineCount] = useState(0); // Количество онлайн участников
  
  // Уведомляем родительский компонент об активной комнате (только когда подключён)
  useEffect(() => {
    onActiveRoomChange?.(isConnected ? currentRoom : null);
  }, [currentRoom, isConnected, onActiveRoomChange]);
  
  // Состояние создания комнаты
  const [roomName, setRoomName] = useState('Совместное прослушивание');
  const [controlMode, setControlMode] = useState('everyone');
  
  // Состояние присоединения
  const [inviteCode, setInviteCode] = useState('');
  
  // WebSocket
  const wsRef = useRef(null);
  const ignoreUntilRef = useRef(0); // Timestamp до которого игнорировать локальные события
  const lastRemoteEventRef = useRef(0); // Timestamp последнего удалённого события
  
  // Загрузка комнат пользователя
  const loadMyRooms = useCallback(async () => {
    if (!telegramId) return;
    
    try {
      const result = await getUserListeningRooms(telegramId);
      setMyRooms(result.rooms || []);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    }
  }, [telegramId]);
  
  useEffect(() => {
    if (isOpen && telegramId) {
      loadMyRooms();
      // Если есть активная комната - показываем её
      if (currentRoom && wsRef.current) {
        setView('room');
      }
    }
  }, [isOpen, telegramId, loadMyRooms]);
  
  // НЕ закрываем соединение при закрытии модального окна
  // Соединение остаётся активным пока пользователь в комнате
  // Закрытие происходит только при реальном выходе из комнаты (handleLeaveRoom)
  
  // Открыть комнату для просмотра (без синхронизации)
  const openRoom = useCallback((room) => {
    setCurrentRoom(room);
    setIsConnected(false);
    setOnlineCount(room.online_count || 0);
    setView('room');
  }, []);
  
  // Подключиться к синхронизации комнаты
  const connectToSync = useCallback(() => {
    if (!currentRoom) return;
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    wsRef.current = createListeningRoomConnection(currentRoom.id, telegramId, {
      onConnected: () => {
        console.log('✅ Connected to listening room sync');
        setIsConnected(true);
        hapticFeedback?.('notification', 'success');
      },
      onStateSync: (state, canCtrl) => {
        if (canCtrl !== undefined) {
          setCanControl(canCtrl);
        }
        
        // Синхронизируем состояние плеера
        if (state && state.current_track) {
          console.log('📥 Initial sync:', state.current_track.title, 'playing:', state.is_playing);
          // Игнорируем локальные события на 800мс
          ignoreUntilRef.current = Date.now() + 800;
          play(state.current_track, [state.current_track]);
          if (state.position > 0) {
            setTimeout(() => seek(state.position), 100);
          }
          if (!state.is_playing) {
            setTimeout(() => pause(), 150);
          }
        }
      },
      onPlay: (track, position, triggeredBy) => {
        // Проверяем что это не наше собственное событие
        if (triggeredBy === telegramId) {
          console.log('🔇 Ignoring own play event');
          return;
        }
        
        console.log('🎵 Remote play:', track?.title, 'from:', triggeredBy);
        // Игнорируем локальные события на 800мс
        ignoreUntilRef.current = Date.now() + 800;
        lastRemoteEventRef.current = Date.now();
        
        if (track) {
          play(track, [track]);
          if (position > 0) {
            setTimeout(() => seek(position), 100);
          }
        }
        hapticFeedback?.('impact', 'light');
      },
      onPause: (position, triggeredBy) => {
        if (triggeredBy === telegramId) {
          console.log('🔇 Ignoring own pause event');
          return;
        }
        
        console.log('⏸️ Remote pause from:', triggeredBy);
        ignoreUntilRef.current = Date.now() + 800;
        lastRemoteEventRef.current = Date.now();
        pause();
        hapticFeedback?.('impact', 'light');
      },
      onSeek: (position, triggeredBy) => {
        if (triggeredBy === telegramId) return;
        console.log('⏩ Remote seek:', position);
        seek(position);
      },
      onTrackChange: (track, triggeredBy) => {
        if (triggeredBy === telegramId) {
          console.log('🔇 Ignoring own track change');
          return;
        }
        
        if (track) {
          console.log('🔄 Remote track change:', track.title, 'from:', triggeredBy);
          ignoreUntilRef.current = Date.now() + 800;
          lastRemoteEventRef.current = Date.now();
          play(track, [track]);
          hapticFeedback?.('impact', 'medium');
        }
      },
      onUserJoined: (newUser) => {
        console.log('👤 User connected:', newUser?.first_name);
        setOnlineCount(prev => prev + 1);
        setCurrentRoom(prev => prev ? {
          ...prev,
          participants: [...(prev.participants || []), newUser],
          participants_count: (prev.participants_count || 0) + 1
        } : prev);
        hapticFeedback?.('notification', 'success');
      },
      onUserLeft: (leftUserId) => {
        console.log('👤 User disconnected:', leftUserId);
        setOnlineCount(prev => Math.max(0, prev - 1));
        setCurrentRoom(prev => prev ? {
          ...prev,
          participants: (prev.participants || []).filter(p => p.telegram_id !== leftUserId),
          participants_count: Math.max(0, (prev.participants_count || 1) - 1)
        } : prev);
      },
      onOnlineCount: (count) => {
        setOnlineCount(count);
      },
      onSettingsChanged: (settings) => {
        console.log('⚙️ Settings changed:', settings);
        setCurrentRoom(prev => prev ? { ...prev, ...settings } : prev);
      },
      onRoomClosed: (message) => {
        console.log('🚪 Room closed:', message);
        hapticFeedback?.('notification', 'warning');
        setCurrentRoom(null);
        setIsConnected(false);
        setView('main');
        loadMyRooms();
      },
      onError: (message) => {
        console.error('❌ Room error:', message);
        setError(message);
        setIsConnected(false);
      },
      onDisconnected: () => {
        console.log('🔌 Disconnected from room');
        setIsConnected(false);
      }
    });
  }, [currentRoom, telegramId, play, pause, seek, hapticFeedback, loadMyRooms]);
  
  // Отключиться от синхронизации (но остаться в комнате)
  const disconnectFromSync = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);
  
  // Создание комнаты
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
      
      // Открываем созданную комнату и сразу подключаемся
      const newRoom = {
        id: result.room_id,
        name: roomName,
        invite_code: result.invite_code,
        invite_link: result.invite_link,
        host_id: telegramId,
        is_host: true,
        participants_count: 1,
        online_count: 1,
        control_mode: controlMode
      };
      setCurrentRoom(newRoom);
      setView('room');
      setIsConnected(true);
      setOnlineCount(1);
      
      // Подключаемся к синхронизации после установки currentRoom
      setTimeout(() => {
        wsRef.current = createListeningRoomConnection(result.room_id, telegramId, {
          onConnected: () => console.log('✅ Host connected'),
          onStateSync: (state, canCtrl) => {
            if (canCtrl !== undefined) setCanControl(canCtrl);
          },
          onUserJoined: () => setOnlineCount(prev => prev + 1),
          onUserLeft: () => setOnlineCount(prev => Math.max(0, prev - 1)),
          onRoomClosed: () => {
            setCurrentRoom(null);
            setIsConnected(false);
            setView('main');
          },
          onDisconnected: () => setIsConnected(false)
        });
      }, 100);
      
    } catch (err) {
      console.error('Create room error:', err);
      setError(err.message);
      hapticFeedback?.('notification', 'error');
    } finally {
      setLoading(false);
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
        connectToRoom({
          ...result.room,
          is_host: result.room.host_id === telegramId
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
  
  // Выход из комнаты
  const handleLeaveRoom = async () => {
    if (!currentRoom) return;
    
    try {
      await leaveListeningRoom(currentRoom.id, telegramId);
      hapticFeedback?.('notification', 'success');
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      setCurrentRoom(null);
      setView('main');
      loadMyRooms();
    } catch (err) {
      console.error('Leave room error:', err);
      setError(err.message);
    }
  };
  
  // Свернуть комнату (вернуться к списку, но остаться участником и сохранить соединение)
  const handleMinimizeRoom = () => {
    // НЕ закрываем соединение - оно остаётся активным для синхронизации
    // wsRef.current остаётся активным
    // currentRoom тоже сохраняем для отправки событий
    setView('main');
    loadMyRooms();
  };
  
  // Копирование ссылки
  const handleCopyInvite = async () => {
    if (!currentRoom?.invite_code) return;
    
    const inviteLink = `https://t.me/rudn_pro_bot/app?startapp=listen_${currentRoom.invite_code}`;
    
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
    
    const inviteLink = `https://t.me/rudn_pro_bot/app?startapp=listen_${currentRoom.invite_code}`;
    const text = `🎵 Присоединяйся к совместному прослушиванию "${currentRoom.name}"!`;
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`);
    } else {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`, '_blank');
    }
    
    hapticFeedback?.('impact', 'medium');
  };
  
  // Отслеживание предыдущего состояния для определения изменений
  const prevIsPlayingRef = useRef(isPlaying);
  const prevTrackIdRef = useRef(currentTrack?.id);
  
  // Отправка событий воспроизведения в комнату
  useEffect(() => {
    // Проверяем что мы в комнате и имеем права управления
    if (!wsRef.current || !currentRoom || !canControl) {
      return;
    }
    
    // Игнорируем если недавно получили удалённое событие (предотвращает эхо)
    if (Date.now() < ignoreUntilRef.current) {
      console.log('🔇 Sync skipped: within ignore window');
      return;
    }
    
    // Проверяем изменилось ли состояние воспроизведения
    const playStateChanged = prevIsPlayingRef.current !== isPlaying;
    const trackChanged = prevTrackIdRef.current !== currentTrack?.id;
    
    // Обновляем refs
    prevIsPlayingRef.current = isPlaying;
    prevTrackIdRef.current = currentTrack?.id;
    
    if (!playStateChanged && !trackChanged) {
      return; // Ничего не изменилось
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
    
    // Отправляем соответствующее событие
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
  }, [isPlaying, currentTrack?.id, currentRoom, canControl, progress]);
  
  // Периодическая синхронизация позиции (каждые 5 секунд когда играет)
  useEffect(() => {
    if (!wsRef.current || !currentRoom || !canControl || !isPlaying || !currentTrack) {
      return;
    }
    
    const syncPosition = () => {
      if (Date.now() < ignoreUntilRef.current) return;
      
      const trackData = {
        id: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        duration: currentTrack.duration || 0,
        cover: currentTrack.cover,
        url: currentTrack.url
      };
      
      // Отправляем текущую позицию для синхронизации
      wsRef.current.sendPlay(trackData, progress);
    };
    
    // Синхронизируем позицию каждые 5 секунд
    const interval = setInterval(syncPosition, 5000);
    
    return () => clearInterval(interval);
  }, [isPlaying, currentRoom, canControl, currentTrack, progress]);
  
  if (!isOpen) return null;
  
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
                        handleMinimizeRoom(); // Свернуть, но остаться в комнате
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
                    <p className="text-xs text-gray-400">
                      {currentRoom.participants_count || 1} слушател{currentRoom.participants_count === 1 ? 'ь' : 'ей'}
                    </p>
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
                          onClick={() => connectToRoom(room)}
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
                              {room.participants_count} участник{room.participants_count === 1 ? '' : 'ов'}
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
                
                <p className="text-sm text-gray-400 text-center">
                  Получите код комнаты от друга или перейдите по ссылке-приглашению
                </p>
              </div>
            )}
            
            {/* Room View */}
            {view === 'room' && currentRoom && (
              <div className="space-y-4">
                {/* Current Track */}
                {currentTrack && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gray-800 overflow-hidden">
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
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {!currentTrack && (
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
                  </div>
                </div>
                
                {/* Participants */}
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Слушатели ({currentRoom.participants?.length || currentRoom.participants_count || 1})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(currentRoom.participants || []).map(participant => (
                      <div
                        key={participant.telegram_id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/30"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium">
                          {participant.first_name?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">
                            {participant.first_name} {participant.last_name}
                          </p>
                        </div>
                        {participant.telegram_id === currentRoom.host_id && (
                          <Crown className="w-4 h-4 text-yellow-400" />
                        )}
                        {participant.telegram_id === telegramId && (
                          <span className="text-xs text-gray-400">Вы</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Controls Info */}
                <div className="p-3 rounded-xl bg-gray-800/30 border border-gray-700/30">
                  <p className="text-xs text-gray-400">
                    {canControl 
                      ? '✅ Вы можете управлять воспроизведением'
                      : '🔒 Управление только у хоста комнаты'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Нажмите ← чтобы свернуть, вы останетесь в комнате
                  </p>
                </div>
                
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
    </AnimatePresence>
  );
};

export default ListeningRoomModal;
