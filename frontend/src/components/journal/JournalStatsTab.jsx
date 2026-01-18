import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Users, TrendingUp, Calendar, Award, 
  UserCheck, UserX, Clock, AlertCircle, ChevronDown, ChevronUp,
  Shield, ShieldCheck, X, Plus, BookOpen, ChevronRight
} from 'lucide-react';
import { getJournalStats } from '../../services/journalAPI';
import { SubjectAttendanceModal } from './SubjectAttendanceModal';

// Цветовая палитра для графиков
const COLORS = {
  present: '#22c55e',   // green-500
  absent: '#ef4444',    // red-500
  excused: '#6b7280',   // gray-500
  late: '#eab308',      // yellow-500
  gradient: {
    purple: ['#a855f7', '#ec4899'],
    blue: ['#3b82f6', '#06b6d4'],
    green: ['#22c55e', '#10b981'],
    orange: ['#f97316', '#fbbf24'],
  }
};

const PIE_COLORS = ['#22c55e', '#ef4444', '#6b7280', '#eab308'];

// Кастомный тултип для графиков
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1C1C1E] border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-white font-medium text-sm mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Кастомный тултип для Pie chart
const PieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-[#1C1C1E] border border-white/10 rounded-lg p-3 shadow-xl">
        <p className="text-white font-medium text-sm">{data.name}</p>
        <p className="text-xs text-gray-400">{data.value} студентов ({data.payload.percent}%)</p>
      </div>
    );
  }
  return null;
};

