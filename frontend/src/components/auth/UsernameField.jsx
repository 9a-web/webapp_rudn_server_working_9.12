/**
 * UsernameField — поле выбора username с debounced-проверкой доступности
 * и автоматическим показом свободных альтернатив.
 *
 * 🔒 Stage 6/7/Now:
 *  - Не агрессивно нормализуем при каждом вводе (это вызывало прыжки caret'а
 *    при быстрой печати на мобиле). Запрещаем недопустимые символы
 *    через onKeyDown.
 *  - Race-safe debounced check-username с AbortController.
 *  - NEW: если username status === 'taken' (или прокинут `suggestBase` —
 *    напр. конфликт Telegram-username), автоматически тянем альтернативы
 *    через /auth/suggest-username и показываем кликабельные чипы под полем.
 *
 * Props:
 *  - value, onChange — управляемое значение
 *  - onValidChange(bool) — колбэк валидности
 *  - suggestBase?: string — если передан, при пустом значении сразу подгружаем
 *    альтернативы для этого base (напр. для занятого telegram-username).
 *  - showSuggestions?: boolean (default true) — показывать ли чипы-варианты.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AtSign, Check, X, Loader2, Sparkles } from 'lucide-react';
import AuthInput from './AuthInput';
import { authAPI } from '../../services/authAPI';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const ALLOWED_CHAR_RE = /^[a-zA-Z0-9_]$/;

// Управляющие клавиши, которые НЕ блокируем
const ALLOW_KEYS = new Set([
  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
]);

const UsernameField = ({
  value,
  onChange,
  onValidChange,
  suggestBase = '',
  showSuggestions = true,
}) => {
  const [status, setStatus] = useState('idle');
  // idle | checking | available | taken | invalid
  const [reason, setReason] = useState(null);
  const timerRef = useRef(null);
  // Защита от race condition при быстром изменении значения.
  const seqRef = useRef(0);
  const abortRef = useRef(null);

  // ===== Suggestions state =====
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsAbortRef = useRef(null);
  const lastFetchedBaseRef = useRef(null);

  // Грузит альтернативы для указанного `base` (или generic если base пустой).
  // Идемпотентно: повторный вызов для того же base не дёргает сеть.
  const fetchSuggestions = useCallback(async (base) => {
    if (!showSuggestions) return;
    const normalized = (base || '').trim().toLowerCase();
    if (lastFetchedBaseRef.current === normalized) return;
    lastFetchedBaseRef.current = normalized;

    // Отменяем предыдущий запрос
    suggestionsAbortRef.current?.abort?.();
    const ac = new AbortController();
    suggestionsAbortRef.current = ac;

    setSuggestionsLoading(true);
    try {
      const res = await authAPI.suggestUsername(normalized, 5, { signal: ac.signal });
      if (ac.signal.aborted) return;
      setSuggestions(Array.isArray(res?.suggestions) ? res.suggestions : []);
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.name === 'AbortError' || ac.signal.aborted) return;
      // Тихо игнорируем: альтернативы — это nice-to-have, не блокирующий UX
      setSuggestions([]);
    } finally {
      if (!ac.signal.aborted) setSuggestionsLoading(false);
    }
  }, [showSuggestions]);

  // При монтировании / изменении suggestBase: если поле пустое — сразу грузим
  // подсказки для base (напр. для конфликта tg-username).
  useEffect(() => {
    if (!showSuggestions) return;
    if (suggestBase && !value) {
      fetchSuggestions(suggestBase);
    }
  }, [suggestBase, value, fetchSuggestions, showSuggestions]);

  useEffect(() => {
    if (!value) {
      setStatus('idle'); setReason(null);
      onValidChange?.(false);
      abortRef.current?.abort?.();
      return undefined;
    }
    // Для проверки используем lowercase (backend всё равно case-insensitive)
    const normalized = value.toLowerCase();
    if (!USERNAME_RE.test(normalized)) {
      setStatus('invalid');
      setReason('3–32 символа, только a-z, 0-9, _');
      onValidChange?.(false);
      abortRef.current?.abort?.();
      return undefined;
    }
    setStatus('checking'); setReason(null);
    clearTimeout(timerRef.current);
    const mySeq = ++seqRef.current;
    // Отменяем предыдущий in-flight request
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    timerRef.current = setTimeout(async () => {
      try {
        const res = await authAPI.checkUsername(normalized, { signal: ac.signal });
        if (mySeq !== seqRef.current) return;
        if (res.available) {
          setStatus('available'); setReason(null); onValidChange?.(true);
        } else {
          setStatus('taken'); setReason(res.reason || 'Занято'); onValidChange?.(false);
          // ВАЖНО: при «taken» сразу подгружаем альтернативы на основе текущего ввода.
          // Это и есть main UX-фикс: пользователь ввёл занятый ник — мгновенно видит варианты.
          if (showSuggestions) fetchSuggestions(normalized);
        }
      } catch (e) {
        if (e?.name === 'CanceledError' || e?.name === 'AbortError' || ac.signal.aborted) return;
        if (mySeq !== seqRef.current) return;
        const code = e?.response?.status;
        if (code === 429) {
          setStatus('invalid');
          setReason('Слишком часто. Подождите секунду.');
        } else if (code && code >= 500) {
          setStatus('invalid');
          setReason('Сервис недоступен. Попробуйте ещё раз.');
        } else {
          setStatus('invalid'); setReason(e.message);
        }
        onValidChange?.(false);
      }
    }, 400);
    return () => {
      clearTimeout(timerRef.current);
      ac.abort();
    };
  }, [value, onValidChange, fetchSuggestions, showSuggestions]);

  // Блокируем недопустимые символы на лету (включая Cyrillic, пробелы)
  const handleKeyDown = (e) => {
    if (ALLOW_KEYS.has(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;
    if (e.key.length === 1 && !ALLOWED_CHAR_RE.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
    onChange(raw);
  };

  const handleSuggestionClick = (s) => {
    // Заполняем поле — useEffect выше сделает повторный check (должен вернуть available)
    onChange(s);
    // Сбрасываем lastFetched, чтобы при следующем «taken» снова показать варианты
    lastFetchedBaseRef.current = null;
  };

  const rightSlot =
    status === 'checking' ? <Loader2 size={16} className="animate-spin text-white/40" />
      : status === 'available' ? <Check size={16} className="text-emerald-400" />
        : status === 'taken' || status === 'invalid' ? <X size={16} className="text-red-400" />
          : null;

  // Когда показывать чипы:
  // 1) Ввод «taken» — показать варианты для текущего ввода;
  // 2) suggestBase прокинут И поле пустое — показать варианты для base.
  const shouldShowChips = showSuggestions && suggestions.length > 0 && (
    status === 'taken' || (!value && !!suggestBase)
  );

  return (
    <div className="space-y-2">
      <AuthInput
        icon={AtSign}
        type="text"
        label="Username"
        placeholder="john_doe"
        autoComplete="username"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={32}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rightSlot={rightSlot}
        error={status === 'taken' || status === 'invalid' ? reason : null}
        hint={
          status === 'available' ? 'Доступно'
            : status === 'idle' && !suggestBase ? 'Будет виден в публичном профиле (ссылка — всегда по UID)'
              : null
        }
      />

      {/* Чипы-альтернативы */}
      {shouldShowChips && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs text-amber-300/90 mb-1.5">
            <Sparkles size={12} />
            <span>Свободные варианты — нажмите, чтобы выбрать:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSuggestionClick(s)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-white/10 hover:bg-emerald-500/25 hover:text-emerald-100 text-white/85 border border-white/10 hover:border-emerald-400/40 transition-colors"
                title={`Выбрать @${s}`}
              >
                @{s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loader для suggestions (без чипов ещё) */}
      {showSuggestions && suggestionsLoading && suggestions.length === 0 && !value && suggestBase && (
        <div className="flex items-center gap-1.5 text-xs text-white/40 px-3">
          <Loader2 size={12} className="animate-spin" />
          <span>Подбираем альтернативы…</span>
        </div>
      )}
    </div>
  );
};

export default UsernameField;
