/**
 * Кнопка для auth-форм с двумя вариантами: primary (градиент) и secondary (провайдеры).
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
    'relative inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0E0E10] disabled:cursor-not-allowed disabled:opacity-60';

  const variants = {
    primary:
      'bg-gradient-to-r from-indigo-500 via-indigo-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 focus:ring-indigo-400',
    secondary:
      'border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-white/20',
    telegram:
      'bg-[#229ED9] text-white hover:bg-[#1E8BC3] focus:ring-sky-400',
    vk: 'bg-[#0077FF] text-white hover:bg-[#0066DD] focus:ring-sky-400',
    ghost:
      'text-white/70 hover:text-white hover:bg-white/5 focus:ring-white/20',
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className="h-4 w-4" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};

export default AuthButton;
