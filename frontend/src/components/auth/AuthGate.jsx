/**
 * AuthGate — защитник роутов.
 *
 * Логика:
 *  1. Пока инициализация не завершена → loading screen.
 *  2. Пользователь уже залогинен (JWT) → пропускаем дальше
 *     (при needsOnboarding — редирект на /register).
 *  3. Мы внутри Telegram WebApp (initData есть), но не залогинены →
 *     показываем явный confirm-экран TelegramWebAppConfirm
 *     («Войти как {Имя} через Telegram?») — НЕ логиним молча.
 *  4. Иначе → редирект на /login с сохранением ?continue=.
 */
import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import TelegramWebAppConfirm from './TelegramWebAppConfirm';

const FullPageLoader = ({ hint }) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-[#0E0E10] text-white">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      {hint && <div className="text-xs text-white/50">{hint}</div>}
    </div>
  </div>
);

const AuthGate = ({ children }) => {
  const { isAuthenticated, needsOnboarding, initializing, loginTelegramWebApp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Telegram WebApp detection (stable across renders)
  const { tg, initData } = useMemo(() => {
    if (typeof window === 'undefined') return { tg: null, initData: null };
    const t = window.Telegram?.WebApp || null;
    const d = t?.initData || null;
    return { tg: t, initData: d && d.length > 0 ? d : null };
  }, []);

  const insideTelegram = !!initData;

  // Редиректы (авторизован либо вообще не Telegram)
  useEffect(() => {
    if (initializing) return;
    if (isAuthenticated) {
      if (needsOnboarding && location.pathname !== '/register') {
        navigate('/register', { replace: true });
      }
      return;
    }
    // Неавторизован
    if (!insideTelegram) {
      const cont = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?continue=${cont}`, { replace: true });
    }
    // Если insideTelegram и не авторизован — показываем confirm (ниже в рендере)
  }, [initializing, isAuthenticated, needsOnboarding, insideTelegram,
      location.pathname, location.search, navigate]);

  // --- Render states ---

  if (initializing) {
    return <FullPageLoader />;
  }

  // Telegram WebApp confirm screen — явное согласие перед логином
  if (!isAuthenticated && insideTelegram) {
    return (
      <TelegramWebAppConfirm
        tg={tg}
        initData={initData}
        onConfirm={async (d, startParam) => {
          await loginTelegramWebApp(d, startParam);
          // После успеха useEffect выше сделает редирект на /register или пропустит дальше.
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return <FullPageLoader hint="Перенаправление..." />;
  }

  if (needsOnboarding && location.pathname !== '/register') {
    return <FullPageLoader hint="Переход к регистрации..." />;
  }

  return children;
};

export default AuthGate;
