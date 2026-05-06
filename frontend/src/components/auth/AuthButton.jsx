/**
 * AuthButton — кнопка для auth-форм.
 *
 * Варианты:
 *  - primary (по умолчанию): GLASSMORPHISM-градиент + shimmer + inner highlight
 *  - secondary: стеклянная нейтральная
 *  - telegram / vk: фирменные цвета провайдеров
 *  - ghost: только текст с hover-glow
 *
 * UX/UI:
 *  - 48px touch target
 *  - active:scale-[0.98] feedback
 *  - focus-visible ring (only keyboard)
 *  - Loader2 заменяет иконку при loading
 *  - aria-busy при loading
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

const AuthButton = ({
  children,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon: Icon,
  className = '',
  ...props
}) => {
  const base =
    'group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-4 py-[14px] text-[14.5px] font-semibold tracking-tight transition-all duration-200 active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0d] disabled:cursor-not-allowed disabled:opacity-60';

  const variants = {
    primary: [
      'text-white',
      'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500',
      'shadow-[0_8px_28px_-6px_rgba(99,102,241,0.55)]',
      'hover:shadow-[0_10px_36px_-6px_rgba(99,102,241,0.70)]',
      'focus-visible:ring-indigo-400',
    ].join(' '),
    secondary: [
      'border border-white/15 bg-white/[0.07] text-white backdrop-blur-md',
      'hover:bg-white/[0.12] hover:border-white/25',
      'focus-visible:ring-white/30',
    ].join(' '),
    telegram: 'bg-[#229ED9] text-white shadow-lg shadow-sky-500/30 hover:bg-[#1E8BC3] focus-visible:ring-sky-400',
    vk: 'bg-[#0077FF] text-white shadow-lg shadow-blue-500/30 hover:bg-[#0066DD] focus-visible:ring-sky-400',
    ghost: 'text-white/75 hover:text-white hover:bg-white/[0.06] focus-visible:ring-white/30',
  };

  const isPrimary = variant === 'primary';

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {/* Inner top highlight (стеклянное отражение) — только для primary */}
      {isPrimary && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
            }}
          />
          {/* Shimmer на hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
          />
        </>
      )}

      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {loading ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : Icon ? (
          <Icon className="h-[18px] w-[18px]" />
        ) : null}
        <span>{children}</span>
      </span>
    </button>
  );
};

export default AuthButton;
