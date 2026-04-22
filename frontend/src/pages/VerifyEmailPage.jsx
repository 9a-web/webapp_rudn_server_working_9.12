/**
 * VerifyEmailPage — /verify-email?token=...
 *
 * Автоматически выполняет подтверждение email при открытии страницы.
 */
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../components/auth/AuthLayout';
import AuthButton from '../components/auth/AuthButton';

const STATES = { LOADING: 'loading', OK: 'ok', FAIL: 'fail' };

const VerifyEmailPage = () => {
  const { verifyEmail, isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(STATES.LOADING);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) {
        if (!mounted) return;
        setState(STATES.FAIL);
        setMessage('Ссылка не содержит токен');
        return;
      }
      try {
        await verifyEmail(token);
        if (!mounted) return;
        setState(STATES.OK);
        setMessage('Email успешно подтверждён!');
      } catch (err) {
        if (!mounted) return;
        setState(STATES.FAIL);
        setMessage(err?.message || 'Не удалось подтвердить email. Возможно, ссылка истекла.');
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthLayout
      title="Подтверждение email"
      subtitle={
        state === STATES.LOADING
          ? 'Обрабатываем…'
          : state === STATES.OK
            ? 'Готово!'
            : 'Не удалось'
      }
    >
      <div className="text-center">
        {state === STATES.LOADING && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-indigo-400" />
            <p className="mt-4 text-sm text-white/60">Подтверждаем ваш email…</p>
          </>
        )}
        {state === STATES.OK && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-sm text-white/70">{message}</p>
            <div className="mt-6">
              <Link to={isAuthenticated ? '/' : '/login'}>
                <AuthButton>{isAuthenticated ? 'К приложению' : 'Войти'}</AuthButton>
              </Link>
            </div>
          </>
        )}
        {state === STATES.FAIL && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <p className="text-sm text-white/70">{message}</p>
            <p className="mt-3 text-xs text-white/40">
              Запросите новое письмо в настройках профиля после входа.
            </p>
            <div className="mt-6">
              <Link to={isAuthenticated ? '/' : '/login'}>
                <AuthButton variant="secondary">{isAuthenticated ? 'К приложению' : 'Войти'}</AuthButton>
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
