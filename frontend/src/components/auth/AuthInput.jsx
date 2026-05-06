/**
 * AuthInput — поле ввода в стиле GLASSMORPHISM.
 *
 * Дизайн:
 *  - Frosted glass background с subtle border
 *  - Animated focus ring (indigo glow + brightening)
 *  - Иконка слева, password-toggle справа
 *  - Smooth transitions всех состояний
 *
 * UX/UI:
 *  - 48px высота (touch target)
 *  - Generated id для label↔input связи (a11y)
 *  - aria-invalid + aria-describedby для error/hint
 *  - role="alert" на error (screen readers)
 *  - Иконка eye имеет aria-pressed для toggle-state
 *  - Error/hint с min-height чтобы layout не прыгал
 */
import React, { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const AuthInput = forwardRef(function AuthInput(
  {
    label, icon: Icon, type = 'text', error, hint, rightSlot,
    className = '', id: idProp, ...props
  },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const reactId = useId();
  const inputId = idProp || `auth-input-${reactId}`;
  const helpId = `${inputId}-help`;

  const handleFocus = (e) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };
  const handleBlur = (e) => {
    setIsFocused(false);
    props.onBlur?.(e);
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-2 block text-[12px] font-medium text-white/80"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {/* Внешний glow при фокусе */}
        <div
          aria-hidden
          className={`pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300 ${
            error ? 'opacity-100' : isFocused ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background: error
              ? 'linear-gradient(135deg, rgba(239,68,68,0.55), rgba(239,68,68,0.25))'
              : 'linear-gradient(135deg, rgba(129,140,248,0.55), rgba(168,85,247,0.30))',
            filter: 'blur(8px)',
          }}
        />

        {/* Само поле */}
        <div
          className={`relative flex items-center rounded-2xl border bg-white/[0.06] backdrop-blur-md transition-all duration-200 ${
            error
              ? 'border-red-400/60'
              : isFocused
                ? 'border-indigo-300/50 bg-white/[0.10] ring-2 ring-indigo-400/30'
                : 'border-white/15 hover:border-white/25 hover:bg-white/[0.08]'
          }`}
          style={{
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.12)',
          }}
        >
          {Icon && (
            <Icon
              className={`ml-3.5 h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200 ${
                error
                  ? 'text-red-300'
                  : isFocused
                    ? 'text-indigo-200'
                    : 'text-white/55'
              }`}
              aria-hidden="true"
            />
          )}
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            aria-invalid={!!error}
            aria-describedby={(error || hint) ? helpId : undefined}
            className="flex-1 min-w-0 bg-transparent px-3 py-3.5 text-[15px] text-white placeholder:text-white/35 focus:outline-none"
            {...props}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />

          <div className="mr-2 flex items-center gap-1">
            {isPassword && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                className="rounded-xl p-2 text-white/55 transition-all hover:bg-white/10 hover:text-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
            {rightSlot}
          </div>
        </div>
      </div>

      {(error || hint) && (
        <div
          id={helpId}
          role={error ? 'alert' : undefined}
          className={`mt-1.5 min-h-[16px] text-[11.5px] leading-tight ${
            error ? 'text-red-300' : 'text-white/45'
          }`}
        >
          {error || hint}
        </div>
      )}
    </div>
  );
});

export default AuthInput;
