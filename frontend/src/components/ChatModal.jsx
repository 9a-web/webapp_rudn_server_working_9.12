/**
 * ChatModal — полноэкранный чат между друзьями
 * Glass morphism, Telegram-style bubbles, анимации
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, Loader2, Check, CheckCheck,
  Trash2, MoreVertical, X, Wifi, ChevronDown
} from 'lucide-react';
import { messagesAPI } from '../services/messagesAPI';
import { getBackendURL } from '../utils/config';

// Генерация градиента по ID
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

// Форматирование времени
const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const formatDateSeparator = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Компонент аватарки
const Avatar = ({ telegramId, firstName, size = 40 }) => {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = `${getBackendURL()}/api/user-profile-photo-proxy/${telegramId}`;
  const initials = (firstName?.[0] || '?').toUpperCase();
  const gradient = getAvatarGradient(telegramId);

  return (
    <div
      className={`bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0`}
      style={{ width: size, height: size, borderRadius: size * 0.38 }}
    >
      {!imgError ? (
        <img
          src={avatarUrl} alt="" className="w-full h-full object-cover"
          onError={() => setImgError(true)} loading="lazy"
        />
      ) : (
        <span style={{ fontSize: size * 0.4 }}>{initials}</span>
      )}
    </div>
  );
};

// Пузырёк сообщения
const MessageBubble = ({ message, isMine, showAvatar, friend, onDelete, isFirst, isLast }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`flex gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${isFirst ? 'mt-1' : 'mt-0.5'}`}
    >
      {/* Аватар собеседника */}
      {!isMine && (
        <div className="w-8 flex-shrink-0">
          {showAvatar && (
            <Avatar telegramId={friend?.telegram_id} firstName={friend?.first_name} size={32} />
          )}
        </div>
      )}

      <div className={`relative group max-w-[78%] ${isMine ? 'order-1' : ''}`}>
        <div
          className={`relative px-3.5 py-2 ${
            isMine
              ? `bg-purple-500/90 text-white ${isFirst && isLast ? 'rounded-2xl' : isFirst ? 'rounded-2xl rounded-br-lg' : isLast ? 'rounded-2xl rounded-tr-lg' : 'rounded-xl rounded-r-lg'}`
              : `bg-white/[0.08] text-gray-100 ${isFirst && isLast ? 'rounded-2xl' : isFirst ? 'rounded-2xl rounded-bl-lg' : isLast ? 'rounded-2xl rounded-tl-lg' : 'rounded-xl rounded-l-lg'}`
          }`}
          onContextMenu={(e) => {
            if (isMine) {
              e.preventDefault();
              setShowMenu(true);
            }
          }}
          onClick={() => {
            if (isMine && !showMenu) setShowMenu(true);
          }}
        >
          <p className="text-[14px] leading-[1.45] whitespace-pre-wrap break-words">{message.text}</p>
          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-gray-500'}`}>
              {formatTime(message.created_at)}
            </span>
            {isMine && (
              message.read_at ? (
                <CheckCheck className="w-3.5 h-3.5 text-white/70" />
              ) : (
                <Check className="w-3 h-3 text-white/50" />
              )
            )}
          </div>
        </div>

        {/* Контекстное меню удаления */}
        <AnimatePresence>
          {showMenu && isMine && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.85, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -5 }}
              transition={{ duration: 0.15 }}
              className="absolute -top-10 right-0 z-50 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete?.(message.id);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors text-[13px] font-medium whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Удалить
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const ChatModal = ({ isOpen, onClose, friend, currentUserId }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const friendName = useMemo(() => {
    if (!friend) return '';
    return [friend.first_name, friend.last_name].filter(Boolean).join(' ') || friend.username || 'Пользователь';
  }, [friend]);

  // Инициализация диалога
  const initConversation = useCallback(async () => {
    if (!currentUserId || !friend?.telegram_id) return;
    setIsLoading(true);
    try {
      const conv = await messagesAPI.createOrGetConversation(currentUserId, friend.telegram_id);
      setConversationId(conv.id);

      const data = await messagesAPI.getMessages(conv.id, currentUserId, 50, 0);
      setMessages((data.messages || []).reverse());
      setHasMore(data.has_more || false);

      // Помечаем прочитанными
      await messagesAPI.markAsRead(conv.id, currentUserId);
    } catch (error) {
      console.error('Init conversation error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, friend?.telegram_id]);

  useEffect(() => {
    if (isOpen && friend?.telegram_id) {
      initConversation();
    }
    return () => {
      setMessages([]);
      setConversationId(null);
      setInputText('');
      setIsLoading(true);
    };
  }, [isOpen, friend?.telegram_id, initConversation]);

  // Автопрокрутка вниз
  useEffect(() => {
    if (!isLoading && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Polling для новых сообщений (каждые 3 секунды)
  useEffect(() => {
    if (!isOpen || !conversationId || !currentUserId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await messagesAPI.getMessages(conversationId, currentUserId, 50, 0);
        const newMessages = (data.messages || []).reverse();

        setMessages(prev => {
          if (newMessages.length !== prev.length ||
            (newMessages.length > 0 && prev.length > 0 &&
              newMessages[newMessages.length - 1]?.id !== prev[prev.length - 1]?.id)) {
            return newMessages;
          }
          // Обновляем read_at без перерисовки порядка
          const updated = prev.map(msg => {
            const fresh = newMessages.find(m => m.id === msg.id);
            if (fresh && fresh.read_at !== msg.read_at) return { ...msg, read_at: fresh.read_at };
            return msg;
          });
          return updated;
        });

        await messagesAPI.markAsRead(conversationId, currentUserId);
      } catch (err) {
        // silent
      }
    }, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, conversationId, currentUserId]);

  // Загрузка старых сообщений
  const loadMore = useCallback(async () => {
    if (!conversationId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await messagesAPI.getMessages(conversationId, currentUserId, 30, messages.length);
      const older = (data.messages || []).reverse();
      setMessages(prev => [...older, ...prev]);
      setHasMore(data.has_more || false);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, currentUserId, messages.length, loadingMore, hasMore]);

  // Отправка сообщения
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending || !friend?.telegram_id) return;

    setIsSending(true);
    setInputText('');

    // Оптимистичное добавление
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      text,
      created_at: new Date().toISOString(),
      read_at: null,
      is_deleted: false,
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const sent = await messagesAPI.sendMessage(currentUserId, friend.telegram_id, text);
      setMessages(prev =>
        prev.map(m => (m.id === optimisticMsg.id ? { ...sent, _optimistic: false } : m))
      );
      if (sent.conversation_id && !conversationId) {
        setConversationId(sent.conversation_id);
      }
    } catch (error) {
      // Откат оптимистичного сообщения
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setInputText(text);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // Удаление сообщения
  const handleDelete = async (messageId) => {
    try {
      await messagesAPI.deleteMessage(messageId, currentUserId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // Обработка скролла
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    setShowScrollDown(!isNearBottom);

    if (scrollTop < 80 && hasMore && !loadingMore) {
      loadMore();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Группировка сообщений по дате
  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastDate = '';
    let lastSenderId = null;
    let groupIndex = 0;

    messages.forEach((msg, idx) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== lastDate) {
        groups.push({ type: 'date', date: msg.created_at, key: `date-${msgDate}` });
        lastDate = msgDate;
        lastSenderId = null;
      }

      const nextMsg = messages[idx + 1];
      const isFirst = msg.sender_id !== lastSenderId;
      const isLast = !nextMsg || nextMsg.sender_id !== msg.sender_id || new Date(nextMsg.created_at).toDateString() !== msgDate;

      groups.push({
        type: 'message',
        message: msg,
        isFirst,
        isLast,
        showAvatar: isFirst,
        key: msg.id,
      });

      lastSenderId = msg.sender_id;
      groupIndex++;
    });

    return groups;
  }, [messages]);

  // Обработка Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!friend) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex flex-col"
          style={{ backgroundColor: 'rgba(10, 10, 16, 0.99)' }}
        >
          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="flex items-center gap-3 px-3 py-3 border-b border-white/[0.06]"
            style={{ backgroundColor: 'rgba(16, 16, 22, 0.95)', backdropFilter: 'blur(20px)' }}
          >
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onClose}
              className="p-2 -ml-1 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>

            <Avatar telegramId={friend.telegram_id} firstName={friend.first_name} size={40} />

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[15px] text-white truncate leading-tight">
                {friendName}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {friend.is_online ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    в сети
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-500">
                    {friend.group_name || (friend.username ? `@${friend.username}` : '')}
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Messages area */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 py-3"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(59, 130, 246, 0.03) 0%, transparent 50%)',
            }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-3"
                >
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  <p className="text-gray-500 text-[13px]">Загрузка...</p>
                </motion.div>
              </div>
            ) : messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-center px-8"
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/15 to-blue-500/15 flex items-center justify-center mb-5">
                  <span className="text-4xl">💬</span>
                </div>
                <h3 className="text-[17px] font-semibold text-gray-300 mb-2">
                  Начните диалог
                </h3>
                <p className="text-[13px] text-gray-500 max-w-[260px] leading-relaxed">
                  Напишите первое сообщение {friendName}
                </p>
              </motion.div>
            ) : (
              <>
                {loadingMore && (
                  <div className="flex justify-center py-3">
                    <Loader2 className="w-5 h-5 text-purple-400/50 animate-spin" />
                  </div>
                )}
                {hasMore && !loadingMore && (
                  <button
                    onClick={loadMore}
                    className="w-full text-center py-2 text-purple-400 text-[12px] font-medium hover:text-purple-300 transition-colors"
                  >
                    Загрузить ещё
                  </button>
                )}

                {groupedMessages.map((item) => {
                  if (item.type === 'date') {
                    return (
                      <motion.div
                        key={item.key}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-center my-3"
                      >
                        <span className="px-3 py-1 bg-white/[0.06] backdrop-blur-sm rounded-full text-[11px] text-gray-400 font-medium">
                          {formatDateSeparator(item.date)}
                        </span>
                      </motion.div>
                    );
                  }

                  return (
                    <MessageBubble
                      key={item.key}
                      message={item.message}
                      isMine={item.message.sender_id === currentUserId}
                      showAvatar={item.showAvatar}
                      friend={friend}
                      onDelete={handleDelete}
                      isFirst={item.isFirst}
                      isLast={item.isLast}
                    />
                  );
                })}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Scroll to bottom button */}
          <AnimatePresence>
            {showScrollDown && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                onClick={scrollToBottom}
                className="absolute bottom-24 right-4 z-50 p-2.5 bg-gray-800/90 backdrop-blur-lg border border-white/10 rounded-full shadow-xl text-gray-300 hover:text-white transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Input area */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="px-3 py-3 border-t border-white/[0.06]"
            style={{ backgroundColor: 'rgba(16, 16, 22, 0.95)', backdropFilter: 'blur(20px)' }}
          >
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Сообщение..."
                  rows={1}
                  className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.08] rounded-2xl text-white text-[14px] placeholder-gray-600 focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.08] transition-all resize-none max-h-[120px] leading-[1.4]"
                  style={{ minHeight: '44px' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={handleSend}
                disabled={!inputText.trim() || isSending}
                className={`p-3 rounded-2xl transition-all duration-200 flex-shrink-0 ${
                  inputText.trim()
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25 hover:bg-purple-400'
                    : 'bg-white/[0.06] text-gray-600'
                }`}
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatModal;
