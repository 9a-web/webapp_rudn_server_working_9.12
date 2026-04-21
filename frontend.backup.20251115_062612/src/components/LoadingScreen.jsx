import React from 'react';
import { motion } from 'framer-motion';

/**
 * Анимированный экран загрузки с логотипом РУДН
 * Мягкие и деликатные анимации
 */
export const LoadingScreen = ({ message = 'Загрузка...' }) => {
  return (
    <motion.div 
      className="fixed inset-0 bg-background flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col items-center justify-center px-6">
        {/* Логотип РУДН с мягкими анимациями */}
        <motion.div
          className="relative mb-8"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
          }}
          transition={{
            duration: 0.5,
            ease: [0.25, 0.1, 0.25, 1]
          }}
        >
          {/* Пульсирующее свечение вокруг логотипа */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(163, 247, 191, 0.2) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }}
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Логотип */}
          <motion.img
            src="/LogoRudn.png"
            alt="RUDN Logo"
            className="relative w-24 h-24 md:w-32 md:h-32 object-contain"
            animate={{ 
              scale: [1, 1.03, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>

        {/* Текст загрузки */}
        <motion.p
          className="text-white/80 text-base md:text-lg font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            delay: 0.2,
            duration: 0.4 
          }}
        >
          {message}
        </motion.p>

        {/* Анимированные точки */}
        <div className="flex gap-1.5 mt-4">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="w-2 h-2 bg-white/60 rounded-full"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 1, 0.4]
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: index * 0.15,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default LoadingScreen;
