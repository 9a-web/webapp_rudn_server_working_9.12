/**
 * Поле ввода с иконкой и анимированной обводкой на focus.
 */
import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const AuthInput = forwardRef(function AuthInput(
  { label, icon: Icon, type = 'text', error, hint, rightSlot, className = '', ...props },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-white/70">
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
          <Icon className="ml-3 h-4 w-4 flex-shrink-0 text-white/50 group-focus-within:text-indigo-300" />
        )}
        <input
          ref={ref}
          type={effectiveType}
          className="flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((s) => !s)}
            className="mr-2 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
            aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
        {rightSlot && <div className="mr-2">{rightSlot}</div>}
      </div>
      {(error || hint) && (
        <div
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
