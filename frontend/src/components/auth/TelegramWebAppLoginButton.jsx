/**
 * TelegramWebAppLoginButton — используется ТОЛЬКО когда приложение открыто
 * внутри Telegram WebApp (есть `window.Telegram.WebApp.initData`).
 *
 * Вместо iframe-widget'а (который требует /setdomain и неудобен внутри бота),
 * показываем кнопку «Войти через Telegram». При клике вызываем
 * /api/auth/login/telegram-webapp с initData — бэкенд проверяет HMAC и выдаёт JWT.
 *
 * Данные профиля (имя, username, фото) берутся прямо из
 * `initDataUnsafe.user` и отрисовываются как превью.
 */
import React, { useMemo, useState } from 'react';
import { MessageCircle, Loader2, CheckCircle2 } from 'lucide-react';
import useIsInsideTelegram from '../../hooks/useIsInsideTelegram';

const TelegramWebAppLoginButton = ({ onSubmit, label = 'Войти через Telegram' }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Реактивно читаем initData и user — SDK может заполнить чуть позже mount'а.
  const { initData, user: tgUser } = useIsInsideTelegram();
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

  const displayName = useMemo(() => {
    if (!tgUser) return '';
    const full = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');
    return full || tgUser.username || `ID ${tgUser.id}`;
  }, [tgUser]);

  const handleClick = async () => {
    if (!initData) {
      setError('Telegram initData отсутствует. Откройте приложение через бота.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const startParam = tg?.initDataUnsafe?.start_param || null;
      try { tg?.HapticFeedback?.impactOccurred?.('light'); } catch { /* noop */ }
      await onSubmit?.(initData, startParam);
    } catch (e) {
      setError(e?.message || 'Не удалось войти через Telegram');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-stretch gap-3">
      {tgUser && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          {tgUser.photo_url ? (
            <img
              src={tgUser.photo_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover ring-2 ring-indigo-400/40"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-semibold text-white">
              {(displayName || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{displayName}</div>
            {tgUser.username && (
              <div className="truncate text-xs text-white/50">@{tgUser.username}</div>
            )}
          </div>
          <CheckCircle2 size={18} className="text-emerald-400" />
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={busy || !initData}
        className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#229ED9] to-[#1B8AC0] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition-all hover:shadow-xl hover:shadow-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={label}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        <span>{busy ? 'Входим...' : label}</span>
      </button>

      {!initData && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 space-y-1">
          <div className="font-semibold">Нет данных Telegram WebApp</div>
          <div className="text-amber-200/90">
            {tg && tg.platform && tg.platform !== 'unknown' ? (
              <>
                Похоже, вы открыли страницу в встроенном браузере Telegram, а не как Mini App.
                Чтобы войти автоматически — откройте приложение через <b>Menu Button</b> бота
                или кнопку <b>WebApp</b> в меню.
              </>
            ) : (
              <>
                Скрипт Telegram SDK не передал initData. Откройте приложение через @бота,
                а не по прямой ссылке.
              </>
            )}
          </div>
          {/* Диагностика — помогает понять, что именно поймал браузер */}
          <details className="mt-1.5 text-amber-200/70">
            <summary className="cursor-pointer select-none text-[11px] underline">Диагностика</summary>
            <div className="mt-1 break-all font-mono text-[10px] leading-snug">
              <div>hasTG: {String(!!tg)}</div>
              <div>version: {tg?.version || '—'}</div>
              <div>platform: {tg?.platform || '—'}</div>
              <div>initDataLen: {(tg?.initData || '').length}</div>
              <div>hasUser: {String(!!tg?.initDataUnsafe?.user)}</div>
              <div>colorScheme: {tg?.colorScheme || '—'}</div>
            </div>
          </details>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}
    </div>
  );
};

export default TelegramWebAppLoginButton;
