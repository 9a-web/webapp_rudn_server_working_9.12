/**
 * QRConfirmPage — страница подтверждения QR-логина.
 *
 * URL: /auth/qr/confirm?token=xxx[&auto=1]
 *
 * Поведение:
 *   - Если пользователь авторизован → показываем кнопку «Подтвердить»
 *     (при ?auto=1 — вызываем confirm автоматически, без клика).
 *   - Иначе → редирект на /login?continue=<этот URL>&auto=1, чтобы после
 *     возврата confirm выполнился сразу без лишнего клика.
 *
 * 🔒 Stage 6 hardening:
 *   - autoRef защищает от двойного auto-confirm (StrictMode).
 *   - Показываем preview текущего user (full name + username + uid).
 *   - Лучший error-state с понятными CTA.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2, CheckCircle2, XCircle, Smartphone, ShieldCheck, ArrowRight,
} from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import AuthButton from '../components/auth/AuthButton';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';

const QRConfirmPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [error, setError] = useState(null);
  const token = params.get('token');
  const auto = params.get('auto') === '1';

  const autoRef = useRef(false);

  const handleConfirm = async () => {
    if (!token) return;
    setStatus('processing'); setError(null);
    try {
      await authAPI.qrConfirm(token);
      setStatus('success');
    } catch (e) {
      setStatus('error');
      const msg = e?.response?.data?.detail || e?.message || 'Не удалось подтвердить вход';
      setError(msg);
    }
  };

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Токен QR-сессии отсутствует');
    }
  }, [token]);

  // Auto-confirm после возврата с /login (если запрошено через ?auto=1)
  useEffect(() => {
    if (!auto || !isAuthenticated || !token || status !== 'idle') return;
    if (autoRef.current) return;
    autoRef.current = true;
    handleConfirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, isAuthenticated, token, status]);

  if (!isAuthenticated && token && status !== 'error') {
    // Логин с continue + auto=1, чтобы после возврата сразу подтвердить.
    const continueTarget = `/auth/qr/confirm?token=${encodeURIComponent(token)}&auto=1`;
    return (
      <AuthLayout title="Вход по QR" subtitle="Сначала войдите в аккаунт">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-100">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-300" />
            <div>
              Для подтверждения QR-входа нужно сначала авторизоваться на этом устройстве.
              <br/>
              <span className="text-indigo-300/80">После входа подтверждение выполнится автоматически.</span>
            </div>
          </div>
          <AuthButton
            onClick={() => navigate(`/login?continue=${encodeURIComponent(continueTarget)}`)}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Войти
          </AuthButton>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Подтвердить вход" subtitle="С другого устройства">
      {status === 'idle' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <Smartphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-300" />
            <div>
              Вы войдёте как{' '}
              <span className="font-semibold text-white">
                {user?.first_name || user?.username || user?.uid}
              </span>{' '}
              на устройстве, с которого отсканировали QR.
              {user?.username && (
                <div className="mt-1 text-xs text-white/50">@{user.username}</div>
              )}
            </div>
          </div>
          <AuthButton onClick={handleConfirm}>Подтвердить вход</AuthButton>
          <AuthButton variant="secondary" onClick={() => navigate('/')}>
            Отмена
          </AuthButton>
        </div>
      )}

      {status === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
          <div className="text-sm text-white/60">Подтверждаем вход…</div>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="rounded-full bg-emerald-500/15 p-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          </div>
          <div className="text-lg font-semibold text-white">Готово</div>
          <div className="text-sm text-white/60">Вход подтверждён. Можете закрыть эту вкладку.</div>
          <AuthButton variant="secondary" onClick={() => navigate('/')}>
            На главную
          </AuthButton>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <XCircle className="h-12 w-12 text-red-400" />
            <div className="text-sm text-red-300 break-words max-w-xs">{error}</div>
          </div>
          <AuthButton onClick={() => navigate('/')}>На главную</AuthButton>
        </div>
      )}
    </AuthLayout>
  );
};

export default QRConfirmPage;
