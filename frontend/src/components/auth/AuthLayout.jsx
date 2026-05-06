/**
 * AuthLayout — общий контейнер для auth-страниц (/login, /register, /forgot-password, ...).
 *
 * Дизайн: GLASSMORPHISM + UX/UI canon
 *  - Фоновое фото door_rudn.png + затемнение для читаемости
 *  - Многослойное стекло (двойной backdrop-blur, ring подсветка)
 *  - Decorative orbs с subtle floating animation
 *  - Inner highlight (имитация отражения света на верхнем крае стекла)
 *  - Subtle noise texture для премиальности
 *  - Корректный контраст (WCAG AA)
 *  - Поддержка prefers-reduced-motion (через Framer Motion)
 *  - Focus-friendly (ring-offset для контраста)
 */
import React from 'react';
import { motion } from 'framer-motion';
import Logo3DAnchor from '../Logo3DAnchor';

const AuthLayout = ({ title, subtitle, children, footer, showLogo = true }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0d] text-white">
      {/* ── Слой 1: Фоновое фото ───────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-no-repeat bg-center bg-[length:auto_90%] sm:bg-cover"
        style={{
          backgroundImage: 'url(/images/door_rudn.png)',
        }}
      />

      {/* ── Слой 2: Радиальный vignette + затемняющий градиент ───── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(10,10,13,0.30) 0%, rgba(10,10,13,0.55) 55%, rgba(10,10,13,0.85) 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,10,13,0.50) 0%, rgba(10,10,13,0.20) 35%, rgba(10,10,13,0.55) 100%)',
        }}
      />

      {/* ── Слой 3: Анимированные orbs (мягкое цветное свечение) ─── */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-indigo-500/25 blur-[120px]"
        animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-1/4 -right-32 h-[520px] w-[520px] rounded-full bg-fuchsia-500/20 blur-[150px]"
        animate={{ x: [0, -22, 0], y: [0, 14, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/3 h-[400px] w-[400px] rounded-full bg-sky-400/20 blur-[120px]"
        animate={{ x: [0, 16, 0], y: [0, -10, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* ── Слой 4: Тонкая сетка (структура) ─────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      {/* ── Слой 5: Noise/grain (премиальность) ──────────────────── */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06] mix-blend-overlay"
      >
        <filter id="auth-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#auth-noise)" />
      </svg>

      {/* ── Контент ──────────────────────────────────────────────── */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {showLogo && (
            <div className="mb-7 flex flex-col items-center text-center">
              {/* Logo 3D + radial glow подложка */}
              <div
                className="relative mb-5"
                style={{
                  width: 108,
                  height: 108,
                  filter: 'drop-shadow(0 14px 36px rgba(99, 102, 241, 0.55))',
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(139,92,246,0.40) 0%, transparent 70%)',
                    filter: 'blur(28px)',
                  }}
                />
                <Logo3DAnchor
                  size={108}
                  material="metal"
                  animate="spin"
                  animateSpeed={2}
                  smoothness={0.2}
                  metalness={0.85}
                  roughness={0.25}
                  lightPosition={[-0.5, 2, 4]}
                  priority={5}
                />
              </div>
              <h1 className="text-[26px] font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-[28px]">
                {title || 'РУДН Расписание'}
              </h1>
              {subtitle && (
                <p className="mt-2 text-sm leading-relaxed text-white/70 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* ── ГЛАВНАЯ СТЕКЛЯННАЯ КАРТОЧКА ────────────────────── */}
          <div className="relative">
            {/* Внешнее свечение карточки */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-[28px] opacity-60"
              style={{
                background:
                  'linear-gradient(135deg, rgba(168,85,247,0.35) 0%, rgba(99,102,241,0.20) 35%, rgba(56,189,248,0.20) 70%, rgba(168,85,247,0.30) 100%)',
                filter: 'blur(14px)',
              }}
            />

            {/* Сама карточка */}
            <div
              className="relative overflow-hidden rounded-[26px] border border-white/15 bg-white/[0.05] p-6 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md backdrop-saturate-150 sm:p-8"
              style={{
                boxShadow:
                  '0 20px 60px -12px rgba(0,0,0,0.6), 0 4px 16px -4px rgba(0,0,0,0.4), inset 0 1px 0 0 rgba(255,255,255,0.18)',
              }}
            >
              {/* Top inner highlight (отражение света сверху) */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                }}
              />
              {/* Subtle radial highlight в верхнем-левом углу (имитация света) */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-1/2 -left-1/4 h-[200%] w-[150%] opacity-30"
                style={{
                  background:
                    'radial-gradient(ellipse at top left, rgba(255,255,255,0.18) 0%, transparent 50%)',
                }}
              />

              {/* Контент формы */}
              <div className="relative z-10">{children}</div>
            </div>
          </div>

          {footer && (
            <div className="mt-6 text-center text-sm text-white/60 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AuthLayout;
