/**
 * Контекст для Telegram WebApp
 * Предоставляет доступ к данным пользователя Telegram и функциям WebApp API
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getBackendURL } from '../utils/config';

const TelegramContext = createContext(null);

// Генерация и сохранение уникального ID устройства в localStorage
const getOrCreateDeviceId = () => {
  const DEVICE_ID_KEY = 'rudn_device_id';
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Генерируем уникальный ID с использованием crypto.randomUUID или fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = crypto.randomUUID();
    } else {
      // Fallback для старых браузеров
      deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log('🆕 Создан новый Device ID:', deviceId);
  } else {
    console.log('📱 Используется существующий Device ID:', deviceId);
  }
  
  // Преобразуем UUID в числовой ID для совместимости с API
  // Берем первые 8 символов hex и конвертируем в число
  const numericId = parseInt(deviceId.replace(/-/g, '').substring(0, 12), 16);
  
  return { deviceId, numericId };
};

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
  
  // Получаем startParam сразу при инициализации (без useState чтобы избежать каскадных рендеров)
  const [startParam] = useState(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
      const param = window.Telegram.WebApp.initDataUnsafe.start_param;
      console.log('🔗 Получен start_param при инициализации:', param);
      return param;
    }
    return null;
  });

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
      
      // 8. Обновляем CSS переменные для viewport и safe area
      const updateViewportVars = () => {
        const height = tg.viewportHeight || window.innerHeight;
        const stableHeight = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
        
        document.documentElement.style.setProperty('--tg-viewport-height', `${height}px`);
        document.documentElement.style.setProperty('--tg-viewport-stable-height', `${stableHeight}px`);
        
        // 📱 Устанавливаем дополнительный отступ для header в зависимости от платформы
        // iOS обычно имеет safe-area-inset-top, Android нет
        const platform = tg.platform || 'unknown';
        let headerOffset = 10; // Базовый отступ для кнопок закрытия Telegram
        
        // На iOS увеличиваем отступ для лучшей видимости (notch/dynamic island)
        if (platform === 'ios' || platform === 'macos') {
          headerOffset = 15;
        }
        // На Android можно использовать меньший отступ
        else if (platform === 'android') {
          headerOffset = 12;
        }
        // Telegram Desktop - минимальный отступ
        else if (platform === 'tdesktop' || platform === 'web' || platform === 'weba') {
          headerOffset = 8;
        }
        
        document.documentElement.style.setProperty('--telegram-header-offset', `${headerOffset}px`);
        
        console.log('📐 Viewport переменные обновлены:', { 
          height, 
          stableHeight, 
          platform,
          headerOffset: `${headerOffset}px`
        });
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
        // Telegram WebApp загружен, но пользователя нет
        // Проверяем localStorage на наличие связанного профиля
        const savedTelegramUser = localStorage.getItem('telegram_user');
        
        if (savedTelegramUser) {
          try {
            const parsedUser = JSON.parse(savedTelegramUser);
            console.log('📱 Загружен связанный Telegram пользователь:', parsedUser.first_name);
            setUser({
              id: parsedUser.id,
              first_name: parsedUser.first_name || 'Пользователь',
              last_name: parsedUser.last_name || '',
              username: parsedUser.username || '',
              photo_url: parsedUser.photo_url,
              is_linked: true // Флаг что это связанный пользователь
            });
          } catch (e) {
            console.error('Ошибка парсинга сохраненного пользователя:', e);
            localStorage.removeItem('telegram_user');
            // Fallback на Device ID
            console.warn('⚠️ Telegram user не найден. Используем уникальный Device ID.');
            const { deviceId, numericId } = getOrCreateDeviceId();
            setUser({
              id: numericId,
              first_name: 'Пользователь',
              last_name: '',
              username: `user_${deviceId.substring(0, 8)}`,
              device_id: deviceId,
              is_guest: true
            });
          }
        } else {
          console.warn('⚠️ Telegram user не найден. Используем уникальный Device ID.');
          // Генерируем уникальный ID для этого браузера
          const { deviceId, numericId } = getOrCreateDeviceId();
          setUser({
            id: numericId,
            first_name: 'Пользователь',
            last_name: '',
            username: `user_${deviceId.substring(0, 8)}`,
            device_id: deviceId,
            is_guest: true
          });
        }
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
      console.warn('⚠️ Telegram WebApp API недоступен.');
      
      // Проверяем, есть ли сохраненный Telegram пользователь в localStorage
      const savedTelegramUser = localStorage.getItem('telegram_user');
      const savedSessionToken = localStorage.getItem('session_token');
      
      if (savedTelegramUser) {
        try {
          const parsedUser = JSON.parse(savedTelegramUser);
          console.log('📱 Найден сохранённый пользователь:', parsedUser.first_name);
          
          // Если есть session_token - проверяем сессию на сервере
          if (savedSessionToken) {
            // Проверяем валидность сессии на сервере
            // Используем ту же логику что в api.js
            let backendUrl;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
              backendUrl = 'http://localhost:8001';
            } else if (import.meta.env.REACT_APP_BACKEND_URL) {
              backendUrl = import.meta.env.REACT_APP_BACKEND_URL;
            } else if (process.env.REACT_APP_BACKEND_URL) {
              backendUrl = process.env.REACT_APP_BACKEND_URL;
            } else {
              backendUrl = window.location.origin;
            }
            
            console.log('🔗 Checking session at:', `${backendUrl}/api/web-sessions/${savedSessionToken}/status`);
            
            fetch(`${backendUrl}/api/web-sessions/${savedSessionToken}/status`)
              .then(response => {
                if (response.ok) {
                  return response.json();
                }
                throw new Error('Session not found');
              })
              .then(sessionData => {
                if (sessionData.status === 'linked' && sessionData.telegram_id === parsedUser.id) {
                  console.log('✅ Сессия валидна, загружаем пользователя');
                  setUser({
                    id: parsedUser.id,
                    first_name: parsedUser.first_name || 'Пользователь',
                    last_name: parsedUser.last_name || '',
                    username: parsedUser.username || '',
                    photo_url: parsedUser.photo_url,
                    is_linked: true
                  });
                } else {
                  // Сессия невалидна, но сохранённый пользователь есть - используем его
                  console.warn('⚠️ Сессия невалидна, но используем сохранённого пользователя');
                  setUser({
                    id: parsedUser.id,
                    first_name: parsedUser.first_name || 'Пользователь',
                    last_name: parsedUser.last_name || '',
                    username: parsedUser.username || '',
                    photo_url: parsedUser.photo_url,
                    is_linked: true,
                    session_expired: true
                  });
                }
                setIsReady(true);
              })
              .catch(err => {
                console.warn('⚠️ Ошибка проверки сессии:', err.message);
                
                // ВАЖНО: При любой ошибке (включая 404) - используем сохранённого пользователя
                // Это предотвращает потерю данных при перезагрузке страницы
                // Сессия может не существовать на сервере, но пользователь уже авторизован
                console.log('🔄 Используем сохранённые данные пользователя (сессия возможно истекла)');
                setUser({
                  id: parsedUser.id,
                  first_name: parsedUser.first_name || 'Пользователь',
                  last_name: parsedUser.last_name || '',
                  username: parsedUser.username || '',
                  photo_url: parsedUser.photo_url,
                  is_linked: true,
                  session_expired: true // Флаг что сессия может быть истекшей
                });
                setIsReady(true);
              });
            
            return; // Ждём ответ от сервера
          } else {
            // Нет session_token, но есть сохранённый пользователь - используем его
            // Это может произойти если сессия была очищена, но telegram_user остался
            console.log('🔄 Используем сохранённого пользователя без проверки сессии');
            setUser({
              id: parsedUser.id,
              first_name: parsedUser.first_name || 'Пользователь',
              last_name: parsedUser.last_name || '',
              username: parsedUser.username || '',
              photo_url: parsedUser.photo_url,
              is_linked: true,
              session_expired: true
            });
            setIsReady(true);
            return;
          }
        } catch (e) {
          console.error('Ошибка парсинга сохраненного пользователя:', e);
          localStorage.removeItem('telegram_user');
          localStorage.removeItem('session_token');
        }
      }
      
      // Если нет сохраненного пользователя - создаем гостевого с device_id
      console.warn('⚠️ Используем уникальный Device ID.');
      const { deviceId, numericId } = getOrCreateDeviceId();
      setUser({
        id: numericId,
        first_name: 'Пользователь',
        last_name: '',
        username: `user_${deviceId.substring(0, 8)}`,
        device_id: deviceId,
        is_guest: true // Флаг что это гостевой пользователь
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
    startParam, // Параметр startapp из ссылки (для реферальной системы)
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
