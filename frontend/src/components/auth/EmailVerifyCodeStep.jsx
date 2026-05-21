/**
 * EmailVerifyCodeStep — экран ввода 4-значного кода подтверждения email.
 *
 * Используется:
 *   1. Сразу после регистрации (Wizard step или модал).
 *   2. При логине неподтверждённого юзера (модал-напоминание).
 *
 * Props:
 *   email           — email, на который отправлен код
 *   onVerified()    — вызывается при успешном подтверждении (можно дёрнуть refreshUser)
 *   onSkip()        — «Подтвердить позже» (необязательная функция)
 *   onCancel()      — кнопка «← Назад» (необязательная)
 *   onAutoLogin(data) — если backend вернул access_token (анонимный flow), сюда придёт data
 *   variant         — 'page' | 'modal' (для модального режима — без шапки)
 *
 * Особенности:
 *  - Авто-сабмит при вводе всех 4 цифр
 *  - Таймер «Отправить ещё раз через 60 сек» с обратным отсчётом
 *  - Beautiful UI с состояниями: idle / loading / error / success
 *  - Поддерживает темную тему
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import OTPInput from './OTPInput';
import { authAPI } from '../../services/authAPI';

const RESEND_COOLDOWN_SEC = 60;

export default function EmailVerifyCodeStep({
  email = '',
  onVerified = null,
  onSkip = null,
  onCancel = null,
  onAutoLogin = null,
  variant = 'page',
  className = '',
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SEC);
  const [resending, setResending] = useState(false);
  const [resendInfoMsg, setResendInfoMsg] = useState('');
  const cooldownRef = useRef(null);

  // Таймер ресенда
  const startCooldown = useCallback(() => {
    setSecondsLeft(RESEND_COOLDOWN_SEC);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startCooldown();
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [startCooldown]);

  // Сабмит кода
  const submit = useCallback(async (codeToSubmit) => {
    const value = (codeToSubmit || code || '').trim();
    if (value.length !== 4 || !/^\d{4}$/.test(value)) {
      setError('Введите 4-значный код');
      return;
    }
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.verifyEmailCode({ email, code: value });
      setSuccess(true);
      // Backend может вернуть access_token (если запрос был анонимный)
      if (res?.access_token && onAutoLogin) {
        try { await onAutoLogin(res); } catch (_) {}
      }
      // Дать визуально увидеть «✓» полсекунды и перейти дальше
      setTimeout(() => {
        if (onVerified) {
          try { onVerified(res); } catch (_) {}
        }
      }, 600);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Неверный код';
      setError(typeof msg === 'string' ? msg : 'Неверный код');
      setCode('');
    } finally {
      setLoading(false);
    }
  }, [code, email, loading, onAutoLogin, onVerified]);

  const handleResend = useCallback(async () => {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    setResendInfoMsg('');
    setError('');
    try {
      await authAPI.resendVerifyCode({ email });
      setResendInfoMsg('Новый код отправлен ✓');
      startCooldown();
      setCode('');
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Не удалось отправить код. Попробуйте позже.';
      setResendInfoMsg('');
      setError(typeof msg === 'string' ? msg : 'Ошибка отправки');
    } finally {
      setResending(false);
    }
  }, [email, resending, secondsLeft, startCooldown]);

  // Реалистичный mask email для приватности отображения (a****@example.com)
  const maskedEmail = (() => {
    if (!email || typeof email !== 'string') return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
    return `${local[0]}${'*'.repeat(Math.max(local.length - 2, 1))}${local[local.length - 1]}@${domain}`;
  })();

  const isModal = variant === 'modal';

  return (
    <div
      className={`flex flex-col items-center w-full ${isModal ? '' : 'min-h-[60vh]'} px-4 py-6 ${className}`}
    >
      {/* Header / Icon */}
      <div className="flex flex-col items-center mb-6">
        <div className={`rounded-full p-4 mb-3 transition-colors ${
          success
            ? 'bg-green-100 dark:bg-green-900/30'
            : error
            ? 'bg-red-100 dark:bg-red-900/30'
            : 'bg-blue-100 dark:bg-blue-900/30'
        }`}>
          {success ? (
            <CheckCircle2 className="w-9 h-9 text-green-600 dark:text-green-400" />
          ) : error ? (
            <AlertCircle className="w-9 h-9 text-red-600 dark:text-red-400" />
          ) : (
            <Mail className="w-9 h-9 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center">
          {success ? 'Email подтверждён!' : 'Подтвердите email'}
        </h2>
        {!success && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 text-center max-w-sm">
            Мы отправили 4-значный код на<br/>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{maskedEmail}</span>
          </p>
        )}
      </div>

      {/* OTP boxes */}
      {!success && (
        <>
          <OTPInput
            length={4}
            value={code}
            onChange={(v) => { setCode(v); if (error) setError(''); }}
            onComplete={(c) => submit(c)}
            error={!!error}
            disabled={loading}
            autoFocus
          />

          {/* Error / Info */}
          <div className="min-h-[24px] mt-3 text-center">
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            {!error && resendInfoMsg && (
              <p className="text-sm text-green-600 dark:text-green-400">{resendInfoMsg}</p>
            )}
          </div>

          {/* Submit button (для desktop / случая когда юзер вводит цифры тапом) */}
          <button
            type="button"
            onClick={() => submit(code)}
            disabled={loading || code.length !== 4}
            className="mt-3 w-full max-w-sm rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3 text-base font-semibold text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Проверяем…' : 'Подтвердить'}
          </button>

          {/* Resend */}
          <div className="mt-5 text-center text-sm">
            {secondsLeft > 0 ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                Отправить код ещё раз через {secondsLeft}с
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50"
              >
                {resending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Отправляем…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Отправить код ещё раз
                  </>
                )}
              </button>
            )}
          </div>

          {/* Skip / Cancel buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-2 w-full max-w-sm">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Назад
              </button>
            )}
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                disabled={loading}
                className="flex-1 rounded-xl bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 transition-colors"
              >
                Подтвердить позже
              </button>
            )}
          </div>
        </>
      )}

      {/* Success state */}
      {success && (
        <p className="text-base text-zinc-600 dark:text-zinc-400 text-center max-w-sm">
          Спасибо! Сейчас перенаправим вас в приложение…
        </p>
      )}
    </div>
  );
}