export const JournalStatsTab = ({ 
  journalId, 
  telegramId,
  students, 
  subjects, 
  pendingMembers,
  gradient = 'from-purple-400 to-pink-400',
  isOwner = false,
  statsViewers = [],
  onUpdateStatsViewers,
  hapticFeedback
}) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [sortBy, setSortBy] = useState('attendance'); // 'attendance' | 'name' | 'present'
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);

  // Обработчик клика по предмету для просмотра детальной статистики
  const handleSubjectClick = (subjectId) => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('light');
    }
    setSelectedSubjectId(subjectId);
  };

  useEffect(() => {
    const loadStats = async () => {
      if (!journalId) return;
      
      setIsLoading(true);
      try {
        const data = await getJournalStats(journalId, telegramId);
        setStats(data);
      } catch (error) {
        console.error('Error loading journal stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [journalId, telegramId]);

  // Функция для добавления/удаления пользователя из списка просмотра статистики
  const handleToggleStatsViewer = async (studentTelegramId) => {
    if (!onUpdateStatsViewers || !studentTelegramId) return;
    
    const newViewers = statsViewers.includes(studentTelegramId)
      ? statsViewers.filter(id => id !== studentTelegramId)
      : [...statsViewers, studentTelegramId];
    
    await onUpdateStatsViewers(newViewers);
  };

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
      </div>
    );
  }

  // Подготовка данных для графика посещаемости по студентам
  const studentsChartData = stats.students_stats
    .filter(s => s.attendance_percent !== null)
    .sort((a, b) => {
      if (sortBy === 'attendance') return (b.attendance_percent || 0) - (a.attendance_percent || 0);
      if (sortBy === 'name') return a.full_name.localeCompare(b.full_name);
      if (sortBy === 'present') return b.present_count - a.present_count;
      return 0;
    })
    .map(s => ({
      name: s.full_name.length > 15 ? s.full_name.substring(0, 15) + '...' : s.full_name,
      fullName: s.full_name,
      attendance: s.attendance_percent || 0,
      present: s.present_count,
      absent: s.absent_count,
      late: s.late_count,
      excused: s.excused_count
    }));

  // Данные для отображения (с учетом "показать все")
  const displayedStudents = showAllStudents 
    ? studentsChartData 
    : studentsChartData.slice(0, 10);

  // Подготовка данных для pie chart (распределение статусов)
  const totalRecords = stats.students_stats.reduce((acc, s) => 
    acc + s.present_count + s.absent_count + s.excused_count + s.late_count, 0
  );
  
  const pieData = [
    { 
      name: 'Присутствовали', 
      value: stats.students_stats.reduce((acc, s) => acc + s.present_count, 0),
      percent: 0
    },
    { 
      name: 'Отсутствовали', 
      value: stats.students_stats.reduce((acc, s) => acc + s.absent_count, 0),
      percent: 0
    },
    { 
      name: 'Уважительная', 
      value: stats.students_stats.reduce((acc, s) => acc + s.excused_count, 0),
      percent: 0
    },
    { 
      name: 'Опоздали', 
      value: stats.students_stats.reduce((acc, s) => acc + s.late_count, 0),
      percent: 0
    },
  ].filter(d => d.value > 0);

  // Вычисляем проценты
  pieData.forEach(d => {
    d.percent = totalRecords > 0 ? Math.round((d.value / totalRecords) * 100) : 0;
  });

  // Подготовка данных для графика по занятиям
  const sessionsChartData = stats.sessions_stats
    .slice()
    .reverse() // От старых к новым
    .slice(-15) // Последние 15 занятий
    .map(s => {
      const total = s.present_count + s.absent_count;
      const percent = total > 0 ? Math.round((s.present_count / total) * 100) : 0;
      return {
        name: new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
        fullDate: s.date,
        title: s.title,
        attendance: percent,
        present: s.present_count,
        absent: s.absent_count
      };
    });

  // Статистика по категориям посещаемости
  const attendanceCategories = {
    excellent: stats.students_stats.filter(s => (s.attendance_percent || 0) >= 90).length,
    good: stats.students_stats.filter(s => (s.attendance_percent || 0) >= 70 && (s.attendance_percent || 0) < 90).length,
    average: stats.students_stats.filter(s => (s.attendance_percent || 0) >= 50 && (s.attendance_percent || 0) < 70).length,
    poor: stats.students_stats.filter(s => (s.attendance_percent || 0) < 50 && s.attendance_percent !== null).length,
  };

  return (
    <div className="space-y-6">
      {/* Общая статистика - карточки */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-purple-400" />
            <p className="text-xs text-gray-400">Студентов</p>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total_students}</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-gray-400">Занятий</p>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total_sessions}</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4 text-green-400" />
            <p className="text-xs text-gray-400">Привязано</p>
          </div>
          <p className="text-2xl font-bold text-green-400">{stats.linked_students}</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <p className="text-xs text-gray-400">Посещаемость</p>
          </div>
          <p className={`text-2xl font-bold ${
            stats.overall_attendance_percent >= 80 ? 'text-green-400' :
            stats.overall_attendance_percent >= 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {stats.overall_attendance_percent}%
          </p>
        </motion.div>
      </div>

      {/* Категории посещаемости */}
      {stats.total_students > 0 && stats.total_sessions > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <h3 className="text-sm font-medium text-white mb-3">Распределение по посещаемости</h3>
          <div className="flex gap-2">
            <div className="flex-1 text-center">
              <div className="w-full h-2 bg-green-500 rounded-full mb-1" />
              <p className="text-lg font-bold text-green-400">{attendanceCategories.excellent}</p>
              <p className="text-xs text-gray-500">≥90%</p>
            </div>
            <div className="flex-1 text-center">
              <div className="w-full h-2 bg-blue-500 rounded-full mb-1" />
              <p className="text-lg font-bold text-blue-400">{attendanceCategories.good}</p>
              <p className="text-xs text-gray-500">70-89%</p>
            </div>
            <div className="flex-1 text-center">
              <div className="w-full h-2 bg-yellow-500 rounded-full mb-1" />
              <p className="text-lg font-bold text-yellow-400">{attendanceCategories.average}</p>
              <p className="text-xs text-gray-500">50-69%</p>
            </div>
            <div className="flex-1 text-center">
              <div className="w-full h-2 bg-red-500 rounded-full mb-1" />
              <p className="text-lg font-bold text-red-400">{attendanceCategories.poor}</p>
              <p className="text-xs text-gray-500">&lt;50%</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Посещаемость по предметам */}
      {stats.subjects_stats && stats.subjects_stats.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-medium text-white">Посещаемость по предметам</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">Нажмите на предмет для просмотра детальной статистики</p>
          
          <div className="space-y-3">
            {stats.subjects_stats.map((subject, index) => {
              const getColorClass = (color) => {
                const colorMap = {
                  blue: 'from-blue-500 to-blue-600',
                  purple: 'from-purple-500 to-purple-600',
                  green: 'from-green-500 to-green-600',
                  red: 'from-red-500 to-red-600',
                  yellow: 'from-yellow-500 to-yellow-600',
                  orange: 'from-orange-500 to-orange-600',
                  pink: 'from-pink-500 to-pink-600',
                  cyan: 'from-cyan-500 to-cyan-600',
                  indigo: 'from-indigo-500 to-indigo-600',
                };
                return colorMap[color] || colorMap.purple;
              };
              
              const getAttendanceColor = (percent) => {
                if (percent >= 80) return 'text-green-400';
                if (percent >= 50) return 'text-yellow-400';
                return 'text-red-400';
              };
              
              return (
                <motion.div
                  key={subject.subject_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22 + index * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSubjectClick(subject.subject_id)}
                  className="bg-white/5 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-colors active:bg-white/15"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getColorClass(subject.subject_color)} flex items-center justify-center`}>
                        <BookOpen className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium text-sm">{subject.subject_name}</h4>
                        <p className="text-xs text-gray-500">{subject.total_sessions} занятий</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className={`text-xl font-bold ${getAttendanceColor(subject.attendance_percent)}`}>
                          {subject.attendance_percent}%
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </div>
                  </div>
                  
                  {/* Прогресс-бар */}
                  <div className="w-full bg-white/10 rounded-full h-2 mb-3">
                    <div 
                      className={`h-2 rounded-full bg-gradient-to-r ${getColorClass(subject.subject_color)}`}
                      style={{ width: `${Math.min(subject.attendance_percent, 100)}%` }}
                    />
                  </div>
                  
                  {/* Детальная статистика */}
                  <div className="flex justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-gray-400">Присут.</span>
                      <span className="text-white font-medium">{subject.present_count}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-gray-400">Отсут.</span>
                      <span className="text-white font-medium">{subject.absent_count}</span>
                    </div>
                    {subject.late_count > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-gray-400">Опозд.</span>
                        <span className="text-white font-medium">{subject.late_count}</span>
                      </div>
                    )}
                    {subject.excused_count > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-gray-500" />
                        <span className="text-gray-400">Уваж.</span>
                        <span className="text-white font-medium">{subject.excused_count}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* График посещаемости по студентам */}
      {studentsChartData.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Посещаемость по студентам</h3>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white/10 text-white text-xs rounded-lg px-2 py-1 border-none outline-none"
            >
              <option value="attendance">По %</option>
              <option value="name">По имени</option>
              <option value="present">По явкам</option>
            </select>
          </div>
          
          <div style={{ height: Math.max(200, displayedStudents.length * 35) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayedStudents}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                <XAxis 
                  type="number" 
                  domain={[0, 100]} 
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={100}
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#1C1C1E] border border-white/10 rounded-lg p-3 shadow-xl">
                          <p className="text-white font-medium text-sm mb-2">{data.fullName}</p>
                          <p className="text-xs text-gray-400">Посещаемость: <span className="text-white">{data.attendance}%</span></p>
                          <div className="flex gap-3 mt-1 text-xs">
                            <span className="text-green-400">✓ {data.present}</span>
                            <span className="text-red-400">✗ {data.absent}</span>
                            {data.late > 0 && <span className="text-yellow-400">⏰ {data.late}</span>}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="attendance" 
                  fill="url(#attendanceGradient)" 
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
                <defs>
                  <linearGradient id="attendanceGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {studentsChartData.length > 10 && (
            <button
              onClick={() => setShowAllStudents(!showAllStudents)}
              className="w-full mt-3 flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              {showAllStudents ? (
                <>Свернуть <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Показать всех ({studentsChartData.length}) <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          )}
        </motion.div>
      )}

      {/* Круговая диаграмма распределения статусов */}
      {pieData.length > 0 && totalRecords > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <h3 className="text-sm font-medium text-white mb-4">Общая статистика отметок</h3>
          
          <div className="flex items-center">
            <div className="w-1/2" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
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

      {/* График динамики посещаемости по занятиям */}
      {sessionsChartData.length > 1 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white/5 rounded-xl p-4"
        >
          <h3 className="text-sm font-medium text-white mb-4">Динамика посещаемости</h3>
          
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sessionsChartData}
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
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#1C1C1E] border border-white/10 rounded-lg p-3 shadow-xl">
                          <p className="text-white font-medium text-sm">{data.title}</p>
                          <p className="text-xs text-gray-400 mb-1">{data.name}</p>
                          <p className="text-xs">
                            Посещаемость: <span className={`font-medium ${
                              data.attendance >= 80 ? 'text-green-400' :
                              data.attendance >= 50 ? 'text-yellow-400' : 'text-red-400'
                            }`}>{data.attendance}%</span>
                          </p>
                          <div className="flex gap-3 mt-1 text-xs">
                            <span className="text-green-400">✓ {data.present}</span>
                            <span className="text-red-400">✗ {data.absent}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="attendance" 
                  stroke="#a855f7" 
                  strokeWidth={2}
                  dot={{ fill: '#a855f7', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#ec4899' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Рейтинг посещаемости (топ и антитоп) */}
      {studentsChartData.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          {/* Топ студентов */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-medium text-white">Лучшая посещаемость</h3>
            </div>
            <div className="space-y-2">
              {studentsChartData
                .slice(0, 5)
                .map((student, index) => (
                  <div
                    key={student.fullName}
                    className="flex items-center justify-between bg-white/5 rounded-lg p-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-white/10 text-gray-400'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-white text-sm">{student.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{student.present}/{student.present + student.absent}</span>
                      <span className={`text-sm font-semibold ${
                        student.attendance >= 80 ? 'text-green-400' :
                        student.attendance >= 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {student.attendance}%
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Студенты с низкой посещаемостью (если есть) */}
          {studentsChartData.filter(s => s.attendance < 50).length > 0 && (
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-medium text-white">Требуют внимания (&lt;50%)</h3>
              </div>
              <div className="space-y-2">
                {studentsChartData
                  .filter(s => s.attendance < 50)
                  .slice(0, 5)
                  .map((student) => (
                    <div
                      key={student.fullName}
                      className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg p-2.5"
                    >
                      <span className="text-white text-sm">{student.fullName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{student.present}/{student.present + student.absent}</span>
                        <span className="text-sm font-semibold text-red-400">
                          {student.attendance}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Пустое состояние */}
      {stats.total_sessions === 0 && (
        <div className="text-center py-10 bg-white/5 rounded-xl">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Нет данных для отображения</p>
          <p className="text-gray-500 text-sm mt-1">Добавьте занятия и отметьте посещаемость</p>
        </div>
      )}

      {/* Управление доступом к статистике - только для владельца */}
      {isOwner && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 rounded-xl p-4 mt-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-medium text-white">Доступ к статистике</h3>
            </div>
            <button
              onClick={() => setShowAccessModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${gradient} rounded-lg text-sm text-white`}
            >
              <Plus className="w-4 h-4" />
              Добавить
            </button>
          </div>
          
          <p className="text-xs text-gray-400 mb-3">
            Выберите студентов, которые могут просматривать статистику журнала
          </p>

          {statsViewers.length === 0 ? (
            <div className="text-center py-4 bg-white/5 rounded-lg">
              <ShieldCheck className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Только вы можете видеть статистику</p>
            </div>
          ) : (
            <div className="space-y-2">
              {statsViewers.map((viewerId) => {
                const student = students.find(s => s.telegram_id === viewerId);
                return (
                  <div
                    key={viewerId}
                    className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span className="text-white text-sm">
                        {student ? student.full_name : `ID: ${viewerId}`}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleStatsViewer(viewerId)}
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Модал выбора студентов для доступа к статистике */}
      <AnimatePresence>
        {showAccessModal && isOwner && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAccessModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1C1C1E] rounded-2xl p-6 w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Доступ к статистике</h3>
                  <p className="text-xs text-gray-400">Выберите студентов</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {students.filter(s => s.is_linked && s.telegram_id).length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Нет привязанных студентов</p>
                    <p className="text-gray-500 text-xs mt-1">Студенты должны привязаться к журналу</p>
                  </div>
                ) : (
                  students
                    .filter(s => s.is_linked && s.telegram_id)
                    .map((student) => {
                      const hasAccess = statsViewers.includes(student.telegram_id);
                      return (
                        <button
                          key={student.id}
                          onClick={() => handleToggleStatsViewer(student.telegram_id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                            hasAccess 
                              ? 'bg-purple-500/20 border border-purple-500/30' 
                              : 'bg-white/5 border border-transparent hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              hasAccess ? 'bg-purple-500/30' : 'bg-white/10'
                            }`}>
                              {hasAccess ? (
                                <ShieldCheck className="w-4 h-4 text-purple-400" />
                              ) : (
                                <Shield className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            <div className="text-left">
                              <p className="text-white text-sm font-medium">{student.full_name}</p>
                              {student.username && (
                                <p className="text-xs text-gray-500">@{student.username}</p>
                              )}
                            </div>
                          </div>
                          {hasAccess && (
                            <div className="px-2 py-1 bg-purple-500/30 rounded-full">
                              <span className="text-xs text-purple-300">Доступ</span>
                            </div>
                          )}
                        </button>
                      );
                    })
                )}
              </div>

              <button
                onClick={() => setShowAccessModal(false)}
                className={`w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${gradient}`}
              >
                Готово
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default JournalStatsTab;
