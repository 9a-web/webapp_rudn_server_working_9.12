/**
 * useIsInsideTelegram — хук для определения, запущено ли приложение
 * внутри Telegram WebApp. Возвращает true когда:
 *  - Telegram WebApp SDK уже положил `initData` (непустая строка)
 *  - ИЛИ `platform` это одна из нативных Telegram-платформ
 *    ('ios', 'android', 'macos', 'tdesktop', 'weba', 'webk')
 *
 * Проверка идёт не только один раз, но и с небольшой задержкой — потому что
 * SDK иногда заполняет initData чуть позже монтирования React.
 *
 * Возвращаемое значение:
 *   {
 *     inside, isInside,        // bool — мы в Telegram?
 *     initData, user, platform,
 *     tg,                      // window.Telegram.WebApp instance (или null)
 *     ready,                   // bool — окончательный ответ дан (поллинг завершён)
 *   }
 */
import { useEffect, useState } from 'react';

const NATIVE_PLATFORMS = new Set([
  'ios', 'android', 'android_x', 'macos', 'tdesktop',
  'weba', 'webk',
]);

// Таймаут поллинга — после этого считаем что SDK не загрузился (мы вне Telegram).
const READY_TIMEOUT_MS = 1500;

export const readTelegramWebAppContext = () => {
  if (typeof window === 'undefined') {
    return { inside: false, initData: '', user: null, platform: 'unknown', tg: null };
  }
  const tg = window.Telegram?.WebApp;
  if (!tg) return { inside: false, initData: '', user: null, platform: 'unknown', tg: null };

  const initData = tg.initData || '';
  const platform = tg.platform || 'unknown';
  const user = tg.initDataUnsafe?.user || null;

  const inside = (initData && initData.length > 0)
    || (platform !== 'unknown' && NATIVE_PLATFORMS.has(platform));

  return { inside, initData, user, platform, tg };
};

const useIsInsideTelegram = () => {
  const [ctx, setCtx] = useState(() => readTelegramWebAppContext());
  const [ready, setReady] = useState(() => {
    // Если на mount уже всё ясно — ready=true сразу.
    const initial = readTelegramWebAppContext();
    return !!(initial.inside && initial.initData);
  });

  // Лог для отладки (один раз на изменение)
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[useIsInsideTelegram]', {
      inside: ctx.inside,
      platform: ctx.platform,
      initDataLen: ctx.initData?.length || 0,
      hasUser: !!ctx.user,
      hasTG: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
      ready,
    });
  }, [ctx.inside, ctx.initData, ctx.platform, ctx.user, ready]);

  useEffect(() => {
    // Если уже определились — больше не поллим.
    if (ready) return undefined;

    let cancelled = false;
    const check = (markReady = false) => {
      if (cancelled) return;
      const next = readTelegramWebAppContext();
      const changed = next.inside !== ctx.inside || next.initData !== ctx.initData;
      if (changed) {
        setCtx(next);
      }
      if (markReady || (next.inside && next.initData)) {
        setReady(true);
      }
    };

    const t1 = setTimeout(() => check(false), 100);
    const t2 = setTimeout(() => check(false), 500);
    const t3 = setTimeout(() => check(true), READY_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [ctx.inside, ctx.initData, ready]);

  return {
    ...ctx,
    isInside: ctx.inside,
    ready,
  };
};

export default useIsInsideTelegram;
