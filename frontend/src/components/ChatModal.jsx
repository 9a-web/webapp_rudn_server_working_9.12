/**
 * ChatModal — Полноэкранный чат между друзьями
 * Фичи: text, reply, edit, reactions, typing, pin, forward, search,
 *        schedule share, music share, task creation, emoji picker
 * Glass morphism, Telegram-style bubbles, Framer Motion анимации
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, Loader2, Check, CheckCheck, Trash2,
  Pin, Reply, Pencil, Forward, Search, X, ChevronDown,
  Calendar, Music, ListTodo, Smile, MoreVertical, PinOff,
  Copy, CheckCircle2, Play, Pause
} from 'lucide-react';
import { messagesAPI } from '../services/messagesAPI';
import { musicAPI } from '../services/musicAPI';
import { usePlayer } from './music/PlayerContext';
import { getBackendURL } from '../utils/config';

/* ============ Константы ============ */
const REACTION_EMOJIS = ['❤️', '👍', '😂', '🔥', '😢', '👎', '🎉', '💯'];

const EMOJI_CATEGORIES = {
  'Часто': ['😀', '😂', '🥹', '😍', '🥰', '😎', '🤔', '👍', '👎', '❤️', '🔥', '💯', '🎉', '✨', '😢', '😭', '😤', '🙏', '👋', '🤝'],
  'Лица': ['😀', '😃', '😄', '😁', '😆', '🥹', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕'],
  'Жесты': ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '👏', '🙌', '🫶', '🤝', '🙏'],
  'Символы': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔥', '⭐', '🌟', '✨', '💫', '🎵', '🎶', '💯', '✅', '❌', '⚡', '💡', '🎯'],
};

const getAvatarGradient = (id) => {
  const g = ['from-violet-500 to-purple-600', 'from-blue-500 to-cyan-500', 'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500', 'from-amber-500 to-orange-500', 'from-indigo-500 to-blue-600', 'from-fuchsia-500 to-pink-600', 'from-cyan-500 to-blue-500'];
  return g[Math.abs(id || 0) % g.length];
};

// Парсим дату — сервер хранит UTC без Z
const parseUTC = (d) => {
  if (!d) return new Date();
  const s = String(d);
  const parsed = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};
const formatTime = (d) => {
  try { return parseUTC(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return ''; }
};

const formatDateSeparator = (d) => {
  try {
    const date = parseUTC(d);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return ''; }
};

/* ============ Мини-компоненты ============ */

const Avatar = ({ telegramId, firstName, size = 40 }) => {
  const [err, setErr] = useState(false);
  const url = `${getBackendURL()}/api/user-profile-photo-proxy/${telegramId}`;
  const initials = (firstName?.[0] || '?').toUpperCase();
  const grad = getAvatarGradient(telegramId);
  return (
    <div className={`bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0`}
      style={{ width: size, height: size, borderRadius: size * 0.38 }}>
      {!err ? <img src={url} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} loading="lazy" />
        : <span style={{ fontSize: size * 0.4 }}>{initials}</span>}
    </div>
  );
};

const Toast = ({ message, onHide }) => {
  useEffect(() => { const t = setTimeout(onHide, 2200); return () => clearTimeout(t); }, [onHide]);
  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] px-5 py-2.5 bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
      <p className="text-[13px] text-white font-medium flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />{message}
      </p>
    </motion.div>
  );
};

