/**
 * AuthInput — поле ввода с иконкой, анимированной обводкой на focus,
 * поддержкой password-toggle и error/hint текста.
 *
 * 🔒 Stage 6:
 *  - Корректная композиция rightSlot + isPassword (eye-icon рядом, без наложения).
 *  - Generated id для label ↔ input связи (a11y).
 *  - aria-invalid и aria-describedby для error/hint.
 *  - role="alert" на error для screen readers.
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
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const reactId = useId();
  const inputId = idProp || `auth-input-${reactId}`;
  const helpId = `${inputId}-help`;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-xs font-medium text-white/70"
        >
          {label}
        </label>
      )}
      <div
        className={`group relative flex items-center rounded-xl border ${
          error
            ? 'border-red-500/70 focus-within:border-red-400'
            : 'border-white/10 focus-within:border-indigo-400/70'
        } bg-white/5 transition-colors focus-within:bg-white/[0.07]`}
      >
        {Icon && (
          <Icon
            className="ml-3 h-4 w-4 flex-shrink-0 text-white/50 group-focus-within:text-indigo-300"
            aria-hidden="true"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          aria-invalid={!!error}
          aria-describedby={(error || hint) ? helpId : undefined}
          className="flex-1 min-w-0 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
          {...props}
        />
        {/* Правая часть: иконка-глаз для password + кастомный rightSlot */}
        <div className="mr-2 flex items-center gap-1">
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((s) => !s)}
              className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          {rightSlot}
        </div>
      </div>
      {(error || hint) && (
        <div
          id={helpId}
          role={error ? 'alert' : undefined}
          className={`mt-1.5 text-xs ${
            error ? 'text-red-400' : 'text-white/40'
          }`}
        >
          {error || hint}
        </div>
      )}
    </div>
  );
});

export default AuthInput;
