/**
 * ResetPasswordPage — /reset-password?token=...
 *
 * Форма ввода нового пароля. После успеха авто-логинит (backend возвращает access_token).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';

const ResetPasswordPage = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError('Токен отсутствует. Запросите новую ссылку.');
  }, [token]);

  const validate = () => {
    if (password.length < 6) return 'Пароль должен быть не менее 6 символов';
    if (password !== confirm) return 'Пароли не совпадают';
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err) {
      setError(err?.message || 'Не удалось сбросить пароль');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="Сброс пароля"
        subtitle="Нет токена в ссылке"
        footer={<Link to="/forgot-password" className="text-indigo-300 hover:text-indigo-200">Запросить новую ссылку</Link>}
      >
        <div className="flex items-center gap-3 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Ссылка повреждена или устарела. Попросите новую.</span>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Новый пароль"
      subtitle={success ? 'Пароль изменён!' : 'Задайте новый пароль для входа'}
    >
      {success ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <p className="text-sm text-white/70">Пароль успешно изменён. Перенаправляем…</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <AuthInput
            label="Новый пароль"
            type="password"
            icon={Lock}
            placeholder="Минимум 6 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
          <AuthInput
            label="Повторите пароль"
            type="password"
            icon={Lock}
            placeholder="Ещё раз"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            error={error}
          />
          <AuthButton type="submit" loading={loading} disabled={loading}>
            Установить пароль
          </AuthButton>
          <p className="text-xs text-white/40">
            После смены пароля все остальные сессии будут завершены для вашей безопасности.
          </p>
        </form>
      )}
    </AuthLayout>
  );
};

export default ResetPasswordPage;
