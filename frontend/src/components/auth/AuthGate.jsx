/**
 * AuthGate — защитник роутов.
 *
 * Логика:
 *  1. Если инициализация ещё не завершена → loading screen
 *  2. Если пользователь уже залогинен через наш JWT → пропускаем дальше
 *  3. Если есть Telegram WebApp initData (внутри бота) → auto-login через /api/auth/login/telegram-webapp
 *     (прозрачно, без UI — существующие Telegram-пользователи получат JWT автоматически)
 *  4. Иначе → редирект на /login (с сохранением оригинального URL как ?continue)
 *  5. Если user.registration_step > 0 → редирект на /register
 */
import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const FullPageLoader = ({ hint }) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-[#0E0E10] text-white">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      {hint && <div className="text-xs text-white/50">{hint}</div>}
    </div>
  </div>
);

const AuthGate = ({ children }) => {
  const { isAuthenticated, needsOnboarding, initializing, loginTelegramWebApp, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [tgAutologinTried, setTgAutologinTried] = useState(false);
  const [tgAutologinBusy, setTgAutologinBusy] = useState(false);
  const attemptedRef = useRef(false);

  // Попытка Telegram WebApp auto-login
  useEffect(() => {
    if (attemptedRef.current) return;
    if (initializing) return;
    if (isAuthenticated) return;
    attemptedRef.current = true;

    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
    const initData = tg?.initData;

    if (initData && initData.length > 0) {
      setTgAutologinBusy(true);
      const startParam = tg?.initDataUnsafe?.start_param;
      loginTelegramWebApp(initData, startParam)
        .catch((e) => {
          console.warn('[AuthGate] Telegram WebApp auto-login failed:', e.message);
        })
        .finally(() => {
          setTgAutologinBusy(false);
          setTgAutologinTried(true);
        });
    } else {
      setTgAutologinTried(true);
    }
  }, [initializing, isAuthenticated, loginTelegramWebApp]);

  // Редиректы
  useEffect(() => {
    if (initializing || tgAutologinBusy) return;
    if (!tgAutologinTried) return;

    if (!isAuthenticated) {
      const cont = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?continue=${cont}`, { replace: true });
      return;
    }

    if (needsOnboarding && location.pathname !== '/register') {
      navigate('/register', { replace: true });
    }
  }, [initializing, tgAutologinBusy, tgAutologinTried, isAuthenticated, needsOnboarding, location.pathname, location.search, navigate]);

  if (initializing || tgAutologinBusy) {
    return <FullPageLoader hint={tgAutologinBusy ? 'Telegram авторизация...' : null} />;
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
