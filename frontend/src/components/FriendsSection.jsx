/**
 * FriendsSection - Главный компонент раздела "Друзья"
 * Полный редизайн: glass morphism, стaggered анимации, skeleton loading, debounce поиск
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, UserPlus, Bell, Star, 
  RefreshCw, UserCheck, UserX, Clock, Send, 
  QrCode, ScanLine, X, Sparkles, Heart, Loader2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTelegram } from '../contexts/TelegramContext';
import { friendsAPI } from '../services/friendsAPI';
import FriendCard from './FriendCard';
import FriendProfileModal from './FriendProfileModal';
import FriendSearchModal from './FriendSearchModal';
import { getBackendURL } from '../utils/config';

// Русское склонение
const pluralize = (n, one, few, many) => {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return `${n} ${many}`;
  if (n1 > 1 && n1 < 5) return `${n} ${few}`;
  if (n1 === 1) return `${n} ${one}`;
  return `${n} ${many}`;
};

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

// Компонент аватарки с фото + fallback на инициалы
const UserAvatar = ({ telegramId, firstName, username, size = 48, className = '' }) => {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = `${getBackendURL()}/api/user-profile-photo-proxy/${telegramId}`;
  const initials = (firstName?.[0] || username?.[0] || '?').toUpperCase();
  const gradient = getAvatarGradient(telegramId);

  return (
    <div 
      className={`bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold overflow-hidden shadow-lg ${className}`}
      style={{ width: size, height: size }}
    >
      {!imgError ? (
        <img 
          src={avatarUrl} alt="" className="w-full h-full object-cover"
          onError={() => setImgError(true)} loading="lazy"
        />
      ) : (
        <span className="drop-shadow-sm" style={{ fontSize: size * 0.38 }}>{initials}</span>
      )}
    </div>
  );
};

const TABS = [
  { id: 'friends', name: 'Друзья', icon: Users },
  { id: 'requests', name: 'Запросы', icon: Bell },
  { id: 'search', name: 'Поиск', icon: Search }
];

// Skeleton Component
const SkeletonCard = ({ delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay }}
    className="rounded-2xl p-4 border border-white/[0.06] bg-white/[0.03]"
  >
    <div className="flex items-center gap-3.5">
      <div className="w-[52px] h-[52px] rounded-[18px] bg-white/[0.06] animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-white/[0.06] rounded-lg w-32 animate-pulse" />
        <div className="h-3 bg-white/[0.04] rounded-lg w-24 animate-pulse" />
        <div className="h-2.5 bg-white/[0.03] rounded-lg w-20 animate-pulse" />
      </div>
      <div className="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse" />
    </div>
  </motion.div>
);

// Avatar gradient generator
const getAvatarGradient = (id) => {
  const gradients = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500', 
    'from-emerald-500 to-teal-500',
    'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500',
    'from-indigo-500 to-blue-600',
    'from-fuchsia-500 to-pink-600',
    'from-cyan-500 to-blue-500',
  ];
  return gradients[Math.abs(id || 0) % gradients.length];
};

const FriendsSection = ({ userSettings, onFriendProfileOpen }) => {
  const { user, webApp } = useTelegram();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [toast, setToast] = useState(null);
  const searchInputRef = useRef(null);
  
  // Debounced search
  const debouncedSearchQuery = useDebounce(searchQuery, 350);
  
  // Processed requests с ограничением и очисткой
  const [processedRequests, setProcessedRequests] = useState(() => {
    try {
      const saved = localStorage.getItem('processed_friend_requests');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      // Очищаем записи старше 24 часов
      const now = Date.now();
      const cleaned = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'object' && v.time && (now - v.time) < 86400000) {
          cleaned[k] = v;
        } else if (typeof v === 'string') {
          // Старый формат — конвертируем
          cleaned[k] = { status: v, time: now };
        }
      });
      return cleaned;
    } catch {
      return {};
    }
  });
  
  useEffect(() => {
    if (Object.keys(processedRequests).length > 0) {
      localStorage.setItem('processed_friend_requests', JSON.stringify(processedRequests));
    }
  }, [processedRequests]);

  // Показ toast-уведомления
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const hapticFeedback = useCallback((type = 'impact', style = 'light') => {
    if (webApp?.HapticFeedback) {
      if (type === 'impact') {
        webApp.HapticFeedback.impactOccurred(style);
      } else if (type === 'notification') {
        webApp.HapticFeedback.notificationOccurred(style);
      }
    }
  }, [webApp]);

  // Загрузка данных
  const loadFriends = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await friendsAPI.getFriends(user.id, showFavoritesOnly);
      setFriends(data.friends || []);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  }, [user?.id, showFavoritesOnly]);

  const loadRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await friendsAPI.getFriendRequests(user.id);
      setRequests(data);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  }, [user?.id]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadFriends(), loadRequests()]);
    } finally {
      setIsLoading(false);
    }
  }, [loadFriends, loadRequests]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // === Синхронизация с NotificationsPanel через CustomEvent ===
  useEffect(() => {
    const handleNotifAction = (e) => {
      const { requestId, action } = e.detail || {};
      if (!requestId || !action) return;
      // Помечаем в processedRequests
      setProcessedRequests(prev => {
        const next = { ...prev, [requestId]: { status: action === 'accept' ? 'accepted' : 'rejected', time: Date.now() } };
        localStorage.setItem('processed_friend_requests', JSON.stringify(next));
        return next;
      });
      // Перезагружаем список друзей если принят
      if (action === 'accept') loadFriends();
    };
    window.addEventListener('friend-request-action', handleNotifAction);
    return () => window.removeEventListener('friend-request-action', handleNotifAction);
  }, [loadFriends]);

  // Debounced search effect
  useEffect(() => {
    const doSearch = async () => {
      if (!user?.id || !debouncedSearchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const data = await friendsAPI.searchUsers(user.id, debouncedSearchQuery);
        setSearchResults(data.results || []);
      } catch (error) {
        console.error('Error searching users:', error);
      }
    };
    doSearch();
  }, [debouncedSearchQuery, user?.id]);

  // Подсчёт непрочитанных входящих (без обработанных)
  const unprocessedIncomingCount = useMemo(() => {
    return (requests.incoming || []).filter(r => !processedRequests[r.request_id]).length;
  }, [requests.incoming, processedRequests]);

  const handleRefresh = async () => {
    setRefreshing(true);
    hapticFeedback('impact', 'medium');
    await loadData();
    setRefreshing(false);
  };

  // Функция для отправки события синхронизации
  const dispatchFriendAction = (requestId, action) => {
    window.dispatchEvent(new CustomEvent('friend-request-action-from-friends', {
      detail: { requestId, action }
    }));
  };

  // Действия
  const handleAcceptRequest = async (requestId) => {
    try {
      hapticFeedback('impact', 'medium');
      await friendsAPI.acceptFriendRequest(requestId, user.id);
      hapticFeedback('notification', 'success');
      setProcessedRequests(prev => {
        const next = { ...prev, [requestId]: { status: 'accepted', time: Date.now() } };
        localStorage.setItem('processed_friend_requests', JSON.stringify(next));
        return next;
      });
      dispatchFriendAction(requestId, 'accept');
      showToast('Запрос принят! Теперь вы друзья');
      await loadFriends();
    } catch (error) {
      hapticFeedback('notification', 'error');
      showToast(error.message || 'Ошибка', 'error');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      hapticFeedback('impact', 'light');
      await friendsAPI.rejectFriendRequest(requestId, user.id);
      setProcessedRequests(prev => {
        const next = { ...prev, [requestId]: { status: 'rejected', time: Date.now() } };
        localStorage.setItem('processed_friend_requests', JSON.stringify(next));
        return next;
      });
      dispatchFriendAction(requestId, 'reject');
      showToast('Запрос отклонён');
    } catch (error) {
      showToast(error.message || 'Ошибка', 'error');
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      hapticFeedback('impact', 'light');
      await friendsAPI.cancelFriendRequest(requestId, user.id);
      setProcessedRequests(prev => {
        const next = { ...prev, [requestId]: { status: 'cancelled', time: Date.now() } };
        localStorage.setItem('processed_friend_requests', JSON.stringify(next));
        return next;
      });
      showToast('Запрос отменён');
    } catch (error) {
      showToast(error.message || 'Ошибка', 'error');
    }
  };

  const [sendingRequest, setSendingRequest] = useState(null);

  const handleSendRequest = async (targetId) => {
    try {
      setSendingRequest(targetId);
      hapticFeedback('impact', 'medium');
      const result = await friendsAPI.sendFriendRequest(user.id, targetId);
      hapticFeedback('notification', 'success');
      showToast(result?.message || 'Запрос отправлен!');
      // Оптимистично обновляем статус в результатах поиска
      setSearchResults(prev => prev.map(r =>
        r.telegram_id === targetId ? { ...r, friendship_status: 'pending_outgoing' } : r
      ));
      // Перезагружаем запросы
      loadRequests();
    } catch (error) {
      hapticFeedback('notification', 'error');
      showToast(error.message || 'Ошибка', 'error');
    } finally {
      setSendingRequest(null);
    }
  };

  const handleToggleFavorite = async (friendId, isFavorite) => {
    try {
      hapticFeedback('impact', 'light');
      await friendsAPI.toggleFavorite(user.id, friendId, isFavorite);
      await loadFriends();
    } catch (error) {
      showToast(error.message || 'Ошибка', 'error');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      hapticFeedback('impact', 'medium');
      await friendsAPI.removeFriend(user.id, friendId);
      hapticFeedback('notification', 'success');
      showToast('Удалён из друзей');
      await loadFriends();
      handleCloseProfile();
    } catch (error) {
      hapticFeedback('notification', 'error');
      showToast(error.message || 'Ошибка', 'error');
    }
  };

  // QR загрузка
  const handleOpenQR = async () => {
    hapticFeedback('impact', 'light');
    setShowQRModal(true);
    try {
      const data = await friendsAPI.getProfileQR(user.id);
      setQrData(data);
    } catch (error) {
      setQrData({ qr_data: `friend_${user?.id}`, display_name: 'Мой профиль' });
    }
  };

  const handleOpenProfile = (friend) => {
    hapticFeedback('impact', 'light');
    setSelectedProfile(friend);
    onFriendProfileOpen?.(true);
  };

  const handleCloseProfile = () => {
    setSelectedProfile(null);
    onFriendProfileOpen?.(false);
  };

  // Рендер карточки запроса
  const renderRequestCard = (request, isIncoming, idx) => {
    const processedObj = processedRequests[request.request_id];
    const processedStatus = processedObj?.status || (typeof processedObj === 'string' ? processedObj : null);
    const isProcessed = !!processedStatus;
    
    return (
      <motion.div
        key={request.request_id}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: isProcessed ? 0.55 : 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: isIncoming ? -80 : 80, scale: 0.9 }}
        transition={{ duration: 0.35, delay: idx * 0.04 }}
        className="relative group overflow-hidden rounded-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.05] to-white/[0.02] backdrop-blur-xl" />
        <div className={`absolute inset-0 border rounded-2xl transition-all duration-300 ${
          processedStatus === 'accepted' ? 'border-emerald-500/20' :
          processedStatus === 'rejected' ? 'border-red-500/10' :
          'border-white/[0.08]'
        }`} />
        
        <div className="relative p-4">
          <div className="flex items-center gap-3.5">
            {/* Аватар с фото */}
            <UserAvatar
              telegramId={request.telegram_id}
              firstName={request.first_name}
              username={request.username}
              size={48}
              className={`rounded-2xl flex-shrink-0 ${
                processedStatus === 'accepted' ? 'ring-2 ring-emerald-500/30' :
                processedStatus === 'rejected' || processedStatus === 'cancelled' ? 'opacity-50 grayscale' : ''
              }`}
            />
            
            {/* Информация */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-[15px] text-white truncate leading-tight">
                {request.first_name} {request.last_name}
              </h4>
              <p className="text-[13px] text-gray-400 truncate mt-0.5">
                {request.group_name || (request.username ? `@${request.username}` : 'Нет группы')}
              </p>
              
              {/* Статус */}
              {processedStatus === 'accepted' && (
                <motion.p 
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[11px] text-emerald-400 mt-1 font-medium flex items-center gap-1"
                >
                  <UserCheck className="w-3 h-3" /> Теперь друзья
                </motion.p>
              )}
              {processedStatus === 'rejected' && (
                <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} 
                  className="text-[11px] text-red-400/70 mt-1 font-medium">✗ Отклонён</motion.p>
              )}
              {processedStatus === 'cancelled' && (
                <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} 
                  className="text-[11px] text-gray-500 mt-1">Отменён</motion.p>
              )}
              {!isProcessed && request.mutual_friends_count > 0 && (
                <p className="text-[11px] text-purple-400/70 mt-1">
                  {pluralize(request.mutual_friends_count, 'общий друг', 'общих друга', 'общих друзей')}
                </p>
              )}
            </div>

            {/* Кнопки действий */}
            <div className="flex gap-2">
              {isIncoming ? (
                isProcessed ? (
                  <div className="flex gap-2 opacity-50">
                    <div className={`p-2.5 rounded-xl ${processedStatus === 'accepted' ? 'bg-emerald-500 text-white' : 'bg-white/[0.04] text-gray-600'}`}>
                      <UserCheck className="w-[18px] h-[18px]" />
                    </div>
                    <div className={`p-2.5 rounded-xl ${processedStatus === 'rejected' ? 'bg-red-500 text-white' : 'bg-white/[0.04] text-gray-600'}`}>
                      <UserX className="w-[18px] h-[18px]" />
                    </div>
                  </div>
                ) : (
                  <>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleAcceptRequest(request.request_id)}
                      className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl hover:bg-emerald-500/25 transition-all active:bg-emerald-500/30"
                    >
                      <UserCheck className="w-[18px] h-[18px]" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleRejectRequest(request.request_id)}
                      className="p-2.5 bg-red-500/10 text-red-400/80 rounded-xl hover:bg-red-500/20 transition-all"
                    >
                      <UserX className="w-[18px] h-[18px]" />
                    </motion.button>
                  </>
                )
              ) : (
                isProcessed ? (
                  <div className="p-2.5 rounded-xl bg-white/[0.04] text-gray-600 opacity-50">
                    <Clock className="w-[18px] h-[18px]" />
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => handleCancelRequest(request.request_id)}
                    className="p-2.5 bg-white/[0.06] text-gray-400 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all"
                    title="Отменить запрос"
                  >
                    <X className="w-[18px] h-[18px]" />
                  </motion.button>
                )
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Рендер результата поиска
  const renderSearchResult = (result, idx) => {
    const isFriend = result.friendship_status === 'friend';
    const isPendingOut = result.friendship_status === 'pending_outgoing';
    const isPendingIn = result.friendship_status === 'pending_incoming';
    const isSending = sendingRequest === result.telegram_id;
    
    return (
      <motion.div
        key={result.telegram_id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: idx * 0.04 }}
        className="relative overflow-hidden rounded-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.05] to-white/[0.02]" />
        <div className="absolute inset-0 border border-white/[0.08] rounded-2xl" />
        
        <div className="relative p-4">
          <div className="flex items-center gap-3.5">
            <UserAvatar
              telegramId={result.telegram_id}
              firstName={result.first_name}
              username={result.username}
              size={48}
              className="rounded-2xl flex-shrink-0"
            />
            
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-[15px] text-white truncate leading-tight">
                {result.first_name} {result.last_name}
              </h4>
              <p className="text-[13px] text-gray-400 truncate mt-0.5">
                {result.group_name || (result.username ? `@${result.username}` : '')}
              </p>
              {result.facultet_name && (
                <p className="text-[11px] text-gray-500 truncate mt-0.5">{result.facultet_name}</p>
              )}
              {result.mutual_friends_count > 0 && (
                <p className="text-[11px] text-purple-400/70 mt-0.5">
                  {pluralize(result.mutual_friends_count, 'общий друг', 'общих друга', 'общих друзей')}
                </p>
              )}
            </div>

            {isFriend ? (
              <span className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-full text-[12px] font-medium">
                <UserCheck className="w-3.5 h-3.5" /> Друзья
              </span>
            ) : isPendingOut ? (
              <motion.span
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-full text-[12px] font-medium"
              >
                <Clock className="w-3.5 h-3.5" /> Отправлено
              </motion.span>
            ) : isPendingIn ? (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => handleAcceptRequest(result.telegram_id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 rounded-full text-[12px] font-medium"
              >
                <UserCheck className="w-3.5 h-3.5" /> Принять
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => handleSendRequest(result.telegram_id)}
                disabled={isSending}
                className={`p-2.5 rounded-xl transition-all ${
                  isSending
                    ? 'bg-purple-500/10 text-purple-300'
                    : 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25'
                }`}
              >
                {isSending ? (
                  <Loader2 className="w-[18px] h-[18px] animate-spin" />
                ) : (
                  <UserPlus className="w-[18px] h-[18px]" />
                )}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Toast уведомление */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-4 right-4 z-[9999]"
          >
            <div className={`px-4 py-3 rounded-2xl backdrop-blur-xl border shadow-xl text-sm font-medium text-center ${
              toast.type === 'error' 
                ? 'bg-red-500/20 border-red-500/20 text-red-300' 
                : 'bg-emerald-500/20 border-emerald-500/20 text-emerald-300'
            }`}>
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Заголовок */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold text-white tracking-tight">Друзья</h1>
            {friends.length > 0 && (
              <motion.span 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }}
                className="px-2.5 py-0.5 bg-purple-500/15 text-purple-400 rounded-full text-[12px] font-semibold"
              >
                {friends.length}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleOpenQR}
              className="p-2.5 bg-white/[0.06] rounded-xl text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
            >
              <QrCode className="w-[18px] h-[18px]" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 bg-white/[0.06] rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <RefreshCw className={`w-[18px] h-[18px] ${refreshing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </div>

        {/* Табы */}
        <div className="relative flex gap-1 bg-white/[0.04] p-1 rounded-2xl border border-white/[0.06]">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const showBadge = tab.id === 'requests' && unprocessedIncomingCount > 0;
            
            return (
              <motion.button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  hapticFeedback('impact', 'light');
                }}
                className={`flex-1 relative flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl transition-all duration-200 z-10 ${
                  isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-purple-500/90 rounded-xl shadow-lg shadow-purple-500/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  <span className="text-[13px] font-semibold">{tab.name}</span>
                </span>
                {showBadge && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center z-20 px-1"
                  >
                    {unprocessedIncomingCount}
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Контент */}
      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {/* ===== Вкладка: Друзья ===== */}
          {activeTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-2.5"
            >
              {/* Фильтр избранных */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500 text-[13px]">
                  {pluralize(friends.length, 'друг', 'друга', 'друзей')}
                </span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setShowFavoritesOnly(!showFavoritesOnly);
                    hapticFeedback('impact', 'light');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-200 ${
                    showFavoritesOnly
                      ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
                      : 'bg-white/[0.04] text-gray-500 border border-transparent hover:text-yellow-400'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" fill={showFavoritesOnly ? 'currentColor' : 'none'} />
                  <span className="text-[12px] font-medium">Избранные</span>
                </motion.button>
              </div>

              {isLoading ? (
                <div className="space-y-2.5">
                  {[0, 1, 2, 3].map(i => <SkeletonCard key={i} delay={i * 0.08} />)}
                </div>
              ) : friends.length > 0 ? (
                friends.map((friend, idx) => (
                  <FriendCard
                    key={friend.telegram_id}
                    friend={friend}
                    index={idx}
                    onPress={() => handleOpenProfile(friend)}
                    onToggleFavorite={() => handleToggleFavorite(friend.telegram_id, !friend.is_favorite)}
                  />
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16"
                >
                  <div className="relative inline-block mb-6">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto">
                      {showFavoritesOnly ? (
                        <Heart className="w-10 h-10 text-purple-400/60" />
                      ) : (
                        <Users className="w-10 h-10 text-purple-400/60" />
                      )}
                    </div>
                    <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-purple-400/40" />
                  </div>
                  <h3 className="text-[17px] font-semibold text-gray-300 mb-2">
                    {showFavoritesOnly ? 'Нет избранных' : 'Пока нет друзей'}
                  </h3>
                  <p className="text-[13px] text-gray-500 mb-6 max-w-[240px] mx-auto leading-relaxed">
                    {showFavoritesOnly 
                      ? 'Нажмите ★ на карточке друга, чтобы добавить в избранное' 
                      : 'Найдите одногруппников через поиск или поделитесь QR-кодом'}
                  </p>
                  {!showFavoritesOnly && (
                    <div className="flex flex-col gap-2.5 max-w-[200px] mx-auto">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveTab('search')}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-purple-500 text-white rounded-2xl font-medium text-[14px] shadow-lg shadow-purple-500/20"
                      >
                        <Search className="w-4 h-4" />
                        Найти друзей
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleOpenQR}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-white/[0.06] text-gray-300 rounded-2xl font-medium text-[14px] border border-white/[0.08]"
                      >
                        <QrCode className="w-4 h-4" />
                        Показать QR
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ===== Вкладка: Запросы ===== */}
          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Входящие */}
              {requests.incoming?.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold text-gray-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                    <UserPlus className="w-3.5 h-3.5" />
                    Входящие · {requests.incoming.length}
                  </h3>
                  <div className="space-y-2">
                    {requests.incoming.map((req, idx) => renderRequestCard(req, true, idx))}
                  </div>
                </div>
              )}

              {/* Исходящие */}
              {requests.outgoing?.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold text-gray-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                    <Send className="w-3.5 h-3.5" />
                    Отправленные · {requests.outgoing.length}
                  </h3>
                  <div className="space-y-2">
                    {requests.outgoing.map((req, idx) => renderRequestCard(req, false, idx))}
                  </div>
                </div>
              )}

              {/* Пусто */}
              {(!requests.incoming?.length && !requests.outgoing?.length) && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16"
                >
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/15 to-cyan-500/15 flex items-center justify-center mx-auto mb-6">
                    <Bell className="w-10 h-10 text-blue-400/50" />
                  </div>
                  <h3 className="text-[17px] font-semibold text-gray-300 mb-2">Нет запросов</h3>
                  <p className="text-[13px] text-gray-500 max-w-[220px] mx-auto leading-relaxed">
                    Здесь появятся входящие и исходящие запросы в друзья
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ===== Вкладка: Поиск ===== */}
          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Поле поиска */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по имени или @username"
                  className="w-full pl-11 pr-10 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-white text-[14px] placeholder-gray-600 focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.06] transition-all"
                />
                {searchQuery && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-white/10 rounded-full text-gray-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </div>

              {/* Быстрые фильтры */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSearchModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-500/12 text-purple-400 rounded-xl whitespace-nowrap text-[13px] font-medium border border-purple-500/15"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Расширенный
                </motion.button>
                {userSettings?.group_id && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={async () => {
                      const data = await friendsAPI.searchUsers(user.id, '', userSettings.group_id);
                      setSearchResults(data.results || []);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.04] text-gray-400 rounded-xl whitespace-nowrap text-[13px] font-medium border border-white/[0.06]"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Моя группа
                  </motion.button>
                )}
              </div>

              {/* Результаты */}
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[12px] text-gray-500 font-medium">
                    Найдено: {searchResults.length}
                  </p>
                  {searchResults.map((r, idx) => renderSearchResult(r, idx))}
                </div>
              ) : searchQuery ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-[14px]">Никого не найдено</p>
                  <p className="text-gray-600 text-[12px] mt-1">Попробуйте другой запрос</p>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-purple-400/40" />
                  </div>
                  <p className="text-gray-400 text-[14px]">Введите имя или @username</p>
                  <p className="text-gray-600 text-[12px] mt-1">Или используйте фильтры выше</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Модалки */}
      <FriendProfileModal
        isOpen={!!selectedProfile}
        onClose={handleCloseProfile}
        friend={selectedProfile}
        currentUserId={user?.id}
        userSettings={userSettings}
        onRemoveFriend={handleRemoveFriend}
        onToggleFavorite={handleToggleFavorite}
      />

      <FriendSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        userSettings={userSettings}
        currentUserId={user?.id}
        onSendRequest={handleSendRequest}
      />

      {/* QR Modal */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="w-full max-w-sm rounded-3xl overflow-hidden border border-white/[0.08]"
              style={{ backgroundColor: 'rgba(22, 22, 28, 0.97)', backdropFilter: 'blur(40px)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 pb-2">
                <div>
                  <h3 className="text-[18px] font-bold text-white">Мой QR-код</h3>
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    {qrData?.display_name || 'Загрузка...'}
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setShowQRModal(false)}
                  className="p-2 bg-white/[0.06] rounded-xl text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* QR Code */}
              <div className="px-5 pb-5 pt-3">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                  className="bg-white rounded-3xl p-5 mx-auto w-fit shadow-2xl"
                >
                  <QRCodeSVG
                    value={qrData?.qr_data || `friend_${user?.id}`}
                    size={200}
                    level="M"
                    includeMargin={false}
                    fgColor="#1a1a2e"
                  />
                </motion.div>
                
                <p className="text-center text-gray-500 text-[13px] mt-5 leading-relaxed max-w-[240px] mx-auto">
                  Покажите этот QR-код другу, чтобы он мог добавить вас
                </p>

                {/* Кнопка сканирования */}
                {webApp?.showScanQrPopup && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      hapticFeedback('impact', 'medium');
                      setShowQRModal(false);
                      webApp.showScanQrPopup(
                        { text: 'Наведите камеру на QR-код друга' },
                        (scannedText) => {
                          if (!scannedText) return;
                          const friendId = scannedText.match(/friend[_\/](\d+)/)?.[1];
                          if (friendId) {
                            hapticFeedback('notification', 'success');
                            webApp.closeScanQrPopup();
                            if (parseInt(friendId) !== user?.id) {
                              handleSendRequest(parseInt(friendId));
                            }
                            return true;
                          }
                          return false;
                        }
                      );
                    }}
                    className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-3.5 bg-purple-500 text-white rounded-2xl font-semibold text-[14px] shadow-lg shadow-purple-500/25"
                  >
                    <ScanLine className="w-5 h-5" />
                    Сканировать QR друга
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FriendsSection;
