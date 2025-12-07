import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, BookOpen, GraduationCap, FlaskConical, FileText, CalendarRange, Check, Loader2, AlertCircle } from 'lucide-react';
import { scheduleAPI } from '../../services/api';
import { createSessionsFromSchedule } from '../../services/journalAPI';

const SESSION_TYPES = [
  { id: 'lecture', label: 'Лекция', icon: BookOpen, color: 'from-blue-400 to-cyan-400' },
  { id: 'seminar', label: 'Семинар', icon: GraduationCap, color: 'from-green-400 to-emerald-400' },
  { id: 'lab', label: 'Лабораторная', icon: FlaskConical, color: 'from-purple-400 to-pink-400' },
  { id: 'exam', label: 'Экзамен/Зачёт', icon: FileText, color: 'from-red-400 to-orange-400' },
];

// Русские названия дней недели
const DAYS_MAP = {
  'понедельник': 1,
  'вторник': 2,
  'среда': 3,
  'четверг': 4,
  'пятница': 5,
  'суббота': 6,
  'воскресенье': 0,
};

// Получить дату для дня недели на указанной неделе
const getDateForDay = (dayName, weekOffset = 0) => {
  const dayIndex = DAYS_MAP[dayName.toLowerCase()];
  if (dayIndex === undefined) return null;
  
  const today = new Date();
  const currentDay = today.getDay();
  
  // Начало текущей недели (понедельник)
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
  
  // Дата нужного дня
  const targetDayOffset = dayIndex === 0 ? 6 : dayIndex - 1;
  const targetDate = new Date(monday);
  targetDate.setDate(monday.getDate() + targetDayOffset);
  
  return targetDate.toISOString().split('T')[0];
};

// Форматирование даты для отображения
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  return date.toLocaleDateString('ru-RU', options);
};

