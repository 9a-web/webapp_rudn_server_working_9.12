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
import TelegramLoginWidget from '../components/auth/TelegramLoginWidget';
import VkLoginButton from '../components/auth/VkLoginButton';
import QRLoginBlock from '../components/auth/QRLoginBlock';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import useIsInsideTelegram from '../hooks/useIsInsideTelegram';
import { safeContinueUrl } from '../utils/safeRedirect'; // Stage 7: B-01

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
  // Stage 7: B-01 — sanitize continue URL для предотвращения Open Redirect
  const continueUrl = safeContinueUrl(searchParams.get('continue'), '/');
  const reason = searchParams.get('reason'); // Stage 7: B-14 — session expired flag
  const { applyQRResult, loginTelegramWebApp, loginTelegramWidget, isAuthenticated, needsOnboarding } = useAuth();

  // Для подсказки в UI («Вы уже в Telegram...»). Детекция мягкая — если false,
  // кнопка всё равно рендерится и сама покажет нужную подсказку.
  const { inside: isInsideTelegram, ready: tgReady } = useIsInsideTelegram();

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

  // Callback для Telegram Login Widget (веб-версия).
  // Приходит `user` с полями {id, first_name, last_name, username, photo_url, auth_date, hash}.
  const [tgWidgetError, setTgWidgetError] = useState(null);
  const handleTelegramWidget = async (widgetUser) => {
    setTgWidgetError(null);
    try {
      await loginTelegramWidget(widgetUser);
      handleSuccess();
    } catch (e) {
      setTgWidgetError(e?.message || 'Не удалось войти через Telegram');
    }
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
          <Link
            to="/register"
            className="font-semibold text-indigo-200 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            Создать
          </Link>
        </div>
      }
    >
      {/* Stage 7: B-14 — session expired banner */}
      {reason === 'expired' && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/[0.12] p-3 text-xs text-amber-100 backdrop-blur-md"
        >
          <span className="mt-[2px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-300" />
          <span>Ваша сессия истекла. Войдите снова.</span>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Способ входа"
        className="relative mb-6 grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/25 p-1 backdrop-blur-md"
        style={{
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 -1px 0 0 rgba(0,0,0,0.25)',
        }}
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`tabpanel-${key}`}
              id={`tab-${key}`}
              onClick={() => setTab(key)}
              className={`relative flex h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
                active ? 'text-white' : 'text-white/55 hover:text-white/85'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="tab-active"
                  className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-400/45 via-violet-500/35 to-fuchsia-500/35 ring-1 ring-white/20"
                  style={{
                    boxShadow:
                      '0 4px 18px -2px rgba(129,140,248,0.45), inset 0 1px 0 0 rgba(255,255,255,0.20)',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                className={`relative z-10 h-[18px] w-[18px] transition-transform duration-200 ${
                  active ? 'scale-110' : ''
                }`}
              />
              <span className="relative z-10 leading-none">{label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          id={`tabpanel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {tab === 'email' && (
            <EmailLoginForm onSuccess={handleSuccess} />
          )}

          {tab === 'telegram' && (
            <div className="flex flex-col items-center gap-4 py-1">
              <div className="text-center text-[13px] leading-relaxed text-white/75">
                {!tgReady
                  ? 'Проверяем окружение Telegram...'
                  : isInsideTelegram
                    ? 'Вы уже в Telegram — данные профиля подгрузятся автоматически.'
                    : 'Нажмите кнопку ниже и подтвердите вход в приложении Telegram.'}
              </div>

              {tgReady && isInsideTelegram && (
                <TelegramWebAppLoginButton onSubmit={handleTelegramWebApp} />
              )}

              {tgReady && !isInsideTelegram && (
                <div className="w-full flex flex-col items-center gap-3">
                  {config?.telegram_bot_username && config?.features?.telegram_login ? (
                    <TelegramLoginWidget
                      botUsername={config.telegram_bot_username}
                      onAuth={handleTelegramWidget}
                      size="large"
                      requestAccess="write"
                    />
                  ) : (
                    <div
                      role="alert"
                      className="rounded-2xl border border-amber-400/40 bg-amber-500/[0.12] p-3 text-xs text-amber-100 backdrop-blur-md"
                    >
                      Telegram Login не сконфигурирован на сервере.
                    </div>
                  )}
                  {tgWidgetError && (
                    <div
                      role="alert"
                      className="w-full rounded-2xl border border-red-400/40 bg-red-500/[0.12] px-3 py-2 text-xs text-red-200 backdrop-blur-md"
                    >
                      {tgWidgetError}
                    </div>
                  )}
                  <div className="text-[11px] leading-snug text-white/45 text-center">
                    Если кнопка не появилась — домен не привязан к боту. Администратору:
                    откройте @BotFather → <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">/setdomain</code> и добавьте
                    текущий домен.
                  </div>
                </div>
              )}

              {!tgReady && (
                <div className="flex items-center justify-center py-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white/85" />
                </div>
              )}

              {configError && (
                <div role="alert" className="text-xs text-red-300">{configError}</div>
              )}
            </div>
          )}

          {tab === 'vk' && (
            <div className="flex flex-col gap-4 py-1">
              <div className="text-center text-[13px] leading-relaxed text-white/75">
                Вход через VK ID. Вы будете перенаправлены на id.vk.com.
              </div>
              <VkLoginButton
                appId={config?.vk_app_id}
                disabled={!config?.features?.vk_login}
              />
              {!config?.features?.vk_login && config && (
                <div
                  role="alert"
                  className="rounded-2xl border border-amber-400/40 bg-amber-500/[0.12] p-3 text-xs text-amber-100 backdrop-blur-md"
                >
                  VK OAuth не сконфигурирован.
                </div>
              )}
            </div>
          )}

          {tab === 'qr' && <QRLoginBlock onSuccess={handleQRSuccess} />}
        </motion.div>
      </AnimatePresence>

      {/* ── Trust badge / Footer внутри карточки ────────────────── */}
      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-white/40">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Защищённое соединение · JWT + bcrypt</span>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
