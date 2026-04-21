import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Компонент подсказки о swipe-навигации
 * Показывается один раз при первом входе
 * Скрывается через 10 секунд или при первом свайпе
 */
export const SwipeHint = ({ onSwipe }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Проверяем, показывали ли уже подсказку
    const hasSeenHint = localStorage.getItem('hasSeenSwipeHint');
    
    if (!hasSeenHint) {
      // Показываем подсказку через 2 секунды после загрузки
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000);

      // Автоматически скрываем через 10 секунд (2 сек задержка + 10 сек показа = 12 сек)
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        localStorage.setItem('hasSeenSwipeHint', 'true');
      }, 12000);

      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    }
  }, []);

  // Обработка свайпа - скрываем подсказку
  useEffect(() => {
    if (onSwipe && isVisible) {
      const handleSwipeEvent = () => {
        setIsVisible(false);
        localStorage.setItem('hasSeenSwipeHint', 'true');
      };
      
      // Подписываемся на событие свайпа
      window.addEventListener('swipe-detected', handleSwipeEvent);
      
      return () => {
        window.removeEventListener('swipe-detected', handleSwipeEvent);
      };
    }
  }, [onSwipe, isVisible]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('hasSeenSwipeHint', 'true');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-20 md:bottom-24 left-4 right-4 md:left-1/2 md:right-auto z-50 pointer-events-auto md:-translate-x-1/2 md:w-auto"
        >
          <div
            onClick={handleDismiss}
            className="bg-black/90 backdrop-blur-sm rounded-2xl px-4 py-3 md:px-6 md:py-4 shadow-2xl max-w-sm mx-auto cursor-pointer"
          >
            <div className="flex items-center justify-center gap-2 md:gap-3 mb-2">
              <motion.div
                animate={{ x: [-10, 0, -10] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </motion.div>
              
              <p className="text-white text-xs md:text-sm font-medium text-center">
                Свайпайте влево и вправо<br />
                для навигации между днями
              </p>
              
              <motion.div
                animate={{ x: [0, 10, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </motion.div>
            </div>
            
            <p className="text-gray-400 text-[10px] md:text-xs text-center mt-1 md:mt-2">
              Нажмите, чтобы скрыть
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
