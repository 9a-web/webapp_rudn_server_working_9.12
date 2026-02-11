/**
 * SendTrackToFriendModal — Модал отправки трека другу в личные сообщения
 * Создаёт чат автоматически если его нет
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Music, Send, Loader2, CheckCircle2, Users } from 'lucide-react';
import { friendsAPI } from '../../services/friendsAPI';
import { messagesAPI } from '../../services/messagesAPI';
import { getBackendURL } from '../../utils/config';

const getAvatarGradient = (id) => {
  const gradients = [
    'from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500',
    'from-amber-500 to-orange-500', 'from-indigo-500 to-blue-600',
    'from-fuchsia-500 to-pink-600', 'from-cyan-500 to-blue-500',
  ];
  return gradients[Math.abs(id || 0) % gradients.length];
};

const FriendAvatar = ({ telegramId, firstName, size = 44 }) => {
  const [imgError, setImgError] = useState(false);
  const url = `${getBackendURL()}/api/user-profile-photo-proxy/${telegramId}`;
  const initials = (firstName?.[0] || '?').toUpperCase();
  const grad = getAvatarGradient(telegramId);

  return (
    <div
      className={`bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0`}
      style={{ width: size, height: size, borderRadius: size * 0.32 }}
    >
      {!imgError ? (
        <img src={url} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} loading="lazy" />
      ) : (
        <span style={{ fontSize: size * 0.38 }}>{initials}</span>
      )}
    </div>
  );
};

export const SendTrackToFriendModal = ({ isOpen, onClose, track, telegramId }) => {
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState(null);
  const [sentTo, setSentTo] = useState(new Set());
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Загрузка друзей
  useEffect(() => {
    const loadFriends = async () => {
      if (!isOpen || !telegramId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await friendsAPI.getFriends(telegramId);
        const friendsList = data?.friends || [];
        setFriends(friendsList);
        setFilteredFriends(friendsList);
      } catch (err) {
        console.error('Load friends error:', err);
        setFriends([]);
        setFilteredFriends([]);
        setError('Не удалось загрузить список друзей');
      } finally {
        setIsLoading(false);
      }
    };
    loadFriends();
  }, [isOpen, telegramId]);

  // Фильтрация
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredFriends(friends.filter(f => {
      const name = `${f.first_name || ''} ${f.last_name || ''}`.toLowerCase();
      const username = (f.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    }));
  }, [searchQuery, friends]);

  // Reset при закрытии
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSentTo(new Set());
      setSendingTo(null);
      setError(null);
    }
  }, [isOpen]);

  const handleSendToFriend = useCallback(async (friend) => {
    if (!track || !telegramId || sendingTo) return;
    setSendingTo(friend.telegram_id);
    setError(null);

    try {
      await messagesAPI.sendMusic(telegramId, friend.telegram_id, {
        track_title: track.title,
        track_artist: track.artist,
        track_id: track.id,
        track_duration: track.duration,
        cover_url: track.cover || null,
      });

      setSentTo(prev => new Set([...prev, friend.telegram_id]));

      // Haptic feedback
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success'); } catch (e) {}
    } catch (err) {
      console.error('Send music error:', err);
      setError(`Ошибка отправки: ${err.message}`);
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('error'); } catch (e) {}
    } finally {
      setSendingTo(null);
    }
  }, [track, telegramId, sendingTo]);

  const formatDuration = (sec) => {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[10000]"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[10001] rounded-t-[28px] max-h-[85vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: 'rgba(14, 14, 20, 0.98)', backdropFilter: 'blur(40px)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/10 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-bold text-white">Отправить другу</h2>
                <p className="text-[12px] text-gray-500 mt-0.5">Выберите получателя</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onClose}
                className="p-2 bg-white/[0.06] rounded-xl text-gray-400 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Track Preview */}
            {track && (
              <div className="mx-5 mb-3 p-3 bg-white/[0.04] rounded-2xl border border-white/[0.06] flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {track.cover ? (
                    <img src={track.cover} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <Music className="w-5 h-5 text-purple-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white truncate">{track.title}</p>
                  <p className="text-[12px] text-gray-400 truncate">{track.artist}</p>
                </div>
                {track.duration && (
                  <span className="text-[12px] text-gray-500 flex-shrink-0">{formatDuration(track.duration)}</span>
                )}
              </div>
            )}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-5 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl"
                >
                  <p className="text-[12px] text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search */}
            <div className="px-5 pb-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск среди друзей"
                  className="w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-white text-[14px] placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-all"
                />
              </div>
            </div>

            {/* Friends List */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              ) : filteredFriends.length > 0 ? (
                <div className="space-y-1.5">
                  {filteredFriends.map((friend, idx) => {
                    const isSent = sentTo.has(friend.telegram_id);
                    const isSending = sendingTo === friend.telegram_id;
                    const displayName = [friend.first_name, friend.last_name].filter(Boolean).join(' ') || friend.username || 'Пользователь';

                    return (
                      <motion.div
                        key={friend.telegram_id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className={`flex items-center gap-3.5 p-3.5 rounded-2xl transition-all ${
                          isSent ? 'bg-emerald-500/[0.08] border border-emerald-500/20' : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04]'
                        }`}
                      >
                        <FriendAvatar
                          telegramId={friend.telegram_id}
                          firstName={friend.first_name}
                          size={44}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-[14px] text-white truncate">{displayName}</h4>
                          <p className="text-[12px] text-gray-400 truncate">
                            {friend.group_name || (friend.username ? `@${friend.username}` : '')}
                          </p>
                        </div>

                        {isSent ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 rounded-xl"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-[12px] text-emerald-400 font-medium">Отправлено</span>
                          </motion.div>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => handleSendToFriend(friend)}
                            disabled={isSending}
                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 text-purple-400 rounded-xl hover:bg-purple-500/25 transition-all disabled:opacity-50"
                          >
                            {isSending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            <span className="text-[12px] font-medium">
                              {isSending ? 'Отправка...' : 'Отправить'}
                            </span>
                          </motion.button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-[14px]">У вас пока нет друзей</p>
                  <p className="text-gray-600 text-[12px] mt-1">Добавьте друзей в разделе "Друзья"</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-[14px]">Никого не найдено</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SendTrackToFriendModal;
