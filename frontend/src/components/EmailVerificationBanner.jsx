/**
 * EmailVerificationBanner — ненавязчивое уведомление в профиле/настройках.
 *
 * Показывается если:
 *  - email привязан
 *  - но не подтверждён (user.email_verified === false)
 *
 * Позволяет отправить письмо о подтверждении.
 */
import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const EmailVerificationBanner = ({ className = '' }) => {
  const { user, sendVerification } = useAuth();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!user || !user.email || user.email_verified) return null;

  const handleSend = async () => {
    setBusy(true);
    setErr('');
    try {
      await sendVerification();
      setSent(true);
    } catch (e) {
      setErr(e?.message || 'Не удалось отправить письмо');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-amber-500/15 p-1.5">
          {sent ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Mail className="h-4 w-4 text-amber-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {sent ? (
            <>
              <p className="text-sm font-medium text-emerald-300">Письмо отправлено</p>
              <p className="mt-0.5 text-xs text-white/50">
                Проверьте <span className="text-white">{user.email}</span> и перейдите по ссылке.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-amber-200">Подтвердите email</p>
              <p className="mt-0.5 text-xs text-white/50">
                Мы отправим ссылку на <span className="text-white">{user.email}</span>
              </p>
              {err && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-red-300">
                  <AlertTriangle className="h-3 w-3" /> {err}
                </div>
              )}
              <button
                type="button"
                onClick={handleSend}
                disabled={busy}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500/25 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                Отправить письмо
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
