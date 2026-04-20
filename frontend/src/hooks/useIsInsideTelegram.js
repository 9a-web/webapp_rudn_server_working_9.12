/**
 * useIsInsideTelegram — хук для определения, запущено ли приложение
 * внутри Telegram WebApp. Возвращает true когда:
 *  - Telegram WebApp SDK уже положил `initData` (непустая строка)
 *  - ИЛИ `platform` это одна из нативных Telegram-платформ
 *    ('ios', 'android', 'macos', 'tdesktop', 'weba', 'webk')
 *
 * Проверка идёт не только один раз, но и с небольшой задержкой — потому что
 * SDK иногда заполняет initData чуть позже монтирования React.
 */
import { useEffect, useState } from 'react';

const NATIVE_PLATFORMS = new Set([
  'ios', 'android', 'android_x', 'macos', 'tdesktop',
  'weba', 'webk',
]);

export const readTelegramWebAppContext = () => {
  if (typeof window === 'undefined') return { inside: false, initData: '', user: null };
  const tg = window.Telegram?.WebApp;
  if (!tg) return { inside: false, initData: '', user: null };

  const initData = tg.initData || '';
  const platform = tg.platform || 'unknown';
  const user = tg.initDataUnsafe?.user || null;

  // Основной критерий — непустой initData. Но если юзер открыл WebApp и
  // SDK ещё не отработал HMAC (initData пустой), но platform уже native —
  // всё равно считаем, что внутри Telegram и показываем соответствующий UI.
  const inside = (initData && initData.length > 0)
    || (platform !== 'unknown' && NATIVE_PLATFORMS.has(platform));

  return { inside, initData, user, platform };
};

const useIsInsideTelegram = () => {
  const [ctx, setCtx] = useState(() => readTelegramWebAppContext());

  useEffect(() => {
    // Логируем один раз для отладки: видно в консоли Telegram WebApp.
    // eslint-disable-next-line no-console
    console.log('[useIsInsideTelegram]', {
      inside: ctx.inside,
      platform: ctx.platform,
      initDataLen: ctx.initData?.length || 0,
      hasUser: !!ctx.user,
      hasTG: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
    });
  }, [ctx.inside, ctx.initData, ctx.platform, ctx.user]);

  useEffect(() => {
    // Повторно проверяем через короткие интервалы — на случай, если
    // telegram-web-app.js ещё не успел положить initData к моменту mount'а.
    if (ctx.inside && ctx.initData) return undefined;

    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      const next = readTelegramWebAppContext();
      if (next.inside !== ctx.inside || next.initData !== ctx.initData) {
        setCtx(next);
      }
    };
    const t1 = setTimeout(check, 100);
    const t2 = setTimeout(check, 500);
    const t3 = setTimeout(check, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [ctx.inside, ctx.initData]);

  return ctx;
};

export default useIsInsideTelegram;
