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
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, User, Check, Mail, MessageCircle, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuthLayout from '../components/auth/AuthLayout';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import EmailRegisterForm from '../components/auth/EmailRegisterForm';
import EmailVerifyCodeStep from '../components/auth/EmailVerifyCodeStep';
import TelegramWebAppLoginButton from '../components/auth/TelegramWebAppLoginButton';
import TelegramLoginWidget from '../components/auth/TelegramLoginWidget';
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
  const [tgWidgetError, setTgWidgetError] = useState(null);
  // 🔧 2026-07: после успешной email-регистрации показываем экран ввода 4-значного кода
  const [pendingEmailVerify, setPendingEmailVerify] = useState(null); // { email }
  const { loginTelegramWebApp, loginTelegramWidget } = useAuth();

  // Подсказка для UI — кнопка «Войти через Telegram» рендерится всегда;
  // если юзер не в Telegram, сама кнопка покажет инструкцию открыть через бота.
  const { inside: isInsideTelegram, ready: tgReady } = useIsInsideTelegram();

  // Экран ввода 4-значного кода — после успешной email-регистрации
  if (pendingEmailVerify?.email) {
    return (
      <div>
        <EmailVerifyCodeStep
          email={pendingEmailVerify.email}
          variant="page"
          onVerified={() => {
            // Email подтверждён → дальше по шагам
            setPendingEmailVerify(null);
            onNext?.();
          }}
          onSkip={() => {
            // Юзер выбрал «Подтвердить позже» → продолжаем
            setPendingEmailVerify(null);
            onNext?.();
          }}
        />
      </div>
    );
  }

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
          onSuccess={(resp) => {
            // Сохраняем email и переключаемся на верификацию.
            // resp может содержать user.email, либо берём из формы (но форма уже unmounted).
            const verifiedEmail = resp?.user?.email || null;
            if (verifiedEmail && !resp?.user?.email_verified) {
              setPendingEmailVerify({ email: verifiedEmail });
            } else {
              // Если email уже verified (теоретически — переход с linkEmail) — сразу дальше
              onNext?.();
            }
          }}
          onSwitchLogin={() => window.location.assign('/login')}
        />
      </div>
    );
  }

  if (method === 'telegram') {
    // 🎁 B-N04: подбираем pending_referral_code из URL `?ref=XYZ`, чтобы передать
    // в Telegram WebApp / Login Widget при первой регистрации.
    let pendingRef = null;
    try { pendingRef = sessionStorage.getItem('pending_referral_code'); } catch { /* noop */ }

    const _clearRef = () => {
      try { sessionStorage.removeItem('pending_referral_code'); } catch { /* noop */ }
    };

    return (
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => { setMethod(null); setTgWidgetError(null); }}
          className="self-start inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80"
        >
          <ArrowLeft size={14} /> Назад
        </button>
        <div className="text-center text-sm text-white/70">
          {!tgReady
            ? 'Проверяем окружение Telegram...'
            : isInsideTelegram
              ? 'Данные Telegram-профиля подгрузятся автоматически.'
              : 'Нажмите кнопку ниже и подтвердите вход в приложении Telegram.'}
        </div>

        {tgReady && isInsideTelegram && (
          <TelegramWebAppLoginButton
            label="Войти через Telegram"
            onSubmit={async (initData, startParam) => {
              const resp = await loginTelegramWebApp(initData, startParam || pendingRef);
              if (pendingRef) _clearRef();
              onNext(resp);
            }}
          />
        )}

        {tgReady && !isInsideTelegram && (
          <div className="w-full flex flex-col items-center gap-3">
            {config?.telegram_bot_username && config?.features?.telegram_login ? (
              <TelegramLoginWidget
                botUsername={config.telegram_bot_username}
                onAuth={async (widgetUser) => {
                  setTgWidgetError(null);
                  try {
                    const payload = pendingRef
                      ? { ...widgetUser, referral_code: pendingRef }
                      : widgetUser;
                    const resp = await loginTelegramWidget(payload);
                    if (pendingRef) _clearRef();
                    onNext(resp);
                  } catch (e) {
                    setTgWidgetError(e?.message || 'Не удалось войти через Telegram');
                  }
                }}
                size="large"
                requestAccess="write"
              />
            ) : (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                Telegram Login не сконфигурирован на сервере.
              </div>
            )}
            {tgWidgetError && (
              <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {tgWidgetError}
              </div>
            )}
            <div className="text-[11px] text-white/40 text-center leading-snug">
              Если кнопка не появилась — домен не привязан к боту. Администратору:
              откройте @BotFather → <code className="rounded bg-white/10 px-1">/setdomain</code> и добавьте
              текущий домен.
            </div>
          </div>
        )}

        {!tgReady && (
          <div className="flex items-center justify-center py-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white/80" />
          </div>
        )}
      </div>
    );
  }

  if (method === 'vk') {
    // 🎁 B-N04: пробрасываем pending_referral_code в VK OAuth state.
    let pendingRefVk = null;
    try { pendingRefVk = sessionStorage.getItem('pending_referral_code'); } catch { /* noop */ }

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
        <VkLoginButton appId={config?.vk_app_id} referralCode={pendingRefVk || undefined} />
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
  const [conflictHint, setConflictHint] = useState(null);
  const { updateProfile } = useAuth();

  // Читаем sessionStorage-подсказку о занятом username из Telegram/VK
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('auth:username_conflict');
      if (!raw) return;
      const obj = JSON.parse(raw);
      // TTL 10 минут — не показываем старые
      if (obj?.value && (Date.now() - (obj.ts || 0)) < 10 * 60 * 1000) {
        setConflictHint(obj.value);
      }
      sessionStorage.removeItem('auth:username_conflict');
    } catch { /* noop */ }
  }, []);

  // canSubmit: (a) username пустой ИЛИ valid, И (b) firstName заполнен.
  // Это устраняет противоречие: раньше при невалидном username кнопка
  // оставалась активной (`!!username` всегда true), а handleNext бросал error.
  const canSubmit = (!username || usernameValid) && firstName.trim().length > 0;

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

      {conflictHint && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-200">
          <div className="font-semibold text-amber-100 mb-1">
            Ник <span className="font-mono">@{conflictHint}</span> из Telegram/VK уже занят
          </div>
          <div className="text-amber-200/90">
            Выберите другой ник — он будет виден друзьям и в поиске.
            Можно нажать на одну из подсказок ниже или ввести свой.
          </div>
        </div>
      )}

      <UsernameField
        value={username}
        onChange={setUsername}
        onValidChange={setUsernameValid}
        suggestBase={conflictHint || ''}
      />
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
    <div className="space-y-3">
      <div className="text-center text-xs text-white/65">
        Выберите факультет и группу, чтобы получать расписание РУДН.
      </div>

      <GroupSelector
        variant="glass"
        onGroupSelected={handleGroupSelected}
        onCancel={handleSkip}
      />

      {error && (
        <div role="alert" className="rounded-2xl border border-red-400/40 bg-red-500/[0.12] p-3 text-xs text-red-200 backdrop-blur-md">
          {error}
        </div>
      )}

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={handleSkip}
          disabled={saving}
          className="text-[11px] text-white/50 underline-offset-4 transition-colors hover:text-white/80 hover:underline disabled:opacity-50"
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
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, refreshMe } = useAuth();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState(null);

  // 🎁 Referral code из URL `?ref=XYZ` → сохраняем в sessionStorage, чтобы
  // EmailRegisterForm/Telegram/VK-кнопки могли подобрать его при регистрации.
  // (B-N04) Раньше параметр игнорировался → реферальная программа ломалась.
  useEffect(() => {
    const ref = (searchParams.get('ref') || '').trim();
    if (ref && /^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      try { sessionStorage.setItem('pending_referral_code', ref); } catch { /* noop */ }
    }
  }, [searchParams]);

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
