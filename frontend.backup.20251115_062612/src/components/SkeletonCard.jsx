import React from 'react';
import { motion } from 'framer-motion';

/**
 * Скелетон для карточки расписания
 * Использует pulse анимацию
 */
export const ScheduleCardSkeleton = () => {
  return (
    <motion.div
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start gap-3">
        {/* Время - левая часть */}
        <div className="flex-shrink-0">
          <motion.div
            className="w-16 h-12 bg-gray-200 rounded-xl"
            animate={{
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Контент - правая часть */}
        <div className="flex-1 min-w-0">
          {/* Название предмета */}
          <motion.div
            className="h-5 bg-gray-200 rounded-lg mb-2 w-3/4"
            animate={{
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.1
            }}
          />
          
          {/* Детали */}
          <motion.div
            className="h-4 bg-gray-200 rounded-lg mb-2 w-1/2"
            animate={{
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.2
            }}
          />
          
          {/* Преподаватель */}
          <motion.div
            className="h-4 bg-gray-200 rounded-lg w-2/3"
            animate={{
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.3
            }}
          />
        </div>

        {/* Статус badge */}
        <motion.div
          className="w-20 h-6 bg-gray-200 rounded-full flex-shrink-0"
          animate={{
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.4
          }}
        />
      </div>
    </motion.div>
  );
};

/**
 * Контейнер для нескольких скелетонов
 */
export const ScheduleListSkeleton = ({ count = 3 }) => {
  return (
    <div className="px-6 md:px-8 lg:px-10">
      {Array.from({ length: count }).map((_, index) => (
        <ScheduleCardSkeleton key={index} />
      ))}
    </div>
  );
};

export default ScheduleCardSkeleton;
