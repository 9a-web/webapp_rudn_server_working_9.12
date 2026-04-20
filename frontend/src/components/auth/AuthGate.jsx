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
import { useAuth } from '../../contexts/AuthContext';
import useIsInsideTelegram from '../../hooks/useIsInsideTelegram';
import TelegramWebAppConfirm from './TelegramWebAppConfirm';
import { safeContinueUrl } from '../../utils/safeRedirect'; // Stage 7: B-01
import LoadingScreen from '../LoadingScreen';

/**
 * FullPageLoader — тонкая обёртка над LoadingScreen с 3D-логотипом РУДН.
 * Параметр `hint` используется как текст под логотипом.
 */
const FullPageLoader = ({ hint }) => (
  <LoadingScreen message={hint || 'Загрузка...'} />
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
      // Stage 7: B-01 — sanitize pathname+search перед тем как класть в ?continue
      const safeCont = safeContinueUrl(location.pathname + location.search, '/');
      const cont = encodeURIComponent(safeCont);
      navigate(`/login?continue=${cont}`, { replace: true });
    }
    // Если isInside и не авторизован — показываем confirm (ниже в рендере)
  }, [initializing, ready, isAuthenticated, needsOnboarding, isInside,
    location.pathname, location.search, navigate]);

  // Stage 7: B-14 — слушаем глобальное событие «session expired» (его шлёт
  // axios-interceptor при любом 401). Перенаправляем на /login с флагом
  // reason=expired, чтобы LoginPage показал пользователю понятный баннер.
  useEffect(() => {
    const onExpired = () => {
      if (isInside) return; // в Telegram WebApp перелогин автоматический
      const safeCont = safeContinueUrl(location.pathname + location.search, '/');
      const cont = encodeURIComponent(safeCont);
      navigate(`/login?reason=expired&continue=${cont}`, { replace: true });
    };
    window.addEventListener('auth:session-expired', onExpired);
    return () => window.removeEventListener('auth:session-expired', onExpired);
  }, [isInside, location.pathname, location.search, navigate]);

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
