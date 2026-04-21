import { useState, useCallback } from 'react';

/**
 * Hook для создания ripple эффекта при клике/тапе
 * Возвращает массив ripples и функцию для добавления нового ripple
 */
export const useRipple = () => {
  const [ripples, setRipples] = useState([]);

  const addRipple = useCallback((event) => {
    const rippleContainer = event.currentTarget;
    const rect = rippleContainer.getBoundingClientRect();
    
    // Вычисляем позицию клика относительно элемента
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Вычисляем размер ripple (диагональ элемента)
    const size = Math.max(rect.width, rect.height) * 2;
    
    const newRipple = {
      x: x - size / 2,
      y: y - size / 2,
      size,
      id: Date.now() + Math.random(),
    };

    setRipples((prev) => [...prev, newRipple]);

    // Удаляем ripple после анимации
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600); // Длительность анимации
  }, []);

  return { ripples, addRipple };
};

export default useRipple;
