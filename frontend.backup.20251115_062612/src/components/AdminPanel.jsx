import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, TrendingUp, Calendar, Award, 
  BarChart3, Clock, Activity, Star,
  BookOpen, Bell, Share2, CheckSquare, RefreshCw
} from 'lucide-react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Правильное определение backend URL для админ панели
const getBackendURL = () => {
  // Для локальной разработки
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8001';
  }
  // Для production - используем текущий origin (domain)
  return window.location.origin;
};

const BACKEND_URL = getBackendURL();

const AdminPanel = ({ isOpen, onClose }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(30); // 7, 30, или null (все время)
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Данные статистики
  const [generalStats, setGeneralStats] = useState(null);
  const [usersActivity, setUsersActivity] = useState([]);
  const [hourlyActivity, setHourlyActivity] = useState([]);
  const [weeklyActivity, setWeeklyActivity] = useState([]);
  const [featureUsage, setFeatureUsage] = useState(null);
  const [topUsers, setTopUsers] = useState([]);
  const [facultyStats, setFacultyStats] = useState([]);
  const [courseStats, setCourseStats] = useState([]);

  // Загрузка данных
  const fetchData = async () => {
    setLoading(true);
    try {
      const daysParam = selectedPeriod ? `?days=${selectedPeriod}` : '';
      
      // Параллельная загрузка всех данных
      const [
        generalRes,
        activityRes,
        hourlyRes,
        weeklyRes,
        featureRes,
        topUsersRes,
        facultyRes,
        courseRes
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
      console.error('Ошибка загрузки данных админ панели:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Принудительная загрузка данных каждый раз при открытии
      fetchData();
    }
  }, [isOpen, selectedPeriod]);

  // Дополнительно: перезагрузка при повторном открытии
  useEffect(() => {
    if (isOpen) {
      // Сбрасываем состояние для индикации загрузки
      setLoading(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel - Mobile: full width bottom sheet, Desktop: centered modal */}
        <motion.div
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full sm:max-w-7xl h-[92vh] sm:max-h-[90vh] bg-gradient-to-br from-[#2B2B3A] to-[#1E1E28] rounded-t-[32px] sm:rounded-3xl shadow-2xl border-t border-white/10 sm:border overflow-hidden"
          style={{ touchAction: 'none' }}
        >
          {/* Drag Indicator (Mobile Only) */}
          <div className="sm:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-white/20 rounded-full"></div>
          </div>

          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg sm:rounded-xl">
                    <BarChart3 className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold text-white">Админ Панель</h2>
                    <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">
                      Статистика и аналитика
                      {lastUpdate && (
                        <span className="ml-2 text-xs text-gray-500">
                          • {lastUpdate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Close Button (Mobile) */}
                <button
                  onClick={onClose}
                  className="sm:hidden p-2 active:bg-white/10 rounded-xl transition-all"
                  style={{ touchAction: 'manipulation' }}
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Period Selector and Refresh Button */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {/* Refresh Button */}
                <button
                  onClick={() => fetchData()}
                  disabled={loading}
                  className="flex-shrink-0 p-2 bg-white/5 active:bg-white/10 sm:hover:bg-white/10 rounded-lg sm:rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Обновить данные"
                  style={{ touchAction: 'manipulation' }}
                >
                  <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
                
                <button
                  onClick={() => setSelectedPeriod(7)}
                  className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    selectedPeriod === 7
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-white/5 text-gray-400 active:bg-white/10 sm:hover:bg-white/10'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  7 дней
                </button>
                <button
                  onClick={() => setSelectedPeriod(30)}
                  className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    selectedPeriod === 30
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-white/5 text-gray-400 active:bg-white/10 sm:hover:bg-white/10'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  30 дней
                </button>
                <button
                  onClick={() => setSelectedPeriod(null)}
                  className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    selectedPeriod === null
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-white/5 text-gray-400 active:bg-white/10 sm:hover:bg-white/10'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  Все время
                </button>
              </div>

              {/* Close Button (Desktop) */}
              <button
                onClick={onClose}
                className="hidden sm:block p-2 hover:bg-white/10 rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto h-[calc(92vh-120px)] sm:max-h-[calc(90vh-120px)] px-4 py-4 sm:p-6 space-y-4 sm:space-y-6 overscroll-contain">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-purple-500 border-t-transparent"></div>
              </div>
            ) : (
              <>
                {/* General Stats Cards */}
                {generalStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                      title="Достижений получено"
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
                  {/* Hourly Activity */}
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

                  {/* Weekly Activity */}
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
                      <FeatureStatCard
                        icon={<BookOpen />}
                        label="Просмотры расписания"
                        value={featureUsage.schedule_views}
                        color="text-purple-400"
                      />
                      <FeatureStatCard
                        icon={<BarChart3 />}
                        label="Просмотры аналитики"
                        value={featureUsage.analytics_views}
                        color="text-cyan-400"
                      />
                      <FeatureStatCard
                        icon={<Calendar />}
                        label="Открытия календаря"
                        value={featureUsage.calendar_opens}
                        color="text-green-400"
                      />
                      <FeatureStatCard
                        icon={<Bell />}
                        label="Настроек уведомлений"
                        value={featureUsage.notifications_configured}
                        color="text-pink-400"
                      />
                      <FeatureStatCard
                        icon={<Share2 />}
                        label="Поделились расписанием"
                        value={featureUsage.schedule_shares}
                        color="text-yellow-400"
                      />
                      <FeatureStatCard
                        icon={<CheckSquare />}
                        label="Создано задач"
                        value={featureUsage.tasks_created}
                        color="text-orange-400"
                      />
                      <FeatureStatCard
                        icon={<Award />}
                        label="Получено достижений"
                        value={featureUsage.achievements_earned}
                        color="text-blue-400"
                      />
                    </div>
                  </ChartCard>
                )}

                {/* Top Users and Faculty/Course Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Users */}
                  <ChartCard title="Топ пользователей (по очкам)" icon={<Star />}>
                    {topUsers.length > 0 ? (
                      <div className="space-y-2">
                        {topUsers.map((user, index) => (
                          <div
                            key={user.telegram_id}
                            className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                index === 0 ? 'bg-yellow-500 text-black' :
                                index === 1 ? 'bg-gray-400 text-black' :
                                index === 2 ? 'bg-orange-600 text-white' :
                                'bg-white/10 text-gray-400'
                              }`}>
                                {index + 1}
                              </div>
                              <div>
                                <div className="text-white font-medium">
                                  {user.first_name || 'Неизвестно'}
                                  {user.username && <span className="text-gray-400 text-sm ml-2">@{user.username}</span>}
                                </div>
                                <div className="text-xs text-gray-500">{user.group_name || 'Группа не указана'}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Star className="w-4 h-4 text-yellow-400" />
                              <span className="text-white font-bold">{user.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-gray-500">
                        Нет активных пользователей
                      </div>
                    )}
                  </ChartCard>

                  {/* Faculty Stats */}
                  <ChartCard title="Распределение по факультетам" icon={<BookOpen />}>
                    {facultyStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={facultyStats.slice(0, 6)}
                            dataKey="users_count"
                            nameKey="faculty_name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={(entry) => `${entry.faculty_name}: ${entry.users_count}`}
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
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-gray-500">
                        Нет данных о факультетах
                      </div>
                    )}
                  </ChartCard>
                </div>

                {/* Course Distribution */}
                <ChartCard title="Распределение по курсам" icon={<TrendingUp />}>
                  {courseStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={courseStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                        <XAxis dataKey="course" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#2B2B3A',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px'
                          }}
                        />
                        <Bar dataKey="users_count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-gray-500">
                      Нет данных о курсах
                    </div>
                  )}
                </ChartCard>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Helper Components
const StatCard = ({ icon, title, value, subtitle, color }) => (
  <div className="relative overflow-hidden bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${color} opacity-10 rounded-full -mr-8 -mt-8`} />
    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${color} mb-4`}>
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