/* ============ Emoji Picker ============ */
const EmojiPicker = ({ isOpen, onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('Часто');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    if (isOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute bottom-full left-0 right-0 mb-2 mx-2 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
      style={{ maxHeight: '280px', backgroundColor: '#14141e' }}>
      <div className="flex gap-1 p-2 border-b border-white/[0.06] overflow-x-auto scrollbar-hide">
        {Object.keys(EMOJI_CATEGORIES).map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-purple-500/20 text-purple-300' : 'text-gray-500 hover:text-gray-300'}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="p-2 grid grid-cols-8 gap-1 overflow-y-auto" style={{ maxHeight: '200px' }}>
        {(EMOJI_CATEGORIES[activeCategory] || []).map((emoji, i) => (
          <button key={`${emoji}-${i}`} onClick={() => onSelect(emoji)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/[0.08] transition-colors text-xl active:scale-90">
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

/* ============ Reaction Bar ============ */
const ReactionBar = ({ isOpen, onSelect, onClose, position }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    if (isOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return (
    <motion.div ref={ref} initial={{ opacity: 0, scale: 0.8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
      className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 z-[99990] flex gap-0.5 p-1.5 border border-white/10 rounded-2xl shadow-2xl`}
      style={{ backgroundColor: '#14141e' }}>
      {REACTION_EMOJIS.map(emoji => (
        <button key={emoji} onClick={() => { onSelect(emoji); onClose(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.1] transition-all text-lg hover:scale-125 active:scale-90">
          {emoji}
        </button>
      ))}
    </motion.div>
  );
};

/* ============ Context Menu ============ */
const MessageContextMenu = ({ isOpen, onClose, message, isMine, actions, position = 'top' }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    if (isOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, onClose]);
  if (!isOpen) return null;

  const items = [
    { icon: Reply, label: 'Ответить', action: 'reply', color: 'text-blue-400' },
    { icon: Smile, label: 'Реакция', action: 'reaction', color: 'text-yellow-400' },
    ...(isMine ? [{ icon: Pencil, label: 'Редактировать', action: 'edit', color: 'text-emerald-400' }] : []),
    { icon: message?.is_pinned ? PinOff : Pin, label: message?.is_pinned ? 'Открепить' : 'Закрепить', action: 'pin', color: 'text-orange-400' },
    { icon: Forward, label: 'Переслать', action: 'forward', color: 'text-purple-400' },
    { icon: Copy, label: 'Копировать', action: 'copy', color: 'text-gray-400' },
    { icon: ListTodo, label: 'В задачи', action: 'task', color: 'text-cyan-400' },
    ...(isMine ? [{ icon: Trash2, label: 'Удалить', action: 'delete', color: 'text-red-400' }] : []),
  ];

  const isBelow = position === 'bottom';

  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, scale: 0.85, y: isBelow ? 8 : -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className={`absolute ${isMine ? 'right-0' : 'left-10'} ${isBelow ? 'top-full mt-2' : 'bottom-full mb-2'} z-[99990] border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[180px] max-h-[70vh] overflow-y-auto`}
      style={{ backgroundColor: '#14141e' }}>
      {items.map(item => (
        <button key={item.action} onClick={() => { actions(item.action); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.06] transition-colors text-left">
          <item.icon className={`w-4 h-4 ${item.color}`} />
          <span className="text-[13px] font-medium text-gray-200">{item.label}</span>
        </button>
      ))}
    </motion.div>
  );
};

/* ============ Пузырёк сообщения ============ */
const MessageBubble = ({ message, isMine, showAvatar, friend, onAction, isFirst, isLast, currentUserId, highlightId }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [menuPosition, setMenuPosition] = useState('top');
  const bubbleRef = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const isHighlighted = highlightId === message.id;
  const isForwarded = message.message_type === 'forward' || message.forwarded_from;
  const isSchedule = message.message_type === 'schedule';
  const isMusic = message.message_type === 'music';

  // Long press refs
  const longPressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const swipeThreshold = 60;
  const replyTriggered = useRef(false);

  // Haptic feedback
  const vibrate = () => {
    try { navigator.vibrate?.(30); } catch (e) {}
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('medium'); } catch (e) {}
  };

  // Определяем позицию меню (сверху или снизу) по положению сообщения
  const calcMenuPosition = useCallback(() => {
    if (!bubbleRef.current) return 'top';
    const rect = bubbleRef.current.getBoundingClientRect();
    // Если до верха viewport менее 320px — показываем меню снизу
    return rect.top < 320 ? 'bottom' : 'top';
  }, []);

  const openMenu = useCallback(() => {
    setMenuPosition(calcMenuPosition());
    setShowMenu(true);
  }, [calcMenuPosition]);

  // Long press handlers
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isLongPressRef.current = false;
    replyTriggered.current = false;
    setIsSwiping(false);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      vibrate();
      openMenu();
    }, 300);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // Если двигаем палец — отменяем long press
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Горизонтальный свайп (только вправо для reply)
    if (Math.abs(dx) > 15 && Math.abs(dy) < 40) {
      setIsSwiping(true);
      const clampedX = Math.max(0, Math.min(dx, 100));
      setSwipeX(clampedX);

      // Вибрация при достижении порога
      if (clampedX >= swipeThreshold && !replyTriggered.current) {
        replyTriggered.current = true;
        vibrate();
      }
      if (clampedX < swipeThreshold) {
        replyTriggered.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Если свайп достиг порога — reply
    if (swipeX >= swipeThreshold) {
      onAction?.('reply', message);
    }

    // Анимированный возврат
    setSwipeX(0);
    setIsSwiping(false);
    isLongPressRef.current = false;
  };

  // Mouse long press (для десктопа)
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    touchStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    isLongPressRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      vibrate();
      openMenu();
    }, 300);
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const handleAction = (action) => {
    if (action === 'reaction') { setShowReactions(true); return; }
    onAction?.(action, message);
  };

  const handleReaction = (emoji) => {
    onAction?.('addReaction', message, emoji);
    setShowReactions(false);
  };

  // Рендер реакций под сообщением
  const renderReactions = () => {
    if (!message.reactions?.length) return null;
    return (
      <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
        {message.reactions.map((r, i) => {
          const isMyReaction = r.users?.includes(currentUserId);
          return (
            <motion.button key={`${r.emoji}-${i}`} whileTap={{ scale: 0.85 }}
              onClick={() => onAction?.('addReaction', message, r.emoji)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] transition-all ${
                isMyReaction ? 'bg-purple-500/25 border border-purple-500/40' : 'bg-white/[0.06] border border-white/[0.06]'
              }`}>
              <span>{r.emoji}</span>
              {r.users?.length > 1 && <span className="text-gray-400 text-[10px]">{r.users.length}</span>}
            </motion.button>
          );
        })}
      </div>
    );
  };

  // Рендер reply-блока
  const renderReply = () => {
    if (!message.reply_to) return null;
    return (
      <div className={`mb-1.5 pl-2.5 border-l-2 ${isMine ? 'border-white/30' : 'border-purple-400/50'} rounded-sm`}
        onClick={(e) => { e.stopPropagation(); onAction?.('scrollToMessage', message, message.reply_to.message_id); }}>
        <p className={`text-[11px] font-semibold ${isMine ? 'text-white/70' : 'text-purple-400/80'}`}>{message.reply_to.sender_name}</p>
        <p className={`text-[12px] truncate ${isMine ? 'text-white/50' : 'text-gray-400'}`}>{message.reply_to.text}</p>
      </div>
    );
  };

  // Рендер пересланного
  const renderForwarded = () => {
    if (!isForwarded || !message.forwarded_from) return null;
    return (
      <div className={`mb-1 flex items-center gap-1 ${isMine ? 'text-white/50' : 'text-gray-500'}`}>
        <Forward className="w-3 h-3" />
        <span className="text-[11px] italic">от {message.forwarded_from.sender_name}</span>
      </div>
    );
  };

  // Рендер карточки расписания
  const renderScheduleCard = () => {
    if (!isSchedule) return null;
    const meta = message.metadata || {};
    return (
      <div className="mt-1.5 p-3 bg-white/[0.06] rounded-xl border border-white/[0.06]">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-purple-400" />
          <span className="text-[12px] font-semibold text-purple-300">{meta.group_name || 'Расписание'}</span>
        </div>
        <p className="text-[11px] text-gray-400">{meta.date}</p>
        {meta.items?.length > 0 ? (
          <div className="mt-2 space-y-1">
            {meta.items.slice(0, 5).map((item, i) => (
              <div key={i} className="text-[12px] text-gray-300 flex gap-2">
                <span className="text-gray-500 flex-shrink-0">{item.time || `${i + 1}.`}</span>
                <span className="truncate">{item.discipline || item.subject || item.name || (typeof item === 'string' ? item : 'Занятие')}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-1 text-[12px] text-gray-500 italic">Занятий нет</p>}
      </div>
    );
  };

  // Рендер музыкальной карточки (кликабельная для воспроизведения)
  const renderMusicCard = () => {
    if (!isMusic) return null;
    const meta = message.metadata || {};
    return (
      <MusicCardPlayable
        metadata={meta}
        isMine={isMine}
      />
    );
  };

  const bubbleRadius = isMine
    ? (isFirst && isLast ? 'rounded-2xl' : isFirst ? 'rounded-2xl rounded-br-lg' : isLast ? 'rounded-2xl rounded-tr-lg' : 'rounded-xl rounded-r-lg')
    : (isFirst && isLast ? 'rounded-2xl' : isFirst ? 'rounded-2xl rounded-bl-lg' : isLast ? 'rounded-2xl rounded-tl-lg' : 'rounded-xl rounded-l-lg');

  // Прогресс свайпа для визуальной индикации
  const swipeProgress = Math.min(swipeX / swipeThreshold, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: isHighlighted ? [1, 0.5, 1] : 1, y: 0, scale: 1, backgroundColor: isHighlighted ? ['rgba(139,92,246,0.15)', 'rgba(139,92,246,0)', 'rgba(139,92,246,0)'] : 'transparent' }}
      transition={{ duration: 0.3 }}
      id={`msg-${message.id}`}
      className={`relative flex gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${isFirst ? 'mt-1.5' : 'mt-0.5'} px-0.5`}
    >
      {/* Swipe reply indicator */}
      <AnimatePresence>
        {swipeX > 10 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: swipeProgress, scale: 0.6 + swipeProgress * 0.4 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
            style={{ width: 36, height: 36 }}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-150 ${
              swipeProgress >= 1 ? 'bg-purple-500' : 'bg-white/10'
            }`}>
              <Reply className={`w-4 h-4 transition-colors duration-150 ${swipeProgress >= 1 ? 'text-white' : 'text-gray-400'}`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isMine && (
        <div className="w-8 flex-shrink-0" style={{ transform: `translateX(${swipeX * 0.3}px)` }}>
          {showAvatar && <Avatar telegramId={friend?.telegram_id} firstName={friend?.first_name} size={32} />}
        </div>
      )}

      <div
        ref={bubbleRef}
        className={`relative group max-w-[78%] select-none`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Context Menu */}
        <AnimatePresence>
          {showMenu && <MessageContextMenu isOpen message={message} isMine={isMine} actions={handleAction} onClose={() => setShowMenu(false)} position={menuPosition} />}
          {showReactions && <ReactionBar isOpen onSelect={handleReaction} onClose={() => setShowReactions(false)} position={menuPosition} />}
        </AnimatePresence>

        <div
          className={`relative px-3.5 py-2 ${
            isMine ? `bg-purple-500/90 text-white ${bubbleRadius}` : `bg-white/[0.08] text-gray-100 ${bubbleRadius}`
          }`}
        >
          {renderForwarded()}
          {renderReply()}
          {!isSchedule && !isMusic && <p className="text-[14px] leading-[1.45] whitespace-pre-wrap break-words">{message.text}</p>}
          {isSchedule && renderScheduleCard()}
          {isMusic && renderMusicCard()}

          <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {message.edited_at && <span className={`text-[10px] ${isMine ? 'text-white/40' : 'text-gray-600'}`}>ред.</span>}
            {message.is_pinned && <Pin className={`w-2.5 h-2.5 ${isMine ? 'text-white/50' : 'text-orange-400/50'}`} />}
            <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-gray-500'}`}>{formatTime(message.created_at)}</span>
            {isMine && (message.read_at ? <CheckCheck className="w-3.5 h-3.5 text-white/70" /> : <Check className="w-3 h-3 text-white/50" />)}
          </div>
        </div>

        {renderReactions()}
      </div>
    </motion.div>
  );
};

/* ============ Typing Indicator ============ */
const TypingDots = ({ name }) => (
  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
    className="flex items-center gap-2 px-3 py-1.5">
    <div className="w-8" />
    <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.06] rounded-2xl rounded-bl-lg">
      <span className="text-[12px] text-gray-400">{name}</span>
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 bg-purple-400 rounded-full"
            animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
        ))}
      </div>
    </div>
  </motion.div>
);

/* ============ Pinned Message Banner ============ */
const PinnedBanner = ({ message, onScroll, onUnpin }) => {
  if (!message) return null;
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      className="border-b border-white/[0.06] bg-orange-500/[0.04]">
      <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer" onClick={() => onScroll?.(message.id)}>
        <Pin className="w-4 h-4 text-orange-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-orange-400 font-semibold">Закреплённое сообщение</p>
          <p className="text-[12px] text-gray-400 truncate">{message.text}</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onUnpin?.(message.id); }} className="p-1 text-gray-600 hover:text-gray-300 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

/* ============ Forward Modal ============ */
const ForwardModal = ({ isOpen, onClose, friends, onForward }) => {
  if (!isOpen) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-[16px] font-semibold text-white">Переслать</h3>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {friends?.length > 0 ? friends.map(f => (
          <motion.button key={f.telegram_id} whileTap={{ scale: 0.97 }} onClick={() => onForward(f)}
            className="w-full flex items-center gap-3 p-3 bg-white/[0.04] rounded-xl hover:bg-white/[0.08] transition-colors">
            <Avatar telegramId={f.telegram_id} firstName={f.first_name} size={40} />
            <span className="text-[14px] text-white font-medium">{[f.first_name, f.last_name].filter(Boolean).join(' ') || f.username}</span>
          </motion.button>
        )) : <p className="text-center text-gray-500 py-8">Нет друзей для пересылки</p>}
      </div>
    </motion.div>
  );
};

