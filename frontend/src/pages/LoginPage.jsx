/**
 * LoginPage — единая страница входа с всеми 4 методами.
 *
 * Методы: Email (форма) / Telegram (widget) / VK (OAuth redirect) / QR (cross-device)
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, QrCode, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuthLayout from '../components/auth/AuthLayout';
import EmailLoginForm from '../components/auth/EmailLoginForm';
import TelegramWebAppLoginButton from '../components/auth/TelegramWebAppLoginButton';
import VkLoginButton from '../components/auth/VkLoginButton';
import QRLoginBlock from '../components/auth/QRLoginBlock';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import useIsInsideTelegram from '../hooks/useIsInsideTelegram';

const VK_LOGO = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M21.579 6.855c.14-.465 0-.806-.661-.806h-2.19c-.558 0-.813.295-.953.619 0 0-1.115 2.719-2.695 4.482-.51.513-.743.675-1.021.675-.139 0-.341-.162-.341-.627V6.855c0-.558-.161-.806-.626-.806H9.642c-.348 0-.557.258-.557.504 0 .528.79.65.871 2.138v3.228c0 .707-.127.836-.407.836-.742 0-2.551-2.732-3.624-5.858-.213-.617-.425-.85-.986-.85h-2.19c-.626 0-.75.294-.75.619 0 .58.742 3.462 3.46 7.271 1.811 2.604 4.361 4.014 6.685 4.014 1.393 0 1.566-.314 1.566-.854v-1.964c0-.627.132-.752.574-.752.325 0 .883.164 2.185 1.418 1.487 1.488 1.732 2.152 2.57 2.152h2.19c.626 0 .94-.314.759-.932-.197-.618-.906-1.515-1.846-2.579-.51-.604-1.276-1.253-1.509-1.577-.325-.417-.232-.604 0-.974.001.001 2.672-3.76 2.95-5.04z" />
  </svg>
);

const TABS = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'telegram', label: 'Telegram', icon: MessageCircle },
  { key: 'vk', label: 'VK ID', icon: VK_LOGO },
  { key: 'qr', label: 'QR', icon: QrCode },
];

const LoginPage = () => {
  const [tab, setTab] = useState('email');
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const continueUrl = searchParams.get('continue') || '/';
  const { applyQRResult, loginTelegramWebApp, isAuthenticated, needsOnboarding } = useAuth();

  // Для подсказки в UI («Вы уже в Telegram...»). Детекция мягкая — если false,
  // кнопка всё равно рендерится и сама покажет нужную подсказку.
  const { inside: isInsideTelegram } = useIsInsideTelegram();

  useEffect(() => {
    authAPI.config().then(setConfig).catch((e) => setConfigError(e.message));
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      if (needsOnboarding) navigate('/register', { replace: true });
      else navigate(continueUrl, { replace: true });
    }
  }, [isAuthenticated, needsOnboarding, navigate, continueUrl]);

  const handleSuccess = () => {
    // Auth redirect будет автоматический через useEffect выше
  };

  const handleTelegramWebApp = async (initData, startParam) => {
    // onSubmit из TelegramWebAppLoginButton — ошибки всплывают обратно в UI кнопки.
    await loginTelegramWebApp(initData, startParam);
    handleSuccess();
  };

  const handleQRSuccess = async ({ access_token, user }) => {
    applyQRResult({ access_token, user });
    handleSuccess();
  };

  return (
    <AuthLayout
      title="РУДН Расписание"
      subtitle="Войдите любым удобным способом"
      footer={
        <div>
          Нет аккаунта?{' '}
          <Link to="/register" className="font-semibold text-indigo-300 hover:text-indigo-200">Создать</Link>
        </div>
      }
    >
      {/* Tabs */}
      <div className="mb-5 grid grid-cols-4 gap-1 rounded-xl bg-white/5 p-1">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors ${
                active ? 'text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="tab-active"
                  className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/30 ring-1 ring-white/10"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'email' && (
            <EmailLoginForm
              onSuccess={handleSuccess}
              onSwitchRegister={() => navigate('/register')}
            />
          )}

          {tab === 'telegram' && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="text-center text-sm text-white/70">
                {isInsideTelegram
                  ? 'Вы уже в Telegram — данные профиля подгрузятся автоматически.'
                  : 'Вход через Telegram. Внутри бота — в один клик.'}
              </div>
              <TelegramWebAppLoginButton onSubmit={handleTelegramWebApp} />
              {configError && (
                <div className="text-xs text-red-400">{configError}</div>
              )}
            </div>
          )}

          {tab === 'vk' && (
            <div className="flex flex-col gap-4 py-2">
              <div className="text-center text-sm text-white/70">
                Вход через VK ID. Вы будете перенаправлены на id.vk.com.
              </div>
              <VkLoginButton
                appId={config?.vk_app_id}
                disabled={!config?.features?.vk_login}
              />
              {!config?.features?.vk_login && config && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  VK OAuth не сконфигурирован.
                </div>
              )}
            </div>
          )}

          {tab === 'qr' && <QRLoginBlock onSuccess={handleQRSuccess} />}
        </motion.div>
      </AnimatePresence>
    </AuthLayout>
  );
};

export default LoginPage;
