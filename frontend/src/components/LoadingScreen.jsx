import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Logo3D from './Logo3D';

/**
 * LoadingScreen — анимированный экран загрузки с 3D-логотипом РУДН.
 *
 * Использует компонент Logo3D (обёртка над `3dsvg` → SVG3D), который:
 *  • Ленится (three.js грузится только когда компонент на экране)
 *  • Автоматически падает в 2D <img> если WebGL недоступен или 3D ломается
 *  • Использует УПРОЩЁННЫЙ SVG (1448 сегментов вместо 13316) для быстрого рендера
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

          {/* Сам 3D-логотип */}
          <Logo3D
            size={200}
            material="metal"
            animate="spin"
            animateSpeed={2}
            smoothness={0.2}
            metalness={0.9}
            roughness={0.25}
            lightPosition={[-0.5, 2, 4]}
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
