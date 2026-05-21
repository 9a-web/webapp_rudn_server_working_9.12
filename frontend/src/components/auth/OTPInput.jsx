/**
 * OTPInput — красивый ввод одноразового кода из N цифр (по умолчанию 4).
 *
 * Возможности:
 *  - Отдельные «боксы» под каждую цифру с автопереходом фокуса
 *  - Поддержка вставки кода целиком (paste из почты)
 *  - Стрелки ←/→ для навигации, Backspace для удаления + откат фокуса
 *  - Только цифры
 *  - autoFocus на первом боксе
 *  - autoSubmit когда все цифры введены → onComplete(code)
 *  - Состояние ошибки (тряска + красный бордер) через prop `error`
 *  - Поддержка disabled (во время отправки)
 *
 * Использование:
 *   const [code, setCode] = useState("");
 *   <OTPInput length={4} value={code} onChange={setCode}
 *             onComplete={(c) => submit(c)} error={lastError} />
 */
import React, { useEffect, useMemo, useRef, useCallback } from 'react';

export default function OTPInput({
  length = 4,
  value = '',
  onChange,
  onComplete,
  error = false,
  disabled = false,
  autoFocus = true,
  className = '',
  inputClassName = '',
  ariaLabel = 'Код подтверждения',
}) {
  const inputsRef = useRef([]);

  // Нормализуем value → массив длины length из цифр или ''
  const digits = useMemo(() => {
    const arr = [];
    const safeValue = (value || '').toString().replace(/\D/g, '').slice(0, length);
    for (let i = 0; i < length; i += 1) arr.push(safeValue[i] || '');
    return arr;
  }, [value, length]);

  useEffect(() => {
    if (autoFocus && inputsRef.current[0]) {
      const t = setTimeout(() => {
        try { inputsRef.current[0].focus(); } catch (_) {}
      }, 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  // Сбросить фокус на ошибку — выделить первый бокс
  useEffect(() => {
    if (error && inputsRef.current[0]) {
      try {
        inputsRef.current[0].focus();
        inputsRef.current[0].select?.();
      } catch (_) {}
    }
  }, [error]);

  const focusBox = useCallback((idx) => {
    const el = inputsRef.current[idx];
    if (el) {
      try {
        el.focus();
        el.select?.();
      } catch (_) {}
    }
  }, []);

  const setDigitAt = useCallback(
    (idx, digit) => {
      const next = [...digits];
      next[idx] = digit;
      const joined = next.join('');
      onChange?.(joined);
      if (joined.length === length && !next.includes('') && onComplete) {
        // Все цифры введены — авто-сабмит
        try { onComplete(joined); } catch (_) {}
      }
    },
    [digits, length, onChange, onComplete],
  );

  const handleInput = (idx, e) => {
    const v = e.target.value.replace(/\D/g, '');
    if (!v) {
      // Очистка
      setDigitAt(idx, '');
      return;
    }
    // Если вставили больше одной цифры (например, мобильная клавиатура iOS),
    // обрабатываем как paste
    if (v.length > 1) {
      const chars = v.split('').slice(0, length - idx);
      const next = [...digits];
      chars.forEach((c, i) => { next[idx + i] = c; });
      const joined = next.join('');
      onChange?.(joined);
      const lastFilled = Math.min(idx + chars.length, length - 1);
      focusBox(lastFilled);
      if (joined.length === length && !next.includes('') && onComplete) {
        try { onComplete(joined); } catch (_) {}
      }
      return;
    }
    setDigitAt(idx, v);
    if (idx < length - 1) focusBox(idx + 1);
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        setDigitAt(idx, '');
        e.preventDefault();
      } else if (idx > 0) {
        focusBox(idx - 1);
        setDigitAt(idx - 1, '');
        e.preventDefault();
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      focusBox(idx - 1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && idx < length - 1) {
      focusBox(idx + 1);
      e.preventDefault();
    } else if (e.key === 'Enter' && digits.every((d) => d) && onComplete) {
      e.preventDefault();
      try { onComplete(digits.join('')); } catch (_) {}
    }
  };

  const handlePaste = (e) => {
    const txt = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, length);
    if (!txt) return;
    e.preventDefault();
    const arr = txt.split('');
    while (arr.length < length) arr.push('');
    const joined = arr.join('').slice(0, length);
    onChange?.(joined);
    const filled = txt.length;
    focusBox(Math.min(filled, length - 1));
    if (joined.length === length && !joined.includes('') && onComplete) {
      try { onComplete(joined); } catch (_) {}
    }
  };

  return (
    <div
      className={`flex items-center justify-center gap-2 sm:gap-3 ${error ? 'animate-shake' : ''} ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {Array.from({ length }).map((_, idx) => {
        const filled = !!digits[idx];
        const base = 'w-14 h-16 sm:w-16 sm:h-20 text-3xl sm:text-4xl text-center font-semibold rounded-2xl border-2 transition-all duration-150 outline-none focus:scale-105 focus:shadow-lg';
        const colorClasses = error
          ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/30'
          : filled
          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/30'
          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

        return (
          <input
            key={idx}
            ref={(el) => { inputsRef.current[idx] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
            maxLength={length} /* большое значение, чтобы handleInput мог получить вставку */
            value={digits[idx]}
            onChange={(e) => handleInput(idx, e)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select?.()}
            disabled={disabled}
            aria-label={`${ariaLabel} цифра ${idx + 1}`}
            className={`${base} ${colorClasses} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${inputClassName}`}
          />
        );
      })}
    </div>
  );
}
