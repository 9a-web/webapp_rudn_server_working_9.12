import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Logo3DAnchor from './Logo3DAnchor';

/**
 * LoadingScreen — анимированный экран загрузки с 3D-логотипом РУДН.
 *
 * Использует Logo3DAnchor (placeholder), а сам 3D-логотип рендерится
 * глобально через Logo3DHost (один раз на всё приложение). Это позволяет:
 *  • Не пересобирать ExtrudeGeometry при каждом маунте LoadingScreen
 *  • Плавно "перелетать" логотипу при переходе LoadingScreen → AuthLayout
 *  • Один SVG-fetch на сессию (preloadLogoSvg в App.jsx)
 */
export const LoadingScreen = ({ message = 'Загрузка...' }) => {
  return (
    <motion.div
      className="fixed inset-0 bg-background flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col items-center justify-center px-6">
        {/* 3D Логотип */}
        <motion.div
          className="relative mb-6"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ width: '200px', height: '200px' }}
        >
          {/* Свечение */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(circle, rgba(79, 70, 229, 0.22) 0%, transparent 70%)',
              filter: 'blur(30px)',
              transform: 'translateY(10px)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.65, 0.3],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* 3D-логотип через глобальный Logo3DHost (placeholder anchor) */}
          <Logo3DAnchor
            size={200}
            material="metal"
            animate="spin"
            animateSpeed={2}
            smoothness={0.2}
            metalness={0.9}
            roughness={0.25}
            lightPosition={[-0.5, 2, 4]}
            priority={10}
          />
        </motion.div>

        {/* Текст */}
        <motion.p
          className="text-white/80 text-base md:text-lg font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {message}
        </motion.p>

        {/* Точки */}
        <div className="flex gap-1.5 mt-4">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="w-2 h-2 bg-white/60 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: index * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default LoadingScreen;
