/**
 * ForgotPasswordPage — /forgot-password
 *
 * Запрос ссылки для сброса пароля. Privacy-aware:
 * backend всегда возвращает success (не подтверждает существование email).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';

const ForgotPasswordPage = () => {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = (email || '').trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Введите корректный email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await forgotPassword(trimmed);
      setSent(true);
    } catch (err) {
      // Даже при ошибке backend для privacy чаще всего возвращает success.
      // Но rate-limit (429) может вернуть ошибку — покажем её.
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('слишком') || msg.includes('429')) {
        setError('Слишком много запросов. Попробуйте позже.');
      } else {
        // Всё равно показываем успех (privacy)
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Восстановление пароля"
      subtitle={sent ? 'Проверьте вашу почту' : 'Мы отправим ссылку для сброса'}
      footer={(
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад ко входу
        </Link>
      )}
    >
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">Письмо отправлено</h2>
          <p className="text-sm text-white/60">
            Если email <strong className="text-white">{email}</strong> зарегистрирован — мы
            отправили на него ссылку для сброса пароля.
          </p>
          <p className="mt-3 text-xs text-white/40">
            Ссылка действительна 30 минут. Не забудьте проверить папку «Спам».
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <AuthInput
            label="Email"
            type="email"
            icon={Mail}
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            error={error}
          />
          <AuthButton type="submit" loading={loading} disabled={loading}>
            Отправить ссылку
          </AuthButton>
          <p className="text-xs text-white/40">
            Если email зарегистрирован, вы получите письмо с инструкцией. Мы не подтверждаем
            существование email из соображений безопасности.
          </p>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
