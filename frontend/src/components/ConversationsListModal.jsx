/**
 * ConversationsListModal — Список диалогов (модальное окно)
 * Glass morphism, staggered анимации, Telegram-стиль
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, MessageCircle, Loader2, Search,
  ChevronRight, Check, CheckCheck
} from 'lucide-react';
import { messagesAPI } from '../services/messagesAPI';
import { getBackendURL } from '../utils/config';

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

const getTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'сейчас';
  if (diffMin < 60) return `${diffMin} мин`;
  if (diffHours < 24) return `${diffHours} ч`;
  if (diffDays < 7) return `${diffDays} дн`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

// Аватар
const Avatar = ({ telegramId, firstName, size = 52 }) => {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = `${getBackendURL()}/api/user-profile-photo-proxy/${telegramId}`;
  const initials = (firstName?.[0] || '?').toUpperCase();
  const gradient = getAvatarGradient(telegramId);

  return (
    <div
      className={`bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0`}
      style={{ width: size, height: size, borderRadius: size * 0.35 }}
    >
      {!imgError ? (
        <img
          src={avatarUrl} alt="" className="w-full h-full object-cover"
          onError={() => setImgError(true)} loading="lazy"
        />
      ) : (
        <span style={{ fontSize: size * 0.38 }}>{initials}</span>
      )}
    </div>
  );
};

// Skeleton
const SkeletonConv = ({ delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay }}
    className="flex items-center gap-3.5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
  >
    <div className="w-[52px] h-[52px] rounded-[18px] bg-white/[0.06] animate-pulse flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-white/[0.06] rounded-lg w-32 animate-pulse" />
      <div className="h-3 bg-white/[0.04] rounded-lg w-48 animate-pulse" />
    </div>
    <div className="w-10 h-3 bg-white/[0.04] rounded-lg animate-pulse" />
  </motion.div>
);

const ConversationsListModal = ({ isOpen, onClose, currentUserId, onOpenChat }) => {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadConversations = useCallback(async () => {
    if (!currentUserId) return;
    setIsLoading(true);
    try {
      const data = await messagesAPI.getConversations(currentUserId);
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Load conversations error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
    return () => {
      setConversations([]);
      setSearchQuery('');
    };
  }, [isOpen, loadConversations]);

  // Polling
  useEffect(() => {
    if (!isOpen || !currentUserId) return;
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [isOpen, currentUserId, loadConversations]);

  // Фильтрация по поиску
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(conv => {
      const other = conv.participants?.find(p => p.telegram_id !== currentUserId);
      if (!other) return false;
      const name = `${other.first_name} ${other.last_name} ${other.username}`.toLowerCase();
      return name.includes(q);
    });
  }, [conversations, searchQuery, currentUserId]);

  const handleOpenChat = (conv) => {
    const other = conv.participants?.find(p => p.telegram_id !== currentUserId);
    if (other) {
      onOpenChat?.({
        telegram_id: other.telegram_id,
        first_name: other.first_name,
        last_name: other.last_name,
        username: other.username,
        is_online: other.is_online,
        last_activity: other.last_activity,
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9998]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[9998] rounded-t-[28px] max-h-[85vh] flex flex-col overflow-hidden"
            style={{ backgroundColor: 'rgba(18, 18, 24, 0.98)', backdropFilter: 'blur(40px)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/10 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-bold text-white">Сообщения</h2>
                {conversations.length > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-2.5 py-0.5 bg-purple-500/15 text-purple-400 rounded-full text-[12px] font-semibold"
                  >
                    {conversations.length}
                  </motion.span>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onClose}
                className="p-2 bg-white/[0.06] rounded-xl text-gray-500 hover:bg-white/10 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Search */}
            {conversations.length > 3 && (
              <div className="px-5 pb-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по диалогам..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white text-[13px] placeholder-gray-600 focus:outline-none focus:border-purple-500/30 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-2">
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map(i => <SkeletonConv key={i} delay={i * 0.08} />)}
                </div>
              ) : filteredConversations.length > 0 ? (
                filteredConversations.map((conv, idx) => {
                  const other = conv.participants?.find(p => p.telegram_id !== currentUserId);
                  if (!other) return null;

                  const displayName = [other.first_name, other.last_name].filter(Boolean).join(' ') || other.username || 'Пользователь';
                  const lastMsg = conv.last_message;
                  const isMineLastMsg = lastMsg?.sender_id === currentUserId;
                  const lastMsgText = lastMsg
                    ? (isMineLastMsg ? 'Вы: ' : '') + (lastMsg.text?.substring(0, 60) || '') + (lastMsg.text?.length > 60 ? '...' : '')
                    : 'Нет сообщений';

                  return (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.04 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleOpenChat(conv)}
                      className="relative group cursor-pointer overflow-hidden rounded-2xl"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/[0.05] to-white/[0.02]" />
                      <div className={`absolute inset-0 border rounded-2xl transition-all duration-300 ${
                        conv.unread_count > 0 ? 'border-purple-500/20' : 'border-white/[0.06]'
                      } group-hover:border-purple-500/25`} />

                      <div className="relative p-3.5 flex items-center gap-3.5">
                        {/* Avatar + online */}
                        <div className="relative">
                          <Avatar telegramId={other.telegram_id} firstName={other.first_name} size={52} />
                          {other.is_online && (
                            <div className="absolute -bottom-0.5 -right-0.5">
                              <div className="w-4 h-4 bg-emerald-500 rounded-full border-[2.5px]" style={{ borderColor: 'rgba(18, 18, 24, 0.98)' }}>
                                <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-30" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`font-semibold text-[15px] truncate leading-tight ${
                              conv.unread_count > 0 ? 'text-white' : 'text-gray-200'
                            }`}>
                              {displayName}
                            </h4>
                            {lastMsg && (
                              <span className="text-[11px] text-gray-500 flex-shrink-0">
                                {getTimeAgo(lastMsg.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            {lastMsg && isMineLastMsg && (
                              lastMsg.read_at ? (
                                <CheckCheck className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                              ) : (
                                <Check className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              )
                            )}
                            <p className={`text-[13px] truncate ${
                              conv.unread_count > 0 ? 'text-gray-300 font-medium' : 'text-gray-500'
                            }`}>
                              {lastMsgText}
                            </p>
                          </div>
                        </div>

                        {/* Unread badge */}
                        {conv.unread_count > 0 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="min-w-[22px] h-[22px] bg-purple-500 rounded-full flex items-center justify-center px-1.5 flex-shrink-0"
                          >
                            <span className="text-[11px] font-bold text-white">
                              {conv.unread_count > 99 ? '99+' : conv.unread_count}
                            </span>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16"
                >
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/15 to-blue-500/15 flex items-center justify-center mx-auto mb-5">
                    <MessageCircle className="w-10 h-10 text-purple-400/50" />
                  </div>
                  <h3 className="text-[17px] font-semibold text-gray-300 mb-2">
                    {searchQuery ? 'Ничего не найдено' : 'Нет сообщений'}
                  </h3>
                  <p className="text-[13px] text-gray-500 max-w-[240px] mx-auto leading-relaxed">
                    {searchQuery
                      ? 'Попробуйте другой запрос'
                      : 'Напишите другу, чтобы начать диалог'}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ConversationsListModal;
