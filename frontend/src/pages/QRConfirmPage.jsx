/**
 * QRConfirmPage — страница подтверждения QR-логина.
 *
 * URL: /auth/qr/confirm?token=xxx
 * Если пользователь авторизован — вызываем /confirm для входа с другого устройства.
 * Иначе — редирект на /login с сохранённым token.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, Smartphone } from 'lucide-react';
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

  const handleConfirm = async () => {
    if (!token) return;
    setStatus('processing'); setError(null);
    try {
      await authAPI.qrConfirm(token);
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setError(e.message);
    }
  };

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Токен QR-сессии отсутствует');
    }
  }, [token]);

  if (!isAuthenticated) {
    return (
      <AuthLayout title="Вход по QR" subtitle="Сначала войдите в аккаунт">
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-200">
            Для подтверждения QR-входа нужно сначала авторизоваться на этом устройстве.
          </div>
          <AuthButton
            onClick={() =>
              navigate(`/login?continue=${encodeURIComponent(`/auth/qr/confirm?token=${token}`)}`)
            }
          >
            Войти
          </AuthButton>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Подтвердить вход" subtitle="C другого устройства">
      {status === 'idle' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <Smartphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-300" />
            <div>
              Вы войдёте как <span className="font-semibold text-white">{user?.first_name || user?.username || user?.uid}</span> на устройстве, с которого отсканировали QR.
            </div>
          </div>
          <AuthButton onClick={handleConfirm}>Подтвердить вход</AuthButton>
          <AuthButton variant="secondary" onClick={() => navigate('/')}>
            Отмена
          </AuthButton>
        </div>
      )}

      {status === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-400" />
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
            <div className="text-sm text-red-300">{error}</div>
          </div>
          <AuthButton onClick={() => navigate('/')}>На главную</AuthButton>
        </div>
      )}
    </AuthLayout>
  );
};

export default QRConfirmPage;
