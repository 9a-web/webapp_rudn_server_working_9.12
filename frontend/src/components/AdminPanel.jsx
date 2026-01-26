import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, TrendingUp, Calendar, Award, 
  BarChart3, Clock, Activity, Star,
  BookOpen, Bell, Share2, CheckSquare, RefreshCw,
  Search, User, GraduationCap, FileText, Send, MessageSquare, Check
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
  const [activeTab, setActiveTab] = useState('stats'); // 'stats', 'users', 'classes', 'notifications'
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

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
        axios.get(`${BACKEND_URL}/api/admin/faculty-stats`),
        axios.get(`${BACKEND_URL}/api/admin/course-stats`)
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
              <div className="flex p-1 bg-black/20 rounded-xl">
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
    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
      active 
        ? 'bg-white/10 text-white shadow-sm' 
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    {label}
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
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchUsers = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const skip = reset ? 0 : page * 50;
      const res = await axios.get(`${BACKEND_URL}/api/admin/users`, {
        params: { limit: 50, skip, search }
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
  }, [page, search]);

  useEffect(() => {
    fetchUsers(true);
  }, [search]); // Re-fetch on search change

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
  
  const fetchJournals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/journals`, {
        params: { limit: 100, search }
      });
      setJournals(res.data);
    } catch (error) {
      console.error('Failed to fetch journals:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchJournals();
  }, [search]);

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
            subtitle={`Сегодня: ${generalStats.active_users_today}`}
            color="from-purple-500 to-purple-600"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Новые пользователи"
            value={generalStats.new_users_week}
            subtitle={`За неделю`}
            color="from-pink-500 to-pink-600"
          />
          <StatCard
            icon={<CheckSquare className="w-6 h-6" />}
            title="Всего задач"
            value={generalStats.total_tasks}
            subtitle={`Выполнено: ${generalStats.total_completed_tasks}`}
            color="from-yellow-500 to-orange-500"
          />
          <StatCard
            icon={<Award className="w-6 h-6" />}
            title="Достижений"
            value={generalStats.total_achievements_earned}
            subtitle={`Комнат: ${generalStats.total_rooms}`}
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
              <XAxis dataKey="date" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#2B2B3A',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px'
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
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
              <XAxis dataKey="hour" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#2B2B3A',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px'
                }}
              />
              <Bar dataKey="count" fill="#EC4899" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Активность по дням недели" icon={<Calendar />}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="day" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#2B2B3A',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px'
                }}
              />
              <Bar dataKey="count" fill="#10B981" radius={[8, 8, 0, 0]} />
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
                  label={(entry) => `${entry.faculty_name.substring(0, 15)}...`}
                >
                  {facultyStats.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="text-center text-gray-500 py-10">Нет данных</div>}
        </ChartCard>
      </div>
    </>
  );
};

const StatCard = ({ icon, title, value, subtitle, color }) => (
  <div className="relative overflow-hidden bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${color} opacity-10 rounded-full -mr-8 -mt-8`} />
    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${color} mb-4 text-white shadow-lg`}>
      {icon}
    </div>
    <div className="text-3xl font-bold text-white mb-1">{value}</div>
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
    <div className="text-2xl font-bold text-white">{value}</div>
    <div className="text-xs text-gray-400 text-center">{label}</div>
  </div>
);

export default AdminPanel;
