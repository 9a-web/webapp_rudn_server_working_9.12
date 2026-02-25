import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, TrendingUp, Calendar, Award, 
  BarChart3, Clock, Activity, Star,
  BookOpen, Bell, Share2, CheckSquare, RefreshCw,
  Search, User, GraduationCap, FileText, Send, MessageSquare, Check,
  Megaphone, AlertCircle, Info, Gift, Sparkles, Zap, Home, Wifi, Circle,
  Globe, Smartphone, Monitor, ArrowUpRight, ArrowDownRight, Layers, Eye, Copy, ChevronRight,
  Server, Cpu, HardDrive, Database, MemoryStick, Gauge
} from 'lucide-react';
import axios from 'axios';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadialBarChart, RadialBar
} from 'recharts';
import { getBackendURL } from '../utils/config';

const BACKEND_URL = getBackendURL();

// =============================================
// GLASSMORPHISM DESIGN SYSTEM
// =============================================

const GLASS = {
  card: 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
  cardHover: 'hover:bg-white/[0.07] hover:border-white/[0.12] hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]',
  cardActive: 'bg-white/[0.08] backdrop-blur-xl border border-white/[0.15] shadow-[0_8px_40px_rgba(139,92,246,0.15)]',
  input: 'bg-white/[0.05] backdrop-blur-lg border border-white/[0.08] focus:border-purple-500/40 focus:bg-white/[0.08] focus:shadow-[0_0_20px_rgba(139,92,246,0.1)]',
  header: 'bg-white/[0.03] backdrop-blur-2xl border-b border-white/[0.06]',
  tooltip: { backgroundColor: 'rgba(15, 15, 25, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
};

const GRADIENTS = {
  purple: 'from-purple-500 to-violet-600',
  pink: 'from-pink-500 to-rose-600',
  blue: 'from-blue-500 to-cyan-500',
  green: 'from-emerald-500 to-teal-500',
  orange: 'from-orange-500 to-amber-500',
  cyan: 'from-cyan-400 to-blue-500',
};

const CHART_COLORS = {
  primary: '#a78bfa',
  secondary: '#f472b6',
  tertiary: '#34d399',
  quaternary: '#fbbf24',
  fifth: '#60a5fa',
  sixth: '#f87171',
};

const PIE_COLORS = ['#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#f87171', '#c084fc', '#fb923c'];

// =============================================
// ANIMATED NUMBER
// =============================================
const AnimatedNumber = ({ value, duration = 1200 }) => {
  const [display, setDisplay] = useState(0);
  const num = typeof value === 'number' ? value : parseInt(value, 10) || 0;
  
  useEffect(() => {
    if (num === 0) { setDisplay(0); return; }
    let start = 0;
    const step = Math.ceil(num / (duration / 16));
    const interval = setInterval(() => {
      start += step;
      if (start >= num) { setDisplay(num); clearInterval(interval); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(interval);
  }, [num, duration]);
  
  return <>{formatNumber(display)}</>;
};

// Format number with spaces
const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

// =============================================
// CUSTOM CHART TOOLTIP
// =============================================
const GlassTooltip = ({ active, payload, label, formatter, labelFormatter }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={GLASS.tooltip} className="px-4 py-3 min-w-[140px]">
      <p className="text-[11px] text-gray-400 mb-1.5 font-medium">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke }} />
          <span className="text-white font-semibold text-sm">
            {formatter ? formatter(entry.value, entry.name)[0] : entry.value}
          </span>
          <span className="text-gray-400 text-[11px]">
            {formatter ? formatter(entry.value, entry.name)[1] : entry.name}
          </span>
        </div>
      ))}
    </div>
  );
};