/* ============ Search Panel ============ */
const SearchPanel = ({ isOpen, onClose, conversationId, telegramId, onScrollToMessage }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);

  const doSearch = useCallback(async () => {
    if (!query.trim() || !conversationId) return;
    setLoading(true);
    try {
      const data = await messagesAPI.searchMessages(conversationId, query, telegramId);
      setResults(data.results || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [query, conversationId, telegramId]);

  useEffect(() => {
    const t = setTimeout(doSearch, 400);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  if (!isOpen) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="absolute top-0 left-0 right-0 z-[80] border-b border-white/[0.06]"
      style={{ backgroundColor: '#14141e' }}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={() => { onClose(); setQuery(''); setResults([]); }} className="p-2 text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по сообщениям..."
          className="flex-1 bg-transparent text-white text-[14px] placeholder-gray-600 focus:outline-none" />
        {loading && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
      </div>
      {results.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto border-t border-white/[0.04]">
          {results.map(r => (
            <button key={r.id} onClick={() => { onScrollToMessage(r.id); onClose(); setQuery(''); setResults([]); }}
              className="w-full text-left px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.03]">
              <p className="text-[13px] text-gray-300 line-clamp-2">{r.text}</p>
              <p className="text-[11px] text-gray-600 mt-0.5">{formatTime(r.created_at)}</p>
            </button>
          ))}
        </div>
      )}
      {query && !loading && results.length === 0 && (
        <div className="py-6 text-center text-[13px] text-gray-500">Ничего не найдено</div>
      )}
    </motion.div>
  );
};

/* ============ Schedule Date Picker ============ */
const ScheduleDatePicker = ({ isOpen, onClose, onSend }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    if (isOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Генерация дней (сегодня + 6 дней вперёд)
  const days = [];
  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const monthNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      date: d.toISOString().split('T')[0],
      day: d.getDate(),
      dayName: dayNames[d.getDay()],
      monthName: monthNames[d.getMonth()],
      isToday: i === 0,
      isTomorrow: i === 1,
    });
  }

  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="absolute bottom-full left-0 right-0 mb-2 mx-2 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 p-4"
      style={{ backgroundColor: '#14141e' }}>
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-5 h-5 text-blue-400" />
        <h3 className="text-[15px] font-semibold text-white">Отправить расписание</h3>
      </div>
      <p className="text-[12px] text-gray-500 mb-3">Выберите день:</p>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {days.map(d => (
          <motion.button key={d.date} whileTap={{ scale: 0.92 }}
            onClick={() => { onSend(d.date); onClose(); }}
            className={`relative p-3 rounded-xl border text-center transition-all hover:border-blue-500/40 hover:bg-blue-500/10 ${
              d.isToday ? 'border-blue-500/30 bg-blue-500/[0.08]' : 'border-white/[0.06] bg-white/[0.03]'
            }`}>
            <p className="text-[11px] text-gray-500 mb-0.5">{d.isToday ? 'Сегодня' : d.isTomorrow ? 'Завтра' : d.dayName}</p>
            <p className="text-[18px] font-bold text-white">{d.day}</p>
            <p className="text-[10px] text-gray-500">{d.monthName}</p>
          </motion.button>
        ))}
        {/* Кнопка "Вся неделя" */}
        <motion.button whileTap={{ scale: 0.92 }}
          onClick={() => {
            const dates = days.map(d => d.date);
            onSend(dates.join(','));
            onClose();
          }}
          className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] text-center transition-all hover:border-purple-500/40 hover:bg-purple-500/10">
          <p className="text-[11px] text-purple-400 mb-0.5">Всю</p>
          <p className="text-[16px] font-bold text-purple-300">📅</p>
          <p className="text-[10px] text-purple-400">неделю</p>
        </motion.button>
      </div>
    </motion.div>
  );
};

