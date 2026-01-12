import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
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
import GroupSelector from './components/GroupSelector';
import WelcomeScreen from './components/WelcomeScreen';
import StatusTester from './StatusTester';
import { TelegramProvider, useTelegram } from './contexts/TelegramContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext'; // Import ThemeProvider
import { scheduleAPI, userAPI, achievementsAPI, tasksAPI } from './services/api';
import { processReferralWebApp } from './services/referralAPI';
import { processJournalWebAppInvite } from './services/journalAPI';
import { joinRoomByToken } from './services/roomsAPI';
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
const AdminPanel = lazy(() => import('./components/AdminPanel'));
import { UpcomingClassNotification } from './components/UpcomingClassNotification';
import { GreetingNotification, GreetingNotificationContent } from './components/GreetingNotification';
import { AchievementNotificationContent } from './components/AchievementNotification';
import { NotificationQueueProvider, useNotificationQueue } from './components/NotificationQueue';
import { AnimatePresence } from 'framer-motion';

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
  
  // Состояние для новогодней темы
  const [newYearThemeMode, setNewYearThemeMode] = useState('auto'); // 'auto', 'always', 'off'

  // Состояния для достижений
  const [allAchievements, setAllAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [newAchievement, setNewAchievement] = useState(null); // Для показа уведомления
  
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
    isMenuOpen ||
    isProfileOpen ||
    isShareModalOpen ||
    isAddTaskModalOpen || // from TasksSection's AddTaskModal
    isJournalModalOpen || // from JournalSection
    isFullscreenPlayerOpen; // fullscreen music player

  // Загрузка данных пользователя при монтировании
  useEffect(() => {
    if (isReady && user) {
      loadUserData();
      loadAchievementsData();
      trackTimeBasedAchievements();
    }
  }, [isReady, user]);
  
  // 🔗 Обработка реферального кода из Web App ссылки
  useEffect(() => {
    const processReferral = async () => {
      // Проверяем условия: есть startParam, начинается с ref_, не обработан ещё
      if (!startParam || !startParam.startsWith('ref_') || referralProcessed || !user) {
        return;
      }
      
      const referralCode = startParam.replace('ref_', '');
      console.log('🔗 Обработка реферального кода из Web App:', referralCode);
      
      try {
        const result = await processReferralWebApp({
          telegram_id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
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
    
    if (isReady && user && startParam) {
      processReferral();
    }
  }, [isReady, user, startParam, referralProcessed]);

  // 📚 Обработка приглашения в журнал из Web App ссылки
  useEffect(() => {
    const processJournalInvite = async () => {
      // Проверяем условия: есть startParam, начинается с journal_ или jstudent_, не обработан ещё
      if (!startParam || journalInviteProcessed || !user) {
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
          telegram_id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
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
    
    if (isReady && user && startParam) {
      processJournalInvite();
    }
  }, [isReady, user, startParam, journalInviteProcessed]);

  // 🚪 Обработка приглашения в комнату из Web App ссылки
  useEffect(() => {
    const processRoomInvite = async () => {
      // Проверяем условия: есть startParam, содержит room_, не обработан ещё
      if (!startParam || roomInviteProcessed || !user) {
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
          telegram_id: user.id,
          username: user.username,
          first_name: user.first_name,
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
    
    if (isReady && user && startParam) {
      processRoomInvite();
    }
  }, [isReady, user, startParam, roomInviteProcessed]);

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

  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await userAPI.getUserSettings(user.id);
      
      if (settings && settings.group_id && settings.facultet_id) {
        // Пользователь имеет полные настройки
        setUserSettings(settings);
        
        // Загружаем настройки темы
        try {
          const backendUrl = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
          const themeResponse = await fetch(`${backendUrl}/api/user-settings/${user.id}/theme`);
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
        console.log('User has incomplete settings, showing welcome screen');
        setShowWelcomeScreen(true);
      } else {
        // Пользователь не найден
        setShowWelcomeScreen(true);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      // Если пользователь не найден (404), показываем welcome screen
      if (err.message === 'Пользователь не найден') {
        setShowWelcomeScreen(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Обработчик изменения настройки новогодней темы
  const handleThemeChange = useCallback((mode) => {
    setNewYearThemeMode(mode);
  }, []);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      
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
    } catch (err) {
      console.error('Error loading schedule:', err);
      
      // Формируем читаемое сообщение об ошибке
      let errorMessage = err.message || 'Неизвестная ошибка';
      
      // Если err.message является объектом или массивом, пытаемся его распарсить
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
    if (!user) return;
    
    try {
      const [achievements, userAchs, stats] = await Promise.all([
        achievementsAPI.getAllAchievements(),
        achievementsAPI.getUserAchievements(user.id),
        achievementsAPI.getUserStats(user.id),
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
    if (!user) return;
    
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
        const result = await achievementsAPI.trackAction(user.id, actionType);
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
      await achievementsAPI.trackAction(user.id, 'daily_activity');
    } catch (err) {
      console.error('Error tracking daily activity:', err);
    }
  };

  // Отслеживание просмотра расписания
  const trackScheduleView = async () => {
    if (!user || !userSettings) return;
    
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
      
      const result = await achievementsAPI.trackAction(user.id, 'view_schedule', {
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
    try {
      hapticFeedback('impact', 'medium');
      
      const settings = await userAPI.saveUserSettings({
        telegram_id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        ...groupData,
      });
      
      setUserSettings(settings);
      setShowGroupSelector(false);
      showAlert(t('common.groupSelected', { groupName: groupData.group_name }));

      // Отслеживаем выбор группы для достижений
      if (user) {
        try {
          const result = await achievementsAPI.trackAction(user.id, 'select_group');
          // Также отслеживаем просмотр группы
          await achievementsAPI.trackAction(user.id, 'view_group', { group_id: groupData.group_id });
          
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
    if (user) {
      try {
        const result = await achievementsAPI.trackAction(user.id, 'open_calendar');
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
    if (user) {
      try {
        const result = await achievementsAPI.trackAction(user.id, 'view_analytics');
        await achievementsAPI.trackAction(user.id, 'visit_menu_item', { menu_item: 'analytics' });
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
    if (user) {
      try {
        await achievementsAPI.trackAction(user.id, 'visit_menu_item', { menu_item: 'achievements' });
      } catch (err) {
        console.error('Error tracking achievements view:', err);
      }
    }
  };

  const handleNotificationsClick = async () => {
    hapticFeedback('impact', 'light');
    setIsNotificationSettingsOpen(true);
    
    // Отслеживаем посещение пункта меню уведомлений
    if (user) {
      try {
        await achievementsAPI.trackAction(user.id, 'visit_menu_item', { menu_item: 'notifications' });
      } catch (err) {
        console.error('Error tracking notifications view:', err);
      }
    }
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
    return (
      <>
        {renderNewYearTheme()}
        <WelcomeScreen onGetStarted={handleWelcomeGetStarted} />
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
      <UpcomingClassNotification schedule={schedule} />
      
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
          user={user}
          userSettings={userSettings}
          onAnalyticsClick={schedule.length > 0 ? handleAnalyticsClick : null}
          onAchievementsClick={user ? handleAchievementsClick : null}
          onNotificationsClick={user ? handleNotificationsClick : null}
          hapticFeedback={hapticFeedback}
          onMenuStateChange={setIsMenuOpen}
          onProfileStateChange={setIsProfileOpen}
          onThemeChange={handleThemeChange}
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
            />
          </div>
        )}
        
        <Suspense fallback={null}>
          <CalendarModal
            isOpen={isCalendarOpen}
            onClose={() => setIsCalendarOpen(false)}
            onDateSelect={handleDateSelect}
          />
        </Suspense>

        <Suspense fallback={null}>
          <AnalyticsModal
            isOpen={isAnalyticsOpen}
            onClose={() => setIsAnalyticsOpen(false)}
            schedule={schedule}
            userStats={userStats}
            hapticFeedback={hapticFeedback}
          />
        </Suspense>

        {user && (
          <Suspense fallback={null}>
            <NotificationSettings
              telegramId={user.id}
              onClose={() => setIsNotificationSettingsOpen(false)}
              hapticFeedback={hapticFeedback}
              showAlert={showAlert}
              isOpen={isNotificationSettingsOpen}
            />
          </Suspense>
        )}

        {user && (
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
        />
      )}

      {/* Fullscreen Player */}
      {!showGroupSelector && userSettings && (
        <FullscreenPlayer 
          isOpen={isFullscreenPlayerOpen}
          onClose={() => setIsFullscreenPlayerOpen(false)}
        />
      )}

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
    </div>
  );
};

function App() {
  return (
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
  );
}

export default App;
