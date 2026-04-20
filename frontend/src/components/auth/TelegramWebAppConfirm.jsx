/**
 * TelegramWebAppConfirm — экран подтверждения входа через Telegram WebApp.
 *
 * Показывается, когда приложение открыто внутри Telegram (initData есть),
 * но пользователь ещё не авторизован в нашей системе. Требует явного
 * согласия пользователя перед созданием аккаунта или входом:
 *
 *  - Avatar + имя + @username из initDataUnsafe.user
 *  - [Войти через Telegram] — вызывает loginTelegramWebApp(initData)
 *  - [Выбрать другой способ] — уходит на /login
 *
 * Это замена тихого auto-login, даёт пользователю контроль и понимание того,
 * что именно происходит.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, CheckCircle2, ArrowRight, Loader2, ShieldCheck, Sparkles } from 'lucide-react';

const TelegramWebAppConfirm = ({ tg, initData, onConfirm, onFail }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const tgUser = tg?.initDataUnsafe?.user || null;

  const fullName = useMemo(() => {
    if (!tgUser) return '';
    return [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim();
  }, [tgUser]);

  const handleConfirm = async () => {
    if (busy || !initData) return;
    setBusy(true);
    setError(null);
    try { tg?.HapticFeedback?.impactOccurred?.('light'); } catch { /* noop */ }
    try {
      const startParam = tg?.initDataUnsafe?.start_param || null;
      await onConfirm(initData, startParam);
    } catch (e) {
      setError(e?.message || 'Не удалось войти через Telegram');
      setBusy(false);
      onFail?.(e);
    }
  };

  const handleOther = () => {
    try { tg?.HapticFeedback?.impactOccurred?.('soft'); } catch { /* noop */ }
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0E0E10] px-4 py-8 text-white">
      {/* Background gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-20 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Header logo / brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Добро пожаловать</h1>
          <p className="mt-1 text-xs text-white/50">Расписание РУДН для студентов</p>
        </div>

        {/* User card */}
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 shadow-2xl backdrop-blur">
          {tgUser ? (
            <>
              <div className="mb-4 flex items-center gap-3">
                {tgUser.photo_url ? (
                  <img
                    src={tgUser.photo_url}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-sky-400/50"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-xl font-bold text-white">
                    {(fullName || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-base font-semibold text-white">
                      {fullName || 'Пользователь'}
                    </span>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-400" />
                  </div>
                  {tgUser.username && (
                    <div className="truncate text-xs text-white/50">@{tgUser.username}</div>
                  )}
                </div>
              </div>

              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                <div className="text-[11px] leading-relaxed text-sky-100/90">
                  Мы создадим аккаунт на основе ваших Telegram-данных, или войдём в
                  существующий. Данные остаются приватными — никому не передаются.
                </div>
              </div>
            </>
          ) : (
            <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-100/90">
              Не удалось прочитать данные пользователя из Telegram. Попробуйте открыть
              приложение через @бота или выберите другой способ входа.
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || !initData || !tgUser}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#229ED9] to-[#1B8AC0] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:shadow-xl hover:shadow-sky-500/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <MessageCircle className="h-4 w-4" />
              }
              <span>{busy ? 'Входим...' : 'Войти через Telegram'}</span>
              {!busy && <ArrowRight className="h-3.5 w-3.5 opacity-70 transition group-hover:translate-x-0.5" />}
            </button>

            <button
              type="button"
              onClick={handleOther}
              disabled={busy}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              Выбрать другой способ входа
            </button>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-white/30">
          Нажимая «Войти», вы соглашаетесь с созданием аккаунта через Telegram ID.
          <br />
          Username можно будет изменить в настройках профиля.
        </p>
      </div>
    </div>
  );
};

export default TelegramWebAppConfirm;