/* ============ Attach Menu ============ */
const AttachMenu = ({ isOpen, onClose, onAction }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    if (isOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  const items = [
    { icon: Calendar, label: 'Расписание', action: 'schedule', color: 'text-blue-400', bg: 'bg-blue-500/15' },
    { icon: Music, label: 'Музыка', action: 'music', color: 'text-pink-400', bg: 'bg-pink-500/15' },
  ];
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }}
      className="absolute bottom-full left-2 mb-2 z-50 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      style={{ backgroundColor: '#14141e' }}>
      {items.map(item => (
        <button key={item.action} onClick={() => { onAction(item.action); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.06] transition-colors">
          <div className={`p-2 rounded-xl ${item.bg}`}><item.icon className={`w-4 h-4 ${item.color}`} /></div>
          <span className="text-[13px] text-gray-200 font-medium">{item.label}</span>
        </button>
      ))}
    </motion.div>
  );
};

/* ============ Playable Music Card in Chat ============ */
const MusicCardPlayable = ({ metadata, isMine }) => {
  const { currentTrack, isPlaying, play, toggle, isLoading: playerLoading } = usePlayer();
  const meta = metadata || {};
  const [playError, setPlayError] = useState(false);

  const trackObj = useMemo(() => ({
    id: meta.track_id,
    title: meta.track_title || 'Трек',
    artist: meta.track_artist || 'Исполнитель',
    duration: meta.track_duration,
    cover: meta.cover_url,
  }), [meta.track_id, meta.track_title, meta.track_artist, meta.track_duration, meta.cover_url]);

  const isCurrentTrack = Boolean(meta.track_id) && currentTrack?.id === meta.track_id;
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;
  const isLoadingThis = isCurrentTrack && playerLoading;

  const handlePlayClick = async (e) => {
    e.stopPropagation();
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light'); } catch (err) {}
    setPlayError(false);
    
    try {
      if (isCurrentTrack) {
        toggle();
      } else if (meta.track_id) {
        console.log('🎵 Playing track from chat message:', meta.track_title, 'id:', meta.track_id);
        await play(trackObj, [trackObj]);
      } else {
        console.warn('🎵 No track_id in music message metadata');
        setPlayError(true);
      }
    } catch (err) {
      console.error('Music play error:', err);
      setPlayError(true);
    }
  };

  const formatDur = (sec) => {
    if (!sec) return '';
    return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  };

  return (
    <div
      className={`mt-1.5 p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
        isCurrentTrack
          ? (isMine ? 'bg-white/10 border-white/20' : 'bg-purple-500/15 border-purple-500/30')
          : (isMine ? 'bg-white/[0.08] border-white/[0.08] hover:bg-white/[0.14]' : 'bg-white/[0.06] border-white/[0.06] hover:bg-white/[0.10]')
      }`}
      onClick={handlePlayClick}
    >
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden relative">
        {meta.cover_url ? (
          <img src={meta.cover_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <Music className="w-5 h-5 text-purple-400" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
          {isLoadingThis ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : isCurrentlyPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white ml-0.5" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold truncate ${isCurrentTrack ? 'text-purple-300' : 'text-white'}`}>
          {meta.track_title || 'Трек'}
        </p>
        <p className="text-[11px] text-gray-400 truncate">{meta.track_artist || 'Исполнитель'}</p>
        {playError && <p className="text-[10px] text-red-400 mt-0.5">Трек недоступен</p>}
      </div>
      <div className="text-[11px] text-gray-500">{formatDur(meta.track_duration)}</div>
    </div>
  );
};

/* ============ Chat Music Picker ============ */
const ChatMusicPicker = ({ isOpen, onClose, onSelectTrack }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [popularTracks, setPopularTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sendingTrackId, setSendingTrackId] = useState(null);
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Загружаем популярные треки при открытии
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
      // Загрузить популярные треки если ещё не загружены
      if (popularTracks.length === 0) {
        (async () => {
          try {
            const data = await musicAPI.search('популярное 2025', 15);
            if (data?.tracks?.length > 0) {
              setPopularTracks(data.tracks);
            }
          } catch (e) {
            console.log('Popular tracks load failed:', e);
          }
        })();
      }
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSearched(false);
      setSendingTrackId(null);
    }
  }, [isOpen]);

  const doSearch = async (q) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await musicAPI.search(q, 20);
      setResults(data?.tracks || []);
    } catch (e) {
      console.error('Music search error:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => doSearch(val), 400);
  };

  const handleTrackClick = (track) => {
    if (track.is_blocked || track.content_restricted || sendingTrackId) return;
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light'); } catch (e) {}
    setSendingTrackId(track.id);
    onSelectTrack(track);
  };

  const formatDuration = (sec) => {
    if (!sec) return '';
    return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] flex flex-col"
      style={{ backgroundColor: 'rgba(10,10,16,0.99)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/[0.06]"
        style={{ backgroundColor: 'rgba(16,16,22,0.95)' }}>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={handleInputChange}
              placeholder="Найти музыку для отправки..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-[14px] placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : searched && results.length > 0 ? (
          <div className="space-y-1.5">
            {results.map((track, idx) => {
              const isBlocked = track.is_blocked || track.content_restricted;
              const isSending = sendingTrackId === track.id;
              return (
                <motion.div
                  key={track.id || idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: isBlocked ? 0.4 : 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => handleTrackClick(track)}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isSending ? 'bg-purple-500/10 border border-purple-500/20' :
                    isBlocked ? 'bg-white/[0.02] cursor-not-allowed' : 'bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {track.cover ? (
                      <img src={track.cover} alt="" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Music className="w-5 h-5 text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white truncate">{track.title}</p>
                    <p className="text-[11px] text-gray-400 truncate">{track.artist}</p>
                  </div>
                  <span className="text-[11px] text-gray-500 flex-shrink-0">{formatDuration(track.duration)}</span>
                  {!isBlocked && (
                    isSending ? <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" /> :
                    <Send className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
              <Music className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400 text-[14px]">Ничего не найдено</p>
            <p className="text-gray-600 text-[12px] mt-1">Попробуйте другой запрос</p>
          </div>
        ) : popularTracks.length > 0 ? (
          <div>
            <p className="text-[12px] text-gray-500 font-medium uppercase tracking-wider mb-3 px-1">Популярное</p>
            <div className="space-y-1.5">
              {popularTracks.map((track, idx) => {
                const isBlocked = track.is_blocked || track.content_restricted;
                const isSending = sendingTrackId === track.id;
                return (
                  <motion.div
                    key={track.id || idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: isBlocked ? 0.4 : 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => handleTrackClick(track)}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isSending ? 'bg-purple-500/10 border border-purple-500/20' :
                      isBlocked ? 'bg-white/[0.02] cursor-not-allowed' : 'bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer active:scale-[0.98]'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {track.cover ? (
                        <img src={track.cover} alt="" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <Music className="w-5 h-5 text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white truncate">{track.title}</p>
                      <p className="text-[11px] text-gray-400 truncate">{track.artist}</p>
                    </div>
                    <span className="text-[11px] text-gray-500 flex-shrink-0">{formatDuration(track.duration)}</span>
                    {!isBlocked && (
                      isSending ? <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" /> :
                      <Send className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/15 to-pink-500/15 flex items-center justify-center mx-auto mb-5">
              <Music className="w-10 h-10 text-purple-400/50" />
            </div>
            <h3 className="text-[17px] font-semibold text-gray-300 mb-2">Отправить музыку</h3>
            <p className="text-[13px] text-gray-500 max-w-[240px] mx-auto leading-relaxed">
              Найдите трек и нажмите на него, чтобы отправить
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ============ MAIN ChatModal ============ */
const ChatModal = ({ isOpen, onClose, friend, currentUserId, friends: allFriends, onOpenProfile }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [toast, setToast] = useState(null);

  // Feature states
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [highlightMsgId, setHighlightMsgId] = useState(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [preEditText, setPreEditText] = useState(''); // текст до начала редактирования

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);
  const typingRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  const friendName = useMemo(() => {
    if (!friend) return '';
    return [friend.first_name, friend.last_name].filter(Boolean).join(' ') || friend.username || 'Пользователь';
  }, [friend]);

  // === Init ===
  const initConversation = useCallback(async () => {
    if (!currentUserId || !friend?.telegram_id) return;
    setIsLoading(true);
    try {
      const conv = await messagesAPI.createOrGetConversation(currentUserId, friend.telegram_id);
      setConversationId(conv.id);
      if (conv.pinned_message) setPinnedMessage(conv.pinned_message);
      const data = await messagesAPI.getMessages(conv.id, currentUserId, 50, 0);
      setMessages((data.messages || []).reverse());
      setHasMore(data.has_more || false);
      await messagesAPI.markAsRead(conv.id, currentUserId);
    } catch (e) { console.error('Init error:', e); }
    finally { setIsLoading(false); }
  }, [currentUserId, friend?.telegram_id]);

  useEffect(() => {
    if (isOpen && friend?.telegram_id) initConversation();
    return () => {
      setMessages([]); setConversationId(null); setInputText(''); setIsLoading(true);
      setReplyTo(null); setEditingMessage(null); setPinnedMessage(null);
      setShowEmojiPicker(false); setShowSearch(false); setShowAttachMenu(false);
      setShowSchedulePicker(false); setShowMusicPicker(false);
    };
  }, [isOpen, friend?.telegram_id, initConversation]);

  // Auto-scroll только если пользователь уже внизу (не читает старые сообщения)
  const isNearBottomRef = useRef(true);
  useEffect(() => {
    if (!isLoading && messagesEndRef.current && isNearBottomRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isLoading]);

  // Polling messages + typing (оптимизировано: 1 основной запрос + typing)
  useEffect(() => {
    if (!isOpen || !conversationId || !currentUserId) return;
    let isActive = true;
    const poll = async () => {
      if (!isActive) return;
      try {
        // Основной запрос: сообщения (включает unread подсчёт через markAsRead)
        const data = await messagesAPI.getMessages(conversationId, currentUserId, 50, 0);
        if (!isActive) return;
        const newMsgs = (data.messages || []).reverse();
        setMessages(prev => {
          if (newMsgs.length !== prev.length || (newMsgs.length > 0 && prev.length > 0 && newMsgs[newMsgs.length - 1]?.id !== prev[prev.length - 1]?.id)) return newMsgs;
          // Обновляем изменённые сообщения (reactions, read_at, edited_at, is_pinned)
          let hasChanges = false;
          const updated = prev.map(msg => {
            const fresh = newMsgs.find(m => m.id === msg.id);
            if (fresh && (fresh.read_at !== msg.read_at || JSON.stringify(fresh.reactions) !== JSON.stringify(msg.reactions) || fresh.edited_at !== msg.edited_at || fresh.is_pinned !== msg.is_pinned)) {
              hasChanges = true;
              return fresh;
            }
            return msg;
          });
          return hasChanges ? updated : prev;
        });
        // markAsRead — только если есть непрочитанные (из data.total)
        await messagesAPI.markAsRead(conversationId, currentUserId);
        
        // Pinned + Typing в параллель  
        const [pinnedData, typingData] = await Promise.all([
          messagesAPI.getPinnedMessage(conversationId).catch(() => null),
          messagesAPI.getTyping(conversationId, currentUserId).catch(() => ({ typing_users: [] })),
        ]);
        if (!isActive) return;
        if (pinnedData) {
          const newPinned = pinnedData?.pinned_message || null;
          setPinnedMessage(prev => {
            if (!newPinned && !prev) return prev;
            if (!newPinned && prev) return null;
            if (newPinned && !prev) return newPinned;
            if (newPinned && prev && newPinned.id !== prev.id) return newPinned;
            return prev;
          });
        }
        setTypingUsers(typingData?.typing_users || []);
      } catch (e) { /* silent */ }
    };
    pollRef.current = setInterval(poll, 4000);
    return () => { isActive = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, [isOpen, conversationId, currentUserId]);

  // === Handlers ===
  const scrollToMessage = useCallback((msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setHighlightMsgId(msgId); setTimeout(() => setHighlightMsgId(null), 2000); }
  }, []);

  const loadMore = useCallback(async () => {
    if (!conversationId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      // Cursor-based: загружаем сообщения ДО самого старого в текущем списке
      const oldestMsg = messages[0]; // messages отсортированы от старых к новым
      const beforeId = oldestMsg?.id || '';
      const data = await messagesAPI.getMessages(conversationId, currentUserId, 30, 0, beforeId);
      const olderMsgs = (data.messages || []).reverse();
      if (olderMsgs.length > 0) {
        setMessages(prev => [...olderMsgs, ...prev]);
      }
      setHasMore(data.has_more || false);
    } catch (e) { console.error(e); }
    finally { setLoadingMore(false); }
  }, [conversationId, currentUserId, messages, loadingMore, hasMore]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(() => {
    if (!conversationId || !currentUserId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now;
      messagesAPI.setTyping(conversationId, currentUserId);
    }
  }, [conversationId, currentUserId]);

  // Reset textarea height
  const resetTextareaHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = '44px';
    }
  }, []);

  // Send message
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending || !friend?.telegram_id) return;

    // Edit mode
    if (editingMessage) {
      setIsSending(true);
      try {
        const updated = await messagesAPI.editMessage(editingMessage.id, currentUserId, text);
        setMessages(prev => prev.map(m => m.id === editingMessage.id ? updated : m));
        setEditingMessage(null); setInputText(''); setPreEditText('');
        resetTextareaHeight();
        setToast('Сообщение отредактировано');
      } catch (e) { console.error(e); }
      finally { setIsSending(false); }
      return;
    }

    setIsSending(true); setInputText('');
    resetTextareaHeight();
    const optimistic = { id: `temp-${Date.now()}`, conversation_id: conversationId, sender_id: currentUserId, text, message_type: 'text', created_at: new Date().toISOString(), read_at: null, is_deleted: false, edited_at: null, is_pinned: false, reply_to: replyTo ? { message_id: replyTo.id, sender_id: replyTo.sender_id, sender_name: replyTo.sender_id === currentUserId ? 'Вы' : friendName, text: replyTo.text?.substring(0, 100) } : null, reactions: [], metadata: null, forwarded_from: null, _optimistic: true };
    setMessages(prev => [...prev, optimistic]);
    setReplyTo(null);
    isNearBottomRef.current = true; // Автоскролл к своему сообщению

    try {
      const sent = await messagesAPI.sendMessage(currentUserId, friend.telegram_id, text, replyTo?.id);
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m));
      if (sent.conversation_id && !conversationId) setConversationId(sent.conversation_id);
    } catch (e) {
      // Показываем ошибку вместо молчаливого удаления
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInputText(text);
      setToast('Ошибка отправки');
    } finally { setIsSending(false); inputRef.current?.focus(); }
  };

  // Message actions
  const handleMessageAction = useCallback(async (action, message, extra) => {
    switch (action) {
      case 'reply':
        setReplyTo(message);
        setEditingMessage(null);
        if (preEditText) { setInputText(preEditText); setPreEditText(''); }
        inputRef.current?.focus();
        break;
      case 'edit':
        setPreEditText(inputText); // Сохраняем текущий текст перед редактированием
        setEditingMessage(message);
        setInputText(message.text);
        setReplyTo(null);
        inputRef.current?.focus();
        break;
      case 'delete':
        try {
          await messagesAPI.deleteMessage(message.id, currentUserId);
          setMessages(prev => prev.filter(m => m.id !== message.id));
          setToast('Сообщение удалено');
        } catch (e) { console.error(e); }
        break;
      case 'addReaction':
        try {
          const updated = await messagesAPI.toggleReaction(message.id, currentUserId, extra);
          setMessages(prev => prev.map(m => m.id === message.id ? updated : m));
        } catch (e) { console.error(e); }
        break;
      case 'pin':
        try {
          const newPinned = !message.is_pinned;
          await messagesAPI.pinMessage(message.id, currentUserId, newPinned);
          setMessages(prev => prev.map(m => {
            if (m.id === message.id) return { ...m, is_pinned: newPinned };
            if (newPinned && m.is_pinned) return { ...m, is_pinned: false };
            return m;
          }));
          if (newPinned) { setPinnedMessage({ ...message, is_pinned: true }); setToast('Сообщение закреплено'); }
          else { setPinnedMessage(null); setToast('Сообщение откреплено'); }
        } catch (e) { console.error(e); }
        break;
      case 'forward':
        setForwardMessage(message);
        setShowForwardModal(true);
        break;
      case 'copy':
        navigator.clipboard?.writeText(message.text);
        setToast('Скопировано');
        break;
      case 'task':
        try {
          await messagesAPI.createTaskFromMessage(currentUserId, message.id);
          setToast('Задача создана');
        } catch (e) { console.error(e); }
        break;
      case 'scrollToMessage':
        scrollToMessage(extra);
        break;
      default: break;
    }
  }, [currentUserId, scrollToMessage, friendName]);

  const handleForward = useCallback(async (targetFriend) => {
    if (!forwardMessage || !targetFriend) return;
    try {
      await messagesAPI.forwardMessage(currentUserId, targetFriend.telegram_id, forwardMessage.id);
      setToast(`Переслано ${targetFriend.first_name || 'другу'}`);
    } catch (e) { console.error(e); }
    setShowForwardModal(false); setForwardMessage(null);
  }, [forwardMessage, currentUserId]);

  // Schedule share with date selection
  const handleSendSchedule = async (dateStr) => {
    if (!friend?.telegram_id) return;
    try {
      // dateStr can be single date "2025-07-10" or multiple "2025-07-10,2025-07-11,..."
      const dates = dateStr.split(',').filter(Boolean);
      for (const date of dates) {
        const msg = await messagesAPI.sendSchedule(currentUserId, friend.telegram_id, date);
        if (msg && msg.id) {
          setMessages(prev => [...prev, msg]);
        }
      }
      setToast(dates.length > 1 ? `Расписание на ${dates.length} дней отправлено` : 'Расписание отправлено');
    } catch (e) {
      console.error('Send schedule error:', e);
      setToast('Ошибка отправки расписания');
    }
  };

  // Music share — открыть пикер
  const handleSendMusic = () => {
    setShowAttachMenu(false);
    setShowEmojiPicker(false);
    setShowSchedulePicker(false);
    setShowMusicPicker(true);
  };

  // Обработчик выбора трека для отправки
  const handleMusicTrackSelected = async (track) => {
    if (!friend?.telegram_id || !track) return;
    setShowMusicPicker(false);
    try {
      const trackData = {
        track_title: track.title || 'Трек',
        track_artist: track.artist || 'Неизвестный',
        track_id: track.id || null,
        track_duration: track.duration || 0,
        cover_url: track.cover || null,
      };
      console.log('🎵 Sending music:', trackData);
      const msg = await messagesAPI.sendMusic(currentUserId, friend.telegram_id, trackData);
      if (msg) {
        setMessages(prev => [...prev, msg]);
        if (msg.conversation_id && !conversationId) setConversationId(msg.conversation_id);
        isNearBottomRef.current = true;
        setToast('Музыка отправлена 🎵');
      }
    } catch (e) {
      console.error('Send music error:', e);
      setToast('Ошибка отправки музыки: ' + (e.message || 'неизвестная ошибка'));
    }
  };

  // Scroll handler
  const handleScroll = () => {
    const c = messagesContainerRef.current;
    if (!c) return;
    const { scrollTop, scrollHeight, clientHeight } = c;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollDown(distanceFromBottom > 120);
    isNearBottomRef.current = distanceFromBottom < 80;
    if (scrollTop < 80 && hasMore && !loadingMore) loadMore();
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups = []; let lastDate = '', lastSenderId = null;
    messages.filter(Boolean).forEach((msg, idx) => {
      if (!msg || !msg.id) return;
      const msgDate = parseUTC(msg.created_at).toDateString();
      if (msgDate !== lastDate) { groups.push({ type: 'date', date: msg.created_at, key: `date-${msgDate}-${idx}` }); lastDate = msgDate; lastSenderId = null; }
      const nextMsg = messages[idx + 1];
      const isFirst = msg.sender_id !== lastSenderId;
      const isLast = !nextMsg || nextMsg.sender_id !== msg.sender_id || parseUTC(nextMsg.created_at).toDateString() !== msgDate;
      groups.push({ type: 'message', message: msg, isFirst, isLast, showAvatar: isFirst, key: msg.id });
      lastSenderId = msg.sender_id;
    });
    return groups;
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') {
      if (editingMessage) {
        setEditingMessage(null);
        setInputText(preEditText); // Восстанавливаем текст до редактирования
        setPreEditText('');
      } else {
        setReplyTo(null);
        setInputText('');
      }
      resetTextareaHeight();
    }
  };

  if (!friend) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex flex-col" style={{ backgroundColor: 'rgba(10,10,16,0.99)' }}>

          {/* Toast */}
          <AnimatePresence>{toast && <Toast message={toast} onHide={() => setToast(null)} />}</AnimatePresence>

          {/* Header */}
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}
            className="flex items-center gap-3 px-3 py-3 border-b border-white/[0.06] relative"
            style={{ backgroundColor: 'rgba(16,16,22,0.95)', backdropFilter: 'blur(20px)' }}>
            <motion.button whileTap={{ scale: 0.85 }} onClick={onClose} className="p-2 -ml-1 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all">
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer active:opacity-70 transition-opacity"
              onClick={() => {
                if (onOpenProfile && friend) {
                  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light'); } catch (e) {}
                  onOpenProfile(friend);
                }
              }}
            >
              <Avatar telegramId={friend.telegram_id} firstName={friend.first_name} size={40} />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[15px] text-white truncate leading-tight">{friendName}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {typingUsers.length > 0 ? (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] text-purple-400 font-medium">печатает...</motion.span>
                  ) : friend.is_online ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />в сети</span>
                  ) : (
                    <span className="text-[11px] text-gray-500">{friend.group_name || (friend.username ? `@${friend.username}` : '')}</span>
                  )}
                </div>
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => setShowSearch(true)}
              className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all">
              <Search className="w-[18px] h-[18px]" />
            </motion.button>

            {/* Search Panel */}
            <AnimatePresence>
              {showSearch && <SearchPanel isOpen onClose={() => setShowSearch(false)} conversationId={conversationId} telegramId={currentUserId} onScrollToMessage={scrollToMessage} />}
            </AnimatePresence>
          </motion.div>

          {/* Pinned Message */}
          <AnimatePresence>
            {pinnedMessage && (
              <PinnedBanner message={pinnedMessage} onScroll={scrollToMessage}
                onUnpin={(id) => handleMessageAction('pin', { ...pinnedMessage, is_pinned: true })} />
            )}
          </AnimatePresence>

          {/* Messages Area */}
          <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-2.5 py-3"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%,rgba(139,92,246,0.03) 0%,transparent 50%),radial-gradient(circle at 80% 50%,rgba(59,130,246,0.03) 0%,transparent 50%)' }}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" /><p className="text-gray-500 text-[13px]">Загрузка...</p>
                </motion.div>
              </div>
            ) : messages.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/15 to-blue-500/15 flex items-center justify-center mb-5"><span className="text-4xl">💬</span></div>
                <h3 className="text-[17px] font-semibold text-gray-300 mb-2">Начните диалог</h3>
                <p className="text-[13px] text-gray-500 max-w-[260px] leading-relaxed">Напишите первое сообщение {friendName}</p>
              </motion.div>
            ) : (
              <>
                {loadingMore && <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 text-purple-400/50 animate-spin" /></div>}
                {hasMore && !loadingMore && (
                  <button onClick={loadMore} className="w-full text-center py-2 text-purple-400 text-[12px] font-medium hover:text-purple-300 transition-colors">Загрузить ещё</button>
                )}
                {groupedMessages.map(item => {
                  if (item.type === 'date') return (
                    <motion.div key={item.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center my-3">
                      <span className="px-3 py-1 bg-white/[0.06] backdrop-blur-sm rounded-full text-[11px] text-gray-400 font-medium">{formatDateSeparator(item.date)}</span>
                    </motion.div>
                  );
                  return (
                    <MessageBubble key={item.key} message={item.message} isMine={item.message.sender_id === currentUserId}
                      showAvatar={item.showAvatar} friend={friend} onAction={handleMessageAction}
                      isFirst={item.isFirst} isLast={item.isLast} currentUserId={currentUserId} highlightId={highlightMsgId} />
                  );
                })}
                {/* Typing indicator */}
                <AnimatePresence>
                  {typingUsers.map(u => <TypingDots key={u.telegram_id} name={u.name} />)}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Scroll to bottom */}
          <AnimatePresence>
            {showScrollDown && (
              <motion.button initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 10 }}
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="absolute bottom-28 right-4 z-50 p-2.5 bg-gray-800/90 backdrop-blur-lg border border-white/10 rounded-full shadow-xl text-gray-300 hover:text-white transition-colors">
                <ChevronDown className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Reply / Edit banner */}
          <AnimatePresence>
            {(replyTo || editingMessage) && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-3"
                style={{ backgroundColor: 'rgba(16,16,22,0.95)' }}>
                <div className={`w-1 h-10 rounded-full ${editingMessage ? 'bg-emerald-400' : 'bg-purple-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-semibold ${editingMessage ? 'text-emerald-400' : 'text-purple-400'}`}>
                    {editingMessage ? 'Редактирование' : `Ответ ${replyTo?.sender_id === currentUserId ? 'себе' : friendName}`}
                  </p>
                  <p className="text-[12px] text-gray-400 truncate">{editingMessage?.text || replyTo?.text}</p>
                </div>
                <button onClick={() => {
                    if (editingMessage) {
                      setEditingMessage(null);
                      setInputText(preEditText);
                      setPreEditText('');
                    } else {
                      setReplyTo(null);
                    }
                    resetTextareaHeight();
                  }}
                  className="p-1.5 text-gray-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="px-3 py-3 border-t border-white/[0.06] relative"
            style={{ backgroundColor: 'rgba(16,16,22,0.95)', backdropFilter: 'blur(20px)' }}>

            {/* Emoji Picker */}
            <AnimatePresence>
              <EmojiPicker isOpen={showEmojiPicker} onSelect={(e) => { setInputText(prev => prev + e); inputRef.current?.focus(); }}
                onClose={() => setShowEmojiPicker(false)} />
            </AnimatePresence>

            {/* Attach Menu */}
            <AnimatePresence>
              <AttachMenu isOpen={showAttachMenu} onClose={() => setShowAttachMenu(false)}
                onAction={(a) => {
                  if (a === 'schedule') { setShowSchedulePicker(true); setShowAttachMenu(false); }
                  if (a === 'music') { handleSendMusic(); }
                }} />
            </AnimatePresence>

            {/* Schedule Date Picker */}
            <AnimatePresence>
              <ScheduleDatePicker isOpen={showSchedulePicker} onClose={() => setShowSchedulePicker(false)}
                onSend={handleSendSchedule} />
            </AnimatePresence>

            <div className="flex items-end gap-2">
              {/* Attach button */}
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }}
                className="p-3 rounded-2xl bg-white/[0.04] text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 transition-all flex-shrink-0">
                <MoreVertical className="w-5 h-5" />
              </motion.button>

              <div className="flex-1 relative">
                <textarea ref={inputRef} value={inputText}
                  onChange={(e) => { setInputText(e.target.value); sendTypingIndicator(); }}
                  onKeyDown={handleKeyDown} placeholder="Сообщение..." rows={1}
                  className="w-full pl-4 pr-11 py-3 bg-white/[0.06] border border-white/[0.08] rounded-2xl text-white text-[14px] placeholder-gray-600 focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.08] transition-all resize-none max-h-[120px] leading-[1.4]"
                  style={{ minHeight: '44px' }}
                  onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }} />
                <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-yellow-400 transition-colors">
                  <Smile className="w-5 h-5" />
                </button>
              </div>

              <motion.button whileTap={{ scale: 0.85 }} onClick={handleSend} disabled={!inputText.trim() || isSending}
                className={`p-3 rounded-2xl transition-all duration-200 flex-shrink-0 ${
                  inputText.trim() ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25 hover:bg-purple-400' : 'bg-white/[0.06] text-gray-600'
                }`}>
                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : editingMessage ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              </motion.button>
            </div>
          </motion.div>

          {/* Forward Modal */}
          <AnimatePresence>
            {showForwardModal && <ForwardModal isOpen onClose={() => { setShowForwardModal(false); setForwardMessage(null); }}
              friends={allFriends?.filter(f => f.telegram_id !== friend?.telegram_id)} onForward={handleForward} />}
          </AnimatePresence>

          {/* Music Picker Modal */}
          <AnimatePresence>
            {showMusicPicker && <ChatMusicPicker isOpen onClose={() => setShowMusicPicker(false)} onSelectTrack={handleMusicTrackSelected} />}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatModal;
