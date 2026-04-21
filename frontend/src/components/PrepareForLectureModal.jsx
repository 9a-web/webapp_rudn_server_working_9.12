import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, Flag, BookOpen, Calendar, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, backdropVariants } from '../utils/animations';

// Маппинг дней недели на числа (вынесено за компонент)
const DAY_NAME_TO_NUMBER = {
  'понедельник': 1,
  'вторник': 2,
  'среда': 3,
  'четверг': 4,
  'пятница': 5,
  'суббота': 6,
  'воскресенье': 0,
};

// Парсинг даты события (вынесено за компонент)
const parseEventDate = (event) => {
  try {
    // event.date может быть в формате "2025-01-15"
    if (event.date) {
      const [year, month, day] = event.date.split('-').map(Number);
      const timeMatch = event.time?.match(/(\d{1,2}):(\d{2})/);
      const hours = timeMatch ? parseInt(timeMatch[1]) : 0;
      const minutes = timeMatch ? parseInt(timeMatch[2]) : 0;
      return new Date(year, month - 1, day, hours, minutes);
    }
    
    // Если есть day (название дня недели на русском) - формат РУДН API
    if (event.day) {
      const dayLower = event.day.toLowerCase();
      const targetDayNum = DAY_NAME_TO_NUMBER[dayLower];
      
      if (targetDayNum !== undefined) {
        const today = new Date();
        const currentDay = today.getDay();
        
        // Вычисляем разницу в днях
        let daysUntil = targetDayNum - currentDay;
        
        // Если день уже прошел на этой неделе, берем следующую неделю
        if (daysUntil < 0) {
          daysUntil += 7;
        }
        
        // Если сегодня, проверяем время
        if (daysUntil === 0) {
          const timeMatch = event.time?.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const eventHours = parseInt(timeMatch[1]);
            const eventMinutes = parseInt(timeMatch[2]);
            const eventTimeToday = new Date(today);
            eventTimeToday.setHours(eventHours, eventMinutes, 0, 0);
            
            // Если время уже прошло, берем следующую неделю
            if (eventTimeToday <= today) {
              daysUntil += 7;
            }
          }
        }
        
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntil);
        
        // Устанавливаем время
        const timeMatch = event.time?.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          targetDate.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
        } else {
          targetDate.setHours(9, 0, 0, 0); // По умолчанию 9:00
        }
        
        return targetDate;
      }
    }
    
    // Если есть dayOfWeek, вычисляем ближайшую дату (старый формат)
    if (event.dayOfWeek !== undefined) {
      const today = new Date();
      const currentDay = today.getDay();
      const targetDay = event.dayOfWeek;
      
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntil);
      
      const timeMatch = event.time?.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        targetDate.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
      }
      
      return targetDate;
    }
    
    return null;
  } catch (e) {
    console.error('Error parsing event date:', e);
    return null;
  }
};

