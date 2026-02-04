import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, Calendar, Award, 
  UserCheck, UserX, Clock, AlertCircle, 
  BookOpen, GraduationCap, FlaskConical, FileText,
  CheckCircle, XCircle, AlertTriangle,
  Trophy,
} from 'lucide-react';
import { getMyAttendance } from '../../services/journalAPI';

// Цветовая палитра
const COLORS = {
  present: '#22c55e',   // green-500
  absent: '#ef4444',    // red-500
  excused: '#6b7280',   // gray-500
  late: '#eab308',      // yellow-500
  unmarked: '#374151',  // gray-700
};

const PIE_COLORS = ['#22c55e', '#ef4444', '#6b7280', '#eab308'];

const SESSION_ICONS = {
  lecture: BookOpen,
  seminar: GraduationCap,
  lab: FlaskConical,
  exam: FileText,
};

const STATUS_CONFIG = {
  present: { label: 'Присутствовал', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
  absent: { label: 'Отсутствовал', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
  late: { label: 'Опоздал', icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  excused: { label: 'Уважительная', icon: AlertTriangle, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  unmarked: { label: 'Не отмечено', icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-700/20' },
};

// Кастомный тултип для Pie chart
const PieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-[#1C1C1E] border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-white font-medium text-sm">{data.name}</p>
        <p className="text-xs text-gray-400">{data.value} занятий ({data.payload.percent}%)</p>
      </div>
    );
  }
  return null;
};

// Кастомный тултип для Line chart
const LineTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const statusConfig = STATUS_CONFIG[data.status] || STATUS_CONFIG.unmarked;
    return (
      <div className="bg-[#1C1C1E] border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-white font-medium text-sm">{data.title}</p>
        <p className="text-xs text-gray-400 mb-1">{data.name}</p>
        <p className={`text-xs ${statusConfig.color}`}>
          {statusConfig.label}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Накопительно: <span className="text-white font-medium">{data.attendance}%</span>
        </p>
      </div>
    );
  }
  return null;
};

// Кастомный dot для Line chart
const CustomDot = ({ cx, cy, payload }) => {
  const color = payload.status === 'present' ? COLORS.present :
               payload.status === 'late' ? COLORS.late :
               payload.status === 'absent' ? COLORS.absent :
               payload.status === 'excused' ? COLORS.excused : COLORS.unmarked;
  return (
    <circle cx={cx} cy={cy} r={4} fill={color} stroke="none" />
  );
};

// Склонение существительных
const getNoun = (number, one, two, five) => {
  let n = Math.abs(number);
  n %= 100;
  if (n >= 5 && n <= 20) {
    return five;
  }
  n %= 10;
  if (n === 1) {
    return one;
  }
  if (n >= 2 && n <= 4) {
    return two;
  }
  return five;
};


export const MyAttendanceStats = ({ 
  journalId, 
  telegramId,
  gradient = 'from-purple-400 to-pink-400'
}) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllRecords, setShowAllRecords] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      if (!journalId || !telegramId) return;
      
      setIsLoading(true);
      try {
        const data = await getMyAttendance(journalId, telegramId);
        setStats(data);
      } catch (error) {
        console.error('Error loading my attendance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [journalId, telegramId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-10">
        <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">Не удалось загрузить статистику</p>
        <p className="text-gray-500 text-sm mt-1">Возможно, вы ещё не привязаны к журналу</p>
      </div>
    );
  }

  // Подготовка данных для pie chart
  const pieData = [
    { name: 'Присутствовал', value: stats.present_count - stats.late_count, percent: 0 },
    { name: 'Отсутствовал', value: stats.absent_count, percent: 0 },
    { name: 'Уважительная', value: stats.excused_count, percent: 0 },
    { name: 'Опоздал', value: stats.late_count, percent: 0 },
  ].filter(d => d.value > 0);

  const totalRecords = stats.present_count + stats.absent_count + stats.excused_count;
  pieData.forEach(d => {
    d.percent = totalRecords > 0 ? Math.round((d.value / totalRecords) * 100) : 0;
  });

  // Подготовка данных для графика динамики (от старых к новым)
  const chartRecords = [...(stats.records || [])]
    .filter(r => r.status !== 'unmarked')
    .reverse()
    .slice(-20); // Последние 20 занятий
  
  const lineChartData = chartRecords.map((r, idx) => {
    // Накопительный процент посещаемости
    const recordsUpToNow = chartRecords.slice(0, idx + 1);
    const presentCount = recordsUpToNow.filter(rec => rec.status === 'present' || rec.status === 'late').length;
    const totalCount = recordsUpToNow.length;
    const percent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
    
    return {
      name: new Date(r.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      fullDate: r.date,
      title: r.title,
      status: r.status,
      attendance: percent
    };
  });

  // Записи для отображения
  const displayRecords = showAllRecords 
    ? stats.records 
    : stats.records?.slice(0, 10) || [];

  // Определяем статус посещаемости и цвет окантовки
  const getAttendanceStatus = (percent) => {
    if (percent >= 80) return { 
      text: 'Отлично!', 
      emoji: '🏆', 
      color: 'text-green-400',
      borderColor: 'border-green-500/50',
      bgColor: 'bg-green-500/5'
    };
    if (percent >= 60) return { 
      text: 'Хорошо', 
      emoji: '👍', 
      color: 'text-yellow-400',
      borderColor: 'border-yellow-500/50',
      bgColor: 'bg-yellow-500/5'
    };
    return { 
      text: 'Требует внимания', 
      emoji: '⚠️', 
      color: 'text-red-400',
      borderColor: 'border-red-500/50',
      bgColor: 'bg-red-500/5'
    };
  };

  const attendanceStatus = getAttendanceStatus(stats.attendance_percent);

  return (
    <div className="space-y-6">
      {/* Заголовок с именем - сдержанный фон с цветной окантовкой */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${attendanceStatus.bgColor} border-2 ${attendanceStatus.borderColor} rounded-2xl p-5`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-gray-400 text-sm">Ваша статистика</p>
            <h2 className="text-lg font-bold text-white mt-1 truncate">{stats.full_name}</h2>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-bold text-white">{stats.attendance_percent}%</p>
            <p className={`text-sm ${attendanceStatus.color}`}>
              {attendanceStatus.emoji} {attendanceStatus.text}
            </p>
          </div>
        </div>
      </motion.div>


      {/* Стрик посещений */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4 relative overflow-hidden"
      >
        {/* Фоновый эффект */}
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 flex-shrink-0">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-2xl font-bold text-white">
                {stats.current_streak || 0}
              </h3>
              <span className="text-sm font-medium text-yellow-200/80 whitespace-nowrap">
                {getNoun(stats.current_streak || 0, 'пара', 'пары', 'пар')} подряд
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Лучший результат: <span className="text-yellow-400">{stats.best_streak || 0}</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4 text-green-400" />
            <p className="text-xs text-gray-400">Присутствовал</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{stats.present_count}</p>
          <p className="text-xs text-gray-500 mt-1">из {stats.total_sessions} занятий</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <UserX className="w-4 h-4 text-red-400" />
            <p className="text-xs text-gray-400">Пропустил</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.absent_count}</p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.excused_count > 0 && `+ ${stats.excused_count} по ув. причине`}
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-yellow-400" />
            <p className="text-xs text-gray-400">Опоздал</p>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{stats.late_count}</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-purple-400" />
            <p className="text-xs text-gray-400">Всего занятий</p>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total_sessions}</p>
        </motion.div>
      </div>

      {/* Круговая диаграмма */}
      {pieData.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <h3 className="text-sm font-medium text-white mb-4">Распределение посещаемости</h3>
          
          <div className="flex items-center">
            <div className="w-1/2" style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="w-1/2 space-y-2">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="text-xs text-gray-400">{entry.name}</span>
                  </div>
                  <span className="text-xs font-medium text-white">{entry.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* График динамики посещаемости */}
      {lineChartData.length > 1 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <h3 className="text-sm font-medium text-white mb-4">Динамика посещаемости</h3>
          
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={lineChartData}
                margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#9CA3AF', fontSize: 9 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<LineTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="attendance" 
                  stroke="#a855f7" 
                  strokeWidth={2}
                  dot={<CustomDot />}
                  activeDot={{ r: 6, fill: '#ec4899' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Легенда */}
          <div className="flex justify-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs text-gray-400">Был</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="text-xs text-gray-400">Опоздал</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-gray-400">Пропуск</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
              <span className="text-xs text-gray-400">Ув.</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* История занятий */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-white/5 rounded-xl p-4"
      >
        <h3 className="text-sm font-medium text-white mb-4">История занятий</h3>
        
        {stats.records?.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Нет записей о занятиях</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {displayRecords.map((record, index) => {
                const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.unmarked;
                const StatusIcon = statusConfig.icon;
                const SessionIcon = SESSION_ICONS[record.type] || BookOpen;
                
                return (
                  <motion.div
                    key={record.session_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex items-center justify-between p-3 rounded-lg ${statusConfig.bg}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                        <SessionIcon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{record.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(record.date).toLocaleDateString('ru-RU', { 
                            day: 'numeric', 
                            month: 'long',
                            weekday: 'short'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                      <span className={`text-xs font-medium ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            {stats.records?.length > 10 && (
              <button
                onClick={() => setShowAllRecords(!showAllRecords)}
                className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                {showAllRecords ? 'Скрыть' : `Показать все (${stats.records.length})`}
              </button>
            )}
          </>
        )}
      </motion.div>

      {/* Подсказки и мотивация */}
      {stats.attendance_percent < 70 && stats.total_sessions > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h4 className="text-white font-medium">Совет</h4>
              <p className="text-sm text-gray-400 mt-1">
                Постарайтесь не пропускать занятия! Чтобы поднять посещаемость до 70%, 
                нужно посетить ещё {Math.ceil((0.7 * stats.total_sessions - stats.present_count) / (1 - 0.7))} занятий подряд.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {stats.attendance_percent >= 90 && stats.total_sessions >= 5 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-green-500/10 border border-green-500/20 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h4 className="text-white font-medium">Отличный результат! 🎉</h4>
              <p className="text-sm text-gray-400 mt-1">
                Вы отлично посещаете занятия. Продолжайте в том же духе!
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default MyAttendanceStats;
