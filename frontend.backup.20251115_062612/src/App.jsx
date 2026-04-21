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
import StatusTester from './StatusTester';
import { TelegramProvider, useTelegram } from './contexts/TelegramContext';
import { scheduleAPI, userAPI, achievementsAPI, tasksAPI } from './services/api';
import { getWeekNumberForDate } from './utils/dateUtils';
import { useTranslation } from 'react-i18next';
import './i18n/config';

// Lazy load модальных окон для уменьшения начального bundle
const CalendarModal = lazy(() => import('./components/CalendarModal').then(module => ({ default: module.CalendarModal })));
const AnalyticsModal = lazy(() => import('./components/AnalyticsModal').then(module => ({ default: module.AnalyticsModal })));
const AchievementsModal = lazy(() => import('./components/AchievementsModal').then(module => ({ default: module.AchievementsModal })));
const AchievementNotification = lazy(() => import('./components/AchievementNotification').then(module => ({ default: module.AchievementNotification })));
const NotificationSettings = lazy(() => import('./components/NotificationSettings'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

const Home = () => {
  const { user, isReady, showAlert, hapticFeedback } = useTelegram();
  const { t } = useTranslation();
  
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
  const [showGroupSelector, setShowGroupSelector] = useState(false);

  // Состояния для достижений
  const [allAchievements, setAllAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [newAchievement, setNewAchievement] = useState(null); // Для показа уведомления

  // Состояние для нижнего меню навигации (загружаем из localStorage)
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('activeTab');
    return savedTab || 'home';
  });
  
  // Состояние для отслеживания модального окна AddTaskModal из TasksSection
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  // Состояния для модальных окон в Header (для отслеживания)
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Состояние для модального окна ShareScheduleModal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Сохраняем activeTab в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Отслеживание всех модальных окон (кроме ProfileModal) для скрытия нижнего меню
  const isAnyModalOpen = 
    isCalendarOpen || 
    isAnalyticsOpen || 
    isAchievementsOpen || 
    isNotificationSettingsOpen ||
    isMenuOpen ||
    isShareModalOpen ||
    isAddTaskModalOpen; // from TasksSection's AddTaskModal

  // Загрузка данных пользователя при монтировании
  useEffect(() => {
    if (isReady && user) {
      loadUserData();
      loadAchievementsData();
      trackTimeBasedAchievements();
    }
  }, [isReady, user]);

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
      } else if (settings) {
        // Пользователь существует, но у него неполные настройки
        console.log('User has incomplete settings, showing group selector');
        setShowGroupSelector(true);
      } else {
        // Пользователь не найден
        setShowGroupSelector(true);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      // Если пользователь не найден (404), показываем селектор группы
      if (err.message === 'Пользователь не найден') {
        setShowGroupSelector(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

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
    
    // Ночной совенок (после 00:00)
    if (hour >= 0 && hour < 6) {
      actionType = 'night_usage';
    }
    // Утренняя пташка (до 08:00)
    else if (hour >= 5 && hour < 8) {
      actionType = 'early_usage';
    }
    
    if (actionType) {
      try {
        const result = await achievementsAPI.trackAction(user.id, actionType);
        if (result.new_achievements && result.new_achievements.length > 0) {
          // Показываем первое новое достижение
          setNewAchievement(result.new_achievements[0]);
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
        setNewAchievement(result.new_achievements[0]);
        loadAchievementsData();
      }
    } catch (err) {
      console.error('Error tracking schedule view:', err);
    }
  };

  // Отслеживание просмотра расписания при загрузке
  useEffect(() => {
    if (schedule.length > 0 && user) {
      trackScheduleView();
    }
  }, [schedule]);

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
            setNewAchievement(result.new_achievements[0]);
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
          setNewAchievement(result.new_achievements[0]);
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
          setNewAchievement(result.new_achievements[0]);
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

  // Показываем GroupSelector
  if (showGroupSelector) {
    return (
      <GroupSelector
        onGroupSelected={handleGroupSelected}
        onCancel={userSettings ? () => setShowGroupSelector(false) : null}
      />
    );
  }

  // Показываем экран загрузки
  if (loading && !userSettings) {
    return <LoadingScreen message={t('common.loading')} />;
  }

  // Показываем ошибку
  if (error && !userSettings) {
    return (
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
    );
  }

  return (
    <div className="h-full min-h-screen bg-background telegram-webapp relative">
      <TopGlow />
      
      {/* Adaptive container with responsive max-width */}
      <div className="relative mx-auto max-w-[430px] md:max-w-3xl lg:max-w-7xl 2xl:max-w-8xl px-0 pb-24" style={{ zIndex: 10 }}>
        {/* Header - full width */}
        <Header 
          user={user}
          userSettings={userSettings}
          onCalendarClick={handleCalendarClick}
          onAnalyticsClick={schedule.length > 0 ? handleAnalyticsClick : null}
          onAchievementsClick={user ? handleAchievementsClick : null}
          onNotificationsClick={user ? handleNotificationsClick : null}
          hapticFeedback={hapticFeedback}
          onMenuStateChange={setIsMenuOpen}
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
            />
          </div>
        )}

        {/* Раздел "Журнал" */}
        {activeTab === 'journal' && (
          <div className="px-4">
            <JournalSection />
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

        {newAchievement && (
          <Suspense fallback={null}>
            <AchievementNotification
              achievement={newAchievement}
              onClose={handleAchievementNotificationClose}
              hapticFeedback={hapticFeedback}
            />
          </Suspense>
        )}
        
        {/* Swipe hint - показывается один раз, скрывается через 10 секунд или при первом свайпе */}
        {!showGroupSelector && schedule.length > 0 && (
          <SwipeHint onSwipe={true} />
        )}
      </div>

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
      <TelegramProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/status-tester" element={<StatusTester />} />
          </Routes>
        </BrowserRouter>
      </TelegramProvider>
    </div>
  );
}

export default App;
