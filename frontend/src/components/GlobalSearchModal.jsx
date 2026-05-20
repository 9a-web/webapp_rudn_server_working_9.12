/**
 * GlobalSearchModal — модальное окно глобального поиска пользователей.
 *
 * Открывается по:
 *  - клику на иконку поиска в header'е приложения;
 *  - keyboard shortcut Cmd/Ctrl + K;
 *  - программно (props.isOpen).
 *
 * Особенности:
 *  - Поддерживает анонимный поиск (работает без авторизации).
 *  - Debounced query (300ms) с AbortController.
 *  - Богатые карточки результатов: аватар, имя, ник, группа, online, level, друг ли.
 *  - Клик по карточке → переход на `/u/{uid}` (публичный профиль).
 *  - Keyboard nav: ↑↓ для выбора, Enter — открыть, ESC — закрыть.
 *  - Состояния: empty / loading / no-results / results / error.
 *  - Пагинация: «Показать ещё» при has_more.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, AtSign, Users, Circle, Sparkles, ChevronRight } from 'lucide-react';
import { searchAPI } from '../services/searchAPI';

// === Avatar helpers ==========================================================

const COLOR_PALETTE = [
  ['#FF6B6B', '#EE5A6F'],
  ['#4ECDC4', '#44A08D'],
  ['#A8E6CF', '#56CCF2'],
  ['#FFD93D', '#FF9F45'],
  ['#6C5CE7', '#A29BFE'],
  ['#FD79A8', '#E84393'],
  ['#74B9FF', '#0984E3'],
  ['#55EFC4', '#00B894'],
];

const pickAvatarGradient = (seed) => {
  if (!seed) return COLOR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < String(seed).length; i++) {
    h = (h * 31 + String(seed).charCodeAt(i)) & 0xffffffff;
  }
  return COLOR_PALETTE[Math.abs(h) % COLOR_PALETTE.length];
};

const getInitials = (user) => {
  const f = (user.first_name || '').trim();
  const l = (user.last_name || '').trim();
  if (f || l) return ((f[0] || '') + (l[0] || '')).toUpperCase();
  const u = (user.username || '').trim();
  if (u) return u.slice(0, 2).toUpperCase();
  return '?';
};

// === ResultCard ==============================================================

const ResultCard = ({ user, isActive, onClick, getCustomAvatarUrl }) => {
  const [gFrom, gTo] = pickAvatarGradient(user.uid || user.telegram_id || user.username);
  const initials = getInitials(user);
  const customUrl =
    user.has_custom_avatar && (user.uid || user.telegram_id)
      ? getCustomAvatarUrl(user)
      : null;

  const friendshipBadge = useMemo(() => {
    switch (user.friendship_status) {
      case 'friend':
        return { text: 'друг', color: 'text-emerald-300', bg: 'bg-emerald-500/15' };
      case 'pending_outgoing':
        return { text: 'заявка отправлена', color: 'text-amber-300', bg: 'bg-amber-500/15' };
      case 'pending_incoming':
        return { text: 'хочет добавить', color: 'text-blue-300', bg: 'bg-blue-500/15' };
      default:
        return null;
    }
  }, [user.friendship_status]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl p-3 transition-all border ${
        isActive
          ? 'bg-white/8 border-white/15 scale-[1.01]'
          : 'bg-white/4 border-transparent hover:bg-white/7 hover:border-white/8'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          {customUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img
              src={customUrl}
              className="w-12 h-12 rounded-full object-cover border border-white/10"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm border border-white/10"
              style={{ background: `linear-gradient(135deg, ${gFrom}, ${gTo})` }}
            >
              {initials}
            </div>
          )}
          {user.is_online && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#1a1c2e]" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-white text-sm truncate">
              {user.full_name || `User ${user.uid || user.telegram_id || ''}`}
            </span>
            {user.level > 1 && (
              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200">
                LVL {user.level}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/55 truncate mt-0.5">
            {user.username ? (
              <span className="flex items-center gap-0.5 truncate">
                <AtSign size={11} className="opacity-70 shrink-0" />
                {user.username}
              </span>
            ) : null}
            {user.username && user.group_name && <span className="opacity-40">·</span>}
            {user.group_name && <span className="truncate">{user.group_name}</span>}
          </div>
          {(user.mutual_friends_count > 0 || friendshipBadge) && (
            <div className="flex items-center gap-1.5 mt-1">
              {friendshipBadge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${friendshipBadge.bg} ${friendshipBadge.color}`}
                >
                  {friendshipBadge.text}
                </span>
              )}
              {user.mutual_friends_count > 0 && (
                <span className="text-[10px] text-white/40 flex items-center gap-0.5">
                  <Users size={9} />
                  {user.mutual_friends_count} общих
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronRight size={16} className="text-white/30 shrink-0" />
      </div>
    </button>
  );
};

// === Main ====================================================================

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 15;

const GlobalSearchModal = ({ isOpen, onClose, initialQuery = '' }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  // URL для кастомного аватара (использует REACT_APP_BACKEND_URL под капотом)
  const getCustomAvatarUrl = useCallback((user) => {
    const id = user.uid;
    if (!id) return null;
    // публичный endpoint /api/u/{uid}/avatar — работает и анонимно
    const base = (typeof window !== 'undefined' && window?.process?.env?.REACT_APP_BACKEND_URL) || '';
    // безопасный fallback на относительный URL
    return `${base || ''}/api/u/${encodeURIComponent(id)}/avatar?t=${Date.now()}`;
  }, []);

  // Reset state при открытии
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery || '');
      setResults([]);
      setError(null);
      setActiveIndex(0);
      setOffset(0);
      setHasMore(false);
      // Auto-focus input
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // Cleanup
      abortRef.current?.abort?.();
      clearTimeout(timerRef.current);
    }
  }, [isOpen, initialQuery]);

  // Debounced search effect
  useEffect(() => {
    if (!isOpen) return undefined;
    clearTimeout(timerRef.current);
    abortRef.current?.abort?.();

    const trimmed = (query || '').trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      setHasMore(false);
      setOffset(0);
      return undefined;
    }

    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const data = await searchAPI.global(
          { q: trimmed, limit: PAGE_SIZE, offset: 0 },
          { signal: ac.signal },
        );
        if (ac.signal.aborted) return;
        setResults(data.results || []);
        setHasMore(!!data.has_more);
        setOffset(PAGE_SIZE);
        setActiveIndex(0);
      } catch (e) {
        if (e?.name === 'CanceledError' || e?.name === 'AbortError' || ac.signal.aborted) return;
        setError(e?.message || 'Ошибка поиска');
        setResults([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [query, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (!results.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const u = results[activeIndex];
        if (u) handleSelect(u);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results, activeIndex, onClose]);

  const handleSelect = useCallback(
    (user) => {
      if (!user?.uid) {
        // Fallback: для очень старых записей без uid открываем по tid (legacy)
        if (user?.telegram_id) {
          navigate(`/u/${user.telegram_id}`);
        }
        return;
      }
      navigate(`/u/${user.uid}`);
      onClose?.();
    },
    [navigate, onClose],
  );

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const ac = new AbortController();
      abortRef.current = ac;
      const data = await searchAPI.global(
        { q: (query || '').trim(), limit: PAGE_SIZE, offset },
        { signal: ac.signal },
      );
      if (ac.signal.aborted) return;
      setResults((prev) => [...prev, ...(data.results || [])]);
      setHasMore(!!data.has_more);
      setOffset(offset + PAGE_SIZE);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.name === 'AbortError') return;
      setError(e?.message || 'Не удалось загрузить ещё');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, query, offset]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIndex}"]`);
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-start sm:items-center justify-center p-2 sm:p-4 pt-[10vh] sm:pt-[8vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-2xl bg-[#1a1c2e] rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-search-title"
          >
            {/* Header (input) */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
              <Search size={18} className="text-white/40 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск людей, групп, факультетов…"
                aria-label="Глобальный поиск"
                className="flex-1 bg-transparent text-white placeholder-white/30 outline-none text-base"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {loading && <Loader2 size={16} className="animate-spin text-white/40 shrink-0" />}
              {!loading && query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                  aria-label="Очистить"
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="ml-1 p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                aria-label="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results area */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
              {/* Empty state (no query) */}
              {!query.trim() && !loading && (
                <div className="px-4 py-12 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 mb-3">
                    <Sparkles size={22} className="text-white/40" />
                  </div>
                  <div className="text-white/70 text-sm font-medium">
                    Найдите однокурсников и друзей
                  </div>
                  <div className="text-white/35 text-xs mt-1.5">
                    Введите имя, ник или название группы. Используйте <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">↑</kbd>{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">↓</kbd> для навигации,{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">Enter</kbd> для открытия.
                  </div>
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="mx-2 my-3 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                  {error}
                </div>
              )}

              {/* No results */}
              {query.trim() && !loading && !error && results.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <div className="text-3xl mb-2 opacity-60">🔍</div>
                  <div className="text-white/70 text-sm font-medium">
                    Ничего не найдено по запросу{' '}
                    <span className="font-mono text-white/90">«{query.trim()}»</span>
                  </div>
                  <div className="text-white/40 text-xs mt-1.5">
                    Попробуйте сократить запрос или проверить написание.
                  </div>
                </div>
              )}

              {/* Results */}
              {results.length > 0 && (
                <div className="space-y-1.5">
                  {results.map((u, i) => (
                    <div key={`${u.uid || u.telegram_id || u.username || i}-${i}`} data-idx={i}>
                      <ResultCard
                        user={u}
                        isActive={i === activeIndex}
                        onClick={() => handleSelect(u)}
                        getCustomAvatarUrl={getCustomAvatarUrl}
                      />
                    </div>
                  ))}

                  {hasMore && (
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          Загрузка…
                        </>
                      ) : (
                        'Показать ещё'
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer hint */}
            {results.length > 0 && (
              <div className="px-4 py-2 border-t border-white/8 text-[11px] text-white/35 flex items-center justify-between">
                <span>Найдено: {results.length}{hasMore ? '+' : ''}</span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[9px]">ESC</kbd>{' '}
                  для закрытия
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalSearchModal;
