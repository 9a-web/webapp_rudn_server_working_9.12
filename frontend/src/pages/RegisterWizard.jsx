/**
 * RegisterWizard — многошаговая регистрация.
 *
 * Шаги:
 *  1. Выбор способа авторизации (если не авторизован)
 *  2. Username + first_name / last_name
 *  3. Факультет / уровень / курс / группа (через существующий GroupSelector)
 *
 * Если пользователь уже авторизован (через любой метод) и registration_step указан > 0,
 * сразу прыгаем на соответствующий шаг.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, User, Check, Mail, MessageCircle, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import EmailRegisterForm from '../components/auth/EmailRegisterForm';
import TelegramLoginWidget from '../components/auth/TelegramLoginWidget';
import TelegramWebAppLoginButton from '../components/auth/TelegramWebAppLoginButton';
import VkLoginButton from '../components/auth/VkLoginButton';
import UsernameField from '../components/auth/UsernameField';
import GroupSelector from '../components/GroupSelector';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import useIsInsideTelegram from '../hooks/useIsInsideTelegram';

// Progress индикатор
const StepIndicator = ({ current, total }) => (
  <div className="mb-6 flex items-center justify-center gap-2">
    {Array.from({ length: total }).map((_, i) => {
      const active = i + 1 <= current;
      const isCurrent = i + 1 === current;
      return (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
              active
                ? 'bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-white/10 text-white/40'
            } ${isCurrent ? 'ring-2 ring-indigo-400/40' : ''}`}
          >
            {active && i + 1 < current ? <Check size={14} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={`h-0.5 w-6 rounded ${
                i + 1 < current ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500' : 'bg-white/10'
              }`}
            />
          )}
        </div>
      );
    })}
  </div>
);

// ================= STEP 1: Выбор способа авторизации =================
const Step1AuthMethod = ({ config, onNext }) => {
  const [method, setMethod] = useState(null);
  const { loginTelegramWidget, loginTelegramWebApp } = useAuth();

  // Внутри Telegram WebApp не показываем iframe-widget — используем initData напрямую.
  const { inside: isInsideTelegram } = useIsInsideTelegram();

  if (method === 'email') {
    return (
      <div>
        <button
          onClick={() => setMethod(null)}
          className="mb-4 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80"
        >
          <ArrowLeft size={14} /> Назад
        </button>
        <EmailRegisterForm
          onSuccess={onNext}
          onSwitchLogin={() => window.location.assign('/login')}
        />
      </div>
    );
  }

  if (method === 'telegram') {
    return (
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => setMethod(null)}
          className="self-start inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80"
        >
          <ArrowLeft size={14} /> Назад
        </button>
        {isInsideTelegram ? (
          <>
            <div className="text-center text-sm text-white/70">
              Данные Telegram-профиля подгрузятся автоматически.
            </div>
            <TelegramWebAppLoginButton
              label="Войти через Telegram"
              onSubmit={async (initData, startParam) => {
                const resp = await loginTelegramWebApp(initData, startParam);
                onNext(resp);
              }}
            />
          </>
        ) : (
          <>
            <div className="text-center text-sm text-white/70">
              Нажмите кнопку Telegram ниже — профиль создастся автоматически.
            </div>
            <TelegramLoginWidget
              botUsername={config?.telegram_bot_username}
              onAuth={async (data) => {
                try {
                  const resp = await loginTelegramWidget(data);
                  onNext(resp);
                } catch (e) {
                  alert('Telegram: ' + e.message);
                }
              }}
            />
          </>
        )}
      </div>
    );
  }

  if (method === 'vk') {
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setMethod(null)}
          className="self-start inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80"
        >
          <ArrowLeft size={14} /> Назад
        </button>
        <div className="text-center text-sm text-white/70">
          Вы будете перенаправлены на VK ID для подтверждения.
        </div>
        <VkLoginButton appId={config?.vk_app_id} />
      </div>
    );
  }

  // Initial menu
  return (
    <div className="space-y-3">
      <div className="mb-4 text-center text-sm text-white/70">
        Выберите, как создать аккаунт:
      </div>

      <MethodButton
        icon={Mail}
        title="Email и пароль"
        subtitle="Традиционная регистрация"
        onClick={() => setMethod('email')}
      />
      <MethodButton
        icon={MessageCircle}
        title="Через Telegram"
        subtitle="Быстрый вход через ваш Telegram-аккаунт"
        onClick={() => setMethod('telegram')}
        accent="from-sky-500 to-cyan-500"
      />
      <MethodButton
        icon={() => (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M21.579 6.855c.14-.465 0-.806-.661-.806h-2.19c-.558 0-.813.295-.953.619 0 0-1.115 2.719-2.695 4.482-.51.513-.743.675-1.021.675-.139 0-.341-.162-.341-.627V6.855c0-.558-.161-.806-.626-.806H9.642c-.348 0-.557.258-.557.504 0 .528.79.65.871 2.138v3.228c0 .707-.127.836-.407.836-.742 0-2.551-2.732-3.624-5.858-.213-.617-.425-.85-.986-.85h-2.19c-.626 0-.75.294-.75.619 0 .58.742 3.462 3.46 7.271 1.811 2.604 4.361 4.014 6.685 4.014 1.393 0 1.566-.314 1.566-.854v-1.964c0-.627.132-.752.574-.752.325 0 .883.164 2.185 1.418 1.487 1.488 1.732 2.152 2.57 2.152h2.19c.626 0 .94-.314.759-.932-.197-.618-.906-1.515-1.846-2.579-.51-.604-1.276-1.253-1.509-1.577-.325-.417-.232-.604 0-.974.001.001 2.672-3.76 2.95-5.04z" />
          </svg>
        )}
        title="Через VK ID"
        subtitle="Используем ваш VK-аккаунт"
        onClick={() => setMethod('vk')}
        accent="from-blue-500 to-blue-600"
      />
    </div>
  );
};

const MethodButton = ({ icon: Icon, title, subtitle, onClick, accent = 'from-indigo-500 to-fuchsia-500' }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/20 hover:bg-white/10 active:scale-[0.98]"
  >
    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-md`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="text-xs text-white/50">{subtitle}</div>
    </div>
    <ArrowRight className="h-4 w-4 text-white/40 transition group-hover:translate-x-1 group-hover:text-white/80" />
  </button>
);

// ================= STEP 2: Profile =================
const Step2Profile = ({ user, onComplete, onBack }) => {
  const [username, setUsername] = useState(user?.username || '');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [usernameValid, setUsernameValid] = useState(!!user?.username);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { updateProfile } = useAuth();

  const canSubmit = (usernameValid || !!username) && firstName.trim().length > 0;

  const handleNext = async () => {
    setError(null);
    if (!firstName.trim()) { setError('Введите имя'); return; }
    if (username && !usernameValid) { setError('Выберите другой username'); return; }
    setSaving(true);
    try {
      await updateProfile({
        username: username || undefined,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        complete_step: 2,
      });
      onComplete();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-3 text-center text-sm text-white/70">
        Расскажите о себе — эти данные увидят друзья.
      </div>

      <UsernameField value={username} onChange={setUsername} onValidChange={setUsernameValid} />
      <div className="grid grid-cols-2 gap-3">
        <AuthInput
          icon={User} type="text" label="Имя"
          placeholder="Иван"
          value={firstName} onChange={(e) => setFirstName(e.target.value)}
        />
        <AuthInput
          type="text" label="Фамилия"
          placeholder="Петров"
          value={lastName} onChange={(e) => setLastName(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {onBack && (
          <AuthButton variant="secondary" onClick={onBack} disabled={saving} className="flex-1">
            Назад
          </AuthButton>
        )}
        <AuthButton onClick={handleNext} loading={saving} disabled={!canSubmit} className="flex-[2]">
          Продолжить
        </AuthButton>
      </div>
    </div>
  );
};

// ================= STEP 3: Academic =================
const Step3Academic = ({ onComplete, onSkip }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { updateProfile } = useAuth();

  const handleGroupSelected = async (groupData) => {
    setSaving(true); setError(null);
    try {
      await updateProfile({
        facultet_id: groupData.facultet_id,
        facultet_name: groupData.facultet_name,
        level_id: groupData.level_id,
        form_code: groupData.form_code,
        kurs: groupData.kurs,
        group_id: groupData.group_id,
        group_name: groupData.group_name,
        complete_step: 3,
      });
      onComplete();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true); setError(null);
    try {
      await updateProfile({ complete_step: 3 });
      onSkip?.();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-3 text-center text-sm text-white/70">
        Выберите факультет и группу, чтобы получать расписание РУДН.
      </div>

      <div className="-mx-2 overflow-hidden">
        <GroupSelector onGroupSelected={handleGroupSelected} onCancel={handleSkip} />
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>
      )}

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={handleSkip}
          disabled={saving}
          className="text-xs text-white/50 hover:text-white/80 disabled:opacity-50"
        >
          Пропустить — настрою позже
        </button>
      </div>
    </div>
  );
};

// ================= MAIN =================
const RegisterWizard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshMe } = useAuth();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    authAPI.config().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    // Если всё уже заполнено — на главную
    if (isAuthenticated && user && (user.registration_step ?? 0) === 0) {
      navigate('/', { replace: true });
    } else if (isAuthenticated && user) {
      // Переключаемся на соответствующий шаг автоматически
      setStep(user.registration_step || 2);
    }
  }, [isAuthenticated, user, navigate]);

  const handleStep1Done = async () => {
    // После email/telegram/vk regist у нас есть JWT + user.registration_step=2
    await refreshMe();
    setStep(2);
  };

  const handleStep2Done = () => setStep(3);
  const handleFinish = () => navigate('/', { replace: true });

  return (
    <AuthLayout
      title="Регистрация"
      subtitle={
        step === 1 ? 'Шаг 1 из 3 — способ входа'
        : step === 2 ? 'Шаг 2 из 3 — профиль'
        : 'Шаг 3 из 3 — учебные данные'
      }
      footer={
        <div>
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-semibold text-indigo-300 hover:text-indigo-200">Войти</Link>
        </div>
      }
    >
      <StepIndicator current={step} total={3} />

      <AnimatePresence mode="wait">
        <motion.div
          key={`step-${step}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 1 && <Step1AuthMethod config={config} onNext={handleStep1Done} />}
          {step === 2 && (
            <Step2Profile
              user={user}
              onComplete={handleStep2Done}
            />
          )}
          {step === 3 && (
            <Step3Academic onComplete={handleFinish} onSkip={handleFinish} />
          )}
        </motion.div>
      </AnimatePresence>
    </AuthLayout>
  );
};

export default RegisterWizard;
