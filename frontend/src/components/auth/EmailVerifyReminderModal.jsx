/**
 * EmailVerifyReminderModal — глобальный модал-напоминание о подтверждении email.
 *
 * Логика показа:
 *  - Юзер залогинен И user.email есть И user.email_verified === false
 *  - Показывается один раз за сессию (отслеживается через sessionStorage)
 *  - Можно нажать «Напомнить позже» (закрытие на эту сессию)
 *  - При клике «Подтвердить сейчас» → встроенный EmailVerifyCodeStep
 *  - После успешного verify → refreshUser() → модал закроется автоматически
 *
 * Используется в App.jsx (рендерится глобально).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import EmailVerifyCodeStep from './EmailVerifyCodeStep';
import { authAPI } from '../../services/authAPI';

const SESSION_KEY = 'email_verify_reminder_dismissed';

export default function EmailVerifyReminderModal() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [enteringCode, setEnteringCode] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [requestError, setRequestError] = useState('');

  const shouldShow = !!(
    isAuthenticated
    && user
    && user.email
    && user.email_verified === false
  );

  useEffect(() => {
    if (!shouldShow) {
      setOpen(false);
      setEnteringCode(false);
      return;
    }
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (_) {}
    if (!dismissed) {
      // Лёгкая задержка — чтобы не моргнуть при быстром восстановлении сессии
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [shouldShow]);

  const handleDismiss = useCallback(() => {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {}
    setOpen(false);
    setEnteringCode(false);
    setRequestError('');
  }, []);

  const handleStartVerify = useCallback(async () => {
    if (!user?.email) return;
    setRequestingCode(true);
    setRequestError('');
    try {
      // Запросим свежий код — если предыдущий ещё активен, бэк всё равно сгенерит новый.
      await authAPI.resendVerifyCode({ email: user.email });
    } catch (e) {
      // Privacy: бэк всегда отвечает success=true, но on network error продолжаем
      setRequestError(e?.message || '');
    } finally {
      setRequestingCode(false);
      setEnteringCode(true);
    }
  }, [user?.email]);

  const handleVerified = useCallback(async () => {
    try { await refreshUser?.(); } catch (_) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    setOpen(false);
    setEnteringCode(false);
  }, [refreshUser]);

  if (!open || !shouldShow) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-2">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {enteringCode ? 'Введите код из письма' : 'Подтвердите email'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 -mt-1 -mr-1"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {!enteringCode ? (
          <div className="p-5">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">
              Ваш email <span className="font-medium text-zinc-900 dark:text-zinc-100">{user?.email}</span> ещё не подтверждён.
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Это нужно для восстановления доступа, важных уведомлений и интеграций.
              Подтверждение займёт меньше минуты.
            </p>

            {requestError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-2.5 mb-3 text-xs text-red-700 dark:text-red-300">
                {requestError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDismiss}
                disabled={requestingCode}
                className="flex-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
              >
                Напомнить позже
              </button>
              <button
                type="button"
                onClick={handleStartVerify}
                disabled={requestingCode}
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
              >
                {requestingCode ? 'Отправляем код…' : 'Подтвердить сейчас'}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-2 py-2">
            <EmailVerifyCodeStep
              email={user?.email}
              variant="modal"
              onVerified={handleVerified}
              onSkip={handleDismiss}
              onCancel={() => setEnteringCode(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
