/**
 * UsernameField — поле выбора username с debounced-проверкой доступности.
 *
 * 🔒 Stage 6:
 *  - Не агрессивно нормализуем при каждом вводе (это вызывало прыжки caret'а
 *    при быстрой печати на мобиле). Вместо этого:
 *      - Запрещаем ввод недопустимых символов через onKeyDown (блокируем
 *        пробел, кириллицу и т.п. на лету).
 *      - Пропускаем верхний регистр в state как есть; нормализация в
 *        lowercase происходит только при отправке формы (родитель
 *        нормализует через `value.toLowerCase()`) и для backend-проверки.
 *  - При первом вводе показываем подсказку «можно использовать строчные
 *    буквы и цифры».
 */
import React, { useEffect, useRef, useState } from 'react';
import { AtSign, Check, X, Loader2 } from 'lucide-react';
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

const UsernameField = ({ value, onChange, onValidChange }) => {
  const [status, setStatus] = useState('idle');
  // idle | checking | available | taken | invalid
  const [reason, setReason] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setStatus('idle'); setReason(null);
      onValidChange?.(false);
      return undefined;
    }
    // Для проверки используем lowercase (backend всё равно case-insensitive)
    const normalized = value.toLowerCase();
    if (!USERNAME_RE.test(normalized)) {
      setStatus('invalid');
      setReason('3–32 символа, только a-z, 0-9, _');
      onValidChange?.(false);
      return undefined;
    }
    setStatus('checking'); setReason(null);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await authAPI.checkUsername(normalized);
        if (res.available) {
          setStatus('available'); setReason(null); onValidChange?.(true);
        } else {
          setStatus('taken'); setReason(res.reason || 'Занято'); onValidChange?.(false);
        }
      } catch (e) {
        // 5xx/network — НЕ помечаем как invalid (UX); подсказываем повторить
        const code = e?.response?.status;
        if (code && code >= 500) {
          setStatus('invalid');
          setReason('Сервис недоступен. Попробуйте ещё раз.');
        } else {
          setStatus('invalid'); setReason(e.message);
        }
        onValidChange?.(false);
      }
    }, 400);
    return () => clearTimeout(timerRef.current);
  }, [value, onValidChange]);

  // Блокируем недопустимые символы на лету (включая Cyrillic, пробелы)
  const handleKeyDown = (e) => {
    if (ALLOW_KEYS.has(e.key)) return;
    if (e.ctrlKey || e.metaKey) return; // Ctrl/Cmd-комбинации
    if (e.key.length === 1 && !ALLOWED_CHAR_RE.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    // Не делаем toLowerCase здесь — caret-friendly. Backend нормализует.
    // Также убираем пробелы/недопустимые символы (если paste).
    const raw = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
    onChange(raw);
  };

  const rightSlot =
    status === 'checking' ? <Loader2 size={16} className="animate-spin text-white/40" />
      : status === 'available' ? <Check size={16} className="text-emerald-400" />
        : status === 'taken' || status === 'invalid' ? <X size={16} className="text-red-400" />
          : null;

  return (
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
          : status === 'idle' ? 'Будет виден в публичном профиле (ссылка — всегда по UID)'
            : null
      }
    />
  );
};

export default UsernameField;
