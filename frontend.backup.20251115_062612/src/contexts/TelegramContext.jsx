/**
 * Контекст для Telegram WebApp
 * Предоставляет доступ к данным пользователя Telegram и функциям WebApp API
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

const TelegramContext = createContext(null);

export const useTelegram = () => {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error('useTelegram must be used within TelegramProvider');
  }
  return context;
};

export const TelegramProvider = ({ children }) => {
  const [webApp, setWebApp] = useState(null);
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Инициализация Telegram WebApp
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      console.log('🔵 Инициализация Telegram WebApp...');
      console.log('📊 Начальное состояние:', {
        isExpanded: tg.isExpanded,
        viewportHeight: tg.viewportHeight,
        platform: tg.platform
      });
      
      // 1. Готовим WebApp
      tg.ready();
      
      // 2. ⭐️ АГРЕССИВНЫЙ ПОЛНОЭКРАННЫЙ РЕЖИМ
      // Вызываем expand() многократно для надежности
      const forceExpand = () => {
        console.log('🔄 Попытка expand()... isExpanded:', tg.isExpanded);
        tg.expand();
        
        // Проверяем результат через 10ms
        setTimeout(() => {
          console.log('📏 После expand(): isExpanded =', tg.isExpanded, ', viewportHeight =', tg.viewportHeight);
        }, 10);
      };
      
      // Первый вызов сразу
      forceExpand();
      
      // Повторные вызовы с разными интервалами
      setTimeout(forceExpand, 10);
      setTimeout(forceExpand, 50);
      setTimeout(forceExpand, 100);
      setTimeout(forceExpand, 200);
      setTimeout(forceExpand, 300);
      setTimeout(forceExpand, 500);
      setTimeout(forceExpand, 1000);
      
      // 3. Постоянная проверка и принудительное разворачивание
      const intervalId = setInterval(() => {
        if (!tg.isExpanded) {
          console.warn('⚠️ WebApp НЕ развернут! Принудительный expand()...');
          tg.expand();
        }
      }, 500);
      
      // Останавливаем через 5 секунд
      setTimeout(() => {
        clearInterval(intervalId);
        console.log('✅ Проверка expand завершена. Финальное состояние: isExpanded =', tg.isExpanded);
      }, 5000);
      
      // 4. Отключаем вертикальные свайпы
      try {
        if (tg.disableVerticalSwipes) {
          tg.disableVerticalSwipes();
          console.log('✅ Вертикальные свайпы отключены');
        }
      } catch (e) {
        console.warn('⚠️ disableVerticalSwipes не поддерживается:', e);
      }
      
      // 5. Включаем подтверждение закрытия
      try {
        if (tg.enableClosingConfirmation) {
          tg.enableClosingConfirmation();
          console.log('✅ Подтверждение закрытия включено');
        }
      } catch (e) {
        console.warn('⚠️ enableClosingConfirmation не поддерживается:', e);
      }
      
      // 6. Устанавливаем цвета темы
      try {
        if (tg.setHeaderColor) tg.setHeaderColor('#1C1C1E');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#1C1C1E');
        if (tg.setBottomBarColor) tg.setBottomBarColor('#1C1C1E');
        console.log('✅ Цвета темы установлены');
      } catch (e) {
        console.warn('⚠️ Ошибка установки цветов:', e);
      }
      
      // 7. Устанавливаем viewport meta
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (viewportMeta) {
        viewportMeta.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );
      }
      
      // 8. Обновляем CSS переменные для viewport
      const updateViewportVars = () => {
        const height = tg.viewportHeight || window.innerHeight;
        const stableHeight = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
        
        document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
        document.documentElement.style.setProperty('--tg-viewport-stable-height', `${stableHeight}px`);
        
        console.log('📐 Viewport переменные обновлены:', { height, stableHeight });
      };
      
      updateViewportVars();
      
      // 9. Слушаем изменения viewport
      const handleViewportChanged = () => {
        console.log('📱 Событие viewportChanged');
        updateViewportVars();
        
        // При изменении viewport снова пытаемся expand
        if (!tg.isExpanded) {
          console.log('🔄 Viewport изменился, повторный expand()');
          tg.expand();
        }
      };
      
      tg.onEvent('viewportChanged', handleViewportChanged);
      
      // Получаем данные пользователя
      const userData = tg.initDataUnsafe?.user;
      
      setWebApp(tg);
      
      if (userData) {
        setUser(userData);
        console.log('👤 Пользователь Telegram:', userData.first_name);
      } else {
        console.warn('⚠️ Telegram user не найден. Mock данные.');
        setUser({
          id: 999888777,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
        });
      }
      
      setIsReady(true);

      console.log('🚀 Telegram WebApp инициализирован:', {
        platform: tg.platform,
        version: tg.version,
        isExpanded: tg.isExpanded,
        viewportHeight: tg.viewportHeight,
        viewportStableHeight: tg.viewportStableHeight,
      });
      
      // Cleanup
      return () => {
        clearInterval(intervalId);
        tg.offEvent('viewportChanged', handleViewportChanged);
      };
    } else {
      console.warn('⚠️ Telegram WebApp API недоступен. Разработка вне Telegram.');
      setUser({
        id: 999888777,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
      });
      setIsReady(true);
    }
  }, []);

  const showAlert = (message) => {
    if (webApp) {
      webApp.showAlert(message);
    } else {
      alert(message);
    }
  };

  const showConfirm = (message) => {
    return new Promise((resolve) => {
      if (webApp) {
        webApp.showConfirm(message, resolve);
      } else {
        resolve(window.confirm(message));
      }
    });
  };

  const showPopup = (params) => {
    return new Promise((resolve) => {
      if (webApp) {
        webApp.showPopup(params, resolve);
      } else {
        alert(params.message);
        resolve(null);
      }
    });
  };

  const close = () => {
    if (webApp) {
      webApp.close();
    }
  };

  const sendData = (data) => {
    if (webApp) {
      webApp.sendData(JSON.stringify(data));
    }
  };

  const openLink = (url, options = {}) => {
    if (webApp) {
      webApp.openLink(url, options);
    } else {
      window.open(url, '_blank');
    }
  };

  const hapticFeedback = (type = 'impact', style = 'medium') => {
    if (webApp?.HapticFeedback) {
      if (type === 'impact') {
        webApp.HapticFeedback.impactOccurred(style);
      } else if (type === 'notification') {
        webApp.HapticFeedback.notificationOccurred(style);
      } else if (type === 'selection') {
        webApp.HapticFeedback.selectionChanged();
      }
    }
  };

  const value = {
    webApp,
    user,
    isReady,
    showAlert,
    showConfirm,
    showPopup,
    close,
    sendData,
    openLink,
    hapticFeedback,
  };

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  );
};

export default TelegramContext;