export const CreateSessionModal = ({ 
  isOpen, 
  onClose, 
  onCreate, 
  onCreateFromSchedule,
  hapticFeedback,
  journalId,
  subjectId,
  subjectName,
  userSettings,
  telegramId
}) => {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'schedule'
  
  // Manual tab state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('lecture');
  const [isLoading, setIsLoading] = useState(false);
  
  // Schedule tab state
  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [selectedWeek, setSelectedWeek] = useState(1); // 1 = текущая, 2 = следующая
  const [creatingFromSchedule, setCreatingFromSchedule] = useState(false);

  // Загружаем расписание при открытии вкладки
  useEffect(() => {
    if (activeTab === 'schedule' && userSettings && scheduleEvents.length === 0) {
      loadSchedule();
    }
  }, [activeTab, userSettings]);

  const loadSchedule = async () => {
    if (!userSettings?.group_id) {
      setScheduleError('Не выбрана группа в настройках');
      return;
    }
    
    setLoadingSchedule(true);
    setScheduleError(null);
    
    try {
      // Загружаем обе недели
      const [week1, week2] = await Promise.all([
        scheduleAPI.getSchedule({
          facultet_id: userSettings.facultet_id,
          level_id: userSettings.level_id,
          kurs: userSettings.kurs,
          form_code: userSettings.form_code,
          group_id: userSettings.group_id,
          week_number: 1
        }),
        scheduleAPI.getSchedule({
          facultet_id: userSettings.facultet_id,
          level_id: userSettings.level_id,
          kurs: userSettings.kurs,
          form_code: userSettings.form_code,
          group_id: userSettings.group_id,
          week_number: 2
        })
      ]);
      
      const allEvents = [
        ...(week1?.events || []).map(e => ({ ...e, week: 1 })),
        ...(week2?.events || []).map(e => ({ ...e, week: 2 }))
      ];
      
      setScheduleEvents(allEvents);
    } catch (error) {
      console.error('Error loading schedule:', error);
      setScheduleError('Не удалось загрузить расписание');
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Фильтруем события по предмету и выбранной неделе
  const filteredEvents = useMemo(() => {
    if (!subjectName) return [];
    
    const subjectLower = subjectName.toLowerCase();
    
    return scheduleEvents
      .filter(e => {
        // Фильтр по неделе
        if (e.week !== selectedWeek) return false;
        
        // Фильтр по предмету (нечёткий поиск)
        const disciplineLower = e.discipline.toLowerCase();
        return disciplineLower.includes(subjectLower) || 
               subjectLower.includes(disciplineLower) ||
               // Проверка по первым словам
               disciplineLower.split(' ')[0] === subjectLower.split(' ')[0];
      })
      .map(e => ({
        ...e,
        date: getDateForDay(e.day, selectedWeek - 1),
        uniqueKey: `${e.day}-${e.time}-${e.week}`
      }))
      .filter(e => e.date) // Только с валидной датой
      .sort((a, b) => {
        // Сортировка по дате и времени
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
  }, [scheduleEvents, subjectName, selectedWeek]);

  const toggleEventSelection = (uniqueKey) => {
    if (hapticFeedback?.selectionChanged) {
      hapticFeedback.selectionChanged();
    }
    
    setSelectedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uniqueKey)) {
        newSet.delete(uniqueKey);
      } else {
        newSet.add(uniqueKey);
      }
      return newSet;
    });
  };

  const selectAllEvents = () => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('light');
    }
    
    if (selectedEvents.size === filteredEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map(e => e.uniqueKey)));
    }
  };

  const handleCreate = async () => {
    if (!date || !title.trim()) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsLoading(true);
    try {
      await onCreate({
        date,
        title: title.trim(),
        description: description.trim() || null,
        type
      });
      setTitle('');
      setDescription('');
      setType('lecture');
      onClose();
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFromSchedule = async () => {
    if (selectedEvents.size === 0) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setCreatingFromSchedule(true);
    
    try {
      const sessionsToCreate = filteredEvents
        .filter(e => selectedEvents.has(e.uniqueKey))
        .map(e => ({
          date: e.date,
          time: e.time,
          discipline: e.discipline,
          lesson_type: e.lessonType || 'Лекция',
          teacher: e.teacher || null,
          auditory: e.auditory || null
        }));
      
      const result = await createSessionsFromSchedule(journalId, {
        subject_id: subjectId,
        telegram_id: telegramId,
        sessions: sessionsToCreate
      });
      
      if (onCreateFromSchedule) {
        onCreateFromSchedule(result);
      }
      
      setSelectedEvents(new Set());
      onClose();
    } catch (error) {
      console.error('Error creating sessions from schedule:', error);
    } finally {
      setCreatingFromSchedule(false);
    }
  };

  if (!isOpen) return null;

  const selectedType = SESSION_TYPES.find(t => t.id === type) || SESSION_TYPES[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[#1C1C1E] w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedType.color} flex items-center justify-center`}>
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Добавить занятие</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5 bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                activeTab === 'manual'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Вручную</span>
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                activeTab === 'schedule'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <CalendarRange className="w-4 h-4" />
              <span className="text-sm font-medium">Из расписания</span>
            </button>
          </div>

          {/* Manual Tab */}
          {activeTab === 'manual' && (
            <div className="space-y-5">
              {/* Тип занятия */}
              <div>
                <label className="text-sm text-gray-400 mb-3 block">Тип занятия</label>
                <div className="grid grid-cols-2 gap-2">
                  {SESSION_TYPES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setType(t.id)}
                        className={`flex items-center gap-2 p-3 rounded-xl transition-all ${
                          type === t.id
                            ? `bg-gradient-to-br ${t.color} text-white`
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Дата */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Дата</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              {/* Название */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Название занятия</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Лекция №5 — Интегралы"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              {/* Описание */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Описание (опционально)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Тема: определённые интегралы"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              {/* Create Button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCreate}
                disabled={!date || !title.trim() || isLoading}
                className={`w-full py-4 rounded-2xl font-semibold text-white transition-all ${
                  date && title.trim() && !isLoading
                    ? `bg-gradient-to-r ${selectedType.color}`
                    : 'bg-white/10 text-gray-500'
                }`}
              >
                {isLoading ? 'Создание...' : 'Добавить занятие'}
              </motion.button>
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              {/* Информация о предмете */}
              {subjectName && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                  <p className="text-sm text-purple-300">
                    <span className="text-gray-400">Предмет:</span> {subjectName}
                  </p>
                </div>
              )}

              {/* Выбор недели */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedWeek(1)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    selectedWeek === 1
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}
                >
                  Текущая неделя
                </button>
                <button
                  onClick={() => setSelectedWeek(2)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    selectedWeek === 2
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}
                >
                  Следующая неделя
                </button>
              </div>

              {/* Loading */}
              {loadingSchedule && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                  <p className="text-gray-400 text-sm">Загрузка расписания...</p>
                </div>
              )}

              {/* Error */}
              {scheduleError && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-red-300 text-sm">{scheduleError}</p>
                    <button
                      onClick={loadSchedule}
                      className="text-red-400 text-xs underline mt-1"
                    >
                      Попробовать снова
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule Events */}
              {!loadingSchedule && !scheduleError && (
                <>
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarRange className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">
                        Занятий по предмету "{subjectName}" не найдено
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        Попробуйте выбрать другую неделю или добавьте занятие вручную
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Select All */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          Найдено занятий: {filteredEvents.length}
                        </span>
                        <button
                          onClick={selectAllEvents}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {selectedEvents.size === filteredEvents.length ? 'Снять все' : 'Выбрать все'}
                        </button>
                      </div>

                      {/* Events List */}
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {filteredEvents.map((event) => {
                          const isSelected = selectedEvents.has(event.uniqueKey);
                          return (
                            <motion.button
                              key={event.uniqueKey}
                              onClick={() => toggleEventSelection(event.uniqueKey)}
                              whileTap={{ scale: 0.98 }}
                              className={`w-full text-left p-3 rounded-xl border transition-all ${
                                isSelected
                                  ? 'bg-blue-500/20 border-blue-500/50'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected
                                    ? 'bg-blue-500'
                                    : 'bg-white/10 border border-white/20'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-white font-medium">{event.time}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                                      {event.lessonType || 'Занятие'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-400 mb-1">{formatDate(event.date)}</p>
                                  {(event.teacher || event.auditory) && (
                                    <p className="text-xs text-gray-500 truncate">
                                      {[event.teacher, event.auditory].filter(Boolean).join(' • ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Create from Schedule Button */}
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCreateFromSchedule}
                        disabled={selectedEvents.size === 0 || creatingFromSchedule}
                        className={`w-full py-4 rounded-2xl font-semibold text-white transition-all ${
                          selectedEvents.size > 0 && !creatingFromSchedule
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                            : 'bg-white/10 text-gray-500'
                        }`}
                      >
                        {creatingFromSchedule ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Создание...
                          </span>
                        ) : (
                          `Добавить выбранные (${selectedEvents.size})`
                        )}
                      </motion.button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
