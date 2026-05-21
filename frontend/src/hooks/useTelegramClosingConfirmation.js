/**
 * useTelegramClosingConfirmation — M9 fix (2026-07)
 *
 * Хук для включения tg.enableClosingConfirmation() на критических формах.
 * Защищает от случайной потери данных при свайпе вниз в Telegram WebApp.
 *
 * Использование:
 *   const isDirty = formData.name !== originalName;
 *   useTelegramClosingConfirmation(isDirty);
 *
 * Автоматически:
 *  - Включает при mount если isDirty=true
 *  - Выключает при unmount
 *  - Реагирует на изменения isDirty
 *  - Не делает ничего вне Telegram WebApp
 */
import { useEffect } from 'react';

export default function useTelegramClosingConfirmation(active = true) {
  useEffect(() => {
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
    if (!tg || !tg.initData) return; // не в Telegram

    try {
      if (active && typeof tg.enableClosingConfirmation === 'function') {
        tg.enableClosingConfirmation();
      } else if (!active && typeof tg.disableClosingConfirmation === 'function') {
        tg.disableClosingConfirmation();
      }
    } catch (e) {
      // ignore
    }

    return () => {
      try {
        if (typeof tg.disableClosingConfirmation === 'function') {
          tg.disableClosingConfirmation();
        }
      } catch (_) {}
    };
  }, [active]);
}