// =============================================
// MAIN ADMIN PANEL
// =============================================
const AdminPanel = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const [onlineData, setOnlineData] = useState(null);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const onlineIntervalRef = useRef(null);

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
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlineUsers = useCallback(async () => {
    setOnlineLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/admin/online-users?minutes=5`);
      setOnlineData(response.data);
    } catch (error) {
      console.error('Error loading online users:', error);
    } finally {
      setOnlineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'online') {
      fetchOnlineUsers();
      onlineIntervalRef.current = setInterval(fetchOnlineUsers, 5000);
    }
    return () => {
      if (onlineIntervalRef.current) clearInterval(onlineIntervalRef.current);
    };
  }, [isOpen, activeTab, fetchOnlineUsers]);

  useEffect(() => {
    if (isOpen && activeTab === 'stats') fetchStats();
  }, [isOpen, activeTab, selectedPeriod]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'online', icon: <Wifi className="w-4 h-4" />, label: 'Онлайн', glow: 'green' },
    { id: 'stats', icon: <BarChart3 className="w-4 h-4" />, label: 'Статистика', glow: 'purple' },
    { id: 'referrals', icon: <Share2 className="w-4 h-4" />, label: 'Рефералы', glow: 'pink' },
    { id: 'server', icon: <Server className="w-4 h-4" />, label: 'Сервер', glow: 'cyan' },
    { id: 'users', icon: <Users className="w-4 h-4" />, label: 'Пользователи', glow: 'blue' },
    { id: 'visits', icon: <Globe className="w-4 h-4" />, label: 'Посещения', glow: 'orange' },
    { id: 'classes', icon: <BookOpen className="w-4 h-4" />, label: 'Занятия', glow: 'orange' },
    { id: 'notifications', icon: <Bell className="w-4 h-4" />, label: 'Уведомления', glow: 'pink' },
    { id: 'tg-notify', icon: <Bell className="w-4 h-4" />, label: 'TG Посты', glow: 'blue' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Main Container */}
        <motion.div
          initial={{ opacity: 0, y: '100%', scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: '100%', scale: 0.95 }}
          transition={{ type: 'spring', damping: 32, stiffness: 300 }}
          className="relative w-full sm:max-w-7xl h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col rounded-t-[28px] sm:rounded-[24px]"
          style={{ touchAction: 'none' }}
        >
          {/* Glassmorphic Background */}
          <div className="absolute inset-0 bg-[#0c0c18]" />
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10" />
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-purple-600/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px]" />
          <div className="absolute inset-0 border border-white/[0.06] rounded-t-[28px] sm:rounded-[24px] pointer-events-none" />

          {/* Header */}
          <div className={`relative z-10 ${GLASS.header} px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0`}>
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl blur-md opacity-50" />
                    <div className="relative p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                      <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Панель управления</h2>
                    {lastUpdate && activeTab === 'stats' && (
                      <p className="text-[11px] text-gray-500 font-medium">
                        Обновлено: {lastUpdate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {activeTab === 'stats' && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={fetchStats}
                      className={`p-2.5 ${GLASS.card} rounded-xl transition-all duration-300 ${GLASS.cardHover}`}
                    >
                      <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </motion.button>
                  )}
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose} 
                    className={`p-2.5 ${GLASS.card} rounded-xl transition-all duration-300 ${GLASS.cardHover}`}
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </motion.button>
                </div>
              </div>

              {/* Glass Tab Navigation */}
              <div className="flex p-1 bg-white/[0.03] backdrop-blur-lg rounded-2xl border border-white/[0.05] overflow-x-auto scrollbar-hide gap-0.5">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <motion.button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      whileTap={{ scale: 0.95 }}
                      className={`relative flex-shrink-0 flex-1 min-w-[65px] flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 ${
                        isActive 
                          ? 'text-white' 
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className={`absolute inset-0 bg-white/[0.08] backdrop-blur-sm rounded-xl border border-white/[0.1] shadow-[0_0_20px_rgba(139,92,246,0.1)]`}
                          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        />
                      )}
                      <span className="relative z-10">{tab.icon}</span>
                      <span className="relative z-10 hidden xs:inline sm:inline">{tab.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 flex-1 overflow-hidden">
            {activeTab === 'online' && (
              <OnlineTab onlineData={onlineData} loading={onlineLoading} onRefresh={fetchOnlineUsers} />
            )}
            {activeTab === 'stats' && (
              <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-5">
                {loading ? <GlassLoader /> : (
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
            {activeTab === 'visits' && <VisitsTab />}
            {activeTab === 'classes' && <ClassesTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'referrals' && <ReferralLinksTab />}
            {activeTab === 'server' && <ServerTab onlineData={onlineData} />}
            {activeTab === 'tg-notify' && <TelegramPostNotifyTab />}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// =============================================
// GLASS LOADER
// =============================================
const GlassLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="relative">
      <div className="w-14 h-14 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
      <div className="absolute inset-2 rounded-full border-2 border-pink-500/20 border-b-pink-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
    </div>
  </div>
);

// =============================================
// PERIOD SELECTOR
// =============================================
const PeriodSelector = ({ selected, onSelect }) => (
  <div className="flex justify-end gap-1.5">
    {[
      { val: 7, label: '7 дней' },
      { val: 30, label: '30 дней' },
      { val: null, label: 'Все' },
    ].map(({ val, label }) => (
      <motion.button
        key={val || 'all'}
        whileTap={{ scale: 0.95 }}
        onClick={() => onSelect(val)}
        className={`relative px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
          selected === val
            ? 'text-white'
            : 'text-gray-500 hover:text-gray-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05]'
        }`}
      >
        {selected === val && (
          <motion.div
            layoutId="periodSelector"
            className="absolute inset-0 bg-gradient-to-r from-purple-600/80 to-pink-600/80 rounded-xl shadow-[0_0_24px_rgba(139,92,246,0.3)]"
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          />
        )}
        <span className="relative z-10">{label}</span>
      </motion.button>
    ))}
  </div>
);

// =============================================
// STAT CARD (Glass)
// =============================================
const GlassStatCard = ({ icon, title, value, subtitle, gradientFrom, gradientTo, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1, duration: 0.5 }}
    className={`relative group overflow-hidden ${GLASS.card} rounded-2xl p-5 transition-all duration-500 ${GLASS.cardHover}`}
  >
    {/* Gradient glow blob */}
    <div className={`absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-full opacity-[0.08] group-hover:opacity-[0.15] blur-2xl transition-opacity duration-500`} />
    
    <div className="relative z-10">
      <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${gradientFrom} ${gradientTo} mb-3.5 shadow-lg`}>
        {icon}
      </div>
      <div className="text-[28px] sm:text-3xl font-bold text-white tracking-tight mb-0.5">
        <AnimatedNumber value={value} />
      </div>
      <div className="text-sm text-gray-400 font-medium mb-0.5">{title}</div>
      <div className="text-[11px] text-gray-600">{subtitle}</div>
    </div>
  </motion.div>
);

// =============================================
// CHART CARD (Glass)
// =============================================
const GlassChartCard = ({ title, icon, children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className={`${GLASS.card} rounded-2xl p-5 sm:p-6 transition-all duration-300 ${className}`}
  >
    <div className="flex items-center gap-2.5 mb-5">
      <div className="p-2 bg-gradient-to-br from-purple-500/15 to-pink-500/15 rounded-xl text-purple-400 backdrop-blur-sm border border-purple-500/10">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-white tracking-tight">{title}</h3>
    </div>
    {children}
  </motion.div>
);

// =============================================
// TELEGRAM CHANNEL STATS
// =============================================
const ChannelStatsCard = () => {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyDelta, setHistoryDelta] = useState(0);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(168); // 7 days default

  // Fetch channel info
  useEffect(() => {
    let cancelled = false;
    axios.get(`${BACKEND_URL}/api/admin/channel-stats`)
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch history on period change
  useEffect(() => {
    let cancelled = false;
    axios.get(`${BACKEND_URL}/api/admin/channel-stats-history`, { params: { hours: period } })
      .then(res => {
        if (cancelled) return;
        const pts = (res.data.history || []).map(p => ({
          time: new Date(p.timestamp).getTime(),
          count: p.member_count,
          label: new Date(p.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' }),
        }));
        setHistory(pts);
        setHistoryDelta(res.data.delta || 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [period]);

  if (loading) return null;
  if (!data) return null;

  const periods = [
    { value: 24, label: '24ч' },
    { value: 72, label: '3д' },
    { value: 168, label: '7д' },
    { value: 720, label: '30д' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${GLASS.card} rounded-2xl p-5 relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#2AABEE]/10 to-blue-600/10 rounded-full blur-3xl" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10 mb-4">
        <h3 className="text-sm font-semibold text-[#2AABEE] flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.63 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.88 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.47-.01.06.01.24 0 .37z"/>
          </svg>
          Telegram-канал
        </h3>
        <a
          href={`https://t.me/${data.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#2AABEE] hover:text-[#2AABEE]/80 transition-colors flex items-center gap-1 font-medium"
        >
          @{data.username} <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {/* Channel info row */}
      <div className="flex items-center gap-4 relative z-10 mb-5">
        <div className="flex-shrink-0 w-14 h-14 rounded-2xl overflow-hidden border border-[#2AABEE]/20">
          {data.photo_url ? (
            <img src={data.photo_url} alt={data.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#2AABEE]/20 to-blue-600/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.63 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.88 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.47-.01.06.01.24 0 .37z"/>
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-base truncate">{data.title}</div>
          <div className="text-[11px] text-gray-500 mt-0.5 truncate">{data.description}</div>
        </div>
        <div className="flex-shrink-0 text-center px-3">
          <div className="text-3xl font-bold text-white"><AnimatedNumber value={data.member_count} /></div>
          <div className="text-[10px] text-gray-500 font-medium mt-0.5">подписчиков</div>
        </div>
      </div>

      {/* Period selector + delta */}
      <div className="flex items-center justify-between relative z-10 mb-3">
        <div className="flex gap-1.5">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 border ${
                period === p.value
                  ? 'bg-[#2AABEE]/15 border-[#2AABEE]/30 text-[#2AABEE]'
                  : 'border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {historyDelta !== 0 && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
            historyDelta > 0
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            {historyDelta > 0 ? '+' : ''}{historyDelta}
          </span>
        )}
      </div>

      {/* Chart */}
      {history.length > 1 && (
        <div className="relative z-10" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="channelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2AABEE" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2AABEE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#555', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: '#555', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={['dataMin - 2', 'dataMax + 2']}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(20,20,35,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(20px)',
                  fontSize: '12px',
                  color: 'white',
                }}
                labelStyle={{ color: '#888' }}
                formatter={(value) => [`${value} подп.`, 'Подписчики']}
                labelFormatter={(_, payload) => {
                  if (payload?.[0]?.payload?.time) {
                    return new Date(payload[0].payload.time).toLocaleString('ru-RU', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow'
                    });
                  }
                  return '';
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#2AABEE"
                strokeWidth={2}
                fill="url(#channelGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#2AABEE', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {history.length <= 1 && !loading && (
        <div className="text-center text-gray-600 text-[11px] py-6 relative z-10">
          Данные собираются... График появится через некоторое время.
        </div>
      )}
    </motion.div>
  );
};

// =============================================
// STATS CONTENT
// =============================================
const StatsContent = ({ generalStats, usersActivity, hourlyActivity, weeklyActivity, featureUsage, topUsers, facultyStats, courseStats }) => {
  return (
    <>
      {/* Telegram Channel Stats */}
      <ChannelStatsCard />

      {/* KPI Cards */}
      {generalStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <GlassStatCard
            icon={<Users className="w-5 h-5 text-white" />}
            title="Пользователи"
            value={generalStats.telegram_users || 0}
            subtitle={`Сегодня: +${formatNumber(generalStats.new_users_today || 0)}`}
            gradientFrom="from-purple-500" gradientTo="to-violet-600"
            delay={0}
          />
          <GlassStatCard
            icon={<Globe className="w-5 h-5 text-white" />}
            title="Веб-посетители"
            value={generalStats.web_guest_users || 0}
            subtitle={`Веб-сессий: ${formatNumber(generalStats.web_sessions_total || 0)}`}
            gradientFrom="from-teal-500" gradientTo="to-cyan-600"
            delay={1}
          />
          <GlassStatCard
            icon={<TrendingUp className="w-5 h-5 text-white" />}
            title="Новые за неделю"
            value={generalStats.new_users_week}
            subtitle={`За месяц: ${formatNumber(generalStats.new_users_month || 0)}`}
            gradientFrom="from-pink-500" gradientTo="to-rose-600"
            delay={2}
          />
          <GlassStatCard
            icon={<CheckSquare className="w-5 h-5 text-white" />}
            title="Задачи"
            value={generalStats.total_tasks}
            subtitle={`Выполнено: ${formatNumber(generalStats.total_completed_tasks)}`}
            gradientFrom="from-amber-500" gradientTo="to-orange-600"
            delay={3}
          />
          <GlassStatCard
            icon={<Award className="w-5 h-5 text-white" />}
            title="Достижения"
            value={generalStats.total_achievements_earned}
            subtitle={`Комнат: ${formatNumber(generalStats.total_rooms)}`}
            gradientFrom="from-cyan-500" gradientTo="to-blue-600"
            delay={4}
          />
        </div>
      )}

      {/* Web Sessions Glass Card */}
      {generalStats && (generalStats.web_sessions_total > 0 || generalStats.web_unique_users > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${GLASS.card} rounded-2xl p-5 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-teal-500/10 to-blue-500/10 rounded-full blur-3xl" />
          <h3 className="text-sm font-semibold text-teal-400 mb-4 flex items-center gap-2 relative z-10">
            <Globe className="w-4 h-4" /> Веб-версия
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
            {[
              { val: generalStats.web_sessions_total, label: 'Веб-сессий', color: 'text-white' },
              { val: generalStats.web_sessions_active, label: 'Сейчас онлайн', color: 'text-emerald-400' },
              { val: generalStats.web_unique_users, label: 'Уникальных', color: 'text-white' },
              { val: generalStats.web_users_today, label: 'Сегодня', color: 'text-white' },
            ].map((item, i) => (
              <div key={i} className="bg-white/[0.04] backdrop-blur-sm rounded-xl p-3 text-center border border-white/[0.05]">
                <div className={`text-2xl font-bold ${item.color}`}><AnimatedNumber value={item.val} /></div>
                <div className="text-[11px] text-gray-500 mt-1 font-medium">{item.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Registration Area Chart */}
      <GlassChartCard title="Регистрации пользователей" icon={<Users className="w-4 h-4" />}>
        {usersActivity.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={usersActivity} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="linePurple" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis stroke="transparent" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<GlassTooltip formatter={(v) => [v, 'Регистраций']} labelFormatter={(l) => `Дата: ${l}`} />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="url(#linePurple)"
                strokeWidth={2.5}
                fill="url(#gradPurple)"
                dot={{ fill: '#a78bfa', stroke: '#0c0c18', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#c084fc', stroke: '#0c0c18', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart text="Нет данных о регистрациях" />
        )}
      </GlassChartCard>

      {/* Hourly & Weekly Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassChartCard title="Активность по часам" icon={<Clock className="w-4 h-4" />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyActivity} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPink" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f472b6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="hour" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<GlassTooltip formatter={(v) => [v, 'Пользователей']} labelFormatter={(l) => `${l}:00`} />} />
              <Bar dataKey="count" fill="url(#gradPink)" radius={[6, 6, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </GlassChartCard>

        <GlassChartCard title="Активность по дням" icon={<Calendar className="w-4 h-4" />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyActivity} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="day" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<GlassTooltip formatter={(v) => [v, 'Пользователей']} />} />
              <Bar dataKey="count" fill="url(#gradGreen)" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </GlassChartCard>
      </div>
      
      {/* Feature Usage Glass Cards */}
      {featureUsage && (
        <GlassChartCard title="Использование функций" icon={<Activity className="w-4 h-4" />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: <Eye className="w-5 h-5" />, label: 'Расписание', value: featureUsage.schedule_views, grad: GRADIENTS.purple },
              { icon: <BarChart3 className="w-5 h-5" />, label: 'Аналитика', value: featureUsage.analytics_views, grad: GRADIENTS.cyan },
              { icon: <Calendar className="w-5 h-5" />, label: 'Календарь', value: featureUsage.calendar_opens, grad: GRADIENTS.green },
              { icon: <Bell className="w-5 h-5" />, label: 'Уведомления', value: featureUsage.notifications_configured, grad: GRADIENTS.pink },
            ].map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                className="relative group overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-xl p-4 border border-white/[0.06] hover:bg-white/[0.06] transition-all duration-300"
              >
                <div className={`absolute -bottom-4 -right-4 w-16 h-16 bg-gradient-to-br ${feat.grad} rounded-full opacity-[0.08] group-hover:opacity-[0.15] blur-xl transition-opacity`} />
                <div className={`text-transparent bg-clip-text bg-gradient-to-r ${feat.grad} mb-2`}>{React.cloneElement(feat.icon, { className: `w-5 h-5 text-current` })}</div>
                <div className={`inline-block mb-1`}>
                  <span className={`bg-gradient-to-r ${feat.grad} bg-clip-text`}>
                    {React.cloneElement(feat.icon, { className: 'w-5 h-5', style: { display: 'none' } })}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white"><AnimatedNumber value={feat.value} /></div>
                <div className="text-[11px] text-gray-500 font-medium mt-0.5">{feat.label}</div>
              </motion.div>
            ))}
          </div>
        </GlassChartCard>
      )}

      {/* Top Users & Faculty Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Users */}
        <GlassChartCard title="Топ пользователей" icon={<Star className="w-4 h-4" />}>
          {topUsers.length > 0 ? (
            <div className="space-y-2">
              {topUsers.map((user, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                const maxVal = topUsers[0]?.value || 1;
                const barWidth = Math.max(10, (user.value / maxVal) * 100);
                return (
                  <motion.div
                    key={user.telegram_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] overflow-hidden group hover:bg-white/[0.06] transition-all"
                  >
                    {/* Progress bar background */}
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500/[0.06] to-transparent rounded-xl transition-all duration-700"
                      style={{ width: `${barWidth}%` }}
                    />
                    
                    <div className="relative z-10 flex items-center gap-3 w-full">
                      <div className="w-7 h-7 flex items-center justify-center text-sm">
                        {index < 3 ? medals[index] : (
                          <span className="text-xs font-bold text-gray-500">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{user.first_name}</div>
                        <div className="text-[11px] text-gray-600 truncate">{user.group_name || '—'}</div>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                        <Zap className="w-3.5 h-3.5" />
                        {user.value}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : <EmptyChart text="Нет данных" />}
        </GlassChartCard>

        {/* Faculty Donut Chart */}
        <GlassChartCard title="По факультетам" icon={<GraduationCap className="w-4 h-4" />}>
          {facultyStats.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <defs>
                    {PIE_COLORS.map((color, i) => (
                      <linearGradient key={`pie-grad-${i}`} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={facultyStats.slice(0, 6)}
                    dataKey="users_count"
                    nameKey="faculty_name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    cornerRadius={4}
                    stroke="none"
                  >
                    {facultyStats.slice(0, 6).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pieGrad${index})`} />
                    ))}
                  </Pie>
                  <Tooltip content={<GlassTooltip formatter={(v) => [v, 'Студентов']} />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
                {facultyStats.slice(0, 6).map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                    <span className="text-[11px] text-gray-400 max-w-[120px] truncate">
                      {(f.faculty_name || 'Без факультета').substring(0, 20)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : <EmptyChart text="Нет данных" />}
        </GlassChartCard>
      </div>
    </>
  );
};

const EmptyChart = ({ text }) => (
  <div className="h-[200px] flex flex-col items-center justify-center text-gray-600">
    <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
    <span className="text-sm">{text}</span>
  </div>
);

// =============================================
// ONLINE TAB
// =============================================
const ONLINE_HISTORY_PERIODS = [
  { label: '1ч', hours: 1 },
  { label: '6ч', hours: 6 },
  { label: '24ч', hours: 24 },
  { label: '7д', hours: 168 },
  { label: '30д', hours: 720 },
  { label: 'Всё', hours: 0 },
];

const OnlineTab = ({ onlineData, loading, onRefresh }) => {
  const [onlineHistory, setOnlineHistory] = useState([]);
  const [persistentHistory, setPersistentHistory] = useState(null);
  const [historyPeriod, setHistoryPeriod] = useState(24);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Realtime in-memory история (для графика за текущую сессию)
  useEffect(() => {
    if (onlineData?.online_now != null) {
      setOnlineHistory(prev => {
        const newPoint = {
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow' }),
          online: onlineData.online_now || 0,
          web: onlineData.web_online || 0,
          telegram: onlineData.telegram_online || 0,
        };
        const updated = [...prev, newPoint];
        return updated.slice(-60);
      });
    }
  }, [onlineData]);

  // Persistent история из API
  const fetchOnlineHistory = useCallback(async (hours) => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/online-stats-history?hours=${hours}`);
      setPersistentHistory(res.data);
    } catch (err) {
      console.error('Online history fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnlineHistory(historyPeriod);
    const interval = setInterval(() => fetchOnlineHistory(historyPeriod), 60000);
    return () => clearInterval(interval);
  }, [historyPeriod, fetchOnlineHistory]);

  // Форматируем persistent данные для графика
  const persistentChartData = useMemo(() => {
    if (!persistentHistory?.metrics) return [];
    return persistentHistory.metrics.map(m => {
      const d = new Date(m.timestamp);
      let timeLabel;
      if (historyPeriod <= 6) {
        timeLabel = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
      } else if (historyPeriod <= 24) {
        timeLabel = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
      } else {
        timeLabel = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Moscow' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
      }
      return {
        time: timeLabel,
        online: Math.round(m.online_now),
        web: Math.round(m.web_online),
        telegram: Math.round(m.telegram_online),
        peak: m.peak_online || Math.round(m.online_now),
        online_1h: Math.round(m.online_1h),
        online_24h: Math.round(m.online_24h),
      };
    });
  }, [persistentHistory, historyPeriod]);

  return (
    <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-50" />
          </div>
          <h3 className="text-lg font-semibold text-white">Онлайн в реальном времени</h3>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onRefresh}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-2 ${GLASS.card} rounded-xl transition-all text-sm text-gray-300 ${GLASS.cardHover}`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Обновить</span>
        </motion.button>
      </div>

      {loading && !onlineData ? <GlassLoader /> : onlineData ? (
        <>
          {/* Online Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <Circle className="w-3.5 h-3.5 fill-green-400 text-green-400" />, label: 'Сейчас', value: onlineData.online_now, sub: `за ${onlineData.threshold_minutes || 5} мин`, grad: 'from-green-500/15 to-emerald-500/15', borderColor: 'border-green-500/15', valueColor: 'text-white' },
              { icon: <Globe className="w-3.5 h-3.5 text-teal-400" />, label: 'Веб', value: onlineData.web_online, sub: 'браузер', grad: 'from-teal-500/15 to-green-500/15', borderColor: 'border-teal-500/15', valueColor: 'text-teal-300' },
              { icon: <Smartphone className="w-3.5 h-3.5 text-blue-400" />, label: 'Telegram', value: onlineData.telegram_online, sub: 'мини-приложение', grad: 'from-blue-500/15 to-indigo-500/15', borderColor: 'border-blue-500/15', valueColor: 'text-blue-300' },
              { icon: <Activity className="w-3.5 h-3.5 text-purple-400" />, label: 'За 24ч', value: onlineData.online_last_day, sub: 'уникальных', grad: 'from-purple-500/15 to-pink-500/15', borderColor: 'border-purple-500/15', valueColor: 'text-white' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative overflow-hidden bg-gradient-to-br ${stat.grad} backdrop-blur-xl rounded-2xl p-4 border ${stat.borderColor}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {stat.icon}
                  <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">{stat.label}</span>
                </div>
                <div className={`text-3xl font-bold ${stat.valueColor}`}>
                  <AnimatedNumber value={stat.value || 0} />
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">{stat.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Realtime Online Chart (current session) */}
          {onlineHistory.length > 1 && (
            <GlassChartCard title="Онлайн — реальное время" icon={<Activity className="w-4 h-4" />}>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={onlineHistory} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradOnline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradWeb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradTelegram" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="time" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<GlassTooltip formatter={(v, name) => [v, name === 'online' ? 'Всего' : name === 'web' ? 'Веб' : 'Telegram']} />} />
                  <Area type="monotone" dataKey="online" stroke="#22c55e" strokeWidth={2} fill="url(#gradOnline)" name="online" dot={false} />
                  <Area type="monotone" dataKey="web" stroke="#2dd4bf" strokeWidth={1.5} fill="url(#gradWeb)" name="web" dot={false} />
                  <Area type="monotone" dataKey="telegram" stroke="#60a5fa" strokeWidth={1.5} fill="url(#gradTelegram)" name="telegram" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-5 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[11px] text-gray-500">Всего</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-teal-400" />
                  <span className="text-[11px] text-gray-500">Веб</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-[11px] text-gray-500">Telegram</span>
                </div>
              </div>
            </GlassChartCard>
          )}

          {/* ====== PERSISTENT Online History (from DB) ====== */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-green-400" />
              История онлайна
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {ONLINE_HISTORY_PERIODS.map((p) => (
              <motion.button
                key={p.hours}
                whileTap={{ scale: 0.95 }}
                onClick={() => setHistoryPeriod(p.hours)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  historyPeriod === p.hours
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                    : `${GLASS.card} text-gray-500 hover:text-gray-300 ${GLASS.cardHover}`
                }`}
              >
                {p.label}
              </motion.button>
            ))}
            <div className="ml-auto">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => fetchOnlineHistory(historyPeriod)}
                className={`p-2 ${GLASS.card} rounded-xl text-gray-400 ${GLASS.cardHover}`}
              >
                <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
              </motion.button>
            </div>
          </div>

          {/* Peak Online Card */}
          {persistentHistory?.peaks?.online_now && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${GLASS.card} rounded-2xl p-4 relative overflow-hidden`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-full blur-3xl" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/10">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Пик онлайна</div>
                    <div className="text-2xl font-bold text-white">{persistentHistory.peaks.online_now.value}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-gray-600">
                    {persistentHistory.peaks.online_now.timestamp 
                      ? new Date(persistentHistory.peaks.online_now.timestamp).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }) + ' МСК'
                      : '—'}
                  </div>
                  <div className="text-[11px] text-gray-600 mt-0.5">
                    за {ONLINE_HISTORY_PERIODS.find(p => p.hours === historyPeriod)?.label || '—'}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Persistent Online Chart */}
          {persistentChartData.length > 1 ? (
            <>
              <GlassChartCard title="Онлайн — история" icon={<Users className="w-4 h-4" />}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={persistentChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradOnlineHist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradWebHist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradTgHist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="time" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<GlassTooltip formatter={(v, name) => [v, name === 'online' ? 'Всего онлайн' : name === 'web' ? 'Веб' : name === 'telegram' ? 'Telegram' : name]} />} />
                    <Area type="monotone" dataKey="online" stroke="#22c55e" strokeWidth={2} fill="url(#gradOnlineHist)" name="online" dot={false} />
                    <Area type="monotone" dataKey="web" stroke="#2dd4bf" strokeWidth={1.5} fill="url(#gradWebHist)" name="web" dot={false} />
                    <Area type="monotone" dataKey="telegram" stroke="#60a5fa" strokeWidth={1.5} fill="url(#gradTgHist)" name="telegram" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-5 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[11px] text-gray-500">Всего</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1.5 rounded-full bg-teal-400" />
                    <span className="text-[11px] text-gray-500">Веб</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1.5 rounded-full bg-blue-400" />
                    <span className="text-[11px] text-gray-500">Telegram</span>
                  </div>
                </div>
                <div className="text-center mt-2 text-[10px] text-gray-600">
                  {persistentHistory?.total_points || 0} точек • интервал {persistentHistory?.interval_minutes || '—'} мин • МСК
                </div>
              </GlassChartCard>

              {/* Active users 1h & 24h history */}
              <GlassChartCard title="Охват — уникальных за 1ч / 24ч" icon={<Activity className="w-4 h-4" />}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={persistentChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradOnline1h" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradOnline24h" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="time" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<GlassTooltip formatter={(v, name) => [v, name === 'online_1h' ? 'За 1 час' : 'За 24 часа']} />} />
                    <Area type="monotone" dataKey="online_24h" stroke="#a78bfa" strokeWidth={1.5} fill="url(#gradOnline24h)" name="online_24h" dot={false} />
                    <Area type="monotone" dataKey="online_1h" stroke="#f59e0b" strokeWidth={2} fill="url(#gradOnline1h)" name="online_1h" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-5 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1.5 rounded-full bg-amber-400" />
                    <span className="text-[11px] text-gray-500">За 1 час</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1.5 rounded-full bg-purple-400" />
                    <span className="text-[11px] text-gray-500">За 24 часа</span>
                  </div>
                </div>
              </GlassChartCard>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${GLASS.card} rounded-2xl p-8 flex flex-col items-center justify-center`}
            >
              <Clock className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-sm text-gray-500 text-center">
                {historyLoading ? 'Загрузка истории...' : 'Данные истории ещё собираются'}
              </p>
              <p className="text-[11px] text-gray-600 mt-1 text-center">Статистика онлайна записывается каждую минуту.</p>
            </motion.div>
          )}

          {/* Users List */}
          <div className={`${GLASS.card} rounded-2xl overflow-hidden`}>
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h4 className="text-white font-medium flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-green-400" />
                Пользователи онлайн
                <span className="px-2 py-0.5 bg-green-500/15 text-green-400 text-[11px] rounded-full font-semibold">
                  {onlineData.users?.length || 0}
                </span>
              </h4>
              <span className="text-[11px] text-gray-600">
                {new Date(onlineData.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow' })}
              </span>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.03]">
              {onlineData.users && onlineData.users.length > 0 ? (
                onlineData.users.map((user, index) => (
                  <motion.div
                    key={user.telegram_id}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-3 p-3 hover:bg-white/[0.03] transition-colors cursor-pointer active:bg-white/[0.05]"
                  >
                    <div className="relative flex-shrink-0">
                      {user.photo_url ? (
                        <img src={user.photo_url} alt={user.first_name} className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center text-white font-bold text-xs">
                          {(user.first_name?.[0] || '?').toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0c0c18]" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm truncate">{user.first_name} {user.last_name}</div>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {user.platform === 'web' ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-500/10 text-teal-400 rounded text-[10px] font-medium">
                            <Globe className="w-2.5 h-2.5" /> Веб
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px] font-medium">
                            <Smartphone className="w-2.5 h-2.5" /> TG
                          </span>
                        )}
                        {user.current_section && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-purple-500/10 text-purple-300 rounded text-[10px] font-medium truncate max-w-[100px]">
                            {user.current_section === 'schedule' && '📅 Расписание'}
                            {user.current_section === 'tasks' && '✅ Задачи'}
                            {user.current_section === 'journal' && '📓 Журнал'}
                            {user.current_section === 'music' && '🎵 Музыка'}
                            {user.current_section === 'friends' && '👥 Друзья'}
                            {user.current_section === 'home' && '🏠 Главная'}
                            {!['schedule', 'tasks', 'journal', 'music', 'friends', 'home'].includes(user.current_section) && user.current_section}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = user.username 
                            ? `https://t.me/${user.username}` 
                            : `tg://user?id=${user.telegram_id}`;
                          try { window.Telegram?.WebApp?.openTelegramLink?.(url) || window.open(url, '_blank'); }
                          catch { window.open(url, '_blank'); }
                        }}
                        className="p-1.5 rounded-lg bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 transition-colors"
                        title="Открыть в Telegram"
                      >
                        <svg className="w-3.5 h-3.5 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.63 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.88 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.47-.01.06.01.24 0 .37z"/>
                        </svg>
                      </button>
                      <div className="text-right">
                        <div className="text-[10px] text-green-400 font-semibold leading-tight">{user.activity_text}</div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-14 text-gray-600">
                  <Wifi className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">Нет активных пользователей</p>
                  <p className="text-[11px] text-gray-700 mt-1">за последние {onlineData.threshold_minutes || 5} минут</p>
                </div>
              )}
            </div>
          </div>

          {/* Info banner */}
          <div className="flex items-center gap-2 p-3.5 bg-blue-500/[0.06] border border-blue-500/10 rounded-xl text-[12px] text-blue-300/80 backdrop-blur-sm">
            <Info className="w-4 h-4 flex-shrink-0 text-blue-400/60" />
            <span>Данные обновляются каждые 5 секунд. Пользователь считается онлайн, если был активен в течение последних {onlineData.threshold_minutes || 5} минут.</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-gray-600">
          <Wifi className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">Не удалось загрузить данные</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onRefresh}
            className="mt-4 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white text-sm font-medium shadow-[0_0_20px_rgba(139,92,246,0.3)]"
          >
            Попробовать снова
          </motion.button>
        </div>
      )}
    </div>
  );
};

// =============================================
// USERS TAB
// =============================================
const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [detailUser, setDetailUser] = useState(null);
  const [detailProfile, setDetailProfile] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const searchTimerRef = useRef(null);

  // Загрузка детального профиля
  useEffect(() => {
    if (!detailUser) { setDetailProfile(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    axios.get(`${BACKEND_URL}/api/profile/${detailUser.telegram_id}`)
      .then(res => { if (!cancelled) setDetailProfile(res.data); })
      .catch(() => { if (!cancelled) setDetailProfile(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [detailUser]);

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
        params: { limit: 50, skip, search: debouncedSearch || undefined, user_type: 'telegram' }
      });
      if (reset) { setUsers(res.data); setPage(1); }
      else { setUsers(prev => [...prev, ...res.data]); setPage(prev => prev + 1); }
      setHasMore(res.data.length === 50);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchUsers(true); }, [debouncedSearch]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-lg space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Поиск по имени, группе, username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${GLASS.input} rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-600 text-sm outline-none transition-all duration-300`}
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2AABEE]/10 border border-[#2AABEE]/20">
            <svg className="w-3 h-3 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.63 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.88 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.47-.01.06.01.24 0 .37z"/>
            </svg>
            <span className="text-[#2AABEE] font-medium">Только Telegram-пользователи</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {users.map((user, i) => (
          <motion.div
            key={user.id || user.telegram_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.5) }}
            onClick={() => setDetailUser(user)}
            className={`${GLASS.card} rounded-xl p-3 transition-all duration-300 ${GLASS.cardHover} cursor-pointer active:scale-[0.98]`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 backdrop-blur-sm flex items-center justify-center text-purple-300 font-bold text-sm border border-white/[0.08]">
                {user.first_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white text-sm truncate">
                  {user.first_name} {user.last_name}
                </div>
                <div className="text-[11px] text-gray-600 flex items-center gap-1.5 mt-0.5 truncate">
                  <span className="truncate">{user.group_name || 'Без группы'}</span>
                  {user.username && <span className="text-gray-700 truncate">@{user.username}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const url = user.username 
                      ? `https://t.me/${user.username}` 
                      : `tg://user?id=${user.telegram_id}`;
                    try { window.Telegram?.WebApp?.openTelegramLink?.(url) || window.open(url, '_blank'); }
                    catch { window.open(url, '_blank'); }
                  }}
                  className="p-1.5 rounded-lg bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 transition-colors"
                  title="Открыть в Telegram"
                >
                  <svg className="w-3.5 h-3.5 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.63 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.88 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.47-.01.06.01.24 0 .37z"/>
                  </svg>
                </button>
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          </motion.div>
        ))}
        
        {loading && <GlassLoader />}
        
        {!loading && users.length === 0 && (
          <div className="text-center text-gray-600 py-14">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Пользователи не найдены</p>
          </div>
        )}
        
        {!loading && hasMore && (
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => fetchUsers(false)}
            className={`w-full py-3 ${GLASS.card} rounded-xl text-gray-400 text-sm transition-all ${GLASS.cardHover} font-medium`}
          >
            Загрузить еще
          </motion.button>
        )}
      </div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {detailUser && (
          <UserDetailModal user={detailUser} profile={detailProfile} loading={detailLoading} onClose={() => setDetailUser(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================
// USER DETAIL MODAL (shared)
// =============================================
const UserDetailModal = ({ user: detailUser, profile: detailProfile, loading: detailLoading, onClose }) => {
  const isWebUser = detailUser.user_type === 'web' || detailUser.telegram_id >= 10000000000;
  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center sm:justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        className="relative w-full sm:w-[440px] max-h-[85vh] overflow-y-auto
                   rounded-t-[24px] sm:rounded-[20px] border border-white/[0.1]
                   shadow-[0_8px_48px_rgba(0,0,0,0.5)]"
        style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.95) 0%, rgba(15,15,30,0.98) 100%)', backdropFilter: 'blur(40px)' }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 sm:hidden"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
        
        {/* Header */}
        <div className="px-5 pt-4 pb-5 text-center relative">
          <button onClick={onClose} className="absolute right-4 top-4 p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] transition-colors">
            <X className="w-4 h-4 text-white/50" />
          </button>
          <div className={`w-16 h-16 mx-auto rounded-full ${isWebUser ? 'bg-gradient-to-br from-orange-500/40 to-amber-500/40 shadow-orange-500/10' : 'bg-gradient-to-br from-purple-500/40 to-blue-500/40 shadow-purple-500/10'} flex items-center justify-center text-2xl font-bold text-white border-2 border-white/10 shadow-lg`}>
            {isWebUser ? <Globe className="w-7 h-7 text-orange-300" /> : (detailUser.first_name?.[0]?.toUpperCase() || 'U')}
          </div>
          <h3 className="text-lg font-bold text-white mt-3">
            {detailUser.first_name || 'Гость'} {detailUser.last_name || ''}
          </h3>
          {detailUser.username && (
            <p className="text-sm text-gray-500 mt-0.5">@{detailUser.username}</p>
          )}
          {isWebUser && (
            <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-[11px] font-semibold border border-orange-500/20">
              <Globe className="w-3 h-3" />
              Веб-посетитель
            </span>
          )}
          {!isWebUser && detailProfile?.is_online && (
            <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Онлайн
            </span>
          )}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        {detailLoading ? (
          <div className="py-12 text-center"><GlassLoader /></div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: isWebUser ? 'ID посетителя' : 'Telegram ID', value: detailUser.telegram_id, icon: '🆔' },
                { label: 'Группа', value: detailUser.group_name || '—', icon: '👥' },
                { label: 'Факультет', value: detailProfile?.facultet_name || detailUser.facultet_name || '—', icon: '🏛️' },
                { label: 'Курс', value: detailProfile?.kurs || detailUser.kurs || '—', icon: '📚' },
                { label: isWebUser ? 'Первый визит' : 'Регистрация', value: detailUser.created_at ? new Date(detailUser.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Moscow' }) : '—', icon: '📅' },
                { label: 'Последняя активность', value: detailProfile?.last_activity ? (() => { const d = new Date(detailProfile.last_activity); const diff = Math.floor((Date.now() - d.getTime()) / 60000); return diff < 5 ? 'Только что' : diff < 60 ? `${diff} мин назад` : diff < 1440 ? `${Math.floor(diff/60)} ч назад` : d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }); })() : detailUser.last_activity ? new Date(detailUser.last_activity).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '—', icon: '⏱️' },
              ].map((item) => (
                <div key={item.label} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{item.icon} {item.label}</div>
                  <div className="text-[13px] text-white/80 font-medium truncate">{item.value}</div>
                </div>
              ))}
            </div>

            {/* Stats row — only for Telegram users */}
            {!isWebUser && detailProfile && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Друзья', value: detailProfile.friends_count, gradient: 'from-blue-500 to-cyan-500' },
                  { label: 'Достижения', value: detailProfile.achievements_count, gradient: 'from-amber-500 to-orange-500' },
                  { label: 'Баллы', value: detailProfile.total_points, gradient: 'from-purple-500 to-pink-500' },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className={`text-xl font-bold bg-gradient-to-r ${s.gradient} bg-clip-text text-transparent`}>{s.value}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Notifications — only for Telegram users */}
            {!isWebUser && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">🔔 Уведомления</div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-white/80">{detailUser.notifications_enabled ? 'Включены' : 'Отключены'}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${detailUser.notifications_enabled ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {detailUser.notifications_enabled ? `за ${detailUser.notification_time || 10} мин` : 'OFF'}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {!isWebUser && (
                <button
                  onClick={() => {
                    const url = detailUser.username 
                      ? `https://t.me/${detailUser.username}` 
                      : `tg://user?id=${detailUser.telegram_id}`;
                    try { window.Telegram?.WebApp?.openTelegramLink?.(url) || window.open(url, '_blank'); }
                    catch { window.open(url, '_blank'); }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#2AABEE]/15 hover:bg-[#2AABEE]/25 transition-colors border border-[#2AABEE]/20"
                >
                  <svg className="w-4 h-4 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.63 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.88 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.47-.01.06.01.24 0 .37z"/>
                  </svg>
                  <span className="text-[13px] font-semibold text-[#2AABEE]">Telegram</span>
                </button>
              )}
              <button
                onClick={() => { navigator.clipboard?.writeText(String(detailUser.telegram_id)); }}
                className={`${isWebUser ? 'flex-1' : ''} flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-white/[0.06]`}
              >
                <Copy className="w-4 h-4 text-gray-500" />
                <span className="text-[13px] text-gray-400">Копировать ID</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// =============================================
// VISITS TAB (Web visitors)
// =============================================
const VisitsTab = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [detailUser, setDetailUser] = useState(null);
  const [detailProfile, setDetailProfile] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const searchTimerRef = useRef(null);

  // Загрузка детального профиля
  useEffect(() => {
    if (!detailUser) { setDetailProfile(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    axios.get(`${BACKEND_URL}/api/profile/${detailUser.telegram_id}`)
      .then(res => { if (!cancelled) setDetailProfile(res.data); })
      .catch(() => { if (!cancelled) setDetailProfile(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [detailUser]);

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
        params: { limit: 50, skip, search: debouncedSearch || undefined, user_type: 'web' }
      });
      if (reset) { setUsers(res.data); setPage(1); }
      else { setUsers(prev => [...prev, ...res.data]); setPage(prev => prev + 1); }
      setHasMore(res.data.length === 50);
    } catch (error) {
      console.error('Failed to fetch web visitors:', error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchUsers(true); }, [debouncedSearch]);

  const formatVisitDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 5) return 'Только что';
    if (diff < 60) return `${diff} мин назад`;
    if (diff < 1440) return `${Math.floor(diff / 60)} ч назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-lg space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Поиск посетителей..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${GLASS.input} rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-600 text-sm outline-none transition-all duration-300`}
          />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <Globe className="w-3 h-3 text-orange-400" />
            <span className="text-orange-400 font-medium">Веб-посетители сайта</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {users.map((user, i) => (
          <motion.div
            key={user.id || user.telegram_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.5) }}
            onClick={() => setDetailUser(user)}
            className={`${GLASS.card} rounded-xl p-3 transition-all duration-300 ${GLASS.cardHover} cursor-pointer active:scale-[0.98]`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex-shrink-0 rounded-full bg-gradient-to-br from-orange-500/30 to-amber-500/30 backdrop-blur-sm flex items-center justify-center border border-orange-500/20">
                <Globe className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white text-sm truncate flex items-center gap-1.5">
                  {user.first_name || 'Гость'} {user.last_name || ''}
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/20 leading-none">
                    ВЕБ
                  </span>
                </div>
                <div className="text-[11px] text-gray-600 flex items-center gap-1.5 mt-0.5 truncate">
                  <span className="truncate">{user.group_name || 'Без группы'}</span>
                  {user.last_activity && (
                    <span className="text-gray-700">• {formatVisitDate(user.last_activity)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </div>
            </div>
          </motion.div>
        ))}
        
        {loading && <GlassLoader />}
        
        {!loading && users.length === 0 && (
          <div className="text-center text-gray-600 py-14">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Веб-посетители не найдены</p>
            <p className="text-xs text-gray-700 mt-1">Здесь будут отображаться пользователи, зашедшие на сайт без Telegram</p>
          </div>
        )}
        
        {!loading && hasMore && (
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => fetchUsers(false)}
            className={`w-full py-3 ${GLASS.card} rounded-xl text-gray-400 text-sm transition-all ${GLASS.cardHover} font-medium`}
          >
            Загрузить еще
          </motion.button>
        )}
      </div>

      {/* Visitor Detail Modal */}
      <AnimatePresence>
        {detailUser && (
          <UserDetailModal user={detailUser} profile={detailProfile} loading={detailLoading} onClose={() => setDetailUser(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================
// CLASSES TAB
// =============================================
const ClassesTab = () => {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef(null);
  
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

  useEffect(() => { fetchJournals(); }, [debouncedSearch]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-lg">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Поиск предметов и групп..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${GLASS.input} rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-600 text-sm outline-none transition-all duration-300`}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {journals.map((journal, i) => (
          <motion.div
            key={journal.journal_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.5) }}
            className={`group ${GLASS.card} rounded-2xl p-4 transition-all duration-300 ${GLASS.cardHover}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/15 to-pink-500/15 text-purple-400 border border-purple-500/10">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="px-2 py-1 rounded-lg bg-white/[0.06] border border-white/[0.05] text-[11px] text-gray-400 font-medium">
                {journal.group_name}
              </div>
            </div>
            
            <h3 className="text-white font-medium text-sm mb-1 truncate">{journal.name}</h3>
            <p className="text-[12px] text-gray-600 line-clamp-2 h-9 mb-4">
              {journal.description || 'Нет описания'}
            </p>
            
            <div className="flex items-center justify-between text-[12px] text-gray-500 pt-3 border-t border-white/[0.05]">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>{journal.total_students || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{journal.total_sessions || 0}</span>
              </div>
            </div>
          </motion.div>
        ))}
        
        {loading && <div className="col-span-full"><GlassLoader /></div>}
        
        {!loading && journals.length === 0 && (
          <div className="col-span-full text-center text-gray-600 py-14">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Журналы занятий не найдены</p>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================
// NOTIFICATIONS TAB
// =============================================
const NotificationsTab = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('admin_message');
  const [notificationCategory, setNotificationCategory] = useState('system');
  const [sendInApp, setSendInApp] = useState(true);
  const [sendTelegram, setSendTelegram] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

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
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (!search.trim()) { setFilteredUsers(users); return; }
    const q = search.toLowerCase();
    setFilteredUsers(users.filter(u => 
      (u.first_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.group_name || '').toLowerCase().includes(q) ||
      String(u.telegram_id).includes(q)
    ));
  }, [search, users]);

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
      setSendResult({ success: true, message: 'Уведомление отправлено!', details: res.data });
      setNotificationTitle('');
      setNotificationMessage('');
    } catch (error) {
      setSendResult({ success: false, message: error.response?.data?.detail || 'Ошибка отправки' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left - User Selection */}
        <div className="space-y-4">
          <h3 className="text-[15px] font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            Выберите получателя
          </h3>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени, username, группе..."
              className={`w-full pl-10 pr-4 py-2.5 ${GLASS.input} rounded-xl text-white placeholder-gray-600 text-sm outline-none transition-all duration-300`}
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
            {loading ? <GlassLoader /> : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const isSelected = selectedUser?.telegram_id === user.telegram_id;
                return (
                  <motion.button
                    key={user.telegram_id}
                    onClick={() => { setSelectedUser(user); setSendResult(null); }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left ${
                      isSelected 
                        ? `${GLASS.cardActive}` 
                        : `bg-white/[0.02] border border-transparent hover:bg-white/[0.05]`
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/40 to-pink-500/40 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 border border-white/[0.08]">
                      {(user.first_name?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm truncate">{user.first_name || 'Нет имени'}</div>
                      <div className="text-[11px] text-gray-600 truncate">
                        {user.username ? `@${user.username}` : ''} 
                        {user.group_name ? ` • ${user.group_name}` : ''}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                  </motion.button>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-600 text-sm">Пользователи не найдены</div>
            )}
          </div>
        </div>

        {/* Right - Notification Form */}
        <div className="space-y-4">
          <h3 className="text-[15px] font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            Отправить уведомление
          </h3>

          {selectedUser ? (
            <div className="space-y-4">
              {/* Selected user badge */}
              <div className={`p-3.5 ${GLASS.card} rounded-xl border-purple-500/20`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-purple-400 font-medium mb-0.5">Получатель:</div>
                    <div className="font-medium text-white text-sm">
                      {selectedUser.first_name || 'Пользователь'} 
                      {selectedUser.username && <span className="text-gray-500"> (@{selectedUser.username})</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const url = selectedUser.username 
                        ? `https://t.me/${selectedUser.username}` 
                        : `tg://user?id=${selectedUser.telegram_id}`;
                      try {
                        window.Telegram?.WebApp?.openTelegramLink?.(url) 
                          || window.open(url, '_blank');
                      } catch { window.open(url, '_blank'); }
                    }}
                    className="p-2 rounded-xl bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 transition-colors"
                    title="Открыть в Telegram"
                  >
                    <svg className="w-4 h-4 text-[#2AABEE]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.63 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.88 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.47-.01.06.01.24 0 .37z"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Type selector */}
              <div>
                <label className="text-[12px] text-gray-500 mb-2 block font-medium">Тип уведомления</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {NOTIFICATION_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = notificationType === type.id;
                    return (
                      <motion.button
                        key={type.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setNotificationType(type.id); setNotificationCategory(type.category); }}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all duration-300 ${
                          isSelected
                            ? 'bg-purple-500/15 border-2 border-purple-500/40 shadow-[0_0_15px_rgba(139,92,246,0.1)]'
                            : 'bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-purple-400' : 'text-gray-500'}`} />
                        <span className={`text-[10px] leading-tight text-center font-medium ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                          {type.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-[12px] text-gray-500 mb-2 block font-medium">Заголовок</label>
                <input
                  type="text"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  placeholder="Заголовок уведомления"
                  className={`w-full px-4 py-2.5 ${GLASS.input} rounded-xl text-white placeholder-gray-600 text-sm outline-none transition-all duration-300`}
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-[12px] text-gray-500 mb-2 block font-medium">Сообщение</label>
                <textarea
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  placeholder="Текст сообщения..."
                  rows={4}
                  className={`w-full px-4 py-2.5 ${GLASS.input} rounded-xl text-white placeholder-gray-600 text-sm outline-none resize-none transition-all duration-300`}
                />
              </div>

              {/* Send options */}
              <div className="space-y-2">
                <label className="text-[12px] text-gray-500 block font-medium">Куда отправить</label>
                
                <label className={`flex items-center gap-3 cursor-pointer p-3 ${GLASS.card} rounded-xl transition-all duration-300 ${GLASS.cardHover}`}>
                  <input
                    type="checkbox"
                    checked={sendInApp}
                    onChange={(e) => setSendInApp(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-700 text-purple-500 focus:ring-purple-500/30 bg-white/[0.05]"
                  />
                  <Bell className="w-4 h-4 text-purple-400" />
                  <div>
                    <div className="text-white font-medium text-sm">В приложение</div>
                    <div className="text-[11px] text-gray-600">Раздел уведомлений</div>
                  </div>
                </label>

                <label className={`flex items-center gap-3 cursor-pointer p-3 ${GLASS.card} rounded-xl transition-all duration-300 ${GLASS.cardHover}`}>
                  <input
                    type="checkbox"
                    checked={sendTelegram}
                    onChange={(e) => setSendTelegram(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-700 text-blue-500 focus:ring-blue-500/30 bg-white/[0.05]"
                  />
                  <Send className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-white font-medium text-sm">В Telegram</div>
                    <div className="text-[11px] text-gray-600">Личное сообщение от бота</div>
                  </div>
                </label>
              </div>

              {/* Result */}
              <AnimatePresence>
                {sendResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className={`p-3.5 rounded-xl backdrop-blur-lg ${
                      sendResult.success 
                        ? 'bg-green-500/10 border border-green-500/20' 
                        : 'bg-red-500/10 border border-red-500/20'
                    }`}
                  >
                    <div className={`font-medium text-sm ${sendResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {sendResult.success ? '✅' : '❌'} {sendResult.message}
                    </div>
                    {sendResult.details && (
                      <div className="text-[11px] text-gray-500 mt-1">
                        In-App: {sendResult.details.in_app_sent ? '✓' : '✗'} | 
                        Telegram: {sendResult.details.telegram_sent ? '✓' : '✗'}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Send button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSendNotification}
                disabled={sending || (!sendInApp && !sendTelegram) || (!notificationTitle.trim() && !notificationMessage.trim())}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                  sending || (!sendInApp && !sendTelegram) || (!notificationTitle.trim() && !notificationMessage.trim())
                    ? 'bg-white/[0.05] text-gray-600 cursor-not-allowed border border-white/[0.05]'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_30px_rgba(139,92,246,0.25)] hover:shadow-[0_0_40px_rgba(139,92,246,0.35)]'
                }`}
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Отправить уведомление
                  </>
                )}
              </motion.button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-600">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] mb-4">
                <User className="w-12 h-12 opacity-20" />
              </div>
              <p className="text-sm">Выберите пользователя слева</p>
              <p className="text-[12px] text-gray-700 mt-1">для отправки уведомления</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================
// SERVER TAB - Server Load Statistics
// =============================================

const CircularGauge = ({ value, label, subtitle, color, icon, size = 120 }) => {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  
  const getColor = (val) => {
    if (val < 50) return '#34d399';
    if (val < 75) return '#fbbf24';
    if (val < 90) return '#f97316';
    return '#ef4444';
  };
  
  const gaugeColor = color || getColor(value);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size/2} cy={size/2} r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="8"
          />
          <circle
            cx={size/2} cy={size/2} r={radius}
            fill="none"
            stroke={gaugeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.5s ease' }}
            filter={`drop-shadow(0 0 6px ${gaugeColor}40)`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{Math.round(value)}%</span>
          {icon && <div className="mt-0.5 text-gray-500">{icon}</div>}
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className="text-sm font-semibold text-white">{label}</div>
        {subtitle && <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
};

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

// =============================================
// REFERRAL LINKS TAB (Admin Referral Links)
// =============================================
const ReferralLinksTab = () => {
  const [links, setLinks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLink, setSelectedLink] = useState(null);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'analytics'
  
  // Create form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDestination, setFormDestination] = useState('');
  const [formCampaign, setFormCampaign] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formMedium, setFormMedium] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  
  // Modal pattern config state
  const [modalEnabled, setModalEnabled] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalButtonText, setModalButtonText] = useState('OK');
  const [modalButtonAction, setModalButtonAction] = useState('close');
  const [modalButtonUrl, setModalButtonUrl] = useState('');
  const [modalNavigateTo, setModalNavigateTo] = useState('');
  const [modalRewardPoints, setModalRewardPoints] = useState(0);
  const [modalImageId, setModalImageId] = useState('');
  const [modalAlwaysShow, setModalAlwaysShow] = useState(false);
  const [modalImages, setModalImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const ACTION_OPTIONS = [
    { value: 'close', label: 'Закрыть модалку' },
    { value: 'open_url', label: 'Открыть ссылку (URL)' },
    { value: 'navigate', label: 'Перейти в раздел' },
    { value: 'reward', label: 'Получить награду (баллы)' },
  ];
  
  const NAVIGATE_OPTIONS = [
    { value: 'schedule', label: 'Расписание' },
    { value: 'friends', label: 'Друзья' },
    { value: 'music', label: 'Музыка' },
    { value: 'rooms', label: 'Комнаты' },
    { value: 'journal', label: 'Журнал' },
    { value: 'settings', label: 'Настройки' },
  ];
  
  const fetchModalImages = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/modal-images`);
      setModalImages(res.data || []);
    } catch (e) { console.error('Error loading modal images:', e); }
  }, []);
  
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${BACKEND_URL}/api/admin/modal-images`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchModalImages();
      setModalImageId(res.data.id);
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setUploadingImage(false);
    }
  };
  
  const resetModalForm = () => {
    setModalEnabled(false);
    setModalTitle('');
    setModalDescription('');
    setModalButtonText('OK');
    setModalButtonAction('close');
    setModalButtonUrl('');
    setModalNavigateTo('');
    setModalRewardPoints(0);
    setModalImageId('');
    setModalAlwaysShow(false);
  };
  
  const getModalConfig = () => {
    if (!modalEnabled) return null;
    return {
      enabled: true,
      image_id: modalImageId,
      title: modalTitle,
      description: modalDescription,
      button_text: modalButtonText,
      button_action: modalButtonAction,
      button_url: modalButtonUrl,
      button_navigate_to: modalNavigateTo,
      reward_points: modalRewardPoints,
      always_show: modalAlwaysShow,
    };
  };

  const SOURCE_OPTIONS = [
    { value: '', label: 'Не указан' },
    { value: 'telegram', label: 'Telegram' },
    { value: 'vk', label: 'ВКонтакте' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'website', label: 'Сайт' },
    { value: 'email', label: 'Email' },
    { value: 'qr', label: 'QR-код' },
    { value: 'offline', label: 'Оффлайн' },
    { value: 'other', label: 'Другое' },
  ];

  const MEDIUM_OPTIONS = [
    { value: '', label: 'Не указан' },
    { value: 'social', label: 'Соцсети' },
    { value: 'post', label: 'Пост' },
    { value: 'story', label: 'Сторис' },
    { value: 'ad', label: 'Реклама' },
    { value: 'banner', label: 'Баннер' },
    { value: 'email', label: 'Email-рассылка' },
    { value: 'direct', label: 'Прямая ссылка' },
    { value: 'print', label: 'Печать' },
  ];

  const fetchLinks = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await axios.get(`${BACKEND_URL}/api/admin/referral-links${params}`);
      setLinks(res.data.links || []);
    } catch (error) {
      console.error('Error loading referral links:', error);
    }
  }, [search]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/referral-links/analytics?days=30`);
      setAnalytics(res.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchLinks(), fetchAnalytics(), fetchModalImages()]);
    setLoading(false);
  }, [fetchLinks, fetchAnalytics, fetchModalImages]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      await axios.post(`${BACKEND_URL}/api/admin/referral-links`, {
        name: formName.trim(),
        code: formCode.trim() || undefined,
        description: formDescription.trim(),
        destination_url: formDestination.trim(),
        campaign: formCampaign.trim(),
        source: formSource,
        medium: formMedium,
        modal_config: getModalConfig(),
      });
      setShowCreateForm(false);
      setFormName(''); setFormCode(''); setFormDescription(''); 
      setFormDestination(''); setFormCampaign(''); setFormSource(''); setFormMedium('');
      resetModalForm();
      await fetchAll();
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка создания ссылки');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (linkId) => {
    if (!window.confirm('Удалить ссылку и все данные кликов?')) return;
    setDeleting(linkId);
    try {
      await axios.delete(`${BACKEND_URL}/api/admin/referral-links/${linkId}`);
      setSelectedLink(null);
      await fetchAll();
    } catch (error) {
      alert('Ошибка удаления');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (link) => {
    try {
      const res = await axios.put(`${BACKEND_URL}/api/admin/referral-links/${link.id}`, {
        is_active: !link.is_active
      });
      await fetchLinks();
      // Обновляем selectedLink с актуальными данными
      if (selectedLink && selectedLink.id === link.id) {
        setSelectedLink(res.data);
      }
    } catch (error) {
      console.error('Error toggling link:', error);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const fetchLinkDetails = async (linkId) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/referral-links/${linkId}`);
      setSelectedLink(res.data);
    } catch (error) {
      console.error('Error loading link details:', error);
    }
  };

  if (loading) return <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6"><GlassLoader /></div>;

  return (
    <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-5">
      {/* Header with view toggle and create button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex p-0.5 bg-white/[0.04] rounded-xl border border-white/[0.06]">
            <button
              onClick={() => { setView('list'); setSelectedLink(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                view === 'list' ? 'bg-white/[0.1] text-white border border-white/[0.1]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Ссылки
            </button>
            <button
              onClick={() => { setView('analytics'); setSelectedLink(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                view === 'analytics' ? 'bg-white/[0.1] text-white border border-white/[0.1]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Аналитика
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {view === 'list' && (
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск..."
                className={`w-full pl-9 pr-3 py-2 ${GLASS.input} rounded-xl text-white placeholder-gray-600 text-xs outline-none transition-all`}
              />
            </div>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white text-xs font-semibold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all flex-shrink-0"
          >
            <span className="text-base leading-none">+</span> Создать
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={fetchAll}
            className={`p-2 ${GLASS.card} rounded-xl transition-all ${GLASS.cardHover} flex-shrink-0`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
          </motion.button>
        </div>
      </div>

      {/* Create Form Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateForm(false)} />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-y-auto bg-[#0f0f1e] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                    <Share2 className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-white">Новая ссылка</h3>
                </div>
                <button onClick={() => setShowCreateForm(false)} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition-colors">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="space-y-3.5">
                {/* Name - required */}
                <div>
                  <label className="text-[11px] text-gray-400 font-medium mb-1 block">Название *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Например: VK Реклама Зима 2025"
                    className={`w-full px-3.5 py-2.5 ${GLASS.input} rounded-xl text-white placeholder-gray-600 text-sm outline-none`}
                  />
                </div>

                {/* Custom code */}
                <div>
                  <label className="text-[11px] text-gray-400 font-medium mb-1 block">Код (необязательно)</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    placeholder="Авто-генерация если пусто"
                    maxLength={20}
                    className={`w-full px-3.5 py-2.5 ${GLASS.input} rounded-xl text-white placeholder-gray-600 text-sm outline-none font-mono`}
                  />
                  <p className="text-[10px] text-gray-600 mt-0.5">Латинские буквы, цифры, - и _</p>
                </div>

                {/* Description */}
                <div>
                  <label className="text-[11px] text-gray-400 font-medium mb-1 block">Описание</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Для чего эта ссылка..."
                    rows={2}
                    className={`w-full px-3.5 py-2.5 ${GLASS.input} rounded-xl text-white placeholder-gray-600 text-sm outline-none resize-none`}
                  />
                </div>

                {/* Destination URL */}
                <div>
                  <label className="text-[11px] text-gray-400 font-medium mb-1 block">URL назначения</label>
                  <input
                    type="text"
                    value={formDestination}
                    onChange={(e) => setFormDestination(e.target.value)}
                    placeholder="Оставьте пустым для бота по умолчанию"
                    className={`w-full px-3.5 py-2.5 ${GLASS.input} rounded-xl text-white placeholder-gray-600 text-sm outline-none`}
                  />
                </div>

                {/* Campaign */}
                <div>
                  <label className="text-[11px] text-gray-400 font-medium mb-1 block">Кампания</label>
                  <input
                    type="text"
                    value={formCampaign}
                    onChange={(e) => setFormCampaign(e.target.value)}
                    placeholder="Например: winter_promo_2025"
                    className={`w-full px-3.5 py-2.5 ${GLASS.input} rounded-xl text-white placeholder-gray-600 text-sm outline-none`}
                  />
                </div>

                {/* Source + Medium row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium mb-1 block">Источник</label>
                    <select
                      value={formSource}
                      onChange={(e) => setFormSource(e.target.value)}
                      className={`w-full px-3 py-2.5 ${GLASS.input} rounded-xl text-white text-sm outline-none appearance-none cursor-pointer`}
                    >
                      {SOURCE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-[#1a1a2e] text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 font-medium mb-1 block">Канал</label>
                    <select
                      value={formMedium}
                      onChange={(e) => setFormMedium(e.target.value)}
                      className={`w-full px-3 py-2.5 ${GLASS.input} rounded-xl text-white text-sm outline-none appearance-none cursor-pointer`}
                    >
                      {MEDIUM_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-[#1a1a2e] text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ===== Modal Pattern Config ===== */}
                <div className="pt-3 border-t border-white/[0.06]">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`relative w-10 h-5 rounded-full transition-all ${modalEnabled ? 'bg-purple-500' : 'bg-white/[0.08]'}`}
                      onClick={() => setModalEnabled(!modalEnabled)}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${modalEnabled ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
                    </div>
                    <span className="text-sm font-medium text-white">Модальное окно при переходе</span>
                  </label>
                  
                  {modalEnabled && (
                    <div className="mt-3 space-y-3 pl-0">
                      {/* Image picker */}
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1.5 block">Изображение</label>
                        <div className="flex gap-2 flex-wrap">
                          {modalImages.map(img => (
                            <div
                              key={img.id}
                              onClick={() => setModalImageId(img.id)}
                              className={`w-16 h-16 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                                modalImageId === img.id ? 'border-purple-500 shadow-lg shadow-purple-500/20' : 'border-white/[0.06] hover:border-white/20'
                              }`}
                            >
                              <img src={`${BACKEND_URL}${img.url}`} alt={img.original_name} className="w-full h-full object-cover" />
                            </div>
                          ))}
                          <label className={`w-16 h-16 rounded-xl border-2 border-dashed border-white/[0.1] flex items-center justify-center cursor-pointer hover:border-white/20 transition-all ${uploadingImage ? 'opacity-50' : ''}`}>
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                            <span className="text-xl text-gray-600">{uploadingImage ? '⏳' : '+'}</span>
                          </label>
                        </div>
                      </div>
                      
                      {/* Title */}
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Заголовок</label>
                        <input
                          value={modalTitle} onChange={(e) => setModalTitle(e.target.value)}
                          placeholder="Добро пожаловать!"
                          className={`w-full px-3 py-2 ${GLASS.input} rounded-xl text-white text-sm outline-none`}
                        />
                      </div>
                      
                      {/* Description */}
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Описание</label>
                        <textarea
                          value={modalDescription} onChange={(e) => setModalDescription(e.target.value)}
                          placeholder="Текст модального окна..."
                          rows={2}
                          className={`w-full px-3 py-2 ${GLASS.input} rounded-xl text-white text-sm outline-none resize-none`}
                        />
                      </div>
                      
                      {/* Button text */}
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Текст кнопки</label>
                        <input
                          value={modalButtonText} onChange={(e) => setModalButtonText(e.target.value)}
                          placeholder="OK"
                          className={`w-full px-3 py-2 ${GLASS.input} rounded-xl text-white text-sm outline-none`}
                        />
                      </div>
                      
                      {/* Action type */}
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Действие кнопки</label>
                        <select
                          value={modalButtonAction} onChange={(e) => setModalButtonAction(e.target.value)}
                          className={`w-full px-3 py-2.5 ${GLASS.input} rounded-xl text-white text-sm outline-none appearance-none cursor-pointer`}
                        >
                          {ACTION_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-[#1a1a2e] text-white">{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Conditional fields based on action */}
                      {modalButtonAction === 'open_url' && (
                        <div>
                          <label className="text-[11px] text-gray-500 mb-1 block">URL для открытия</label>
                          <input
                            value={modalButtonUrl} onChange={(e) => setModalButtonUrl(e.target.value)}
                            placeholder="https://example.com"
                            className={`w-full px-3 py-2 ${GLASS.input} rounded-xl text-white text-sm outline-none`}
                          />
                        </div>
                      )}
                      
                      {modalButtonAction === 'navigate' && (
                        <div>
                          <label className="text-[11px] text-gray-500 mb-1 block">Раздел приложения</label>
                          <select
                            value={modalNavigateTo} onChange={(e) => setModalNavigateTo(e.target.value)}
                            className={`w-full px-3 py-2.5 ${GLASS.input} rounded-xl text-white text-sm outline-none appearance-none cursor-pointer`}
                          >
                            <option value="" className="bg-[#1a1a2e] text-gray-500">Выберите раздел</option>
                            {NAVIGATE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value} className="bg-[#1a1a2e] text-white">{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {modalButtonAction === 'reward' && (
                        <div>
                          <label className="text-[11px] text-gray-500 mb-1 block">Количество баллов</label>
                          <input
                            type="number" min="0"
                            value={modalRewardPoints} onChange={(e) => setModalRewardPoints(parseInt(e.target.value) || 0)}
                            className={`w-full px-3 py-2 ${GLASS.input} rounded-xl text-white text-sm outline-none`}
                          />
                        </div>
                      )}
                      
                      {/* Always show toggle */}
                      <label className="flex items-center gap-3 cursor-pointer group pt-1">
                        <div className={`relative w-10 h-5 rounded-full transition-all ${modalAlwaysShow ? 'bg-green-500' : 'bg-white/[0.08]'}`}
                          onClick={() => setModalAlwaysShow(!modalAlwaysShow)}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${modalAlwaysShow ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
                        </div>
                        <span className="text-sm text-gray-400">Показывать каждый раз</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Submit */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreate}
                  disabled={!formName.trim() || creating}
                  className={`w-full py-3 mt-2 rounded-xl font-semibold text-sm transition-all ${
                    formName.trim() && !creating
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40'
                      : 'bg-white/[0.05] text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Создаю...
                    </span>
                  ) : 'Создать ссылку'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Link Details Modal */}
      <AnimatePresence>
        {selectedLink && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLink(null)} />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] overflow-y-auto bg-[#0f0f1e] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl shadow-2xl"
            >
              {/* Detail Header */}
              <div className="sticky top-0 z-10 bg-[#0f0f1e]/95 backdrop-blur-xl border-b border-white/[0.06] p-4 sm:p-5">
                {/* Drag handle on mobile */}
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-2 sm:p-2.5 rounded-xl flex-shrink-0 ${selectedLink.is_active 
                      ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20' 
                      : 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/20'
                    }`}>
                      <Share2 className={`w-4 h-4 sm:w-5 sm:h-5 ${selectedLink.is_active ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-white truncate">{selectedLink.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] sm:text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">{selectedLink.code}</span>
                        {selectedLink.campaign && (
                          <span className="text-[10px] sm:text-[11px] text-gray-500">{selectedLink.campaign}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedLink(null)} className="p-2 hover:bg-white/[0.05] rounded-xl transition-colors flex-shrink-0">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Клики', value: selectedLink.total_clicks, color: 'from-purple-500 to-violet-500', icon: '👆' },
                    { label: 'Регистрации', value: selectedLink.registrations || 0, color: 'from-emerald-500 to-teal-500', icon: '🆕' },
                    { label: 'Входы', value: selectedLink.logins || 0, color: 'from-blue-500 to-cyan-500', icon: '🔑' },
                    { label: 'Уникальных кликов', value: selectedLink.unique_clicks, color: 'from-orange-500 to-amber-500', icon: '👤' },
                    { label: 'Сегодня', value: selectedLink.clicks_today || 0, color: 'from-pink-500 to-rose-500', icon: '📅' },
                    { label: 'За неделю', value: selectedLink.clicks_week || 0, color: 'from-cyan-400 to-blue-500', icon: '📊' },
                  ].map((stat, i) => (
                    <div key={i} className={`${GLASS.card} rounded-xl p-3.5`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">{stat.icon}</span>
                        <div className="text-[11px] text-gray-500">{stat.label}</div>
                      </div>
                      <div className={`text-xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Referral URL with copy */}
                <div className={`${GLASS.card} rounded-xl p-4`}>
                  <div className="text-[11px] text-gray-500 font-medium mb-2">Ссылка для распространения</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-white/[0.03] rounded-lg border border-white/[0.05] text-xs text-purple-300 font-mono truncate">
                      {selectedLink.full_url}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleCopy(selectedLink.full_url, 'detail-full')}
                      className="p-2.5 bg-purple-500/15 hover:bg-purple-500/25 rounded-lg transition-colors flex-shrink-0"
                    >
                      {copiedId === 'detail-full' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                    </motion.button>
                  </div>
                  {selectedLink.destination_url && (
                    <div className="mt-2">
                      <div className="text-[10px] text-gray-600 mb-1">Назначение</div>
                      <div className="text-[11px] text-gray-400 truncate">{selectedLink.destination_url}</div>
                    </div>
                  )}
                </div>

                {/* Events by day chart */}
                {selectedLink.events_by_day && selectedLink.events_by_day.length > 0 && (
                  <div className={`${GLASS.card} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold text-white">Динамика событий</span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={selectedLink.events_by_day}>
                        <defs>
                          <linearGradient id="detailClicksGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="detailRegsGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                        <Tooltip content={<GlassTooltip />} />
                        <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
                        <Area type="monotone" dataKey="clicks" name="Клики" stroke="#a78bfa" fill="url(#detailClicksGrad)" strokeWidth={2} />
                        <Area type="monotone" dataKey="registrations" name="Регистрации" stroke="#34d399" fill="url(#detailRegsGrad)" strokeWidth={2} />
                        <Area type="monotone" dataKey="logins" name="Входы" stroke="#60a5fa" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Device breakdown */}
                {selectedLink.clicks_by_device && selectedLink.clicks_by_device.length > 0 && (
                  <div className={`${GLASS.card} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Smartphone className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold text-white">Устройства</span>
                    </div>
                    <div className="space-y-2">
                      {selectedLink.clicks_by_device.map((d, i) => {
                        const total = selectedLink.clicks_by_device.reduce((s, x) => s + x.count, 0);
                        const pct = total ? Math.round(d.count / total * 100) : 0;
                        const deviceIcon = d.device === 'mobile' ? '📱' : d.device === 'tablet' ? '📟' : '💻';
                        const deviceLabel = d.device === 'mobile' ? 'Мобильные' : d.device === 'tablet' ? 'Планшеты' : d.device === 'desktop' ? 'Десктоп' : d.device;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-sm">{deviceIcon}</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-300">{deviceLabel}</span>
                                <span className="text-xs text-gray-500">{d.count} ({pct}%)</span>
                              </div>
                              <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8 }}
                                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent events */}
                {/* Modal config badge */}
                {selectedLink.modal_config?.enabled && (
                  <div className={`${GLASS.card} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">🖼</span>
                      <span className="text-sm font-semibold text-white">Модальное окно</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/20">Активно</span>
                    </div>
                    <div className="space-y-1 text-[11px] text-gray-400">
                      {selectedLink.modal_config.title && <div>Заголовок: <span className="text-gray-300">{selectedLink.modal_config.title}</span></div>}
                      <div>Кнопка: <span className="text-gray-300">{selectedLink.modal_config.button_text || 'OK'}</span> → <span className="text-purple-400">{selectedLink.modal_config.button_action}</span></div>
                      {selectedLink.modal_config.button_action === 'reward' && <div>Баллы: <span className="text-amber-400">+{selectedLink.modal_config.reward_points}</span></div>}
                      {selectedLink.modal_config.always_show && <div className="text-green-400">Показывается каждый раз</div>}
                    </div>
                  </div>
                )}
                
                {selectedLink.recent_events && selectedLink.recent_events.length > 0 && (
                  <div className={`${GLASS.card} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-semibold text-white">Последние события</span>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {selectedLink.recent_events.map((evt, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-white/[0.02] rounded-lg text-xs">
                          <span className="text-sm">{evt.event_type === 'click' ? '👆' : evt.event_type === 'registration' ? '🆕' : '🔑'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-300 font-medium">
                              {evt.event_type === 'click' ? 'Клик' : evt.event_type === 'registration' ? 'Регистрация' : 'Вход'}
                              {evt.telegram_name && <span className="text-gray-500 ml-1.5">— {evt.telegram_name}</span>}
                            </div>
                            {evt.device_type && <span className="text-[10px] text-gray-600">{evt.device_type === 'mobile' ? '📱' : '💻'} {evt.device_type}</span>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {evt.is_unique && evt.event_type === 'click' && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-md font-medium">NEW</span>}
                            <span className="text-[10px] text-gray-600">
                              {new Date(evt.timestamp).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Registered users list */}
                {selectedLink.registered_users && selectedLink.registered_users.length > 0 && (
                  <div className={`${GLASS.card} rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-white">Зарегистрированные пользователи ({selectedLink.registered_users.length})</span>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {selectedLink.registered_users.map((reg, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-white/[0.02] rounded-lg text-xs">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center text-white text-[10px] font-bold border border-emerald-500/20">
                            {(reg.telegram_name?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-gray-300 font-medium truncate">{reg.telegram_name || 'Пользователь'}</div>
                            {reg.telegram_username && <div className="text-[10px] text-gray-600">@{reg.telegram_username}</div>}
                          </div>
                          <span className="text-[10px] text-gray-600 flex-shrink-0">
                            {new Date(reg.timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Moscow' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleToggleActive(selectedLink)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      selectedLink.is_active 
                        ? 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/20' 
                        : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20'
                    }`}
                  >
                    {selectedLink.is_active ? '⏸ Деактивировать' : '▶ Активировать'}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(selectedLink.id)}
                    disabled={deleting === selectedLink.id}
                    className="px-4 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-semibold border border-red-500/15 transition-all"
                  >
                    {deleting === selectedLink.id ? '...' : '🗑 Удалить'}
                  </motion.button>
                </div>

                {/* Meta info */}
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  {[
                    { label: 'Источник', value: selectedLink.source || '—' },
                    { label: 'Канал', value: selectedLink.medium || '—' },
                    { label: 'Создана', value: new Date(selectedLink.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow' }) },
                    { label: 'Обновлена', value: new Date(selectedLink.updated_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Moscow' }) },
                  ].map((m, i) => (
                    <div key={i} className="bg-white/[0.02] rounded-lg p-2.5">
                      <span className="text-gray-600">{m.label}: </span>
                      <span className="text-gray-400">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      {view === 'list' ? (
        <>
          {/* Summary cards */}
          {analytics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <GlassStatCard
                icon={<Share2 className="w-4 h-4 text-white" />}
                title="Всего ссылок"
                value={analytics.total_links}
                subtitle={`${analytics.active_links} активных`}
                gradientFrom="from-purple-500"
                gradientTo="to-violet-600"
                delay={0}
              />
              <GlassStatCard
                icon={<Eye className="w-4 h-4 text-white" />}
                title="Всего кликов"
                value={analytics.total_clicks}
                subtitle={`${analytics.total_unique_clicks} уникальных`}
                gradientFrom="from-blue-500"
                gradientTo="to-cyan-500"
                delay={1}
              />
              <GlassStatCard
                icon={<TrendingUp className="w-4 h-4 text-white" />}
                title="Сегодня"
                value={analytics.clicks_today}
                subtitle="кликов"
                gradientFrom="from-emerald-500"
                gradientTo="to-teal-500"
                delay={2}
              />
              <GlassStatCard
                icon={<Calendar className="w-4 h-4 text-white" />}
                title="За неделю"
                value={analytics.clicks_week}
                subtitle="кликов"
                gradientFrom="from-orange-500"
                gradientTo="to-amber-500"
                delay={3}
              />
            </div>
          )}

          {/* Links list */}
          {links.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${GLASS.card} rounded-2xl p-10 flex flex-col items-center justify-center`}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center mb-4 border border-purple-500/10">
                <Share2 className="w-8 h-8 text-purple-500/40" />
              </div>
              <p className="text-sm text-gray-400 font-medium mb-1">Нет реферальных ссылок</p>
              <p className="text-[11px] text-gray-600 text-center">Создайте первую ссылку для отслеживания трафика</p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {links.map((link, idx) => (
                <motion.div
                  key={link.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`${GLASS.card} rounded-xl p-4 transition-all duration-300 ${GLASS.cardHover} cursor-pointer group`}
                  onClick={() => fetchLinkDetails(link.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${link.is_active ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-gray-600'}`} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white truncate">{link.name}</span>
                        <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded flex-shrink-0">{link.code}</span>
                        {link.source && (
                          <span className="text-[10px] text-gray-600 bg-white/[0.03] px-1.5 py-0.5 rounded flex-shrink-0">
                            {link.source}
                          </span>
                        )}
                      </div>
                      
                      {link.description && (
                        <p className="text-[11px] text-gray-500 truncate mb-1.5">{link.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-[11px]">
                        <span className="text-gray-400">
                          <span className="text-white font-semibold">{link.total_clicks}</span> кликов
                        </span>
                        <span className="text-gray-400">
                          <span className="text-emerald-400 font-semibold">{link.registrations || 0}</span> регистр.
                        </span>
                        <span className="text-gray-400">
                          <span className="text-blue-400 font-semibold">{link.logins || 0}</span> входов
                        </span>
                        {link.clicks_today > 0 && (
                          <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                            <ArrowUpRight className="w-3 h-3" /> +{link.clicks_today} сегодня
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Copy button */}
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(link.full_url, link.id);
                      }}
                      className="p-2 bg-white/[0.03] hover:bg-purple-500/15 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                    </motion.button>
                    
                    <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors flex-shrink-0 mt-1" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* ANALYTICS VIEW */
        <>
          {analytics ? (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <GlassStatCard
                  icon={<Share2 className="w-4 h-4 text-white" />}
                  title="Ссылок"
                  value={analytics.total_links}
                  subtitle={`${analytics.active_links} активных`}
                  gradientFrom="from-purple-500"
                  gradientTo="to-violet-600"
                  delay={0}
                />
                <GlassStatCard
                  icon={<Eye className="w-4 h-4 text-white" />}
                  title="Клики"
                  value={analytics.total_clicks}
                  subtitle={`${analytics.total_unique_clicks} уникальных`}
                  gradientFrom="from-blue-500"
                  gradientTo="to-cyan-500"
                  delay={1}
                />
                <GlassStatCard
                  icon={<Users className="w-4 h-4 text-white" />}
                  title="Регистрации"
                  value={analytics.total_registrations || 0}
                  subtitle="новых пользователей"
                  gradientFrom="from-emerald-500"
                  gradientTo="to-teal-500"
                  delay={2}
                />
                <GlassStatCard
                  icon={<Zap className="w-4 h-4 text-white" />}
                  title="Входы"
                  value={analytics.total_logins || 0}
                  subtitle="повторных визитов"
                  gradientFrom="from-orange-500"
                  gradientTo="to-amber-500"
                  delay={3}
                />
                <GlassStatCard
                  icon={<Activity className="w-4 h-4 text-white" />}
                  title="Сегодня"
                  value={analytics.clicks_today}
                  subtitle="кликов за день"
                  gradientFrom="from-pink-500"
                  gradientTo="to-rose-500"
                  delay={4}
                />
                <GlassStatCard
                  icon={<Calendar className="w-4 h-4 text-white" />}
                  title="За месяц"
                  value={analytics.clicks_month}
                  subtitle="кликов за 30 дней"
                  gradientFrom="from-cyan-400"
                  gradientTo="to-blue-500"
                  delay={5}
                />
              </div>

              {/* Events by day chart */}
              {analytics.clicks_by_day && analytics.clicks_by_day.length > 0 && (
                <GlassChartCard title="Динамика событий" icon={<TrendingUp className="w-4 h-4" />}>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={analytics.clicks_by_day}>
                      <defs>
                        <linearGradient id="analyticsClicksGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="analyticsRegsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.tertiary} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={CHART_COLORS.tertiary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                      <Tooltip content={<GlassTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                      <Area type="monotone" dataKey="clicks" name="Клики" stroke={CHART_COLORS.primary} fill="url(#analyticsClicksGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="registrations" name="Регистрации" stroke={CHART_COLORS.tertiary} fill="url(#analyticsRegsGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="logins" name="Входы" stroke="#60a5fa" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </GlassChartCard>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Top links */}
                {analytics.top_links && analytics.top_links.length > 0 && (
                  <GlassChartCard title="Топ ссылок" icon={<Star className="w-4 h-4" />}>
                    <div className="space-y-2.5">
                      {analytics.top_links.map((link, i) => {
                        const maxClicks = analytics.top_links[0]?.total_clicks || 1;
                        const pct = Math.round(link.total_clicks / maxClicks * 100);
                        return (
                          <div key={i} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] text-gray-600 font-mono w-4">#{i + 1}</span>
                                <span className="text-xs text-white font-medium truncate">{link.name}</span>
                                <span className="text-[10px] font-mono text-purple-400/60">{link.code}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-white font-bold">{link.total_clicks}</span>
                                <span className="text-[10px] text-emerald-400">{link.registrations || 0} рег</span>
                                <span className="text-[10px] text-blue-400">{link.logins || 0} вх</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: i * 0.1 }}
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassChartCard>
                )}

                {/* Clicks by source */}
                {analytics.clicks_by_source && analytics.clicks_by_source.length > 0 && (
                  <GlassChartCard title="Источники трафика" icon={<Globe className="w-4 h-4" />}>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={analytics.clicks_by_source}
                          dataKey="clicks"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          strokeWidth={0}
                        >
                          {analytics.clicks_by_source.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<GlassTooltip />} />
                        <Legend
                          wrapperStyle={{ fontSize: '11px' }}
                          formatter={(value) => <span className="text-gray-400">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </GlassChartCard>
                )}
              </div>

              {/* Recent events */}
              {analytics.recent_events && analytics.recent_events.length > 0 && (
                <GlassChartCard title="Последние события" icon={<Clock className="w-4 h-4" />}>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {analytics.recent_events.map((evt, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-2.5 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors"
                      >
                        <span className="text-base">{evt.event_type === 'click' ? '👆' : evt.event_type === 'registration' ? '🆕' : '🔑'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              evt.event_type === 'click' ? 'bg-purple-500/15 text-purple-400' :
                              evt.event_type === 'registration' ? 'bg-emerald-500/15 text-emerald-400' :
                              'bg-blue-500/15 text-blue-400'
                            }`}>
                              {evt.event_type === 'click' ? 'КЛИК' : evt.event_type === 'registration' ? 'РЕГИСТРАЦИЯ' : 'ВХОД'}
                            </span>
                            <span className="text-xs text-white font-medium truncate">{evt.link_name || evt.link_code}</span>
                          </div>
                          {evt.telegram_name && (
                            <div className="text-[10px] text-gray-500 mt-0.5">{evt.telegram_name}{evt.telegram_username ? ` (@${evt.telegram_username})` : ''}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-gray-600">{evt.device_type === 'mobile' ? '📱' : '💻'}</span>
                          <span className="text-[10px] text-gray-600 whitespace-nowrap">
                            {new Date(evt.timestamp).toLocaleString('ru-RU', { 
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' 
                            })}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </GlassChartCard>
              )}
            </div>
          ) : (
            <GlassLoader />
          )}
        </>
      )}
    </div>
  );
};

const ServerTab = ({ onlineData }) => {
  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const intervalRef = useRef(null);
  const onlineDataRef = useRef(onlineData);
  
  // Синхронизируем ref с актуальным onlineData
  useEffect(() => {
    onlineDataRef.current = onlineData;
  }, [onlineData]);

  const fetchServerStats = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/server-stats`);
      setServerData(res.data);
      setError(null);
      setHistory(prev => {
        const newPoint = {
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow' }),
          cpu: res.data.cpu?.percent || 0,
          ram: res.data.memory?.percent || 0,
          online: onlineDataRef.current?.online_now || 0,
        };
        const updated = [...prev, newPoint];
        return updated.slice(-30);
      });
    } catch (err) {
      setError(err.message);
      console.error('Server stats error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServerStats();
    intervalRef.current = setInterval(fetchServerStats, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchServerStats]);

  if (loading && !serverData) return <div className="p-6"><GlassLoader /></div>;

  if (error && !serverData) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-600 p-6">
      <Server className="w-16 h-16 mb-4 opacity-20" />
      <p className="text-sm">Не удалось загрузить данные сервера</p>
      <p className="text-[11px] text-red-400/60 mt-1">{error}</p>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={fetchServerStats}
        className="mt-4 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white text-sm font-medium shadow-[0_0_20px_rgba(6,182,212,0.3)]"
      >
        Попробовать снова
      </motion.button>
    </div>
  );

  const cpu = serverData?.cpu || {};
  const mem = serverData?.memory || {};
  const disk = serverData?.disk || {};
  const uptime = serverData?.uptime || {};
  const proc = serverData?.process || {};
  const mongo = serverData?.mongodb || {};
  const system = serverData?.system || {};
  const network = serverData?.network || {};
  const topProcs = serverData?.top_processes || [];

  return (
    <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-5">
      {/* Header with auto-refresh indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-cyan-500 rounded-full animate-ping opacity-50" />
          </div>
          <h3 className="text-lg font-semibold text-white">Нагрузка сервера</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-600">
            {serverData?.timestamp ? new Date(serverData.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Moscow' }) : ''}
          </span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={fetchServerStats}
            className={`flex items-center gap-2 px-3 py-2 ${GLASS.card} rounded-xl transition-all text-sm text-gray-300 ${GLASS.cardHover}`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* System Info Bar */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${GLASS.card} rounded-2xl p-4 relative overflow-hidden`}
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl" />
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-gray-400 relative z-10">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] rounded-lg border border-white/[0.06]">
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            <span>{system.platform} {system.platform_release}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] rounded-lg border border-white/[0.06]">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>{system.architecture} • {cpu.count_logical} ядер</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] rounded-lg border border-white/[0.06]">
            <Clock className="w-3.5 h-3.5 text-green-400" />
            <span>Uptime: {uptime.days}д {uptime.hours}ч {uptime.minutes}м</span>
          </div>
          {cpu.load_average && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] rounded-lg border border-white/[0.06]">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Load: {cpu.load_average['1min']} / {cpu.load_average['5min']} / {cpu.load_average['15min']}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Gauges Row */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className={`${GLASS.card} rounded-2xl p-5 flex flex-col items-center transition-all duration-300 ${GLASS.cardHover}`}
        >
          <CircularGauge
            value={cpu.percent || 0}
            label="CPU"
            subtitle={cpu.frequency_mhz ? `${cpu.frequency_mhz} MHz` : `${cpu.count_logical} cores`}
            icon={<Cpu className="w-3.5 h-3.5" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className={`${GLASS.card} rounded-2xl p-5 flex flex-col items-center transition-all duration-300 ${GLASS.cardHover}`}
        >
          <CircularGauge
            value={mem.percent || 0}
            label="RAM"
            subtitle={`${mem.used_gb} / ${mem.total_gb} GB`}
            icon={<MemoryStick className="w-3.5 h-3.5" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className={`${GLASS.card} rounded-2xl p-5 flex flex-col items-center transition-all duration-300 ${GLASS.cardHover}`}
        >
          <CircularGauge
            value={disk.percent || 0}
            label="Диск"
            subtitle={`${disk.used_gb} / ${disk.total_gb} GB`}
            icon={<HardDrive className="w-3.5 h-3.5" />}
          />
        </motion.div>
      </div>

      {/* CPU, RAM & Online History Chart */}
      {history.length > 1 && (
        <GlassChartCard title="CPU, RAM и Онлайн в реальном времени" icon={<Activity className="w-4 h-4" />}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={history} margin={{ top: 5, right: 35, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCpuHist" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRamHist" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOnlineHist" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="time" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="percent" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
              <YAxis yAxisId="online" orientation="right" stroke="transparent" tick={{ fill: '#22c55e', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<GlassTooltip formatter={(v, name) => {
                if (name === 'cpu') return [`${v}%`, 'CPU'];
                if (name === 'ram') return [`${v}%`, 'RAM'];
                return [v, 'Онлайн'];
              }} />} />
              <Area yAxisId="percent" type="monotone" dataKey="cpu" stroke="#06b6d4" strokeWidth={2} fill="url(#gradCpuHist)" name="cpu" dot={false} />
              <Area yAxisId="percent" type="monotone" dataKey="ram" stroke="#a78bfa" strokeWidth={2} fill="url(#gradRamHist)" name="ram" dot={false} />
              <Area yAxisId="online" type="monotone" dataKey="online" stroke="#22c55e" strokeWidth={2} fill="url(#gradOnlineHist)" name="online" dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-[11px] text-gray-500">CPU</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1.5 rounded-full bg-purple-400" />
              <span className="text-[11px] text-gray-500">RAM</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-1.5 rounded-full bg-green-500" style={{ borderBottom: '1px dashed #22c55e' }} />
              <span className="text-[11px] text-gray-500">Онлайн</span>
            </div>
          </div>
        </GlassChartCard>
      )}

      {/* Per-Core CPU */}
      {cpu.per_core && cpu.per_core.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${GLASS.card} rounded-2xl p-5`}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-gradient-to-br from-cyan-500/15 to-blue-500/15 rounded-xl text-cyan-400 backdrop-blur-sm border border-cyan-500/10">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-[15px] font-semibold text-white tracking-tight">Нагрузка по ядрам</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cpu.per_core.map((coreVal, i) => {
              const barColor = coreVal < 50 ? 'from-emerald-500 to-teal-500' : coreVal < 75 ? 'from-amber-500 to-yellow-500' : coreVal < 90 ? 'from-orange-500 to-red-500' : 'from-red-500 to-rose-600';
              return (
                <div key={i} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-gray-500 font-medium">Core {i}</span>
                    <span className="text-sm font-bold text-white">{Math.round(coreVal)}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                      style={{ width: `${Math.max(2, coreVal)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* MongoDB & Process Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MongoDB Stats */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${GLASS.card} rounded-2xl p-5 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-2.5 mb-4 relative z-10">
            <div className="p-2 bg-gradient-to-br from-green-500/15 to-emerald-500/15 rounded-xl text-green-400 backdrop-blur-sm border border-green-500/10">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-[15px] font-semibold text-white tracking-tight">MongoDB</h3>
            {mongo.db_name && <span className="text-[11px] text-gray-600 bg-white/[0.04] px-2 py-0.5 rounded-md">{mongo.db_name}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2.5 relative z-10">
            {[
              { label: 'Коллекции', value: mongo.collections, icon: '📁' },
              { label: 'Объекты', value: mongo.objects ? formatNumber(mongo.objects) : '0', icon: '📄' },
              { label: 'Данные', value: `${mongo.data_size_mb || 0} MB`, icon: '💾' },
              { label: 'Индексы', value: `${mongo.indexes || 0} (${mongo.index_size_mb || 0} MB)`, icon: '🗂️' },
              { label: 'Подключения', value: `${mongo.connections_current || 0} / ${mongo.connections_available || 0}`, icon: '🔗' },
              { label: 'Uptime MongoDB', value: mongo.uptime_seconds ? `${Math.floor(mongo.uptime_seconds / 3600)}ч` : '—', icon: '⏱️' },
            ].map((item) => (
              <div key={item.label} className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                <div className="text-[10px] text-gray-600 mb-1">{item.icon} {item.label}</div>
                <div className="text-sm font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* FastAPI Process */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${GLASS.card} rounded-2xl p-5 relative overflow-hidden`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl" />
          <div className="flex items-center gap-2.5 mb-4 relative z-10">
            <div className="p-2 bg-gradient-to-br from-purple-500/15 to-pink-500/15 rounded-xl text-purple-400 backdrop-blur-sm border border-purple-500/10">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-[15px] font-semibold text-white tracking-tight">FastAPI процесс</h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5 relative z-10">
            {[
              { label: 'PID', value: proc.pid, icon: '🔢' },
              { label: 'RSS память', value: `${proc.memory_rss_mb || 0} MB`, icon: '🧠' },
              { label: 'VMS память', value: `${proc.memory_vms_mb || 0} MB`, icon: '📊' },
              { label: 'Потоки', value: proc.threads, icon: '🧵' },
              { label: 'CPU', value: `${proc.cpu_percent || 0}%`, icon: '⚡' },
              { label: 'Запущен', value: proc.started_at ? new Date(proc.started_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }) : '—', icon: '🕐' },
            ].map((item) => (
              <div key={item.label} className="p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                <div className="text-[10px] text-gray-600 mb-1">{item.icon} {item.label}</div>
                <div className="text-sm font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>

          {/* Network */}
          {network && (
            <div className="mt-4 pt-3 border-t border-white/[0.06] relative z-10">
              <div className="text-[11px] text-gray-500 font-medium mb-2 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Сеть
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05] text-center">
                  <div className="text-[10px] text-gray-600 flex items-center justify-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-green-400" /> Отправлено
                  </div>
                  <div className="text-xs font-semibold text-white mt-0.5">{formatBytes(network.bytes_sent)}</div>
                </div>
                <div className="p-2 bg-white/[0.03] rounded-lg border border-white/[0.05] text-center">
                  <div className="text-[10px] text-gray-600 flex items-center justify-center gap-1">
                    <ArrowDownRight className="w-3 h-3 text-blue-400" /> Получено
                  </div>
                  <div className="text-xs font-semibold text-white mt-0.5">{formatBytes(network.bytes_recv)}</div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Top Processes */}
      {topProcs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${GLASS.card} rounded-2xl p-5`}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-gradient-to-br from-orange-500/15 to-amber-500/15 rounded-xl text-orange-400 backdrop-blur-sm border border-orange-500/10">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-[15px] font-semibold text-white tracking-tight">Топ процессов</h3>
          </div>
          <div className="space-y-1.5">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider font-semibold">
              <span className="col-span-2">PID</span>
              <span className="col-span-5">Имя</span>
              <span className="col-span-2 text-right">CPU %</span>
              <span className="col-span-3 text-right">RAM %</span>
            </div>
            {topProcs.map((p, i) => (
              <motion.div
                key={p.pid}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-12 gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-colors items-center border border-transparent hover:border-white/[0.05]"
              >
                <span className="col-span-2 text-[11px] text-gray-600 font-mono">{p.pid}</span>
                <span className="col-span-5 text-[12px] text-white font-medium truncate">{p.name}</span>
                <span className={`col-span-2 text-right text-[12px] font-bold ${p.cpu_percent > 50 ? 'text-orange-400' : 'text-gray-300'}`}>{p.cpu_percent}</span>
                <span className={`col-span-3 text-right text-[12px] font-bold ${p.memory_percent > 50 ? 'text-red-400' : 'text-gray-300'}`}>{p.memory_percent}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ===== History Section ===== */}
      <ServerHistorySection />

      {/* Auto-refresh info */}
      <div className="flex items-center gap-2 p-3.5 bg-cyan-500/[0.06] border border-cyan-500/10 rounded-xl text-[12px] text-cyan-300/80 backdrop-blur-sm">
        <Info className="w-4 h-4 flex-shrink-0 text-cyan-400/60" />
        <span>Данные обновляются автоматически каждые 5 секунд. История записывается каждую минуту и хранится 7 дней.</span>
      </div>
    </div>
  );
};

// =============================================
// SERVER HISTORY - История нагрузки и пики
// =============================================

const HISTORY_PERIODS = [
  { label: '1ч', hours: 1 },
  { label: '6ч', hours: 6 },
  { label: '24ч', hours: 24 },
  { label: '3д', hours: 72 },
  { label: '7д', hours: 168 },
  { label: '30д', hours: 720 },
  { label: 'Всё', hours: 0 },
];

const PeakCard = ({ label, value, unit, timestamp, icon, color }) => {
  const formattedTime = timestamp 
    ? new Date(timestamp).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
    : '—';
  
  return (
    <div className={`${GLASS.card} rounded-2xl p-4 relative overflow-hidden transition-all duration-300 ${GLASS.cardHover}`}>
      <div className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-3xl opacity-20`} style={{ background: color }} />
      <div className="flex items-center gap-2 mb-2.5 relative z-10">
        <div className="p-1.5 rounded-lg" style={{ background: `${color}20`, border: `1px solid ${color}20` }}>
          {icon}
        </div>
        <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="relative z-10">
        <div className="text-2xl font-bold text-white">
          {value}{unit}
        </div>
        <div className="text-[11px] text-gray-600 mt-1 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formattedTime}
        </div>
      </div>
    </div>
  );
};

const ServerHistorySection = () => {
  const [historyData, setHistoryData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(24);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async (hours) => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/server-stats-history?hours=${hours}`);
      setHistoryData(res.data);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(selectedPeriod);
    const interval = setInterval(() => fetchHistory(selectedPeriod), 60000);
    return () => clearInterval(interval);
  }, [selectedPeriod, fetchHistory]);

  const metrics = historyData?.metrics || [];
  const peaks = historyData?.peaks;
  const averages = historyData?.averages;

  // Форматируем метки времени для графиков
  const chartData = metrics.map(m => ({
    ...m,
    time: (() => {
      const d = new Date(m.timestamp);
      if (selectedPeriod <= 6) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
      if (selectedPeriod <= 24) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Moscow' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
    })(),
  }));

  return (
    <>
      {/* Section Divider */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          История нагрузки
        </h3>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        {HISTORY_PERIODS.map((p) => (
          <motion.button
            key={p.hours}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedPeriod(p.hours)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
              selectedPeriod === p.hours
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                : `${GLASS.card} text-gray-500 hover:text-gray-300 ${GLASS.cardHover}`
            }`}
          >
            {p.label}
          </motion.button>
        ))}
        <div className="ml-auto">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => fetchHistory(selectedPeriod)}
            className={`p-2 ${GLASS.card} rounded-xl text-gray-400 ${GLASS.cardHover}`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* Peak Cards */}
      {peaks && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-red-500/10 rounded-lg border border-red-500/10">
              <TrendingUp className="w-4 h-4 text-red-400" />
            </div>
            <h4 className="text-[13px] font-semibold text-white">Пиковые нагрузки</h4>
            <span className="text-[11px] text-gray-600 ml-auto">за {HISTORY_PERIODS.find(p => p.hours === selectedPeriod)?.label || selectedPeriod + 'ч'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <PeakCard
              label="CPU пик"
              value={peaks.cpu?.value || 0}
              unit="%"
              timestamp={peaks.cpu?.timestamp}
              icon={<Cpu className="w-3.5 h-3.5 text-cyan-400" />}
              color="#06b6d4"
            />
            <PeakCard
              label="RAM пик"
              value={peaks.ram?.value || 0}
              unit="%"
              timestamp={peaks.ram?.timestamp}
              icon={<MemoryStick className="w-3.5 h-3.5 text-purple-400" />}
              color="#a78bfa"
            />
            <PeakCard
              label="Диск пик"
              value={peaks.disk?.value || 0}
              unit="%"
              timestamp={peaks.disk?.timestamp}
              icon={<HardDrive className="w-3.5 h-3.5 text-orange-400" />}
              color="#f97316"
            />
            <PeakCard
              label="Load пик"
              value={peaks.load?.value || 0}
              unit=""
              timestamp={peaks.load?.timestamp}
              icon={<Activity className="w-3.5 h-3.5 text-red-400" />}
              color="#ef4444"
            />
          </div>
          {/* Averages bar */}
          {averages && (
            <div className="flex items-center gap-4 mt-3 px-3 py-2.5 bg-white/[0.02] rounded-xl border border-white/[0.05]">
              <span className="text-[11px] text-gray-600 font-medium">Среднее:</span>
              <span className="text-[12px] text-cyan-300">CPU {averages.cpu}%</span>
              <span className="text-[12px] text-purple-300">RAM {averages.ram}%</span>
              <span className="text-[12px] text-orange-300">Диск {averages.disk}%</span>
            </div>
          )}
        </motion.div>
      )}

      {/* History Charts */}
      {chartData.length > 1 ? (
        <>
          {/* CPU & RAM History */}
          <GlassChartCard title="CPU и RAM — история" icon={<Activity className="w-4 h-4" />}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCpuHistory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRamHistory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="time" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip content={<GlassTooltip formatter={(v, name) => [`${v}%`, name === 'cpu_percent' ? 'CPU' : 'RAM']} />} />
                <Area type="monotone" dataKey="cpu_percent" stroke="#06b6d4" strokeWidth={1.5} fill="url(#gradCpuHistory)" name="cpu_percent" dot={false} />
                <Area type="monotone" dataKey="ram_percent" stroke="#a78bfa" strokeWidth={1.5} fill="url(#gradRamHistory)" name="ram_percent" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-1.5 rounded-full bg-cyan-400" />
                <span className="text-[11px] text-gray-500">CPU</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1.5 rounded-full bg-purple-400" />
                <span className="text-[11px] text-gray-500">RAM</span>
              </div>
            </div>
          </GlassChartCard>

          {/* Load Average History */}
          <GlassChartCard title="Load Average — история" icon={<Gauge className="w-4 h-4" />}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="time" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<GlassTooltip formatter={(v, name) => [v, name === 'load_1' ? 'Load 1m' : 'Load 5m']} />} />
                <Line type="monotone" dataKey="load_1" stroke="#f59e0b" strokeWidth={2} dot={false} name="load_1" />
                <Line type="monotone" dataKey="load_5" stroke="#f97316" strokeWidth={1.5} dot={false} name="load_5" strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[11px] text-gray-500">Load 1 мин</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0 border-t-[1.5px] border-dashed border-orange-400" />
                <span className="text-[11px] text-gray-500">Load 5 мин</span>
              </div>
            </div>
          </GlassChartCard>

          {/* Disk History */}
          <GlassChartCard title="Диск — история" icon={<HardDrive className="w-4 h-4" />}>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDiskHistory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="time" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip content={<GlassTooltip formatter={(v) => [`${v}%`, 'Диск']} />} />
                <Area type="monotone" dataKey="disk_percent" stroke="#f97316" strokeWidth={1.5} fill="url(#gradDiskHistory)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassChartCard>

          {/* FastAPI Process Memory History */}
          <GlassChartCard title="Память FastAPI процесса — история" icon={<Zap className="w-4 h-4" />}>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradProcHistory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="time" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} unit=" MB" />
                <Tooltip content={<GlassTooltip formatter={(v) => [`${v} MB`, 'RSS память']} />} />
                <Area type="monotone" dataKey="process_rss_mb" stroke="#ec4899" strokeWidth={1.5} fill="url(#gradProcHistory)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassChartCard>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`${GLASS.card} rounded-2xl p-8 flex flex-col items-center justify-center`}
        >
          <Clock className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-sm text-gray-500 text-center">Данные истории ещё собираются</p>
          <p className="text-[11px] text-gray-600 mt-1 text-center">Метрики записываются каждую минуту. Первые графики появятся через пару минут.</p>
        </motion.div>
      )}
    </>
  );
};

// ============ TelegramPostNotifyTab ============

const TelegramPostNotifyTab = () => {
  const [telegramUrl, setTelegramUrl] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [recipients, setRecipients] = useState('all');

  const handleParse = async () => {
    if (!telegramUrl.trim()) return;
    setParsing(true);
    setParsedData(null);
    setSendResult(null);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/admin/notifications/parse-telegram`, {
        telegram_url: telegramUrl.trim()
      });
      setParsedData(res.data);
      setEditTitle(res.data.title || '');
      setEditDescription(res.data.description || '');
    } catch (err) {
      console.error('Parse error:', err);
      setParsedData({ error: err.response?.data?.detail || 'Ошибка парсинга' });
    } finally {
      setParsing(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await axios.post(`${API_BASE}/admin/notifications/send-from-post`, {
        title: editTitle,
        description: editDescription,
        image_url: parsedData?.image_url || '',
        recipients
      });
      setSendResult(res.data);
    } catch (err) {
      console.error('Send error:', err);
      setSendResult({ success: false, message: err.response?.data?.detail || 'Ошибка отправки' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`${GLASS.card} rounded-2xl p-4`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <Send className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Уведомление из Telegram поста</h3>
            <p className="text-xs text-gray-500">Парсинг публичного поста → отправка всем</p>
          </div>
        </div>

        {/* URL Input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={telegramUrl}
            onChange={(e) => setTelegramUrl(e.target.value)}
            placeholder="https://t.me/channel/123"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 border border-white/10"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            onKeyDown={(e) => e.key === 'Enter' && handleParse()}
          />
          <button
            onClick={handleParse}
            disabled={parsing || !telegramUrl.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-500 text-white disabled:opacity-50 hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            {parsing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Парсить
          </button>
        </div>
      </div>

      {/* Error */}
      {parsedData?.error && (
        <div className={`${GLASS.card} rounded-2xl p-4 border border-red-500/20`}>
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {parsedData.error}
          </div>
        </div>
      )}

      {/* Preview */}
      {parsedData && !parsedData.error && (
        <div className={`${GLASS.card} rounded-2xl p-4`}>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Предпросмотр</h4>
          
          {/* Image */}
          {parsedData.image_url && (
            <div className="mb-3 rounded-xl overflow-hidden border border-white/5">
              <img 
                src={parsedData.image_url} 
                alt="Post" 
                className="w-full max-h-48 object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
          )}

          {/* Editable Title */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Заголовок</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              placeholder="Заголовок уведомления"
            />
          </div>

          {/* Editable Description */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Текст</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 resize-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              placeholder="Текст уведомления"
            />
          </div>

          {/* Recipients */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-2 block">Получатели</label>
            <div className="flex gap-2">
              {['all', 'group'].map(type => (
                <button
                  key={type}
                  onClick={() => setRecipients(type)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    recipients === type 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}
                >
                  {type === 'all' ? '● Все пользователи' : '○ Группа'}
                </button>
              ))}
            </div>
          </div>

          {/* Send Button */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setParsedData(null);
                setTelegramUrl('');
                setSendResult(null);
              }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 border border-white/10 hover:bg-white/5 transition-colors"
            >
              ❌ Отмена
            </button>
            <button
              onClick={handleSend}
              disabled={sending || (!editTitle && !editDescription)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              📤 Отправить уведомление
            </button>
          </div>
        </div>
      )}

      {/* Send Result */}
      {sendResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${GLASS.card} rounded-2xl p-4 border ${
            sendResult.success ? 'border-green-500/20' : 'border-red-500/20'
          }`}
        >
          <div className={`flex items-center gap-2 text-sm ${
            sendResult.success ? 'text-green-400' : 'text-red-400'
          }`}>
            {sendResult.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="font-medium">{sendResult.message}</span>
          </div>
          {sendResult.sent !== undefined && (
            <div className="text-xs text-gray-500 mt-2">
              Отправлено: {sendResult.sent} | Ошибки: {sendResult.failed || 0}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AdminPanel;
