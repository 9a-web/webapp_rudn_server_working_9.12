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

      <div className="flex items-center justify-end -mt-2">
        <Link
          to="/forgot-password"
          className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
        >
          Забыли пароль?
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <AuthButton type="submit" loading={loading} onClick={handleSubmit}>
        Войти
      </AuthButton>

      {onSwitchRegister && (
        <div className="pt-2 text-center text-xs text-white/50">
          Нет аккаунта?{' '}
          <button
            type="button"
            onClick={onSwitchRegister}
            className="font-semibold text-indigo-300 hover:text-indigo-200"
          >
            Зарегистрироваться
          </button>
        </div>
      )}
    </form>
  );
};

export default EmailLoginForm;
