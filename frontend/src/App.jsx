import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { Header } from './components/Header';
import { LiveScheduleCard } from './components/LiveScheduleCard';
import { LiveScheduleCarousel } from './components/LiveScheduleCarousel';
import { WeekDaySelector } from './components/WeekDaySelector';
import { TopGlow } from './components/TopGlow';
import { LiveScheduleSection } from './components/LiveScheduleSection';
import { LoadingScreen } from './components/LoadingScreen';
import { ScheduleListSkeleton } from './components/SkeletonCard';
import { DesktopSidebar } from './components/DesktopSidebar';
import { SwipeHint } from './components/SwipeHint';
import { BottomNavigation } from './components/BottomNavigation';
import { TasksSection } from './components/TasksSection';
import { JournalSection } from './components/JournalSection';
import FriendsSection from './components/FriendsSection';
import GroupSelector from './components/GroupSelector';
import WelcomeScreen from './components/WelcomeScreen';
import StatusTester from './StatusTester';
import { TelegramProvider, useTelegram } from './contexts/TelegramContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext'; // Import ThemeProvider
import { scheduleAPI, userAPI, achievementsAPI, tasksAPI, activityAPI, getBackendURL } from './services/api';
import { processReferralWebApp, trackAdminReferralEvent } from './services/referralAPI';
import { processJournalWebAppInvite } from './services/journalAPI';
import { joinRoomByToken } from './services/roomsAPI';
import { friendsAPI } from './services/friendsAPI';
import { getWeekNumberForDate, isWinterSeason } from './utils/dateUtils';
import { useTranslation } from 'react-i18next';
import './i18n/config';
import { NewYearTheme } from './components/NewYearTheme';
import { PlayerProvider, usePlayer, MiniPlayer, FullscreenPlayer, MusicSection, ArtistCard } from './components/music';

