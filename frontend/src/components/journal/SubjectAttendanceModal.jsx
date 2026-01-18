import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ArrowLeft, Users, Calendar, TrendingUp, UserCheck, UserX, 
  Clock, AlertCircle, ChevronDown, ChevronUp, BookOpen, Award,
  GraduationCap, FlaskConical, FileText
} from 'lucide-react';
import { getSubjectAttendanceStats } from '../../services/journalAPI';

const SESSION_ICONS = {
  lecture: BookOpen,
  seminar: GraduationCap,
  lab: FlaskConical,
  exam: FileText,
};

const SUBJECT_COLORS = {
  blue: 'from-blue-400 to-cyan-400',
  purple: 'from-purple-400 to-pink-400',
  green: 'from-green-400 to-emerald-400',
  orange: 'from-orange-400 to-amber-400',
  red: 'from-red-400 to-rose-400',
  indigo: 'from-indigo-400 to-violet-400',
  yellow: 'from-yellow-400 to-orange-400',
  pink: 'from-pink-400 to-rose-400',
  cyan: 'from-cyan-400 to-teal-400',
};

export const SubjectAttendanceModal = ({ 
  isOpen, 
  onClose, 
  subjectId,
  telegramId, 
  hapticFeedback 
}) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'sessions'
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [sortBy, setSortBy] = useState('attendance'); // 'attendance' | 'name' | 'absent'

  const loadData = useCallback(async () => {
    if (!subjectId) return;
    
    setIsLoading(true);
    try {
      const result = await getSubjectAttendanceStats(subjectId, telegramId);
      setData(result);
    } catch (error) {
      console.error('Error loading subject attendance stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [subjectId, telegramId]);

  useEffect(() => {
    if (isOpen && subjectId) {
      loadData();
    }
  }, [isOpen, subjectId, loadData]);

  if (!isOpen) return null;

  const gradient = data ? SUBJECT_COLORS[data.subject_color] || SUBJECT_COLORS.blue : SUBJECT_COLORS.blue;

  // Сортировка студентов
  const sortedStudents = data?.students_stats ? [...data.students_stats].sort((a, b) => {
    if (sortBy === 'attendance') return b.attendance_percent - a.attendance_percent;
    if (sortBy === 'name') return a.full_name.localeCompare(b.full_name);
    if (sortBy === 'absent') return b.absent_count - a.absent_count;
    return 0;
  }) : [];

  const displayedStudents = showAllStudents ? sortedStudents : sortedStudents.slice(0, 10);
  const displayedSessions = showAllSessions ? (data?.sessions_stats || []) : (data?.sessions_stats || []).slice(0, 10);

  // Статистика по категориям посещаемости
  const attendanceCategories = {
    excellent: sortedStudents.filter(s => s.attendance_percent >= 90).length,
    good: sortedStudents.filter(s => s.attendance_percent >= 70 && s.attendance_percent < 90).length,
    average: sortedStudents.filter(s => s.attendance_percent >= 50 && s.attendance_percent < 70).length,
    poor: sortedStudents.filter(s => s.attendance_percent < 50).length,
  };

  const getAttendanceColor = (percent) => {
    if (percent >= 80) return 'text-green-400';
    if (percent >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAttendanceBgColor = (percent) => {
    if (percent >= 80) return 'bg-green-500';
    if (percent >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] overflow-hidden"
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="absolute inset-0 bg-[#0D0D0D] overflow-y-auto"
        >
          {/* Header */}
          <div className={`sticky top-0 z-10 bg-gradient-to-br ${gradient} p-4 pb-6`}>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-black/20 backdrop-blur-sm"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            </div>
            
            {data && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-5 h-5 text-white/80" />
                  <span className="text-white/60 text-sm">Посещаемость по предмету</span>
                </div>
                <h1 className="text-2xl font-bold text-white">{data.subject_name}</h1>
                {data.description && (
                  <p className="text-white/70 mt-1 text-sm">{data.description}</p>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : data ? (
            <div className="p-4 pb-24">
              {/* Общая статистика */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-purple-400" />
                    <p className="text-xs text-gray-400">Студентов</p>
                  </div>
                  <p className="text-2xl font-bold text-white">{data.total_students}</p>
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
                  <p className="text-2xl font-bold text-white">{data.total_sessions}</p>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white/5 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <UserCheck className="w-4 h-4 text-green-400" />
                    <p className="text-xs text-gray-400">Присутствий</p>
                  </div>
                  <p className="text-2xl font-bold text-green-400">{data.present_count}</p>
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
                  <p className={`text-2xl font-bold ${getAttendanceColor(data.overall_attendance_percent)}`}>
                    {data.overall_attendance_percent}%
                  </p>
                </motion.div>
              </div>

              {/* Категории посещаемости */}
              {data.total_students > 0 && data.total_sessions > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/5 rounded-xl p-4 mb-6"
                >
                  <h3 className="text-sm font-medium text-white mb-3">Распределение студентов</h3>
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

              {/* Вкладки */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('students')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'students'
                      ? `bg-gradient-to-r ${gradient} text-white`
                      : 'bg-white/5 text-gray-400'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-1.5" />
                  Студенты
                </button>
                <button
                  onClick={() => setActiveTab('sessions')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'sessions'
                      ? `bg-gradient-to-r ${gradient} text-white`
                      : 'bg-white/5 text-gray-400'
                  }`}
                >
                  <Calendar className="w-4 h-4 inline mr-1.5" />
                  Занятия
                </button>
              </div>

              {/* Контент вкладок */}
              {activeTab === 'students' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  {/* Сортировка */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-white">Список студентов</h3>
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-white/10 text-white text-xs rounded-lg px-2 py-1 border-none outline-none"
                    >
                      <option value="attendance">По посещаемости</option>
                      <option value="name">По имени</option>
                      <option value="absent">По пропускам</option>
                    </select>
                  </div>

                  {displayedStudents.length === 0 ? (
                    <div className="text-center py-10">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">Нет данных о студентах</p>
                    </div>
                  ) : (
                    <>
                      {displayedStudents.map((student, index) => (
                        <motion.div
                          key={student.student_id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="bg-white/5 rounded-xl p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                student.attendance_percent >= 80 ? 'bg-green-500/20' :
                                student.attendance_percent >= 50 ? 'bg-yellow-500/20' : 'bg-red-500/20'
                              }`}>
                                <span className="text-lg font-bold text-white">
                                  {student.full_name.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <p className="text-white font-medium">{student.full_name}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  {student.is_linked && (
                                    <span className="flex items-center gap-1 text-green-400">
                                      <UserCheck className="w-3 h-3" />
                                      Привязан
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-xl font-bold ${getAttendanceColor(student.attendance_percent)}`}>
                                {student.attendance_percent}%
                              </p>
                            </div>
                          </div>
                          
                          {/* Прогресс-бар */}
                          <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                            <div 
                              className={`h-1.5 rounded-full ${getAttendanceBgColor(student.attendance_percent)}`}
                              style={{ width: `${Math.min(student.attendance_percent, 100)}%` }}
                            />
                          </div>
                          
                          {/* Детальная статистика */}
                          <div className="flex justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-gray-400">Присут.</span>
                              <span className="text-white font-medium">{student.present_count}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-gray-400">Отсут.</span>
                              <span className="text-white font-medium">{student.absent_count}</span>
                            </div>
                            {student.late_count > 0 && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span className="text-gray-400">Опозд.</span>
                                <span className="text-white font-medium">{student.late_count}</span>
                              </div>
                            )}
                            {student.excused_count > 0 && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-gray-500" />
                                <span className="text-gray-400">Уваж.</span>
                                <span className="text-white font-medium">{student.excused_count}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}

                      {sortedStudents.length > 10 && (
                        <button
                          onClick={() => setShowAllStudents(!showAllStudents)}
                          className="w-full mt-3 flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-white transition-colors py-2"
                        >
                          {showAllStudents ? (
                            <>Свернуть <ChevronUp className="w-4 h-4" /></>
                          ) : (
                            <>Показать всех ({sortedStudents.length}) <ChevronDown className="w-4 h-4" /></>
                          )}
                        </button>
                      )}
                    </>
                  )}

                  {/* Студенты с низкой посещаемостью */}
                  {sortedStudents.filter(s => s.attendance_percent < 50).length > 0 && (
                    <div className="mt-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <h3 className="text-sm font-medium text-white">Требуют внимания</h3>
                      </div>
                      <div className="space-y-2">
                        {sortedStudents
                          .filter(s => s.attendance_percent < 50)
                          .slice(0, 5)
                          .map((student) => (
                            <div
                              key={student.student_id}
                              className="flex items-center justify-between py-1"
                            >
                              <span className="text-white text-sm">{student.full_name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{student.present_count}/{data.total_sessions}</span>
                                <span className="text-sm font-semibold text-red-400">
                                  {student.attendance_percent}%
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'sessions' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-medium text-white mb-2">История занятий</h3>
                  
                  {displayedSessions.length === 0 ? (
                    <div className="text-center py-10">
                      <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">Нет занятий</p>
                    </div>
                  ) : (
                    <>
                      {displayedSessions.map((session, index) => {
                        const SessionIcon = SESSION_ICONS[session.type] || BookOpen;
                        
                        return (
                          <motion.div
                            key={session.session_id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="bg-white/5 rounded-xl p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                                  <SessionIcon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="text-white font-medium">{session.title}</p>
                                  <p className="text-sm text-gray-400">
                                    {new Date(session.date).toLocaleDateString('ru-RU', {
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-xl font-bold ${getAttendanceColor(session.attendance_percent)}`}>
                                  {session.attendance_percent}%
                                </p>
                                <p className="text-xs text-gray-500">
                                  {session.present_count}/{session.total_students}
                                </p>
                              </div>
                            </div>
                            
                            {/* Прогресс-бар */}
                            <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                              <div 
                                className={`h-1.5 rounded-full ${getAttendanceBgColor(session.attendance_percent)}`}
                                style={{ width: `${Math.min(session.attendance_percent, 100)}%` }}
                              />
                            </div>
                            
                            {/* Детальная статистика */}
                            <div className="flex gap-4 text-xs">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-gray-400">Присут.</span>
                                <span className="text-white font-medium">{session.present_count}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-gray-400">Отсут.</span>
                                <span className="text-white font-medium">{session.absent_count}</span>
                              </div>
                              {session.late_count > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                  <span className="text-gray-400">Опозд.</span>
                                  <span className="text-white font-medium">{session.late_count}</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}

                      {(data?.sessions_stats || []).length > 10 && (
                        <button
                          onClick={() => setShowAllSessions(!showAllSessions)}
                          className="w-full mt-3 flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-white transition-colors py-2"
                        >
                          {showAllSessions ? (
                            <>Свернуть <ChevronUp className="w-4 h-4" /></>
                          ) : (
                            <>Показать все ({(data?.sessions_stats || []).length}) <ChevronDown className="w-4 h-4" /></>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </div>
          ) : (
            <div className="text-center py-20">
              <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Не удалось загрузить данные</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SubjectAttendanceModal;
