/**
 * AuthLayout — общий контейнер для страниц /login и /register.
 *
 * Предоставляет:
 *  - красивый фон с градиентом/блуром
 *  - декоративную glow-сетку
 *  - центрированную карточку для формы
 *  - логотип + слоган
 */
import React from 'react';
import { motion } from 'framer-motion';
import Logo3DAnchor from '../Logo3DAnchor';

const AuthLayout = ({ title, subtitle, children, footer, showLogo = true }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0E0E10] text-white">
      {/* Decorative gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/30 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-fuchsia-500/20 blur-[140px]" />
        <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-sky-500/20 blur-[120px]" />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {showLogo && (
            <div className="mb-8 flex flex-col items-center text-center">
              {/* 3D-логотип РУДН — рендерится через глобальный Logo3DHost.
                  При переходе LoadingScreen → AuthLayout (или между auth-страницами)
                  логотип НЕ перезагружается, а плавно перелетает на новое место. */}
              <div
                className="relative mb-4"
                style={{
                  width: 112,
                  height: 112,
                  filter: 'drop-shadow(0 10px 30px rgba(99, 102, 241, 0.45))',
                }}
              >
                {/* Мягкое свечение за логотипом */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)',
                    filter: 'blur(24px)',
                  }}
                />
                <Logo3DAnchor
                  size={112}
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
              <h1 className="text-2xl font-bold tracking-tight text-white">{title || 'РУДН Расписание'}</h1>
              {subtitle && (
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{subtitle}</p>
              )}
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            {children}
          </div>

          {footer && (
            <div className="mt-6 text-center text-sm text-white/50">{footer}</div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AuthLayout;
