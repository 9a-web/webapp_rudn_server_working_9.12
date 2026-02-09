import { useEffect, useRef } from 'react';

/**
 * Хук для динамического favicon с бейджем уведомлений.
 * Рисует число непрочитанных уведомлений поверх иконки через Canvas.
 * 
 * @param {number} count - Количество непрочитанных уведомлений
 * @param {string} faviconUrl - Путь к исходному favicon (по умолчанию /retro-logo-rudn.png)
 */
export function useFaviconBadge(count, faviconUrl = '/retro-logo-rudn.png') {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    // Создаём canvas и img один раз
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 64;
      canvasRef.current.height = 64;
    }
    if (!imgRef.current) {
      imgRef.current = new Image();
      imgRef.current.crossOrigin = 'anonymous';
      imgRef.current.src = faviconUrl;
      imgRef.current.onload = () => {
        loadedRef.current = true;
        drawFavicon(count);
      };
    }

    if (loadedRef.current) {
      drawFavicon(count);
    }

    // Обновляем title с количеством уведомлений
    const baseTitle = 'RUDN Schedule';
    if (count > 0) {
      document.title = `(${count}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [count]);

  function drawFavicon(badgeCount) {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    const size = 64;

    // Очищаем canvas
    ctx.clearRect(0, 0, size, size);

    // Рисуем исходную иконку
    ctx.drawImage(img, 0, 0, size, size);

    // Если есть уведомления — рисуем бейдж
    if (badgeCount > 0) {
      const text = badgeCount > 99 ? '99+' : String(badgeCount);
      
      // Размер бейджа зависит от длины текста
      const badgeRadius = text.length > 2 ? 18 : text.length > 1 ? 16 : 13;
      const badgeX = size - badgeRadius;
      const badgeY = badgeRadius;

      // Тень бейджа для контрастности
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;

      // Красный круг
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#FF3B30';
      ctx.fill();

      // Белая обводка
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Текст
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${text.length > 2 ? 16 : text.length > 1 ? 18 : 22}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, badgeX, badgeY + 1);
    }

    // Обновляем favicon
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = canvas.toDataURL('image/png');
  }
}
