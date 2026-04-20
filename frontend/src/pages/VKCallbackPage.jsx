/**
 * VKCallbackPage — обработка возврата от VK ID OAuth.
 *
 * URL: /auth/vk/callback?code=...&state=...&device_id=...
 *
 * Поддерживает два режима (читает `vk_oauth_mode` из sessionStorage):
 *   - `login` (по умолчанию): обычный вход/регистрация → POST /api/auth/login/vk
 *   - `link` : привязка VK к уже авторизованному аккаунту → POST /api/auth/link/vk
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import AuthButton from '../components/auth/AuthButton';
import { useAuth } from '../contexts/AuthContext';
import { PUBLIC_BASE_URL } from '../constants/publicBase';
import { authAPI } from '../services/authAPI';

const VKCallbackPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing | success | error
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('login');
  const { loginVK, refreshMe } = useAuth();

  useEffect(() => {
    const code = params.get('code');
    const state = params.get('state');
    const device_id = params.get('device_id');
    const vkError = params.get('error') || params.get('error_description');

    const savedMode = sessionStorage.getItem('vk_oauth_mode') || 'login';
    setMode(savedMode);

    if (vkError) {
      setStatus('error');
      setError(`VK: ${vkError}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setError('Ответ VK не содержит code');
      return;
    }

    const savedState = sessionStorage.getItem('vk_oauth_state');
    if (state && savedState && state !== savedState) {
      setStatus('error');
      setError('State не совпадает — возможна CSRF атака');
      return;
    }

    const verifier = sessionStorage.getItem('vk_oauth_verifier') || undefined;
    const redirect = sessionStorage.getItem('vk_oauth_redirect') || `${PUBLIC_BASE_URL}/auth/vk/callback`;
    const referralCode = sessionStorage.getItem('vk_oauth_referral') || undefined;

    const cleanup = () => {
      sessionStorage.removeItem('vk_oauth_state');
      sessionStorage.removeItem('vk_oauth_verifier');
      sessionStorage.removeItem('vk_oauth_redirect');
      sessionStorage.removeItem('vk_oauth_mode');
      sessionStorage.removeItem('vk_oauth_referral');
    };

    (async () => {
      try {
        if (savedMode === 'link') {
          // Привязка к существующему аккаунту (JWT уже есть)
          await authAPI.linkVK({
            code,
            device_id: device_id || undefined,
            redirect_uri: redirect,
            code_verifier: verifier,
            state,
          });
          await refreshMe?.();
          cleanup();
          setStatus('success');
          setTimeout(() => navigate('/?linked=vk', { replace: true }), 700);
        } else {
          const resp = await loginVK({
            code,
            device_id: device_id || undefined,
            redirect_uri: redirect,
            code_verifier: verifier,
            state,
            referral_code: referralCode,
          });
          cleanup();
          setStatus('success');
          setTimeout(() => {
            if ((resp.user?.registration_step ?? 0) > 0) {
              navigate('/register', { replace: true });
            } else {
              navigate('/', { replace: true });
            }
          }, 300);
        }
      } catch (e) {
        setStatus('error');
        setError(e.message);
      }
    })();
    // eslint-disable-next-line
  }, []);

  const isLink = mode === 'link';

  return (
    <AuthLayout
      title="VK ID"
      subtitle={
        status === 'error'
          ? 'Произошла ошибка'
          : isLink
          ? 'Привязка аккаунта'
          : 'Обработка входа'
      }
    >
      {status === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
          <div className="text-sm text-white/70">
            {isLink ? 'Привязываем VK к вашему аккаунту...' : 'Обмениваем code на токен...'}
          </div>
        </div>
      )}
      {status === 'success' && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          <div className="text-sm text-white/70">
            {isLink ? 'VK успешно привязан! Возврат в приложение...' : 'Успех! Перенаправление...'}
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <XCircle className="h-12 w-12 text-red-400" />
            <div className="text-sm text-red-300">{error}</div>
          </div>
          <AuthButton onClick={() => navigate(isLink ? '/' : '/login', { replace: true })}>
            {isLink ? 'Вернуться в приложение' : 'Вернуться к входу'}
          </AuthButton>
        </div>
      )}
    </AuthLayout>
  );
};

export default VKCallbackPage;
