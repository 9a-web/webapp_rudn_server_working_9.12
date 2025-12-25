import React, { useEffect, useState } from 'react';
import './NewYearTheme.css';

/**
 * Компонент новогодней темы с падающими снежинками
 */
export const NewYearTheme = ({ enabled = true }) => {
  const [snowflakes, setSnowflakes] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setSnowflakes([]);
      return;
    }

    // Создаем массив снежинок с рандомными параметрами
    const flakes = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100, // позиция по горизонтали (%)
      animationDuration: 10 + Math.random() * 20, // длительность падения (сек)
      animationDelay: Math.random() * 5, // задержка старта (сек)
      size: 4 + Math.random() * 6, // размер снежинки (px)
      opacity: 0.3 + Math.random() * 0.7, // прозрачность
      swingAmount: 30 + Math.random() * 40, // амплитуда раскачивания (px)
    }));

    setSnowflakes(flakes);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="new-year-theme">
      {/* Контейнер со снежинками */}
      <div className="snowflakes-container">
        {snowflakes.map((flake) => (
          <div
            key={flake.id}
            className="snowflake"
            style={{
              left: `${flake.left}%`,
              animationDuration: `${flake.animationDuration}s`,
              animationDelay: `${flake.animationDelay}s`,
              fontSize: `${flake.size}px`,
              opacity: flake.opacity,
              '--swing-amount': `${flake.swingAmount}px`,
            }}
          >
            ❄
          </div>
        ))}
      </div>
    </div>
  );
};