// Форматирование даты для отображения (вынесено за компонент)
const formatClassDate = (date) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateStr = date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  
  if (date.toDateString() === today.toDateString()) {
    return `Сегодня, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Завтра, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  return `${dateStr}, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Специальное модальное окно для быстрой команды "Подготовиться к лекции"
 * Показывает:
 * - Название предмета (выбор из списка расписания)
 * - Приоритет
 * - Переключатель "К какому сроку" / "К какой паре"
 */
export const PrepareForLectureModal = ({ 
  isOpen, 
  onClose, 
  onAddTask, 
  hapticFeedback,
  scheduleSubjects = [], // Список предметов из расписания
  scheduleEvents = [], // Все события расписания для поиска ближайших пар
  userSettings = null, // Настройки пользователя для загрузки расписания
  selectedDate: taskSelectedDate = null, // Выбранная дата из селектора задач
}) => {
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadlineType, setDeadlineType] = useState('date'); // 'date' или 'class'
  const [deadlineDateInput, setDeadlineDateInput] = useState(''); // Дата дедлайна (переименовано для ясности)
  const [selectedClass, setSelectedClass] = useState(null); // Выбранная пара
  const [saving, setSaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [useDeadlineAsTargetDate, setUseDeadlineAsTargetDate] = useState(false); // Привязать к дате/паре вместо сегодня
  
  const modalRef = useRef(null);
  const dropdownRef = useRef(null);
  
  // Проверяем, является ли выбранный день сегодняшним
  const isToday = useMemo(() => {
    if (!taskSelectedDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(taskSelectedDate);
    selected.setHours(0, 0, 0, 0);
    return today.getTime() === selected.getTime();
  }, [taskSelectedDate]);
  
  // Блокируем скролл страницы при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  // Сброс состояния при открытии
  useEffect(() => {
    if (isOpen) {
      setSubject('');
      setPriority('medium');
      setDeadlineType('date');
      setDeadlineDateInput('');
      setSelectedClass(null);
      setUseDeadlineAsTargetDate(false);
    }
  }, [isOpen]);
  
  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSubjectDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Получаем ближайшие пары по выбранному предмету
  const upcomingClasses = useMemo(() => {
    if (!subject || !scheduleEvents || scheduleEvents.length === 0) {
      return [];
    }
    
    const now = new Date();
    const classes = [];
    
    // Фильтруем события по выбранному предмету
    scheduleEvents.forEach(event => {
      if (event.discipline && event.discipline.toLowerCase().includes(subject.toLowerCase())) {
        // Парсим дату и время события
        const eventDate = parseEventDate(event);
        if (eventDate && eventDate > now) {
          classes.push({
            ...event,
            parsedDate: eventDate,
            displayDate: formatClassDate(eventDate),
            displayTime: event.time || '',
          });
        }
      }
    });
    
    // Сортируем по дате и берем ближайшие 5
    classes.sort((a, b) => a.parsedDate - b.parsedDate);
    
    // Удаляем дубликаты по дате и времени
    const uniqueClasses = [];
    const seenDates = new Set();
    classes.forEach(cls => {
      const key = cls.parsedDate.toISOString();
      if (!seenDates.has(key)) {
        seenDates.add(key);
        uniqueClasses.push(cls);
      }
    });
    
    return uniqueClasses.slice(0, 5);
  }, [subject, scheduleEvents]);
  
  // Приоритеты
  const priorities = [
    { id: 'low', label: 'Низкий', color: 'bg-green-100 text-green-700 border-green-200' },
    { id: 'medium', label: 'Средний', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    { id: 'high', label: 'Высокий', color: 'bg-red-100 text-red-700 border-red-200' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!subject) return;
    
    try {
      setSaving(true);
      hapticFeedback && hapticFeedback('impact', 'medium');
      
      // Формируем текст задачи
      const taskText = `Подготовиться к лекции: ${subject}`;
      
      // deadline определяется выбором пользователя (дата или пара)
      let deadlineISO = null;
      let deadlineTargetDate = null; // Дата из дедлайна для target_date если выбран checkbox
      
      if (deadlineType === 'date' && deadlineDateInput) {
        const deadlineDate = new Date(deadlineDateInput);
        deadlineISO = deadlineDate.toISOString();
        // Для target_date берем только дату без времени
        const year = deadlineDate.getFullYear();
        const month = String(deadlineDate.getMonth() + 1).padStart(2, '0');
        const day = String(deadlineDate.getDate()).padStart(2, '0');
        deadlineTargetDate = `${year}-${month}-${day}T00:00:00`;
      } else if (deadlineType === 'class' && selectedClass) {
        const classDate = selectedClass.parsedDate;
        deadlineISO = classDate.toISOString();
        // Для target_date берем только дату без времени
        const year = classDate.getFullYear();
        const month = String(classDate.getMonth() + 1).padStart(2, '0');
        const day = String(classDate.getDate()).padStart(2, '0');
        deadlineTargetDate = `${year}-${month}-${day}T00:00:00`;
      }
      
      // target_date определяется:
      // - Если сегодня и checkbox включен и есть дедлайн → берем дату из дедлайна/пары
      // - Иначе → берем выбранный день в селекторе
      let targetDateISO = null;
      
      if (isToday && useDeadlineAsTargetDate && deadlineTargetDate) {
        // Привязываем к дате дедлайна/пары
        targetDateISO = deadlineTargetDate;
      } else if (taskSelectedDate) {
        // Привязываем к выбранному дню в селекторе
        const targetDate = new Date(taskSelectedDate);
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        targetDateISO = `${year}-${month}-${day}T00:00:00`;
      }
      
      const taskData = {
        text: taskText,
        category: 'study',
        priority: priority,
        deadline: deadlineISO,
        target_date: targetDateISO,
        subject: subject,
      };
      
      await onAddTask(taskData);
      
      // Очищаем все поля и закрываем модальное окно
      setSubject('');
      setPriority('medium');
      setDeadlineType('date');
      setDeadlineDateInput('');
      setSelectedClass(null);
      setUseDeadlineAsTargetDate(false);
      onClose();
    } catch (error) {
      console.error('Error adding task:', error);
      const errorMessage = error?.message || error?.toString() || 'Неизвестная ошибка при создании задачи';
      alert(`Ошибка при создании задачи: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    hapticFeedback && hapticFeedback('impact', 'light');
    setSubject('');
    setPriority('medium');
    setDeadlineType('date');
    setDeadlineDateInput('');
    setSelectedClass(null);
    setUseDeadlineAsTargetDate(false);
    setDragY(0);
    onClose();
  };
  
  // Обработка свайпа вниз для закрытия
  const handleDragEnd = (event, info) => {
    if (info.offset.y > 100) {
      handleClose();
    } else {
      setDragY(0);
    }
  };
  
  // Выбор предмета
  const handleSubjectSelect = (subj) => {
    setSubject(subj);
    setShowSubjectDropdown(false);
    setSelectedClass(null); // Сбрасываем выбранную пару при смене предмета
    hapticFeedback && hapticFeedback('selection');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={backdropVariants}
        onClick={handleClose}
      >
        <motion.div 
          ref={modalRef}
          className="bg-white w-full max-w-lg shadow-2xl relative z-[10000] overflow-hidden
                     rounded-t-[32px] sm:rounded-3xl
                     max-h-[92vh] sm:max-h-[85vh]
                     flex flex-col"
          initial={{ y: "100%" }}
          animate={{ y: dragY }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={handleDragEnd}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag indicator (для мобильных) */}
          <div className="sm:hidden flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header - фиксированный */}
          <div className="flex-shrink-0 px-4 sm:px-6 pt-3 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#1C1C1E]">Подготовиться к лекции</h2>
                  <p className="text-xs text-gray-500">Быстрая задача</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={saving}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Form - прокручиваемый контент */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 px-4 sm:px-6 py-4 sm:py-5">
              
              {/* Выбор предмета */}
              <div ref={dropdownRef} className="relative">
                <label className="block text-xs sm:text-sm font-medium text-[#1C1C1E] mb-2 flex items-center gap-1.5 sm:gap-2">
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                  Название предмета
                </label>
                
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowSubjectDropdown(!showSubjectDropdown);
                    hapticFeedback && hapticFeedback('selection');
                  }}
                  disabled={saving}
                  className={`
                    w-full px-3 py-3 sm:px-4 sm:py-3.5 bg-gray-50 border-2 rounded-xl sm:rounded-2xl 
                    flex items-center justify-between gap-2
                    transition-all text-left
                    ${subject ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}
                    ${showSubjectDropdown ? 'ring-2 ring-blue-400' : ''}
                    disabled:opacity-50
                  `}
                >
                  <span className={`text-sm sm:text-base ${subject ? 'text-[#1C1C1E] font-medium' : 'text-gray-400'}`}>
                    {subject || 'Выберите предмет из расписания'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showSubjectDropdown ? 'rotate-180' : ''}`} />
                </motion.button>
                
                {/* Dropdown список предметов */}
                <AnimatePresence>
                  {showSubjectDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto"
                    >
                      {scheduleSubjects.length > 0 ? (
                        scheduleSubjects.map((subj, idx) => (
                          <motion.button
                            key={idx}
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSubjectSelect(subj)}
                            className={`
                              w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors
                              ${subject === subj ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'}
                              ${idx === 0 ? 'rounded-t-xl' : ''}
                              ${idx === scheduleSubjects.length - 1 ? 'rounded-b-xl' : 'border-b border-gray-100'}
                            `}
                          >
                            {subj}
                          </motion.button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-400 text-center">
                          Нет предметов в расписании
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Приоритет */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-[#1C1C1E] mb-2 flex items-center gap-1.5 sm:gap-2">
                  <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
                  Приоритет
                </label>
                <div className="flex gap-1.5 sm:gap-2">
                  {priorities.map((prior) => (
                    <motion.button
                      key={prior.id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setPriority(prior.id);
                        hapticFeedback && hapticFeedback('selection');
                      }}
                      disabled={saving}
                      className={`
                        flex-1 px-2 py-2 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl border-2 transition-all text-xs sm:text-sm font-medium touch-manipulation
                        ${priority === prior.id
                          ? `${prior.color} border-transparent`
                          : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50'
                        }
                        disabled:opacity-50
                      `}
                    >
                      {prior.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Переключатель срока */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-[#1C1C1E] mb-2 flex items-center gap-1.5 sm:gap-2">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500" />
                  Срок выполнения
                </label>
                
                {/* Переключатель */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setDeadlineType('date');
                      setSelectedClass(null);
                      hapticFeedback && hapticFeedback('selection');
                    }}
                    disabled={saving}
                    className={`
                      flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5
                      ${deadlineType === 'date' 
                        ? 'bg-white shadow-sm text-[#1C1C1E]' 
                        : 'text-gray-500'
                      }
                    `}
                  >
                    <Calendar className="w-4 h-4" />
                    К дате
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setDeadlineType('class');
                      setDeadlineDateInput('');
                      hapticFeedback && hapticFeedback('selection');
                    }}
                    disabled={saving}
                    className={`
                      flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5
                      ${deadlineType === 'class' 
                        ? 'bg-white shadow-sm text-[#1C1C1E]' 
                        : 'text-gray-500'
                      }
                    `}
                  >
                    <BookOpen className="w-4 h-4" />
                    К паре
                  </motion.button>
                </div>
                
                {/* Контент в зависимости от типа */}
                <AnimatePresence mode="wait">
                  {deadlineType === 'date' ? (
                    <motion.div
                      key="date-picker"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <input
                        type="datetime-local"
                        value={deadlineDateInput}
                        onChange={(e) => setDeadlineDateInput(e.target.value)}
                        disabled={saving}
                        className="w-full px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent text-[#1C1C1E] text-sm sm:text-base disabled:opacity-50"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="class-picker"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-2"
                    >
                      {!subject ? (
                        <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-500">
                          Сначала выберите предмет
                        </div>
                      ) : upcomingClasses.length > 0 ? (
                        <>
                          <p className="text-xs text-gray-500 mb-2">Ближайшие пары по предмету:</p>
                          {upcomingClasses.map((cls, idx) => (
                            <motion.button
                              key={idx}
                              type="button"
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setSelectedClass(cls);
                                hapticFeedback && hapticFeedback('selection');
                              }}
                              disabled={saving}
                              className={`
                                w-full px-3 py-3 rounded-xl border-2 transition-all text-left flex items-center gap-3
                                ${selectedClass === cls 
                                  ? 'border-purple-400 bg-purple-50' 
                                  : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                }
                              `}
                            >
                              <div className={`
                                w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                                ${selectedClass === cls ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'}
                              `}>
                                <Clock className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${selectedClass === cls ? 'text-purple-700' : 'text-[#1C1C1E]'}`}>
                                  {cls.displayDate}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {cls.auditory ? `Ауд. ${cls.auditory}` : ''} {cls.teacher ? `• ${cls.teacher}` : ''}
                                </p>
                              </div>
                              <ChevronRight className={`w-4 h-4 flex-shrink-0 ${selectedClass === cls ? 'text-purple-500' : 'text-gray-400'}`} />
                            </motion.button>
                          ))}
                        </>
                      ) : (
                        <div className="bg-amber-50 rounded-xl p-4 text-center">
                          <p className="text-sm text-amber-700">
                            Не найдено ближайших пар по этому предмету
                          </p>
                          <p className="text-xs text-amber-600 mt-1">
                            Используйте вкладку «К дате»
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Checkbox для привязки к дате/паре (только если выбран сегодняшний день) */}
                {isToday && (deadlineDateInput || selectedClass) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3"
                  >
                    <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={useDeadlineAsTargetDate}
                        onChange={(e) => {
                          setUseDeadlineAsTargetDate(e.target.checked);
                          hapticFeedback && hapticFeedback('selection');
                        }}
                        disabled={saving}
                        className="w-5 h-5 rounded-md border-2 border-blue-300 text-blue-500 focus:ring-blue-400 focus:ring-offset-0"
                      />
                      <span className="text-sm text-blue-700">
                        Прикрепить задачу к {deadlineType === 'class' ? 'дате пары' : 'выбранной дате'} вместо сегодня
                      </span>
                    </label>
                  </motion.div>
                )}
              </div>

            </form>
          </div>

          {/* Footer с кнопками - фиксированный */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-white">
            <div className="flex gap-2 sm:gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={handleClose}
                disabled={saving}
                className="flex-1 px-4 py-2.5 sm:px-6 sm:py-3 bg-gray-100 active:bg-gray-200 text-gray-700 rounded-xl sm:rounded-2xl font-medium text-sm sm:text-base transition-colors disabled:opacity-50 touch-manipulation"
              >
                Отмена
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
                disabled={!subject || saving}
                className={`
                  flex-1 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl font-medium text-sm sm:text-base transition-all touch-manipulation
                  ${subject && !saving
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 active:from-blue-600 active:to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div 
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    Сохранение...
                  </span>
                ) : (
                  'Создать задачу'
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
