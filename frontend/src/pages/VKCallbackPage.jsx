/**
 * VKCallbackPage — обработка возврата от VK ID OAuth.
 *
 * URL: /auth/vk/callback?code=...&state=...&device_id=...
 *
 * Поддерживает два режима (читает `vk_oauth_mode` из sessionStorage):
 *   - `login` (по умолчанию): обычный вход/регистрация → POST /api/auth/login/vk
 *   - `link` : привязка VK к уже авторизованному аккаунту → POST /api/auth/link/vk
 *
 * 🔒 Stage 6:
 *  - `processedRef` guard защищает от повторного выполнения в React StrictMode
 *    (useEffect срабатывает дважды → VK code одноразовый → второй обмен падает).
 *  - Поддержка `?continue=...` через sessionStorage (vk_oauth_continue).
 *  - Усилена CSRF-проверка state.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, XCircle, CheckCircle2 } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import AuthButton from '../components/auth/AuthButton';
import { useAuth } from '../contexts/AuthContext';
import { PUBLIC_BASE_URL } from '../constants/publicBase';
import { authAPI } from '../services/authAPI';
import { safeContinueUrl } from '../utils/safeRedirect'; // Stage 7: B-01

const VKCallbackPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing | success | error
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('login');
  const { loginVK, refreshMe } = useAuth();

  // 🛡️ StrictMode guard — useEffect выполнится дважды в dev,
  // а VK code одноразовый. Гарантируем единственный exchange.
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const deviceId = params.get('device_id');
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

    // CSRF: при login требуем совпадение state. При link допускаем отсутствие
    // (ссылка может быть сгенерирована до рестарта вкладки).
    const savedState = sessionStorage.getItem('vk_oauth_state');
    if (savedState && state && state !== savedState) {
      setStatus('error');
      setError('State не совпадает — возможна CSRF-атака. Попробуйте войти ещё раз.');
      return;
    }
    if (savedMode === 'login' && !savedState) {
      // Сессия sessionStorage потеряна (другая вкладка/incognito) — отказ.
      setStatus('error');
      setError('Сессия VK OAuth не найдена. Откройте вход заново и попробуйте снова.');
      return;
    }

    const verifier = sessionStorage.getItem('vk_oauth_verifier') || undefined;
    const redirect = sessionStorage.getItem('vk_oauth_redirect')
      || `${PUBLIC_BASE_URL}/auth/vk/callback`;
    const referralCode = sessionStorage.getItem('vk_oauth_referral') || undefined;
    // Stage 7: B-01 — sanitize continue URL из sessionStorage
    const continueUrl = safeContinueUrl(sessionStorage.getItem('vk_oauth_continue'), null);

    const cleanup = () => {
      ['vk_oauth_state', 'vk_oauth_verifier', 'vk_oauth_redirect',
        'vk_oauth_mode', 'vk_oauth_referral', 'vk_oauth_continue'].forEach((k) => {
        try { sessionStorage.removeItem(k); } catch { /* noop */ }
      });
    };

    (async () => {
      try {
        if (savedMode === 'link') {
          await authAPI.linkVK({
            code,
            device_id: deviceId || undefined,
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
            device_id: deviceId || undefined,
            redirect_uri: redirect,
            code_verifier: verifier,
            state,
            referral_code: referralCode,
          });
          cleanup();
          setStatus('success');
          setTimeout(() => {
            // Если есть continueUrl — приоритет; иначе onboarding или /
            if (continueUrl) {
              navigate(continueUrl, { replace: true });
            } else if ((resp.user?.registration_step ?? 0) > 0) {
              navigate('/register', { replace: true });
            } else {
              navigate('/', { replace: true });
            }
          }, 300);
        }
      } catch (e) {
        // Stage 7: B-09 — cleanup sessionStorage на ошибке, иначе следующая попытка
        // упадёт с "State mismatch" из-за устаревших данных в storage.
        cleanup();
        setStatus('error');
        setError(e.message || 'Не удалось завершить вход через VK');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <div className="text-sm text-red-300 break-words">{error}</div>
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
