import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook для обработки свайпов
 * @param {Function} onSwipeLeft - Callback при свайпе влево
 * @param {Function} onSwipeRight - Callback при свайпе вправо
 * @param {number} threshold - Минимальное расстояние для свайпа (px)
 * @returns {Object} ref для элемента
 */
export const useSwipe = (onSwipeLeft, onSwipeRight, threshold = 50) => {
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const elementRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);
    
    // Проверяем, что горизонтальное движение больше вертикального
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        // Свайп вправо
        onSwipeRight && onSwipeRight();
      } else {
        // Свайп влево
        onSwipeLeft && onSwipeLeft();
      }
    }
  }, [onSwipeLeft, onSwipeRight, threshold]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return elementRef;
};

/**
 * Hook для обработки долгого нажатия
 * @param {Function} onLongPress - Callback при долгом нажатии
 * @param {number} delay - Задержка в мс (по умолчанию 500ms)
 * @returns {Object} Обработчики событий для привязки
 */
export const useLongPress = (onLongPress, delay = 500) => {
  const timeout = useRef();
  const target = useRef();

  const start = useCallback((e) => {
    target.current = e.target;
    timeout.current = setTimeout(() => {
      onLongPress && onLongPress(e);
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback(() => {
    timeout.current && clearTimeout(timeout.current);
  }, []);

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchEnd: clear,
  };
};

/**
 * Hook для обработки shake (встряхивания)
 * @param {Function} onShake - Callback при встряхивании
 * @param {number} threshold - Порог ускорения для срабатывания
 * @returns {void}
 */
export const useShake = (onShake, threshold = 15) => {
  useEffect(() => {
    if (!window.DeviceMotionEvent) {
      console.warn('DeviceMotionEvent не поддерживается');
      return;
    }

    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    let lastTime = Date.now();

    const handleMotion = (e) => {
      const current = Date.now();
      const timeDiff = current - lastTime;

      if (timeDiff > 100) {
        const acceleration = e.accelerationIncludingGravity;
        
        if (acceleration) {
          const deltaX = Math.abs(acceleration.x - lastX);
          const deltaY = Math.abs(acceleration.y - lastY);
          const deltaZ = Math.abs(acceleration.z - lastZ);

          if (deltaX > threshold || deltaY > threshold || deltaZ > threshold) {
            onShake && onShake();
          }

          lastX = acceleration.x;
          lastY = acceleration.y;
          lastZ = acceleration.z;
          lastTime = current;
        }
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [onShake, threshold]);
};
