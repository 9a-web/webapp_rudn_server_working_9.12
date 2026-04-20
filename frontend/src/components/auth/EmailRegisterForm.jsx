/**
 * Email Registration Form (шаг 1 визарда).
 * Собирает email + пароль + first_name.
 * После успеха — сервер выдаёт JWT + UserPublic с registration_step=2.
 */
import React, { useState } from 'react';
import { Mail, Lock, User } from 'lucide-react';
import AuthInput from './AuthInput';
import AuthButton from './AuthButton';
import { useAuth } from '../../contexts/AuthContext';

const EmailRegisterForm = ({ onSuccess, onSwitchLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState(null);
  const { registerEmail, loading } = useAuth();

  const validate = () => {
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return 'Введите корректный email';
    }
    if (password.length < 6) return 'Пароль должен быть не менее 6 символов';
    if (password !== confirmPassword) return 'Пароли не совпадают';
    if (!firstName.trim()) return 'Введите имя';
    return null;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    try {
      const resp = await registerEmail(email.trim(), password, firstName.trim(), lastName.trim() || null);
      onSuccess?.(resp);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <AuthInput
        icon={Mail} type="email" label="Email"
        placeholder="you@example.com" autoComplete="email"
        value={email} onChange={(e) => setEmail(e.target.value)} required
      />
      <div className="grid grid-cols-2 gap-3">
        <AuthInput
          icon={User} type="text" label="Имя"
          placeholder="Иван" autoComplete="given-name"
          value={firstName} onChange={(e) => setFirstName(e.target.value)} required
        />
        <AuthInput
          type="text" label="Фамилия"
          placeholder="Петров" autoComplete="family-name"
          value={lastName} onChange={(e) => setLastName(e.target.value)}
        />
      </div>
      <AuthInput
        icon={Lock} type="password" label="Пароль"
        placeholder="Минимум 6 символов" autoComplete="new-password"
        value={password} onChange={(e) => setPassword(e.target.value)} required
      />
      <AuthInput
        icon={Lock} type="password" label="Повторите пароль"
        placeholder="Тот же пароль" autoComplete="new-password"
        value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
      />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <AuthButton type="submit" loading={loading} onClick={handleSubmit}>
        Продолжить
      </AuthButton>

      {onSwitchLogin && (
        <div className="pt-2 text-center text-xs text-white/50">
          Уже есть аккаунт?{' '}
          <button
            type="button" onClick={onSwitchLogin}
            className="font-semibold text-indigo-300 hover:text-indigo-200"
          >Войти</button>
        </div>
      )}
    </form>
  );
};

export default EmailRegisterForm;
