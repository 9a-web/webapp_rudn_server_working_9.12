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
 *
 * 🔒 Stage 6: используем `useIsInsideTelegram()` — он надёжно поллит SDK
 * (initData может прийти позже монтирования компонента). Раньше использовался
 * useMemo с пустой зависимостью, что приводило к ошибочному редиректу на /login
 * для пользователей внутри Telegram, если SDK ещё не успел загрузить initData.
 */
import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import useIsInsideTelegram from '../../hooks/useIsInsideTelegram';
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

  // useIsInsideTelegram возвращает { isInside, tg, initData, ready }.
  // `ready=true` означает что SDK полностью загружен (или таймаут истёк).
  const { isInside, tg, initData, ready } = useIsInsideTelegram();

  // Редиректы (авторизован либо вообще не Telegram)
  useEffect(() => {
    if (initializing) return;
    // Ждём окончательного определения isInside (избегаем фолса при медленном SDK)
    if (!ready) return;

    if (isAuthenticated) {
      if (needsOnboarding && location.pathname !== '/register') {
        navigate('/register', { replace: true });
      }
      return;
    }
    // Неавторизован
    if (!isInside) {
      const cont = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?continue=${cont}`, { replace: true });
    }
    // Если isInside и не авторизован — показываем confirm (ниже в рендере)
  }, [initializing, ready, isAuthenticated, needsOnboarding, isInside,
    location.pathname, location.search, navigate]);

  // --- Render states ---

  if (initializing || !ready) {
    return <FullPageLoader hint={!ready ? 'Проверяем окружение Telegram…' : undefined} />;
  }

  // Telegram WebApp confirm screen — явное согласие перед логином
  if (!isAuthenticated && isInside) {
    return (
      <TelegramWebAppConfirm
        tg={tg}
        initData={initData}
        onConfirm={async (d, startParam) => {
          await loginTelegramWebApp(d, startParam);
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
