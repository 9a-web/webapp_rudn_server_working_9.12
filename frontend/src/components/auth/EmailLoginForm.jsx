/**
 * Email Login Form.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import AuthInput from './AuthInput';
import AuthButton from './AuthButton';
import { useAuth } from '../../contexts/AuthContext';

const EmailLoginForm = ({ onSuccess, onSwitchRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { loginEmail, loading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Введите email и пароль');
      return;
    }
    try {
      const resp = await loginEmail(email.trim(), password);
      onSuccess?.(resp);
    } catch (e) {
      // Улучшенные сообщения для конкретных ошибок
      const msg = e?.message || 'Не удалось войти';
      if (msg.includes('429') || msg.toLowerCase().includes('слишком')) {
        setError('Слишком много попыток входа. Попробуйте через несколько минут.');
      } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('неверн')) {
        setError('Неверный email или пароль');
      } else {
        setError(msg);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AuthInput
        icon={Mail}
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <AuthInput
        icon={Lock}
        type="password"
        label="Пароль"
        placeholder="Ваш пароль"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <div className="flex items-center justify-end -mt-1">
        <Link
          to="/forgot-password"
          className="text-xs font-medium text-indigo-200 underline-offset-4 transition-colors hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 rounded"
        >
          Забыли пароль?
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-red-400/40 bg-red-500/[0.12] p-3 text-xs text-red-200 backdrop-blur-md"
        >
          <svg className="mt-[1px] h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <AuthButton type="submit" loading={loading}>
        Войти
      </AuthButton>

      {onSwitchRegister && (
        <div className="pt-2 text-center text-xs text-white/55">
          Нет аккаунта?{' '}
          <button
            type="button"
            onClick={onSwitchRegister}
            className="font-semibold text-indigo-200 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            Зарегистрироваться
          </button>
        </div>
      )}
    </form>
  );
};

export default EmailLoginForm;
