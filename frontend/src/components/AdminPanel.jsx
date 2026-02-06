import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, TrendingUp, Calendar, Award, 
  BarChart3, Clock, Activity, Star,
  BookOpen, Bell, Share2, CheckSquare, RefreshCw,
  Search, User, GraduationCap, FileText, Send, MessageSquare, Check,
  Megaphone, AlertCircle, Info, Gift, Sparkles, Zap, Home, Wifi, Circle,
  Globe, Smartphone, Monitor
} from 'lucide-react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Правильное определение backend URL
const getBackendURL = () => {
  let envBackendUrl = '';
  try {
    if (import.meta.env.VITE_BACKEND_URL) {
      envBackendUrl = import.meta.env.VITE_BACKEND_URL;
    } else if (import.meta.env.REACT_APP_BACKEND_URL) {
      envBackendUrl = import.meta.env.REACT_APP_BACKEND_URL;
    }
  } catch (error) {
    console.warn('Could not access environment variables:', error);
  }
  
  if (envBackendUrl && envBackendUrl.trim() !== '') return envBackendUrl;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:8001';
  return window.location.origin;
};

const BACKEND_URL = getBackendURL();

const AdminPanel = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('stats'); // 'stats', 'users', 'classes', 'notifications', 'online'
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // --- Online Users Data ---
  const [onlineData, setOnlineData] = useState(null);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const onlineIntervalRef = useRef(null);

  // --- Stats Data ---
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [generalStats, setGeneralStats] = useState(null);
  const [usersActivity, setUsersActivity] = useState([]);
  const [hourlyActivity, setHourlyActivity] = useState([]);
  const [weeklyActivity, setWeeklyActivity] = useState([]);
  const [featureUsage, setFeatureUsage] = useState(null);
  const [topUsers, setTopUsers] = useState([]);
  const [facultyStats, setFacultyStats] = useState([]);
  const [courseStats, setCourseStats] = useState([]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const daysParam = selectedPeriod ? `?days=${selectedPeriod}` : '';
      const [
        generalRes, activityRes, hourlyRes, weeklyRes,
        featureRes, topUsersRes, facultyRes, courseRes
      ] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/stats${daysParam}`),
        axios.get(`${BACKEND_URL}/api/admin/users-activity${daysParam}`),
        axios.get(`${BACKEND_URL}/api/admin/hourly-activity${daysParam}`),
        axios.get(`${BACKEND_URL}/api/admin/weekly-activity${daysParam}`),
        axios.get(`${BACKEND_URL}/api/admin/feature-usage${daysParam}`),
        axios.get(`${BACKEND_URL}/api/admin/top-users?metric=points&limit=10`),
        axios.get(`${BACKEND_URL}/api/admin/faculty-stats${daysParam}`),
        axios.get(`${BACKEND_URL}/api/admin/course-stats${daysParam}`)
      ]);

      setGeneralStats(generalRes.data);
      setUsersActivity(activityRes.data);
      setHourlyActivity(hourlyRes.data);
      setWeeklyActivity(weeklyRes.data);
      setFeatureUsage(featureRes.data);
      setTopUsers(topUsersRes.data);
      setFacultyStats(facultyRes.data);
      setCourseStats(courseRes.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
  };

  // Функция для получения онлайн пользователей
  const fetchOnlineUsers = useCallback(async () => {
    setOnlineLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/admin/online-users?minutes=5`);
      setOnlineData(response.data);
    } catch (error) {
      console.error('Ошибка загрузки онлайн пользователей:', error);
    } finally {
      setOnlineLoading(false);
    }
  }, []);

  // Автообновление онлайн данных каждые 5 секунд
  useEffect(() => {
    if (isOpen && activeTab === 'online') {
      fetchOnlineUsers();
      onlineIntervalRef.current = setInterval(fetchOnlineUsers, 5000);
    }
    
    return () => {
      if (onlineIntervalRef.current) {
        clearInterval(onlineIntervalRef.current);
      }
    };
  }, [isOpen, activeTab, fetchOnlineUsers]);

  useEffect(() => {
    if (isOpen && activeTab === 'stats') {
      fetchStats();
    }
  }, [isOpen, activeTab, selectedPeriod]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full sm:max-w-7xl h-[92vh] sm:max-h-[90vh] bg-gradient-to-br from-[#2B2B3A] to-[#1E1E28] rounded-t-[32px] sm:rounded-3xl shadow-2xl border-t border-white/10 sm:border overflow-hidden flex flex-col"
          style={{ touchAction: 'none' }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:p-6 flex-shrink-0">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Админ Панель</h2>
                    {lastUpdate && activeTab === 'stats' && (
                      <p className="text-xs text-gray-400">
                        Обновлено: {lastUpdate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {activeTab === 'stats' && (
                    <button
                      onClick={fetchStats}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      title="Обновить"
                    >
                      <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex p-1 bg-black/20 rounded-xl overflow-x-auto scrollbar-hide">
                <TabButton 
                  active={activeTab === 'online'} 
                  onClick={() => setActiveTab('online')} 
                  icon={<Wifi className="w-4 h-4" />}
                  label="Онлайн" 
                />
                <TabButton 
                  active={activeTab === 'stats'} 
                  onClick={() => setActiveTab('stats')} 
                  icon={<BarChart3 className="w-4 h-4" />}
                  label="Статистика" 
                />
                <TabButton 
                  active={activeTab === 'users'} 
                  onClick={() => setActiveTab('users')} 
                  icon={<Users className="w-4 h-4" />}
                  label="Студенты" 
                />
                <TabButton 
                  active={activeTab === 'classes'} 
                  onClick={() => setActiveTab('classes')} 
                  icon={<BookOpen className="w-4 h-4" />}
                  label="Занятия" 
                />
                <TabButton 
                  active={activeTab === 'notifications'} 
                  onClick={() => setActiveTab('notifications')} 
                  icon={<Bell className="w-4 h-4" />}
                  label="Уведомления" 
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden relative">
             {activeTab === 'online' && (
               <OnlineTab 
                 onlineData={onlineData} 
                 loading={onlineLoading} 
                 onRefresh={fetchOnlineUsers}
               />
             )}
             
             {activeTab === 'stats' && (
               <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-6">
                 {loading ? (
                    <LoadingSpinner />
                 ) : (
                   <>
                     <PeriodSelector selected={selectedPeriod} onSelect={setSelectedPeriod} />
                     <StatsContent 
                       generalStats={generalStats}
                       usersActivity={usersActivity}
                       hourlyActivity={hourlyActivity}
                       weeklyActivity={weeklyActivity}
                       featureUsage={featureUsage}
                       topUsers={topUsers}
                       facultyStats={facultyStats}
                       courseStats={courseStats}
                     />
                   </>
                 )}
               </div>
             )}
             
             {activeTab === 'users' && <UsersTab />}
             {activeTab === 'classes' && <ClassesTab />}
             {activeTab === 'notifications' && <NotificationsTab />}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// --- Sub-components ---

const TabButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex-shrink-0 flex-1 min-w-[70px] sm:min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
      active 
        ? 'bg-white/10 text-white shadow-sm' 
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    <span className="hidden xs:inline sm:inline">{label}</span>
  </button>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
  </div>
);

const PeriodSelector = ({ selected, onSelect }) => (
  <div className="flex justify-end gap-2 mb-4">
    {[7, 30, null].map((period) => (
      <button
        key={period || 'all'}
        onClick={() => onSelect(period)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          selected === period
            ? 'bg-purple-500 text-white'
            : 'bg-white/5 text-gray-400 hover:bg-white/10'
        }`}
      >
        {period ? `${period} дней` : 'Все время'}
      </button>
    ))}
  </div>
);

const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const searchTimerRef = useRef(null);

  // Debounce поиск
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const fetchUsers = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 0 : page;
      const skip = currentPage * 50;
      const res = await axios.get(`${BACKEND_URL}/api/admin/users`, {
        params: { limit: 50, skip, search: debouncedSearch || undefined }
      });
      
      if (reset) {
        setUsers(res.data);
        setPage(1);
      } else {
        setUsers(prev => [...prev, ...res.data]);
        setPage(prev => prev + 1);
      }
      setHasMore(res.data.length === 50);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchUsers(true);
  }, [debouncedSearch]); // Re-fetch on debounced search change

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 bg-[#2B2B3A]/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск студентов (имя, username, группа)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {users.map((user) => (
          <div key={user.id || user.telegram_id} className="bg-white/5 rounded-xl p-4 border border-white/5 flex items-center justify-between">
             <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">
                 {user.first_name?.[0]?.toUpperCase() || 'U'}
               </div>
               <div>
                 <div className="font-medium text-white">
                   {user.first_name} {user.last_name}
                   {user.username && <span className="text-gray-400 text-sm ml-2">@{user.username}</span>}
                 </div>
                 <div className="text-sm text-gray-500 flex items-center gap-3">
                   <span className="flex items-center gap-1">
                     <Users className="w-3 h-3" />
                     {user.group_name || 'Без группы'}
                   </span>
                   <span>•</span>
                   <span>ID: {user.telegram_id}</span>
                 </div>
               </div>
             </div>
             <div className="text-right">
               <div className="text-xs text-gray-500">Регистрация</div>
               <div className="text-sm text-gray-300">
                 {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
               </div>
             </div>
          </div>
        ))}
        
        {loading && <LoadingSpinner />}
        
        {!loading && users.length === 0 && (
          <div className="text-center text-gray-500 py-10">Студенты не найдены</div>
        )}
        
        {!loading && hasMore && (
          <button 
            onClick={() => fetchUsers(false)}
            className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 text-sm transition-colors"
          >
            Загрузить еще
          </button>
        )}
      </div>
    </div>
  );
};

const ClassesTab = () => {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef(null);
  
  // Debounce поиск
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const fetchJournals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/journals`, {
        params: { limit: 100, search: debouncedSearch || undefined }
      });
      setJournals(res.data);
    } catch (error) {
      console.error('Failed to fetch journals:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchJournals();
  }, [debouncedSearch]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 bg-[#2B2B3A]/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск предметов и групп..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {journals.map((journal) => (
          <div key={journal.journal_id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-purple-500/30 transition-all">
             <div className="flex items-start justify-between mb-3">
               <div className={`p-2 rounded-lg bg-${journal.color || 'purple'}-500/20 text-${journal.color || 'purple'}-400`}>
                 <BookOpen className="w-5 h-5" />
               </div>
               <div className="px-2 py-1 rounded bg-white/10 text-xs text-gray-300">
                 {journal.group_name}
               </div>
             </div>
             
             <h3 className="text-white font-medium mb-1 truncate">{journal.name}</h3>
             <p className="text-sm text-gray-500 line-clamp-2 h-10 mb-4">
               {journal.description || 'Нет описания'}
             </p>
             
             <div className="flex items-center justify-between text-sm text-gray-400 pt-3 border-t border-white/5">
               <div className="flex items-center gap-1.5">
                 <Users className="w-4 h-4" />
                 <span>{journal.total_students || 0}</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <Calendar className="w-4 h-4" />
                 <span>{journal.total_sessions || 0}</span>
               </div>
             </div>
          </div>
        ))}
        
        {loading && <div className="col-span-full"><LoadingSpinner /></div>}
        
        {!loading && journals.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-10">
            Журналы занятий не найдены
          </div>
        )}
      </div>
    </div>
  );
};

const StatsContent = ({ generalStats, usersActivity, hourlyActivity, weeklyActivity, featureUsage, topUsers, facultyStats, courseStats }) => {
  const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];
  
  return (
    <>
      {/* General Stats Cards */}
      {generalStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={<Users className="w-6 h-6" />}
            title="Всего пользователей"
            value={generalStats.total_users}
            subtitle={`Активных сегодня: ${formatNumber(generalStats.active_users_today)}`}
            color="from-purple-500 to-purple-600"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Новые за неделю"
            value={generalStats.new_users_week}
            subtitle={`За месяц: ${formatNumber(generalStats.new_users_month || 0)}`}
            color="from-pink-500 to-pink-600"
          />
          <StatCard
            icon={<CheckSquare className="w-6 h-6" />}
            title="Всего задач"
            value={generalStats.total_tasks}
            subtitle={`Выполнено: ${formatNumber(generalStats.total_completed_tasks)}`}
            color="from-yellow-500 to-orange-500"
          />
          <StatCard
            icon={<Award className="w-6 h-6" />}
            title="Достижений выдано"
            value={generalStats.total_achievements_earned}
            subtitle={`Комнат: ${formatNumber(generalStats.total_rooms)}`}
            color="from-cyan-500 to-blue-500"
          />
        </div>
      )}

      {/* User Registration Chart */}
      <ChartCard title="Регистрации пользователей" icon={<Users />}>
        {usersActivity.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={usersActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="date" stroke="#888" tick={{ fontSize: 11 }} />
              <YAxis stroke="#888" allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#2B2B3A',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px'
                }}
                formatter={(value) => [value, 'Регистраций']}
                labelFormatter={(label) => `Дата: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="Регистраций"
                stroke="#8B5CF6"
                strokeWidth={3}
                dot={{ fill: '#8B5CF6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
            Нет данных о регистрациях
          </div>
        )}
      </ChartCard>

      {/* Hourly and Weekly Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard title="Активность по часам" icon={<Clock />}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="hour" stroke="#888" tick={{ fontSize: 11 }} />
              <YAxis stroke="#888" allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#2B2B3A',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px'
                }}
                formatter={(value) => [value, 'Пользователей']}
                labelFormatter={(label) => `${label}:00`}
              />
              <Bar dataKey="count" name="Пользователей" fill="#EC4899" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Активность по дням недели" icon={<Calendar />}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="day" stroke="#888" tick={{ fontSize: 11 }} />
              <YAxis stroke="#888" allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#2B2B3A',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px'
                }}
                formatter={(value) => [value, 'Пользователей']}
              />
              <Bar dataKey="count" name="Пользователей" fill="#10B981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      
      {/* Feature Usage */}
      {featureUsage && (
        <ChartCard title="Использование функций" icon={<Activity />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FeatureStatCard icon={<BookOpen />} label="Расписание" value={featureUsage.schedule_views} color="text-purple-400" />
            <FeatureStatCard icon={<BarChart3 />} label="Аналитика" value={featureUsage.analytics_views} color="text-cyan-400" />
            <FeatureStatCard icon={<Calendar />} label="Календарь" value={featureUsage.calendar_opens} color="text-green-400" />
            <FeatureStatCard icon={<Bell />} label="Уведомления" value={featureUsage.notifications_configured} color="text-pink-400" />
          </div>
        </ChartCard>
      )}

      {/* Top Users and Faculty/Course Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Топ пользователей" icon={<Star />}>
          {topUsers.length > 0 ? (
            <div className="space-y-2">
              {topUsers.map((user, index) => (
                <div key={user.telegram_id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">{user.first_name}</div>
                      <div className="text-xs text-gray-500">{user.group_name}</div>
                    </div>
                  </div>
                  <div className="text-yellow-400 font-bold text-sm">{user.value}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-center text-gray-500 py-10">Нет данных</div>}
        </ChartCard>

        <ChartCard title="По факультетам" icon={<BookOpen />}>
          {facultyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={facultyStats.slice(0, 6)}
                  dataKey="users_count"
                  nameKey="faculty_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => {
                    const name = entry.faculty_name || 'Без факультета';
                    return name.length > 15 ? `${name.substring(0, 15)}…` : name;
                  }}
                >
                  {facultyStats.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#2B2B3A',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px'
                  }}
                  formatter={(value, name) => [formatNumber(value), 'Студентов']}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="text-center text-gray-500 py-10">Нет данных</div>}
        </ChartCard>
      </div>
    </>
  );
};

// Форматирование числа (1234 → "1 234")
const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const StatCard = ({ icon, title, value, subtitle, color }) => (
  <div className="relative overflow-hidden bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${color} opacity-10 rounded-full -mr-8 -mt-8`} />
    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${color} mb-4 text-white shadow-lg`}>
      {icon}
    </div>
    <div className="text-3xl font-bold text-white mb-1">{formatNumber(value)}</div>
    <div className="text-sm text-gray-400 mb-1">{title}</div>
    <div className="text-xs text-gray-500">{subtitle}</div>
  </div>
);

const ChartCard = ({ title, icon, children }) => (
  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl text-purple-400">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
    </div>
    {children}
  </div>
);

const FeatureStatCard = ({ icon, label, value, color }) => (
  <div className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
    <div className={color}>{icon}</div>
    <div className="text-2xl font-bold text-white">{formatNumber(value)}</div>
    <div className="text-xs text-gray-400 text-center">{label}</div>
  </div>
);

// --- Online Tab ---
const OnlineTab = ({ onlineData, loading, onRefresh }) => {
  return (
    <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header с кнопкой обновления */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
          </div>
          <h3 className="text-lg font-semibold text-white">Онлайн в реальном времени</h3>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm text-gray-300"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Обновить</span>
        </button>
      </div>

      {loading && !onlineData ? (
        <LoadingSpinner />
      ) : onlineData ? (
        <>
          {/* Статистика онлайн */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl p-4 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Circle className="w-4 h-4 text-green-400 fill-green-400" />
                <span className="text-xs text-green-400 font-medium">Сейчас</span>
              </div>
              <div className="text-3xl font-bold text-white">{onlineData.online_now || 0}</div>
              <div className="text-xs text-gray-400 mt-1">за {onlineData.threshold_minutes || 5} мин</div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl p-4 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-blue-400 font-medium">За час</span>
              </div>
              <div className="text-3xl font-bold text-white">{onlineData.online_last_hour || 0}</div>
              <div className="text-xs text-gray-400 mt-1">уникальных</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-purple-400 font-medium">За 24ч</span>
              </div>
              <div className="text-3xl font-bold text-white">{onlineData.online_last_day || 0}</div>
              <div className="text-xs text-gray-400 mt-1">уникальных</div>
            </div>
          </div>

          {/* Список пользователей онлайн */}
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-green-400" />
                Пользователи онлайн
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                  {onlineData.users?.length || 0}
                </span>
              </h4>
              <span className="text-xs text-gray-500">
                Обновлено: {new Date(onlineData.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto divide-y divide-white/5">
              {onlineData.users && onlineData.users.length > 0 ? (
                onlineData.users.map((user, index) => (
                  <motion.div
                    key={user.telegram_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
                  >
                    {/* Аватар */}
                    <div className="relative flex-shrink-0">
                      {user.photo_url ? (
                        <img 
                          src={user.photo_url} 
                          alt={user.first_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {(user.first_name?.[0] || '?').toUpperCase()}
                        </div>
                      )}
                      {/* Индикатор онлайн */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#2B2B3A]">
                        <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-50"></div>
                      </div>
                    </div>
                    
                    {/* Инфо */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">
                          {user.first_name} {user.last_name}
                        </span>
                        {user.username && (
                          <span className="text-xs text-gray-500 truncate">@{user.username}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {user.current_section && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                            {user.current_section === 'schedule' && '📅 Расписание'}
                            {user.current_section === 'tasks' && '✅ Задачи'}
                            {user.current_section === 'journal' && '📓 Журнал'}
                            {user.current_section === 'music' && '🎵 Музыка'}
                            {user.current_section === 'friends' && '👥 Друзья'}
                            {!['schedule', 'tasks', 'journal', 'music', 'friends'].includes(user.current_section) && user.current_section}
                          </span>
                        )}
                        {user.faculty && (
                          <span className="truncate">{user.faculty}</span>
                        )}
                        {user.course && (
                          <span>{user.course} курс</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Время активности */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs text-green-400 font-medium">
                        {user.activity_text}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        ID: {user.telegram_id}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Wifi className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Нет активных пользователей</p>
                  <p className="text-xs text-gray-600 mt-1">за последние {onlineData.threshold_minutes || 5} минут</p>
                </div>
              )}
            </div>
          </div>

          {/* Подсказка */}
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-300">
            <Info className="w-5 h-5 flex-shrink-0" />
            <span>Данные обновляются автоматически каждые 5 секунд. Пользователь считается онлайн, если был активен в течение последних {onlineData.threshold_minutes || 5} минут.</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Wifi className="w-16 h-16 mb-4 opacity-30" />
          <p>Не удалось загрузить данные</p>
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white text-sm transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      )}
    </div>
  );
};

// --- Notifications Tab ---
const NotificationsTab = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Форма уведомления
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('admin_message');
  const [notificationCategory, setNotificationCategory] = useState('system');
  const [sendInApp, setSendInApp] = useState(true);
  const [sendTelegram, setSendTelegram] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Типы уведомлений с иконками
  const NOTIFICATION_TYPES = [
    { id: 'admin_message', label: 'Сообщение', icon: Megaphone, color: 'purple', category: 'system' },
    { id: 'announcement', label: 'Объявление', icon: Bell, color: 'blue', category: 'system' },
    { id: 'app_update', label: 'Обновление', icon: Sparkles, color: 'cyan', category: 'system' },
    { id: 'schedule_changed', label: 'Расписание', icon: Calendar, color: 'orange', category: 'study' },
    { id: 'task_deadline', label: 'Дедлайн', icon: Clock, color: 'red', category: 'study' },
    { id: 'achievement_earned', label: 'Достижение', icon: Award, color: 'yellow', category: 'achievements' },
    { id: 'level_up', label: 'Уровень', icon: Star, color: 'amber', category: 'achievements' },
    { id: 'room_invite', label: 'Приглашение', icon: Home, color: 'green', category: 'rooms' },
  ];

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/users?limit=100`);
      setUsers(res.data || []);
      setFilteredUsers(res.data || []);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Поиск
  useEffect(() => {
    if (!search.trim()) {
      setFilteredUsers(users);
      return;
    }
    const q = search.toLowerCase();
    setFilteredUsers(users.filter(u => 
      (u.first_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.group_name || '').toLowerCase().includes(q) ||
      String(u.telegram_id).includes(q)
    ));
  }, [search, users]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSendResult(null);
  };

  const handleSendNotification = async () => {
    if (!selectedUser || (!notificationTitle.trim() && !notificationMessage.trim())) return;
    if (!sendInApp && !sendTelegram) return;

    setSending(true);
    setSendResult(null);

    const selectedType = NOTIFICATION_TYPES.find(t => t.id === notificationType);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/send-notification`, {
        telegram_id: selectedUser.telegram_id,
        title: notificationTitle.trim() || 'Уведомление',
        message: notificationMessage.trim(),
        notification_type: notificationType,
        category: selectedType?.category || 'system',
        send_in_app: sendInApp,
        send_telegram: sendTelegram
      });

      setSendResult({
        success: true,
        message: 'Уведомление отправлено!',
        details: res.data
      });

      // Очистить форму
      setNotificationTitle('');
      setNotificationMessage('');

    } catch (error) {
      console.error('Ошибка отправки:', error);
      setSendResult({
        success: false,
        message: error.response?.data?.detail || 'Ошибка отправки уведомления'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Левая колонка - выбор пользователя */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Выберите получателя
          </h3>

          {/* Поиск */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, username, группе или ID..."
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Список пользователей */}
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
              </div>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <motion.button
                  key={user.telegram_id}
                  onClick={() => handleSelectUser(user)}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    selectedUser?.telegram_id === user.telegram_id
                      ? 'bg-purple-500/20 border-2 border-purple-500/50'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">
                      {user.first_name || 'Нет имени'}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {user.username ? `@${user.username}` : ''} 
                      {user.group_name ? ` • ${user.group_name}` : ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {user.telegram_id}
                    </div>
                  </div>
                  {selectedUser?.telegram_id === user.telegram_id && (
                    <Check className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  )}
                </motion.button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                Пользователи не найдены
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка - форма уведомления */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            Отправить уведомление
          </h3>

          {selectedUser ? (
            <div className="space-y-4">
              {/* Выбранный пользователь */}
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <div className="text-sm text-purple-300">Получатель:</div>
                <div className="font-semibold text-white">
                  {selectedUser.first_name || 'Пользователь'} 
                  {selectedUser.username && <span className="text-gray-400"> (@{selectedUser.username})</span>}
                </div>
              </div>

              {/* Тип уведомления */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Тип уведомления</label>
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-1.5 sm:gap-2">
                  {NOTIFICATION_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = notificationType === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => {
                          setNotificationType(type.id);
                          setNotificationCategory(type.category);
                        }}
                        className={`flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-3 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-purple-500/30 ring-2 ring-purple-500'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isSelected ? 'text-purple-400' : 'text-gray-400'}`} />
                        <span className={`text-[10px] sm:text-xs leading-tight text-center ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Заголовок */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Заголовок</label>
                <input
                  type="text"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  placeholder="Заголовок уведомления"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* Сообщение */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Сообщение</label>
                <textarea
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  placeholder="Текст сообщения..."
                  rows={4}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none"
                />
              </div>

              {/* Опции отправки */}
              <div className="space-y-3">
                <label className="text-sm text-gray-400 block">Куда отправить</label>
                
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <input
                    type="checkbox"
                    checked={sendInApp}
                    onChange={(e) => setSendInApp(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 text-purple-500 focus:ring-purple-500 bg-white/10"
                  />
                  <Bell className="w-5 h-5 text-purple-400" />
                  <div>
                    <div className="text-white font-medium">В приложение</div>
                    <div className="text-xs text-gray-400">Появится в разделе уведомлений</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                  <input
                    type="checkbox"
                    checked={sendTelegram}
                    onChange={(e) => setSendTelegram(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-white/10"
                  />
                  <Send className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-white font-medium">В Telegram</div>
                    <div className="text-xs text-gray-400">Личное сообщение от бота</div>
                  </div>
                </label>
              </div>

              {/* Результат */}
              {sendResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl ${
                    sendResult.success 
                      ? 'bg-green-500/20 border border-green-500/30' 
                      : 'bg-red-500/20 border border-red-500/30'
                  }`}
                >
                  <div className={`font-medium ${sendResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {sendResult.success ? '✅' : '❌'} {sendResult.message}
                  </div>
                  {sendResult.details && (
                    <div className="text-xs text-gray-400 mt-1">
                      In-App: {sendResult.details.in_app_sent ? '✓' : '✗'} | 
                      Telegram: {sendResult.details.telegram_sent ? '✓' : '✗'}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Кнопка отправки */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSendNotification}
                disabled={sending || (!sendInApp && !sendTelegram) || (!notificationTitle.trim() && !notificationMessage.trim())}
                className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  sending || (!sendInApp && !sendTelegram) || (!notificationTitle.trim() && !notificationMessage.trim())
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                }`}
              >
                {sending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Отправить уведомление
                  </>
                )}
              </motion.button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <User className="w-16 h-16 mb-4 opacity-30" />
              <p>Выберите пользователя слева</p>
              <p className="text-sm text-gray-500 mt-1">для отправки уведомления</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