// Lazy load модальных окон для уменьшения начального bundle
const CalendarModal = lazy(() => import('./components/CalendarModal').then(module => ({ default: module.CalendarModal })));
const AnalyticsModal = lazy(() => import('./components/AnalyticsModal').then(module => ({ default: module.AnalyticsModal })));
const AchievementsModal = lazy(() => import('./components/AchievementsModal').then(module => ({ default: module.AchievementsModal })));
const AchievementNotification = lazy(() => import('./components/AchievementNotification').then(module => ({ default: module.AchievementNotification })));
const NotificationSettings = lazy(() => import('./components/NotificationSettings'));
const NotificationsPanel = lazy(() => import('./components/NotificationsPanel'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
import { UpcomingClassNotification } from './components/UpcomingClassNotification';
import { GreetingNotification, GreetingNotificationContent } from './components/GreetingNotification';
import { AchievementNotificationContent } from './components/AchievementNotification';
import { NotificationQueueProvider, useNotificationQueue } from './components/NotificationQueue';
import { AnimatePresence, motion } from 'framer-motion';
import { notificationsAPI } from './services/notificationsAPI';
import { getWebSessionStatus, sendHeartbeat, createSessionMonitorWebSocket } from './services/webSessionAPI';
import TelegramLinkScreen from './components/TelegramLinkScreen';
import TelegramLinkConfirmModal from './components/TelegramLinkConfirmModal';

import ErrorBoundary from './components/ErrorBoundary';
import { useFaviconBadge } from './hooks/useFaviconBadge';

const Home = () => {
  const { user, isReady, showAlert, hapticFeedback, startParam } = useTelegram();
  const { theme } = useTheme(); // Use Theme Context
  const { t } = useTranslation();
  // TEST: Greeting Notification
  const [testGreetingHour, setTestGreetingHour] = useState(null);
  const [greetingKey, setGreetingKey] = useState(0);

  const testGreeting = (hour) => {
      setTestGreetingHour(hour);
      setGreetingKey(prev => prev + 1);
      hapticFeedback('success');
      showAlert(hour === 8 ? "Testing Morning Greeting" : "Testing Night Greeting");
      
      // Reset after 7 seconds to allow re-testing
      setTimeout(() => {
          setTestGreetingHour(null);
      }, 7000);
  };
  // TEST: Добавляем тестовое состояние для проверки уведомления
  const [testNotification, setTestNotification] = useState(false);
  
  // Функция для включения теста
  const toggleTestNotification = () => {
    setTestNotification(prev => !prev);
    if (!testNotification) {
       // Добавляем фейковое занятие через 10 минут
       const now = new Date();
       const future = new Date(now.getTime() + 10 * 60000); // +10 min
       
       const startHour = future.getHours();
       const startMin = future.getMinutes();
       const endHour = startHour + 1;
       
       const timeStr = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')} - ${endHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
       
       const currentDayName = now.toLocaleDateString('ru-RU', { weekday: 'long' });
       const formattedDayName = currentDayName.charAt(0).toUpperCase() + currentDayName.slice(1);

       const fakeClass = {
           discipline: "TEST SUBJECT (Testing Notification)",
           time: timeStr,
           day: formattedDayName,
           auditory: "Room 101",
           teacher: "Test Teacher",
           lessonType: "Seminar"
       };
       
       setSchedule(prev => [...prev, fakeClass]);
       hapticFeedback('success');
       showAlert("Test class added! Notification should appear.");
    } else {
       // Reload schedule to remove fake
       loadSchedule();
       hapticFeedback('warning');
       showAlert("Test class removed.");
    }
  };
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [hasNewNotification, setHasNewNotification] = useState(false); // Флаг нового уведомления для анимации
  
  // Динамический favicon с бейджем уведомлений
  useFaviconBadge(unreadNotificationsCount);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentClass, setCurrentClass] = useState(null);
  const [minutesLeft, setMinutesLeft] = useState(0);
  
  // Состояния для расписания
  const [schedule, setSchedule] = useState([]);
  const [weekNumber, setWeekNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Состояния для пользователя
  const [userSettings, setUserSettings] = useState(null);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [syncedUser, setSyncedUser] = useState(null); // Данные пользователя из QR синхронизации
  
  // Эффективный user - syncedUser имеет приоритет (содержит is_linked: true)
  const effectiveUser = syncedUser || user;
  
  // Состояние для новогодней темы
  const [newYearThemeMode, setNewYearThemeMode] = useState('auto'); // 'auto', 'always', 'off'

  // Состояния для достижений
  const [allAchievements, setAllAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [newAchievement, setNewAchievement] = useState(null); // Для показа уведомления
  
  // Состояние для модального окна подтверждения добавления в друзья
  const [friendRequestModal, setFriendRequestModal] = useState({
    isOpen: false,
    friendId: null,
    friendData: null,
    loading: false
  });
  
  // Состояние для модального окна подтверждения подключения к комнате прослушивания
  const [listenRoomJoinModal, setListenRoomJoinModal] = useState({
    isOpen: false,
    inviteCode: null,
    roomData: null,
    loading: false
  });
  
  // Ref для открытия ListeningRoom из MiniPlayer
  const openListeningRoomRef = useRef(null);
  
  // Очередь уведомлений (greeting, achievement и т.д.)
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [activeQueueNotification, setActiveQueueNotification] = useState(null);
  
  // Функция для добавления уведомления в очередь
  const addToNotificationQueue = useCallback((notification) => {
    setNotificationQueue(prev => {
      // Проверяем, нет ли уже такого уведомления
      if (prev.some(n => n.id === notification.id)) {
        return prev;
      }
      // Добавляем и сортируем по приоритету (выше = важнее)
      return [...prev, notification].sort((a, b) => b.priority - a.priority);
    });
  }, []);
  
  // Обработка очереди уведомлений - берём следующее из очереди
  useEffect(() => {
    if (activeQueueNotification || notificationQueue.length === 0) {
      return;
    }
    
    // Берем первое уведомление из очереди
    const next = notificationQueue[0];
    setNotificationQueue(prev => prev.slice(1));
    setActiveQueueNotification(next);
  }, [notificationQueue, activeQueueNotification]);
  
  // Автозакрытие активного уведомления
  useEffect(() => {
    if (!activeQueueNotification) {
      return;
    }
    
    const duration = activeQueueNotification.duration || 6000;
    const timer = setTimeout(() => {
      setActiveQueueNotification(null);
    }, duration);
    
    return () => clearTimeout(timer);
  }, [activeQueueNotification]);
  
  // Задержка перед показом следующего уведомления
  useEffect(() => {
    if (!activeQueueNotification && notificationQueue.length > 0) {
      const delay = setTimeout(() => {
        // Триггерим обновление
        setNotificationQueue(prev => [...prev]);
      }, 500);
      return () => clearTimeout(delay);
    }
  }, [activeQueueNotification, notificationQueue.length]);
  
  // Callback для greeting notification
  const handleGreetingRequest = useCallback((greetingData) => {
    addToNotificationQueue({
      id: `greeting-${greetingData.type}`,
      type: 'greeting',
      data: greetingData,
      priority: 1, // Низкий приоритет
      duration: 6000,
    });
  }, [addToNotificationQueue]);
  
  // Обновленная функция для показа достижения через очередь
  const showAchievementInQueue = useCallback((achievement) => {
    addToNotificationQueue({
      id: `achievement-${achievement.id}-${Date.now()}`,
      type: 'achievement',
      data: achievement,
      priority: 10, // Высокий приоритет (достижения важнее приветствий)
      duration: 7000,
    });
  }, [addToNotificationQueue]);
  
  // Закрытие текущего уведомления из очереди
  const closeQueueNotification = useCallback(() => {
    setActiveQueueNotification(null);
  }, []);
  
  // Состояние для реферальной системы Web App
  const [referralProcessed, setReferralProcessed] = useState(false);
  
  // Состояние для админской реферальной ссылки (adref_)
  const [adrefCode, setAdrefCode] = useState(null);
  
  // Состояние для обработки приглашения в журнал
  const [journalInviteProcessed, setJournalInviteProcessed] = useState(false);
  
  // ID журнала для автоматического открытия после присоединения
  const [pendingJournalId, setPendingJournalId] = useState(null);
  
  // Состояние для обработки приглашения в комнату
  const [roomInviteProcessed, setRoomInviteProcessed] = useState(false);
  
  // ID комнаты для автоматического открытия после присоединения
  const [pendingRoomId, setPendingRoomId] = useState(null);

  // Состояние для нижнего меню навигации (загружаем из localStorage)
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('activeTab');
    return savedTab || 'home';
  });
  
  // Состояние для отслеживания модальных окон журнала
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  // Состояние для отслеживания модального окна AddTaskModal из TasksSection
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  // Состояния для модальных окон в Header (для отслеживания)
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // Состояние для модального окна ShareScheduleModal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  // Состояние для полноэкранного музыкального плеера
  const [isFullscreenPlayerOpen, setIsFullscreenPlayerOpen] = useState(false);
  // Состояние для карточки артиста
  const [isArtistCardOpen, setIsArtistCardOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);
  // Состояние для модального окна профиля друга
  const [isFriendProfileOpen, setIsFriendProfileOpen] = useState(false);
  // Состояние для открытого чата с другом
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Состояние для модального окна совместного прослушивания
  const [isListeningRoomOpen, setIsListeningRoomOpen] = useState(false);
  const [isSendTrackModalOpen, setIsSendTrackModalOpen] = useState(false);

  // Состояния для связки Telegram профиля через QR
  const [showTelegramLinkScreen, setShowTelegramLinkScreen] = useState(false);
  const [showTelegramLinkConfirm, setShowTelegramLinkConfirm] = useState(false);
  const [linkSessionToken, setLinkSessionToken] = useState(null);

  // Открыть карточку артиста
  const handleArtistClick = useCallback((artistName) => {
    setSelectedArtist(artistName);
    setIsArtistCardOpen(true);
  }, []);

  // Закрыть карточку артиста
  const handleArtistCardClose = useCallback(() => {
    setIsArtistCardOpen(false);
    setSelectedArtist(null);
  }, []);

  // Сохраняем activeTab в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Отслеживание всех модальных окон для скрытия нижнего меню
  const isAnyModalOpen = 
    isCalendarOpen || 
    isAnalyticsOpen || 
    isAchievementsOpen || 
    isNotificationSettingsOpen ||
    isNotificationsPanelOpen ||
    isMenuOpen ||
    isProfileOpen ||
    isShareModalOpen ||
    isAddTaskModalOpen || // from TasksSection's AddTaskModal
    isJournalModalOpen || // from JournalSection
    isFullscreenPlayerOpen || // fullscreen music player
    isFriendProfileOpen || // friend profile modal
    isChatOpen || // chat with friend
    isListeningRoomOpen || // listening room modal
    isSendTrackModalOpen; // send track to friend modal

  // Ref для отслеживания предыдущего счётчика уведомлений
  const prevUnreadCountRef = React.useRef(0);
  const newNotificationTimerRef = React.useRef(null);

  // Загрузка счётчика непрочитанных уведомлений с детекцией новых
  const loadUnreadCount = useCallback(async () => {
    const currentUser = syncedUser || user;
    if (!currentUser?.id) return;
    try {
      const data = await notificationsAPI.getUnreadCount(currentUser.id);
      const newCount = data.unread_count || 0;
      
      // Проверяем, появилось ли новое уведомление
      if (newCount > prevUnreadCountRef.current && prevUnreadCountRef.current !== 0) {
        // Новое уведомление! Запускаем анимацию
        setHasNewNotification(true);
        
        // Haptic feedback при новом уведомлении
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        
        // Очищаем предыдущий таймер если есть
        if (newNotificationTimerRef.current) {
          clearTimeout(newNotificationTimerRef.current);
        }
        
        // Останавливаем анимацию через 5 секунд
        newNotificationTimerRef.current = setTimeout(() => {
          setHasNewNotification(false);
        }, 5000);
      }
      
      prevUnreadCountRef.current = newCount;
      setUnreadNotificationsCount(newCount);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [user?.id]);

  // Периодическая загрузка счётчика — каждые 30 секунд (оптимизировано для снижения нагрузки)
  useEffect(() => {
    if (isReady && user?.id) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 30000); // Каждые 30 секунд
      return () => {
        clearInterval(interval);
        if (newNotificationTimerRef.current) {
          clearTimeout(newNotificationTimerRef.current);
        }
      };
    }
  }, [isReady, user?.id, syncedUser?.id, loadUnreadCount]);

  // 📊 Отслеживание активности пользователя (для админ панели - онлайн статус)
  useEffect(() => {
    const currentUser = syncedUser || user;
    if (!isReady || !currentUser?.id || currentUser?.is_guest) return;
    
    // Отправляем heartbeat с текущим разделом
    const sendActivityHeartbeat = () => {
      activityAPI.trackActivity(currentUser.id, activeTab);
    };
    
    // Отправляем сразу при загрузке/смене вкладки
    sendActivityHeartbeat();
    
    // Периодически отправляем heartbeat каждые 30 секунд
    const heartbeatInterval = setInterval(sendActivityHeartbeat, 30000);
    
    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [isReady, user?.id, syncedUser?.id, activeTab]);

  // Загрузка данных пользователя при монтировании
  // Сравниваем по ID вместо ссылки на объект, чтобы избежать лишних перезагрузок
  useEffect(() => {
    if (isReady && (user || syncedUser)) {
      loadUserData();
      loadAchievementsData();
      trackTimeBasedAchievements();
    }
  }, [isReady, user?.id, syncedUser?.id]);
  
  // 🔗 Обработка реферального кода из Web App ссылки
  useEffect(() => {
    const processReferral = async () => {
      const currentUser = syncedUser || user;
      // Проверяем условия: есть startParam, начинается с ref_, не обработан ещё
      if (!startParam || !startParam.startsWith('ref_') || referralProcessed || !currentUser) {
        return;
      }
      
      const referralCode = startParam.replace('ref_', '');
      console.log('🔗 Обработка реферального кода из Web App:', referralCode);
      
      try {
        const result = await processReferralWebApp({
          telegram_id: currentUser.id,
          username: currentUser.username,
          first_name: currentUser.first_name,
          last_name: currentUser.last_name,
          referral_code: referralCode
        });
        
        setReferralProcessed(true);
        
        if (result.success) {
          console.log('✅ Реферальный код обработан:', result.message);
          hapticFeedback('success');
          showAlert(result.message);
        } else {
          console.log('ℹ️ Реферальный код не применён:', result.message);
          // Не показываем ошибку если пользователь уже был приглашён ранее
          if (!result.message.includes('уже')) {
            showAlert(result.message);
          }
        }
      } catch (error) {
        console.error('❌ Ошибка обработки реферального кода:', error);
        setReferralProcessed(true);
      }
    };
    
    if (isReady && (user || syncedUser) && startParam) {
      processReferral();
    }
  }, [isReady, user?.id, syncedUser?.id, startParam, referralProcessed]);

  // 📊 Обработка админской реферальной ссылки (adref_)
  // Используем localStorage чтобы:
  // 1. Не считать клик дважды при перемонтировании компонента
  // 2. Не считать клик при обновлении страницы (startParam сохраняется в Telegram)
  useEffect(() => {
    if (!startParam || !startParam.startsWith('adref_')) return;
    
    const code = startParam.replace('adref_', '');
    const storageKey = `adref_click_${code}`;
    const storageAuthKey = `adref_auth_${code}`;
    
    // Проверяем: был ли клик уже зафиксирован для этого кода?
    const alreadyClicked = localStorage.getItem(storageKey);
    
    if (!alreadyClicked) {
      // Первый раз — фиксируем клик
      localStorage.setItem(storageKey, Date.now().toString());
      console.log('📊 Обнаружена админская реферальная ссылка:', code);
      
      trackAdminReferralEvent({ code, event_type: 'click' })
        .then(res => {
          if (res?.success) {
            console.log('✅ Клик по реферальной ссылке зафиксирован:', res.link_name);
          }
        })
        .catch(err => console.error('❌ Ошибка трекинга клика:', err));
    }
    
    // Сохраняем код для этапа 2 (регистрация/вход), если ещё не обработан
    if (!localStorage.getItem(storageAuthKey)) {
      setAdrefCode(code);
    }
  }, [startParam]);

  // 📊 Этап 2: регистрация/вход (после авторизации пользователя)
  useEffect(() => {
    if (!adrefCode) return;
    const currentUser = syncedUser || user;
    if (!currentUser || !isReady) return;
    
    const storageAuthKey = `adref_auth_${adrefCode}`;
    if (localStorage.getItem(storageAuthKey)) {
      setAdrefCode(null);
      return;
    }
    
    localStorage.setItem(storageAuthKey, Date.now().toString());
    
    const processAdrefAuth = async () => {
      try {
        let eventType = 'login';
        try {
          const settings = await userAPI.getUserSettings(currentUser.id);
          eventType = settings ? 'login' : 'registration';
        } catch {
          eventType = 'registration';
        }
        
        console.log(`📊 adref: пользователь ${currentUser.id} — ${eventType}`);
        
        await trackAdminReferralEvent({
          code: adrefCode,
          event_type: eventType,
          telegram_id: currentUser.id,
          telegram_username: currentUser.username || '',
          telegram_name: (currentUser.first_name || '') + ' ' + (currentUser.last_name || ''),
        });
      } catch (error) {
        console.error('❌ Ошибка трекинга adref auth:', error);
        // Если ошибка — убираем флаг, чтобы попробовать ещё раз
        localStorage.removeItem(storageAuthKey);
      }
      setAdrefCode(null);
    };
    
    processAdrefAuth();
  }, [adrefCode, isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // 📚 Обработка приглашения в журнал из Web App ссылки
  useEffect(() => {
    const processJournalInvite = async () => {
      const currentUser = syncedUser || user;
      // Проверяем условия: есть startParam, начинается с journal_ или jstudent_, не обработан ещё
      if (!startParam || journalInviteProcessed || !currentUser) {
        return;
      }
      
      let inviteType = null;
      let inviteCode = null;
      
      if (startParam.startsWith('journal_')) {
        inviteType = 'journal';
        inviteCode = startParam.replace('journal_', '');
      } else if (startParam.startsWith('jstudent_')) {
        inviteType = 'jstudent';
        inviteCode = startParam.replace('jstudent_', '');
      } else {
        return; // Не наш параметр
      }
      
      console.log('📚 Обработка приглашения в журнал через Web App:', inviteType, inviteCode);
      
      try {
        const result = await processJournalWebAppInvite({
          telegram_id: currentUser.id,
          username: currentUser.username,
          first_name: currentUser.first_name,
          last_name: currentUser.last_name,
          invite_type: inviteType,
          invite_code: inviteCode
        });
        
        setJournalInviteProcessed(true);
        
        if (result.success) {
          console.log('✅ Приглашение в журнал обработано:', result.message);
          hapticFeedback('success');
          showAlert(result.message);
          
          // Переключаемся на вкладку Журнал
          setActiveTab('journal');
          
          // Если получили journal_id - сохраняем для автоматического открытия
          if (result.journal_id) {
            console.log('📖 Устанавливаем pendingJournalId:', result.journal_id);
            setPendingJournalId(result.journal_id);
          }
        } else {
          console.log('ℹ️ Приглашение в журнал не применено:', result.message);
          showAlert(result.message);
        }
      } catch (error) {
        console.error('❌ Ошибка обработки приглашения в журнал:', error);
        setJournalInviteProcessed(true);
        showAlert('Ошибка при присоединении к журналу');
      }
    };
    
    if (isReady && (user || syncedUser) && startParam) {
      processJournalInvite();
    }
  }, [isReady, user?.id, syncedUser?.id, startParam, journalInviteProcessed]);

  // 🚪 Обработка приглашения в комнату из Web App ссылки
  useEffect(() => {
    const processRoomInvite = async () => {
      const currentUser = syncedUser || user;
      // Проверяем условия: есть startParam, содержит room_, не обработан ещё
      if (!startParam || roomInviteProcessed || !currentUser) {
        return;
      }
      
      // Формат: room_{invite_token}_ref_{telegram_id}
      if (!startParam.startsWith('room_')) {
        return; // Не наш параметр
      }
      
      // Парсим параметры
      const parts = startParam.split('_ref_');
      if (parts.length !== 2) {
        console.log('❌ Неверный формат приглашения в комнату:', startParam);
        return;
      }
      
      const inviteToken = parts[0].replace('room_', '');
      const referralCode = parseInt(parts[1], 10);
      
      console.log('🚪 Обработка приглашения в комнату через Web App:', inviteToken, 'реферал:', referralCode);
      
      try {
        const result = await joinRoomByToken(inviteToken, {
          telegram_id: currentUser.id,
          username: currentUser.username,
          first_name: currentUser.first_name,
          referral_code: referralCode
        });
        
        setRoomInviteProcessed(true);
        
        if (result && result.room_id) {
          console.log('✅ Присоединился к комнате:', result.name);
          hapticFeedback('success');
          showAlert(`Вы присоединились к комнате "${result.name}"!`);
          
          // Переключаемся на вкладку "Задачи"
          setActiveTab('tasks');
          
          // Сохраняем ID комнаты для автоматического открытия
          console.log('🚪 Устанавливаем pendingRoomId:', result.room_id);
          setPendingRoomId(result.room_id);
        }
      } catch (error) {
        console.error('❌ Ошибка обработки приглашения в комнату:', error);
        setRoomInviteProcessed(true);
        
        // Проверяем тип ошибки
        if (error.response?.status === 404) {
          showAlert('Комната не найдена или ссылка устарела');
        } else {
          showAlert('Ошибка при присоединении к комнате');
        }
      }
    };
    
    if (isReady && (user || syncedUser) && startParam) {
      processRoomInvite();
    }
  }, [isReady, user?.id, syncedUser?.id, startParam, roomInviteProcessed]);

  // Обработка приглашения от друга
  const [friendInviteProcessed, setFriendInviteProcessed] = useState(false);
  useEffect(() => {
    const processFriendInvite = async () => {
      const currentUser = syncedUser || user;
      if (!startParam || friendInviteProcessed || !currentUser) {
        return;
      }
      
      // Формат: friend_{telegram_id}
      if (!startParam.startsWith('friend_')) {
        return;
      }
      
      const inviterIdStr = startParam.replace('friend_', '');
      const inviterId = parseInt(inviterIdStr, 10);
      
      if (isNaN(inviterId) || inviterId === currentUser.id) {
        return;
      }
      
      console.log('👥 Обработка приглашения от друга:', inviterId);
      
      try {
        const result = await friendsAPI.processFriendInvite(currentUser.id, inviterId, false);
        
        setFriendInviteProcessed(true);
        
        if (result && result.success) {
          console.log('✅ Добавлен в друзья:', result.inviter_info?.first_name);
          hapticFeedback('success');
          
          const inviterName = result.inviter_info 
            ? `${result.inviter_info.first_name || ''} ${result.inviter_info.last_name || ''}`.trim()
            : 'Пользователь';
          
          showAlert(`Вы теперь друзья с ${inviterName}!`);
          
          // Переключаемся на вкладку "Друзья"
          setActiveTab('friends');
        }
      } catch (error) {
        console.error('❌ Ошибка обработки приглашения от друга:', error);
        setFriendInviteProcessed(true);
      }
    };
    
    if (isReady && (user || syncedUser) && startParam) {
      processFriendInvite();
    }
  }, [isReady, user?.id, syncedUser?.id, startParam, friendInviteProcessed]);

  // Обработка связки Telegram профиля (startapp=link_{token})
  const [linkInviteProcessed, setLinkInviteProcessed] = useState(false);
  useEffect(() => {
    const processLinkInvite = async () => {
      const currentUser = syncedUser || user;
      if (!startParam || linkInviteProcessed || !currentUser) {
        return;
      }
      
      // Формат: link_{session_token}
      if (!startParam.startsWith('link_')) {
        return;
      }
      
      const sessionToken = startParam.replace('link_', '');
      
      if (!sessionToken) {
        return;
      }
      
      // Проверяем, не был ли этот токен уже обработан (сохранено в localStorage)
      const processedTokens = JSON.parse(localStorage.getItem('processed_link_tokens') || '{}');
      if (processedTokens[sessionToken]) {
        // Токен уже обработан, проверяем не истек ли срок (1 час)
        const processedAt = processedTokens[sessionToken];
        const hourAgo = Date.now() - 60 * 60 * 1000;
        if (processedAt > hourAgo) {
          console.log('🔗 Токен связки уже был обработан, пропускаем:', sessionToken.slice(0, 8));
          setLinkInviteProcessed(true);
          return;
        }
      }
      
      console.log('🔗 Обработка запроса на связку профиля:', sessionToken);
      
      // Показываем модальное окно подтверждения
      setLinkSessionToken(sessionToken);
      setShowTelegramLinkConfirm(true);
      setLinkInviteProcessed(true);
    };
    
    if (isReady && (user || syncedUser) && startParam) {
      processLinkInvite();
    }
  }, [isReady, user?.id, syncedUser?.id, startParam, linkInviteProcessed]);

  // Обработка приглашения в комнату прослушивания (startapp=listen_{invite_code})
  const [listenInviteProcessed, setListenInviteProcessed] = useState(false);
  const [pendingListenInvite, setPendingListenInvite] = useState(null);
  useEffect(() => {
    const processListenInvite = async () => {
      if (!startParam || listenInviteProcessed || !user) {
        return;
      }
      
      // Формат: listen_{invite_code}
      if (!startParam.startsWith('listen_')) {
        return;
      }
      
      const inviteCode = startParam.replace('listen_', '');
      
      if (!inviteCode) {
        return;
      }
      
      console.log('🎵 Обработка приглашения в комнату прослушивания:', inviteCode);
      
      // Сохраняем код для открытия в MusicSection
      setPendingListenInvite(inviteCode);
      setListenInviteProcessed(true);
      
      // Переключаемся на вкладку музыки
      setActiveTab('music');
      
      hapticFeedback('success');
      showAlert('Присоединение к комнате прослушивания...');
    };
    
    if (isReady && user && startParam) {
      processListenInvite();
    }
  }, [isReady, user?.id, startParam, listenInviteProcessed]);

  // Загрузка расписания при изменении настроек или недели
  useEffect(() => {
    // Проверяем, что у пользователя есть полные настройки группы
    if (userSettings && userSettings.group_id && userSettings.facultet_id) {
      loadSchedule();
    }
  }, [userSettings, weekNumber]);

  // Обновление текущей пары
  useEffect(() => {
    if (schedule.length > 0) {
      updateCurrentClass();
      const interval = setInterval(updateCurrentClass, 60000);
      return () => clearInterval(interval);
    }
  }, [schedule]);

  // Загрузка syncedUser из localStorage при старте (для QR синхронизации)
  // Зависимость только от user — syncedUser убран чтобы избежать цикла перерендеров
  useEffect(() => {
    const savedSyncedUser = localStorage.getItem('synced_user');
    if (savedSyncedUser && !user) {
      try {
        const parsedUser = JSON.parse(savedSyncedUser);
        console.log('📱 Загружены данные синхронизированного пользователя из localStorage');
        setSyncedUser(parsedUser);
      } catch (e) {
        console.error('Ошибка парсинга synced_user:', e);
        localStorage.removeItem('synced_user');
      }
    }
  }, [user?.id]);

  const loadUserData = useCallback(async () => {
    // Используем effectiveUser (syncedUser из QR имеет приоритет над user из Telegram)
    // Важно: syncedUser содержит is_linked: true после синхронизации через QR
    const currentUser = syncedUser || user;
    if (!currentUser) {
      console.log('No user available for loadUserData');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Проверяем, является ли пользователь связанным с Telegram (не гостевым)
      const isLinkedUser = currentUser.is_linked || (!currentUser.is_guest && !currentUser.device_id);
      
      // Гостевые пользователи (device_id) — сразу показываем Welcome Screen, не дёргаем API
      if (currentUser.is_guest) {
        console.log('👤 Гостевой пользователь — показываем Welcome Screen');
        setShowWelcomeScreen(true);
        setLoading(false);
        return;
      }
      
      // Пробуем загрузить настройки из localStorage сначала (для быстрого восстановления)
      const savedUserSettings = localStorage.getItem('user_settings');
      let cachedSettings = null;
      if (savedUserSettings) {
        try {
          cachedSettings = JSON.parse(savedUserSettings);
          console.log('📦 Найдены сохранённые настройки в localStorage');
        } catch (e) {
          console.error('Ошибка парсинга сохранённых настроек:', e);
          localStorage.removeItem('user_settings');
        }
      }
      
      const settings = await userAPI.getUserSettings(currentUser.id);
      
      if (settings && settings.group_id && settings.facultet_id) {
        // Пользователь имеет полные настройки
        setUserSettings(settings);
        
        // Сохраняем в localStorage для быстрого восстановления
        localStorage.setItem('user_settings', JSON.stringify(settings));
        
        // Загружаем настройки темы
        try {
          const backendUrl = getBackendURL();
          const themeResponse = await fetch(`${backendUrl}/api/user-settings/${currentUser.id}/theme`);
          if (themeResponse.ok) {
            const themeData = await themeResponse.json();
            setNewYearThemeMode(themeData.new_year_theme_mode || 'auto');
          }
        } catch (themeError) {
          console.error('Error loading theme settings:', themeError);
          // Используем значение по умолчанию
          setNewYearThemeMode('auto');
        }
      } else if (settings) {
        // Пользователь существует, но у него неполные настройки
        console.log('User has incomplete settings, showing group selector');
        // Показываем выбор группы, НЕ очищая данные связки для связанных пользователей
        setShowGroupSelector(true);
        if (!isLinkedUser) {
          // Только для гостевых пользователей очищаем данные
          console.log('Guest user with incomplete settings');
        }
      } else {
        // Пользователь не найден в БД
        console.log('User not found in DB, isLinkedUser:', isLinkedUser);
        
        // Пробуем использовать сохранённые настройки для связанных пользователей
        if (isLinkedUser && cachedSettings && cachedSettings.group_id && cachedSettings.facultet_id) {
          console.log('🔄 Используем сохранённые настройки из localStorage');
          setUserSettings(cachedSettings);
          // Пытаемся синхронизировать с сервером в фоне
          try {
            await userAPI.saveUserSettings({
              telegram_id: currentUser.id,
              username: currentUser.username,
              first_name: currentUser.first_name,
              last_name: currentUser.last_name,
              ...cachedSettings
            });
            console.log('✅ Настройки синхронизированы с сервером');
          } catch (syncError) {
            console.warn('⚠️ Не удалось синхронизировать настройки:', syncError);
          }
        } else if (isLinkedUser) {
          // Связанный Telegram пользователь, но настроек нет - показываем Welcome Screen
          console.log('Linked user without settings - showing welcome screen');
          setShowWelcomeScreen(true);
        } else {
          // Гостевой пользователь - показываем welcome screen
          setShowWelcomeScreen(true);
          // НЕ очищаем device_id - это идентификатор устройства
          // Очищаем только данные связки если они есть
          localStorage.removeItem('session_token');
          localStorage.removeItem('user_settings');
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      
      // Проверяем, является ли пользователь связанным с Telegram
      const isLinkedUser = currentUser.is_linked || (!currentUser.is_guest && !currentUser.device_id);
      
      // Пробуем использовать сохранённые настройки из localStorage
      const savedUserSettings = localStorage.getItem('user_settings');
      if (isLinkedUser && savedUserSettings) {
        try {
          const cachedSettings = JSON.parse(savedUserSettings);
          if (cachedSettings.group_id && cachedSettings.facultet_id) {
            console.log('🔄 Ошибка API, используем сохранённые настройки');
            setUserSettings(cachedSettings);
            return;
          }
        } catch (e) {
          console.error('Ошибка парсинга настроек:', e);
        }
      }
      
      // Если пользователь не найден (404)
      if (err.message === 'Пользователь не найден') {
        // Показываем Welcome Screen для всех новых пользователей
        console.log('User not found - showing welcome screen');
        setShowWelcomeScreen(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, syncedUser?.id]);

  // Обработчик изменения настройки новогодней темы
  const handleThemeChange = useCallback((mode) => {
    setNewYearThemeMode(mode);
  }, []);

  // Периодическая проверка валидности сессии для связанных пользователей
  useEffect(() => {
    // Проверяем только если пользователь связан через веб (есть session_token)
    const sessionToken = localStorage.getItem('session_token');
    const telegramUser = localStorage.getItem('telegram_user');
    
    // Если нет session_token или нет сохранённого пользователя - не проверяем
    if (!sessionToken || !telegramUser) {
      return;
    }
    
    // Если мы в Telegram WebApp - не проверяем (там своя авторизация)
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      return;
    }
    
    console.log('💓 Starting session monitoring and heartbeat');
    
    // Функция для разлогинивания при удалении сессии
    const handleSessionRevoked = () => {
      console.log('🔌 Session revoked - logging out...');
      // Очищаем все данные авторизации
      localStorage.removeItem('telegram_user');
      localStorage.removeItem('user_settings');
      localStorage.removeItem('session_token');
      localStorage.removeItem('synced_user');
      localStorage.removeItem('linked_telegram_id');
      // Перезагружаем страницу для показа экрана связки
      window.location.reload();
    };
    
    // Подключаем WebSocket для мониторинга сессии в реальном времени
    const wsMonitor = createSessionMonitorWebSocket(sessionToken, {
      onRevoked: handleSessionRevoked,
      onError: (msg) => console.warn('Session monitor error:', msg)
    });
    
    // Отправляем heartbeat и проверяем валидность сессии
    const checkSession = async () => {
      const result = await sendHeartbeat(sessionToken);
      if (!result.valid) {
        console.log('❌ Session invalid:', result.reason);
        handleSessionRevoked();
      }
    };
    
    // Отправляем heartbeat сразу при загрузке
    checkSession();
    
    // Периодически отправляем heartbeat каждые 30 секунд (оптимизировано)
    const heartbeatInterval = setInterval(checkSession, 30000);
    
    return () => {
      clearInterval(heartbeatInterval);
      wsMonitor.close();
    };
  }, []);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 1) Пробуем загрузить из кэша СНАЧАЛА (мгновенно), чтобы показать данные пока грузим свежие
      let cachedEvents = null;
      try {
        const cached = await scheduleAPI.getCachedSchedule(userSettings.group_id, weekNumber);
        if (cached && cached.events && cached.events.length > 0) {
          cachedEvents = cached.events;
        }
      } catch (cacheErr) {
        // Кэш не критичен — игнорируем
      }
      
      // 2) Пробуем получить актуальное расписание с RUDN
      try {
        const scheduleData = await scheduleAPI.getSchedule({
          facultet_id: userSettings.facultet_id,
          level_id: userSettings.level_id,
          kurs: userSettings.kurs,
          form_code: userSettings.form_code,
          group_id: userSettings.group_id,
          week_number: weekNumber,
        });
        
        setSchedule(scheduleData.events || []);
        hapticFeedback('notification', 'success');
        return; // Успех — выходим
      } catch (fetchErr) {
        console.warn('Не удалось загрузить актуальное расписание:', fetchErr.message);
        
        // 3) Если свежие данные не доступны — используем кэш
        if (cachedEvents) {
          console.log('Используем кэшированное расписание');
          setSchedule(cachedEvents);
          hapticFeedback('notification', 'success');
          return; // Кэш спас — выходим без ошибки
        }
        
        // 4) Нет ни свежих данных, ни кэша — выбрасываем ошибку
        throw fetchErr;
      }
    } catch (err) {
      console.error('Error loading schedule:', err);
      
      // Формируем читаемое сообщение об ошибке
      let errorMessage = err.message || 'Неизвестная ошибка';
      
      if (typeof errorMessage === 'object') {
        if (Array.isArray(errorMessage)) {
          errorMessage = errorMessage.map(e => e.msg || JSON.stringify(e)).join(', ');
        } else {
          errorMessage = JSON.stringify(errorMessage);
        }
      }
      
      setError(errorMessage);
      showAlert(t('common.scheduleError', { message: errorMessage }));
    } finally {
      setLoading(false);
    }
  };

  // Загрузка данных достижений
  const loadAchievementsData = async () => {
    const currentUser = syncedUser || user;
    if (!currentUser) return;
    
    try {
      const [achievements, userAchs, stats] = await Promise.all([
        achievementsAPI.getAllAchievements(),
        achievementsAPI.getUserAchievements(currentUser.id),
        achievementsAPI.getUserStats(currentUser.id),
      ]);
      
      setAllAchievements(achievements);
      setUserAchievements(userAchs);
      setUserStats(stats);
    } catch (err) {
      console.error('Error loading achievements:', err);
    }
  };

  // Отслеживание достижений по времени
  const trackTimeBasedAchievements = async () => {
    const currentUser = syncedUser || user;
    if (!currentUser) return;
    
    const hour = new Date().getHours();
    let actionType = null;
    
    // Ночной совенок (с 23:00 до 04:00)
    if (hour >= 23 || hour < 4) {
      actionType = 'night_usage';
    }
    // Утренняя пташка (до 08:00, но не в ночное время)
    else if (hour >= 4 && hour < 8) {
      actionType = 'early_usage';
    }
    
    if (actionType) {
      try {
        const result = await achievementsAPI.trackAction(currentUser.id, actionType);
        if (result.new_achievements && result.new_achievements.length > 0) {
          // Показываем первое новое достижение через очередь
          showAchievementInQueue(result.new_achievements[0]);
          // Обновляем данные достижений
          loadAchievementsData();
        }
      } catch (err) {
        console.error('Error tracking time-based achievement:', err);
      }
    }
    
    // Отслеживаем ежедневную активность
    try {
      await achievementsAPI.trackAction(currentUser.id, 'daily_activity');
    } catch (err) {
      console.error('Error tracking daily activity:', err);
    }
  };

  // Отслеживание просмотра расписания
  const trackScheduleView = async () => {
    const currentUser = syncedUser || user;
    if (!currentUser || !userSettings) return;
    
    try {
      // Подсчитываем уникальные пары (группируем по ДНЮ + ВРЕМЕНИ, чтобы одинаковое время в разные дни считалось отдельно)
      const uniqueTimeSlots = new Set();
      schedule.forEach(event => {
        if (event.time && event.day) {
          // Создаём уникальный ключ: день + время
          uniqueTimeSlots.add(`${event.day}|${event.time}`); // Например: "Понедельник|10:30 - 11:50"
        }
      });
      
      const classesCount = uniqueTimeSlots.size;
      
      const result = await achievementsAPI.trackAction(currentUser.id, 'view_schedule', {
        classes_count: classesCount
      });
      if (result.new_achievements && result.new_achievements.length > 0) {
        showAchievementInQueue(result.new_achievements[0]);
        loadAchievementsData();
      }
    } catch (err) {
      console.error('Error tracking schedule view:', err);
    }
  };

  const updateCurrentClass = useCallback(() => {
    const now = new Date();
    const currentDay = now.toLocaleDateString('ru-RU', { weekday: 'long' });
    const dayName = currentDay.charAt(0).toUpperCase() + currentDay.slice(1);
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const todayClasses = schedule.filter(event => event.day === dayName);

    for (const classItem of todayClasses) {
      const timeRange = classItem.time.split('-');
      if (timeRange.length !== 2) continue;
      
      const [startHour, startMin] = timeRange[0].trim().split(':').map(Number);
      const [endHour, endMin] = timeRange[1].trim().split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      if (currentTime >= startTime && currentTime < endTime) {
        setCurrentClass(classItem.discipline);
        setMinutesLeft(endTime - currentTime);
        return;
      }
    }

    setCurrentClass(null);
    setMinutesLeft(0);
  }, [schedule]);

  const handleGroupSelected = async (groupData) => {
    const currentUser = syncedUser || user;
    try {
      hapticFeedback('impact', 'medium');
      
      const settings = await userAPI.saveUserSettings({
        telegram_id: currentUser?.id,
        username: currentUser?.username,
        first_name: currentUser?.first_name,
        last_name: currentUser?.last_name,
        ...groupData,
      });
      
      setUserSettings(settings);
      setShowGroupSelector(false);
      showAlert(t('common.groupSelected', { groupName: groupData.group_name }));

      // Отслеживаем выбор группы для достижений
      if (effectiveUser) {
        try {
          const result = await achievementsAPI.trackAction(effectiveUser.id, 'select_group');
          // Также отслеживаем просмотр группы
          await achievementsAPI.trackAction(effectiveUser.id, 'view_group', { group_id: groupData.group_id });
          
          if (result.new_achievements && result.new_achievements.length > 0) {
            showAchievementInQueue(result.new_achievements[0]);
            loadAchievementsData();
          }
        } catch (err) {
          console.error('Error tracking group selection:', err);
        }
      }
    } catch (err) {
      console.error('Error saving user settings:', err);
      showAlert(t('common.settingsError', { message: err.message }));
    }
  };

  const handleCalendarClick = async () => {
    hapticFeedback('impact', 'light');
    setIsCalendarOpen(true);
    
    // Отслеживаем открытие календаря
    if (effectiveUser) {
      try {
        const result = await achievementsAPI.trackAction(effectiveUser.id, 'open_calendar');
        if (result.new_achievements && result.new_achievements.length > 0) {
          showAchievementInQueue(result.new_achievements[0]);
          loadAchievementsData();
        }
      } catch (err) {
        console.error('Error tracking calendar open:', err);
      }
    }
  };

  const handleAnalyticsClick = async () => {
    hapticFeedback('impact', 'light');
    setIsAnalyticsOpen(true);
    
    // Отслеживаем открытие аналитики и посещение пункта меню
    if (effectiveUser) {
      try {
        const result = await achievementsAPI.trackAction(effectiveUser.id, 'view_analytics');
        await achievementsAPI.trackAction(effectiveUser.id, 'visit_menu_item', { menu_item: 'analytics' });
        if (result.new_achievements && result.new_achievements.length > 0) {
          showAchievementInQueue(result.new_achievements[0]);
          loadAchievementsData();
        }
      } catch (err) {
        console.error('Error tracking analytics view:', err);
      }
    }
  };

  const handleAchievementsClick = async () => {
    hapticFeedback('impact', 'light');
    setIsAchievementsOpen(true);
    
    // Отслеживаем посещение пункта меню достижений
    if (effectiveUser) {
      try {
        await achievementsAPI.trackAction(effectiveUser.id, 'visit_menu_item', { menu_item: 'achievements' });
      } catch (err) {
        console.error('Error tracking achievements view:', err);
      }
    }
  };

  const handleNotificationsClick = async () => {
    hapticFeedback('impact', 'light');
    setIsNotificationsPanelOpen(true);
    
    // Отслеживаем посещение пункта меню уведомлений
    if (effectiveUser) {
      try {
        await achievementsAPI.trackAction(effectiveUser.id, 'visit_menu_item', { menu_item: 'notifications' });
      } catch (err) {
        console.error('Error tracking notifications view:', err);
      }
    }
  };

  const handleNotificationsPanelClose = () => {
    setIsNotificationsPanelOpen(false);
    // Обновляем счётчик после закрытия панели
    loadUnreadCount();
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    
    // Автоматически определяем и устанавливаем номер недели
    const weekNum = getWeekNumberForDate(date);
    if (weekNum !== null) {
      setWeekNumber(weekNum);
      console.log('Selected date:', date, 'Week number:', weekNum);
    } else {
      console.log('Selected date:', date, 'is outside current/next week range');
    }
  };

  const handleWeekChange = (newWeekNumber) => {
    setWeekNumber(newWeekNumber);
    
    // Если выбранная дата не входит в новую неделю, обновляем дату на первый день новой недели
    const currentWeekNum = getWeekNumberForDate(selectedDate);
    if (currentWeekNum !== newWeekNumber) {
      const today = new Date();
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      
      if (newWeekNumber === 2) {
        // Следующая неделя - добавляем 7 дней
        monday.setDate(monday.getDate() + 7);
      }
      
      setSelectedDate(monday);
      console.log('Week changed to:', newWeekNumber, 'Date updated to:', monday);
    }
  };


  const handleChangeGroup = () => {
    hapticFeedback('impact', 'medium');
    setShowGroupSelector(true);
  };

  const handleAchievementNotificationClose = () => {
    setNewAchievement(null);
  };

  const handleTabChange = (newTab) => {
    hapticFeedback('impact', 'light');
    setActiveTab(newTab);
  };

  const handleWelcomeGetStarted = () => {
    setShowWelcomeScreen(false);
    setShowGroupSelector(true);
  };

  // Обработка успешной синхронизации через QR-код на Welcome Screen
  const handleWelcomeSyncComplete = async (userData) => {
    console.log('✅ Синхронизация через Welcome Screen:', userData);
    setShowWelcomeScreen(false);
    
    // Сохраняем данные синхронизированного пользователя
    if (userData) {
      const syncedUserData = {
        id: userData.telegram_id,
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username,
        photo_url: userData.photo_url,
        is_linked: true
      };
      setSyncedUser(syncedUserData);
      
      // Сохраняем в localStorage для восстановления после перезагрузки
      localStorage.setItem('synced_user', JSON.stringify(syncedUserData));
      localStorage.setItem('linked_telegram_id', userData.telegram_id?.toString());
      
      // ВАЖНО: Сохраняем telegram_user для TelegramContext
      // Это нужно чтобы при перезагрузке страницы пользователь не был гостем
      const telegramUserData = {
        id: userData.telegram_id,
        first_name: userData.first_name || 'Пользователь',
        last_name: userData.last_name || '',
        username: userData.username || '',
        photo_url: userData.photo_url,
        is_linked: true
      };
      localStorage.setItem('telegram_user', JSON.stringify(telegramUserData));
      
      // Сохраняем session_token для проверки валидности сессии
      if (userData.session_token) {
        localStorage.setItem('session_token', userData.session_token);
      }
      
      // Сохраняем user_settings если они есть
      if (userData.user_settings) {
        localStorage.setItem('user_settings', JSON.stringify(userData.user_settings));
      }
    }
    
    // Проверяем есть ли у пользователя уже настройки с группой
    if (userData && userData.user_settings) {
      const settings = userData.user_settings;
      if (settings.group_id && settings.facultet_id) {
        // У пользователя уже есть группа - загружаем его данные
        console.log('✅ Пользователь уже зарегистрирован, загружаем данные');
        setUserSettings(settings);
        
        // Сохраняем в localStorage для кэширования
        if (userData.telegram_id) {
          localStorage.setItem(`user_settings_${userData.telegram_id}`, JSON.stringify(settings));
        }
        
        // Не показываем GroupSelector - сразу к главному экрану
        setShowGroupSelector(false);
        return;
      }
    }
    
    // Если группа не выбрана - показываем GroupSelector
    setShowGroupSelector(true);
  };

  // Обработка успешной связки Telegram профиля
  const handleTelegramLinked = (userData) => {
    console.log('✅ Telegram профиль связан:', userData);
    setShowTelegramLinkScreen(false);
    
    // Перезагружаем страницу для применения новых данных пользователя
    window.location.reload();
  };

  // Обработка закрытия модального окна подтверждения связки
  const handleLinkConfirmClose = () => {
    // Сохраняем токен как обработанный, чтобы при обновлении страницы модальное окно не появлялось
    if (linkSessionToken) {
      const processedTokens = JSON.parse(localStorage.getItem('processed_link_tokens') || '{}');
      processedTokens[linkSessionToken] = Date.now();
      // Очищаем старые токены (старше 1 часа)
      const hourAgo = Date.now() - 60 * 60 * 1000;
      Object.keys(processedTokens).forEach(token => {
        if (processedTokens[token] < hourAgo) {
          delete processedTokens[token];
        }
      });
      localStorage.setItem('processed_link_tokens', JSON.stringify(processedTokens));
    }
    setShowTelegramLinkConfirm(false);
    setLinkSessionToken(null);
  };

  // Обработка успешного подтверждения связки в Telegram Web App
  const handleLinkConfirmSuccess = () => {
    console.log('✅ Связка подтверждена из Telegram Web App');
    // Сохраняем токен как обработанный
    if (linkSessionToken) {
      const processedTokens = JSON.parse(localStorage.getItem('processed_link_tokens') || '{}');
      processedTokens[linkSessionToken] = Date.now();
      // Очищаем старые токены (старше 1 часа)
      const hourAgo = Date.now() - 60 * 60 * 1000;
      Object.keys(processedTokens).forEach(token => {
        if (processedTokens[token] < hourAgo) {
          delete processedTokens[token];
        }
      });
      localStorage.setItem('processed_link_tokens', JSON.stringify(processedTokens));
    }
    setShowTelegramLinkConfirm(false);
    setLinkSessionToken(null);
    // Показываем уведомление об успехе
    showAlert('Веб-версия успешно подключена!');
  };

  // Обработка отсканированного QR-кода
  const handleQRScanned = async (scannedText) => {
    console.log('🔍 Processing QR code:', scannedText);
    
    try {
      // 1. QR для синхронизации с веб-версией (link_XXXXX)
      if (scannedText.includes('link_')) {
        const sessionToken = scannedText.split('link_').pop()?.split(/[?&#]/)[0];
        if (sessionToken) {
          console.log('📱 Web session QR detected:', sessionToken);
          setLinkSessionToken(sessionToken);
          setShowTelegramLinkConfirm(true);
          return;
        }
      }
      
      // 2. QR для добавления в друзья (friend_XXXXX или rudn://friend/XXXXX)
      if (scannedText.includes('friend_') || scannedText.includes('friend/')) {
        const friendId = scannedText.match(/friend[_\/](\d+)/)?.[1];
        if (friendId && effectiveUser?.id) {
          console.log('👥 Friend QR detected:', friendId);
          
          // Проверяем, что это не свой QR-код
          if (parseInt(friendId) === effectiveUser.id) {
            showAlert('Это ваш собственный QR-код');
            return;
          }
          
          // Показываем модальное окно подтверждения
          setFriendRequestModal({
            isOpen: true,
            friendId: parseInt(friendId),
            friendData: null,
            loading: true
          });
          
          // Загружаем данные о пользователе и аватарку
          try {
            const { friendsAPI } = await import('./services/friendsAPI');
            const backendUrl = getBackendURL();
            
            // Загружаем профиль и аватарку параллельно
            const [userData, photoResponse] = await Promise.all([
              friendsAPI.getUserProfile(parseInt(friendId), effectiveUser.id),
              fetch(`${backendUrl}/api/user-profile-photo/${friendId}`).then(r => r.ok ? r.json() : null).catch(() => null)
            ]);
            
            setFriendRequestModal(prev => ({
              ...prev,
              friendData: {
                ...userData,
                photo_url: photoResponse?.photo_url || null
              },
              loading: false
            }));
          } catch (err) {
            console.error('Error loading friend data:', err);
            setFriendRequestModal(prev => ({
              ...prev,
              friendData: { telegram_id: parseInt(friendId) },
              loading: false
            }));
          }
          return;
        }
      }
      
      // 3. QR для подключения к комнате прослушивания (listen_XXXXX или startapp=listen_XXXXX)
      if (scannedText.includes('listen_')) {
        const inviteCode = scannedText.match(/listen_([a-zA-Z0-9]+)/)?.[1];
        if (inviteCode) {
          console.log('🎵 Listening room QR detected:', inviteCode);
          
          // Показываем модальное окно с загрузкой
          setListenRoomJoinModal({
            isOpen: true,
            inviteCode: inviteCode,
            roomData: null,
            loading: true
          });
          
          // Загружаем информацию о комнате
          try {
            const { getListeningRoomPreview } = await import('./services/listeningRoomAPI');
            const preview = await getListeningRoomPreview(inviteCode);
            
            setListenRoomJoinModal(prev => ({
              ...prev,
              roomData: preview.found ? preview : null,
              loading: false
            }));
            
            if (!preview.found) {
              hapticFeedback('notification', 'error');
            }
          } catch (err) {
            console.error('Error loading room preview:', err);
            setListenRoomJoinModal(prev => ({
              ...prev,
              roomData: null,
              loading: false
            }));
            hapticFeedback('notification', 'error');
          }
          return;
        }
      }
      
      // 4. QR для присоединения к комнате задач (room_XXXXX)
      if (scannedText.includes('room_')) {
        const roomId = scannedText.match(/room_([a-zA-Z0-9-]+)/)?.[1];
        if (roomId) {
          console.log('🚪 Room QR detected:', roomId);
          // TODO: Реализовать присоединение к комнате
          showAlert('Комната найдена: ' + roomId);
          return;
        }
      }
      
      // 4. QR для журнала посещений (journal_XXXXX или содержит /journal/)
      if (scannedText.includes('journal_') || scannedText.includes('/journal/')) {
        const journalId = scannedText.match(/journal[_\/]([a-zA-Z0-9-]+)/)?.[1];
        if (journalId) {
          console.log('📓 Journal QR detected:', journalId);
          // TODO: Реализовать присоединение к журналу
          showAlert('Журнал найден: ' + journalId);
          return;
        }
      }
      
      // 5. Реферальный QR (ref_XXXXX)
      if (scannedText.includes('ref_')) {
        const refCode = scannedText.match(/ref_([a-zA-Z0-9]+)/)?.[1];
        if (refCode) {
          console.log('🔗 Referral QR detected:', refCode);
          showAlert('Реферальный код: ' + refCode);
          return;
        }
      }
      
      // 6. URL - открываем в браузере
      if (scannedText.startsWith('http://') || scannedText.startsWith('https://')) {
        console.log('🌐 URL QR detected:', scannedText);
        window.Telegram?.WebApp?.openLink(scannedText);
        return;
      }
      
      // Неизвестный формат QR
      console.log('❓ Unknown QR format:', scannedText);
      showAlert('QR-код: ' + scannedText.substring(0, 100));
      
    } catch (error) {
      console.error('Error processing QR code:', error);
      showAlert('Ошибка обработки QR-кода');
    }
  };

  // Обработка подтверждения запроса в друзья
  const handleFriendRequestConfirm = async () => {
    if (!friendRequestModal.friendId || !effectiveUser?.id) return;
    
    setFriendRequestModal(prev => ({ ...prev, loading: true }));
    
    try {
      const { friendsAPI } = await import('./services/friendsAPI');
      const result = await friendsAPI.sendFriendRequest(effectiveUser.id, friendRequestModal.friendId);
      
      setFriendRequestModal({ isOpen: false, friendId: null, friendData: null, loading: false });
      
      if (result.status === 'sent') {
        showAlert('Запрос в друзья отправлен!');
        if (hapticFeedback) hapticFeedback('notification', 'success');
      } else if (result.status === 'already_friends') {
        showAlert('Вы уже друзья!');
      } else if (result.status === 'already_sent') {
        showAlert('Запрос уже отправлен!');
      } else {
        showAlert(result.message || 'Запрос отправлен');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      showAlert('Ошибка отправки запроса');
      if (hapticFeedback) hapticFeedback('notification', 'error');
      setFriendRequestModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Закрытие модального окна запроса в друзья
  const handleFriendRequestCancel = () => {
    setFriendRequestModal({ isOpen: false, friendId: null, friendData: null, loading: false });
  };

  // Обработчик подтверждения подключения к комнате прослушивания
  const handleListenRoomJoinConfirm = () => {
    const inviteCode = listenRoomJoinModal.inviteCode;
    setListenRoomJoinModal({ isOpen: false, inviteCode: null, roomData: null, loading: false });
    
    if (inviteCode) {
      // Устанавливаем pendingListenInvite и переключаемся на вкладку музыки
      setPendingListenInvite(inviteCode);
      setActiveTab('music');
      setTimeout(() => {
        openListeningRoomRef.current?.();
      }, 300);
      hapticFeedback('success');
    }
  };

  const handleListenRoomJoinCancel = () => {
    setListenRoomJoinModal({ isOpen: false, inviteCode: null, roomData: null, loading: false });
  };

  // Рендерим новогоднюю тему для всех экранов
  const renderNewYearTheme = () => {
    // Определяем, показывать ли снег
    let showSnow = false;
    
    if (newYearThemeMode === 'always') {
      // Режим "Всегда" - показываем круглый год
      showSnow = true;
    } else if (newYearThemeMode === 'auto') {
      // Режим "Авто" - показываем только зимой (Dec/Jan/Feb)
      const isWinter = isWinterSeason();
      showSnow = isWinter;
    }
    // Режим "off" - не показываем (showSnow остаётся false)
    
    return showSnow ? <NewYearTheme enabled={true} /> : null;
  };

  // Показываем Welcome Screen
  if (showWelcomeScreen) {
    // Определяем, открыто ли приложение из Telegram WebApp
    const isInTelegram = Boolean(window.Telegram?.WebApp?.initDataUnsafe?.user);
    
    return (
      <>
        {renderNewYearTheme()}
        <WelcomeScreen 
          onGetStarted={handleWelcomeGetStarted} 
          onSyncComplete={handleWelcomeSyncComplete}
          hideSyncButton={isInTelegram}
        />
      </>
    );
  }

  // Показываем GroupSelector
  if (showGroupSelector) {
    return (
      <>
        {renderNewYearTheme()}
        <GroupSelector
          onGroupSelected={handleGroupSelected}
          onCancel={userSettings ? () => setShowGroupSelector(false) : null}
        />
      </>
    );
  }

  // Показываем экран загрузки
  if (loading && !userSettings) {
    return (
      <>
        {renderNewYearTheme()}
        <LoadingScreen message={t('common.loading')} />
      </>
    );
  }

  // Показываем ошибку
  if (error && !userSettings) {
    return (
      <>
        {renderNewYearTheme()}
        <div className="h-full min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadUserData}
              className="bg-white text-black px-6 py-3 rounded-full font-medium"
            >
              {t('common.retry')}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="h-full min-h-screen bg-background telegram-webapp relative">
      <TopGlow />
      {activeTab === 'home' && <UpcomingClassNotification schedule={schedule} />}
      
      {/* Новогодняя тема с тремя режимами */}
      {renderNewYearTheme()}
      
      {/* Greeting Notification через очередь */}
      <GreetingNotification 
          key={greetingKey}
          userFirstName={user?.first_name} 
          testHour={testGreetingHour}
          onRequestShow={handleGreetingRequest}
      />
      
      {/* Очередь уведомлений (greeting + achievements) */}
      <AnimatePresence>
        {activeQueueNotification && activeQueueNotification.type === 'greeting' && (
          <GreetingNotificationContent 
            greeting={activeQueueNotification.data}
            onClose={closeQueueNotification}
          />
        )}
        {activeQueueNotification && activeQueueNotification.type === 'achievement' && (
          <AchievementNotificationContent 
            achievement={activeQueueNotification.data}
            onClose={closeQueueNotification}
            hapticFeedback={hapticFeedback}
          />
        )}
      </AnimatePresence>
      
      {/* Adaptive container with responsive max-width */}
      <div className="relative mx-auto max-w-[430px] md:max-w-3xl lg:max-w-7xl 2xl:max-w-8xl px-0 pb-24" style={{ zIndex: 10 }}>
        {/* Header - full width */}
        <Header 
          user={effectiveUser}
          userSettings={userSettings}
          onAnalyticsClick={schedule.length > 0 ? handleAnalyticsClick : null}
          onAchievementsClick={effectiveUser ? handleAchievementsClick : null}
          onNotificationsClick={effectiveUser ? handleNotificationsClick : null}
          hapticFeedback={hapticFeedback}
          onMenuStateChange={setIsMenuOpen}
          onProfileStateChange={setIsProfileOpen}
          onThemeChange={handleThemeChange}
          unreadNotificationsCount={unreadNotificationsCount}
          hasNewNotification={hasNewNotification}
          onQRScanned={handleQRScanned}
        />
        
        {/* Условное отображение разделов в зависимости от активной вкладки */}
        {activeTab === 'home' && (
          <>
            {/* Responsive layout: 
                - Mobile (< 768px): single column
                - Tablet (768px - 1279px): two columns equal width
                - Desktop (>= 1280px): main content + sidebar (380px fixed)
            */}
            <div className="md:grid md:grid-cols-2 md:gap-6 md:px-6 lg:grid-cols-2 xl:grid-cols-[1fr_380px]">
              {/* Main content column */}
              <div className="md:min-w-0 md:overflow-visible">
                <LiveScheduleCarousel
                  currentClass={currentClass} 
                  minutesLeft={minutesLeft}
                  hapticFeedback={hapticFeedback}
                  allAchievements={allAchievements}
                  userAchievements={userAchievements}
                  userStats={userStats}
                  user={user}
                  schedule={schedule}
                  isAchievementsOpen={isAchievementsOpen}
                  setIsAchievementsOpen={setIsAchievementsOpen}
                  isAnalyticsOpen={isAnalyticsOpen}
                  setIsAnalyticsOpen={setIsAnalyticsOpen}
                />
              
                <WeekDaySelector 
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  weekNumber={weekNumber}
                  hapticFeedback={hapticFeedback}
                />
                
                {loading ? (
                  <div className="bg-white rounded-t-[40px] mt-6 pt-8">
                    <ScheduleListSkeleton count={4} />
                  </div>
                ) : (
                  <LiveScheduleSection 
                    selectedDate={selectedDate}
                    mockSchedule={schedule}
                    weekNumber={weekNumber}
                    onWeekChange={handleWeekChange}
                    groupName={userSettings?.group_name}
                    onChangeGroup={handleChangeGroup}
                    onDateSelect={handleDateSelect}
                    onCalendarClick={handleCalendarClick}
                    hapticFeedback={hapticFeedback}
                    telegramId={user?.id}
                    onShareModalStateChange={setIsShareModalOpen}
                    user={user}
                    onAdminPanelOpen={() => setIsAdminPanelOpen(true)}
                  />
                )}
              </div>
              
              {/* Desktop Sidebar - right column (desktop only) */}
              <DesktopSidebar
                user={user}
                userStats={userStats}
                userAchievements={userAchievements}
                allAchievements={allAchievements}
                onAchievementsClick={user ? handleAchievementsClick : null}
                onAnalyticsClick={schedule.length > 0 ? handleAnalyticsClick : null}
                onCalendarClick={handleCalendarClick}
              />
            </div>
          </>
        )}

        {/* Раздел "Список дел" */}
        {activeTab === 'tasks' && (
          <div className="px-4">
            <TasksSection 
              userSettings={userSettings}
              selectedDate={selectedDate}
              weekNumber={weekNumber}
              onModalStateChange={setIsAddTaskModalOpen}
              pendingRoomId={pendingRoomId}
              onPendingRoomHandled={() => setPendingRoomId(null)}
            />
          </div>
        )}

        {/* Раздел "Журнал" */}
        {activeTab === 'journal' && (
          <div className="px-4">
            <JournalSection 
              telegramId={user?.id}
              hapticFeedback={hapticFeedback}
              userSettings={userSettings}
              pendingJournalId={pendingJournalId}
              onPendingJournalHandled={() => setPendingJournalId(null)}
              onModalStateChange={setIsJournalModalOpen}
            />
          </div>
        )}

        {/* Раздел "Музыка" */}
        {activeTab === 'music' && (
          <div className="px-4">
            <MusicSection 
              telegramId={user?.id}
              onListeningRoomOpenChange={setIsListeningRoomOpen}
              onSendTrackModalOpenChange={setIsSendTrackModalOpen}
              openListeningRoomRef={openListeningRoomRef}
              pendingListenInvite={pendingListenInvite}
              onListenInviteHandled={() => setPendingListenInvite(null)}
            />
          </div>
        )}

        {/* Раздел "Друзья" */}
        {activeTab === 'friends' && (
          <ErrorBoundary>
            <FriendsSection 
              userSettings={userSettings}
              onFriendProfileOpen={setIsFriendProfileOpen}
              onChatOpen={setIsChatOpen}
              onJoinListeningRoom={(inviteCode) => {
                setPendingListenInvite(inviteCode);
                setActiveTab('music');
                setTimeout(() => {
                  openListeningRoomRef.current?.();
                }, 500);
              }}
            />
          </ErrorBoundary>
        )}
        
        <Suspense fallback={null}>
          <ErrorBoundary>
            <CalendarModal
              isOpen={isCalendarOpen}
              onClose={() => setIsCalendarOpen(false)}
              onDateSelect={handleDateSelect}
            />
          </ErrorBoundary>
        </Suspense>

        <Suspense fallback={null}>
          <ErrorBoundary>
            <AnalyticsModal
              isOpen={isAnalyticsOpen}
              onClose={() => setIsAnalyticsOpen(false)}
              schedule={schedule}
              userStats={userStats}
              hapticFeedback={hapticFeedback}
            />
          </ErrorBoundary>
        </Suspense>

        {effectiveUser && (
          <Suspense fallback={null}>
            <NotificationsPanel
              isOpen={isNotificationsPanelOpen}
              onClose={handleNotificationsPanelClose}
              telegramId={effectiveUser.id}
              hapticFeedback={hapticFeedback}
            />
          </Suspense>
        )}

        {effectiveUser && (
          <Suspense fallback={null}>
            <NotificationSettings
              telegramId={effectiveUser.id}
              onClose={() => setIsNotificationSettingsOpen(false)}
              hapticFeedback={hapticFeedback}
              showAlert={showAlert}
              isOpen={isNotificationSettingsOpen}
            />
          </Suspense>
        )}

        {effectiveUser && (
          <Suspense fallback={null}>
            <AchievementsModal
              isOpen={isAchievementsOpen}
              onClose={() => setIsAchievementsOpen(false)}
              allAchievements={allAchievements}
              userAchievements={userAchievements}
              userStats={userStats}
              hapticFeedback={hapticFeedback}
            />
          </Suspense>
        )}

        {/* AchievementNotification теперь отображается через очередь выше */}
        
        {/* Swipe hint - показывается один раз, скрывается через 10 секунд или при первом свайпе */}
        {!showGroupSelector && schedule.length > 0 && (
          <SwipeHint onSwipe={true} />
        )}
      </div>

      {/* Mini Player - показывается над BottomNavigation, скрывается при открытии модальных окон */}
      {!showGroupSelector && userSettings && !isFullscreenPlayerOpen && (
        <MiniPlayer 
          onExpand={() => setIsFullscreenPlayerOpen(true)}
          isHidden={isAnyModalOpen}
          onArtistClick={handleArtistClick}
          onOpenListeningRoom={() => {
            setActiveTab('music');
            setTimeout(() => {
              openListeningRoomRef.current?.();
            }, 100);
          }}
        />
      )}

      {/* Fullscreen Player */}
      {!showGroupSelector && userSettings && (
        <FullscreenPlayer 
          isOpen={isFullscreenPlayerOpen}
          onClose={() => setIsFullscreenPlayerOpen(false)}
          onArtistClick={handleArtistClick}
        />
      )}

      {/* Artist Card Modal */}
      <ArtistCard
        isOpen={isArtistCardOpen}
        onClose={handleArtistCardClose}
        artistName={selectedArtist}
      />

      {/* Bottom Navigation */}
      {!showGroupSelector && userSettings && (
        <BottomNavigation 
          activeTab={activeTab}
          onTabChange={handleTabChange}
          hapticFeedback={hapticFeedback}
          isHidden={isAnyModalOpen}
        />
      )}

      {/* Admin Panel Modal */}
      {isAdminPanelOpen && (
        <Suspense fallback={null}>
          <AdminPanel
            isOpen={isAdminPanelOpen}
            onClose={() => setIsAdminPanelOpen(false)}
          />
        </Suspense>
      )}

      {/* Friend Request Confirm Modal - подтверждение запроса в друзья */}
      <AnimatePresence>
        {friendRequestModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
            onClick={handleFriendRequestCancel}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{
                backgroundColor: 'rgba(30, 30, 30, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center overflow-hidden">
                    {friendRequestModal.loading ? (
                      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : friendRequestModal.friendData?.photo_url ? (
                      <img 
                        src={friendRequestModal.friendData.photo_url} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-white">
                        {friendRequestModal.friendData?.first_name?.[0] || '?'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Добавить в друзья?
                  </h3>
                  {friendRequestModal.loading ? (
                    <p className="text-gray-400 text-sm">Загрузка...</p>
                  ) : (
                    <p className="text-gray-300 text-base">
                      {friendRequestModal.friendData?.first_name || 'Пользователь'}{' '}
                      {friendRequestModal.friendData?.last_name || ''}
                      {friendRequestModal.friendData?.username && (
                        <span className="text-gray-500 text-sm block mt-1">
                          @{friendRequestModal.friendData.username}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleFriendRequestCancel}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 transition-all active:scale-95"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleFriendRequestConfirm}
                    disabled={friendRequestModal.loading}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
                    }}
                  >
                    {friendRequestModal.loading ? 'Отправка...' : 'Добавить'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Listening Room Join Confirm Modal - подтверждение подключения к комнате прослушивания */}
      <AnimatePresence>
        {listenRoomJoinModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
            onClick={handleListenRoomJoinCancel}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{
                backgroundColor: 'rgba(30, 30, 30, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                {/* Header */}
                <div className="text-center mb-5">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
                  >
                    {listenRoomJoinModal.loading ? (
                      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="text-3xl">🎵</span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Подключиться к комнате?
                  </h3>
                  {listenRoomJoinModal.loading ? (
                    <p className="text-gray-400 text-sm">Загрузка информации...</p>
                  ) : listenRoomJoinModal.roomData ? (
                    <div>
                      <p className="text-white font-semibold text-base mb-1">
                        {listenRoomJoinModal.roomData.name}
                      </p>
                      <p className="text-gray-400 text-sm">
                        Создатель: {listenRoomJoinModal.roomData.host_name}
                      </p>
                      <div className="flex items-center justify-center gap-3 mt-2 text-xs text-gray-500">
                        <span>👥 {listenRoomJoinModal.roomData.participants_count} участн.</span>
                        <span className="text-green-400">● {listenRoomJoinModal.roomData.online_count} онлайн</span>
                      </div>
                      {listenRoomJoinModal.roomData.current_track && (
                        <p className="text-gray-400 text-xs mt-2">
                          ▶ {listenRoomJoinModal.roomData.current_track.artist} — {listenRoomJoinModal.roomData.current_track.title}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-red-400 text-sm">Комната не найдена или закрыта</p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleListenRoomJoinCancel}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 transition-all active:scale-95"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleListenRoomJoinConfirm}
                    disabled={listenRoomJoinModal.loading || !listenRoomJoinModal.roomData}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
                  >
                    {listenRoomJoinModal.loading ? 'Загрузка...' : 'Подключиться'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Telegram Link Confirm Modal - показывается при открытии через QR-код */}
      <TelegramLinkConfirmModal
        isOpen={showTelegramLinkConfirm}
        onClose={handleLinkConfirmClose}
        sessionToken={linkSessionToken}
        onSuccess={handleLinkConfirmSuccess}
      />
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <ThemeProvider>
          <TelegramProvider>
            <PlayerProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/status-tester" element={<StatusTester />} />
                </Routes>
              </BrowserRouter>
            </PlayerProvider>
          </TelegramProvider>
        </ThemeProvider>
      </div>
    </ErrorBoundary>
  );
}

export default App;
