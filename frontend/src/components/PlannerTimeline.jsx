import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, ChevronDown, ChevronUp, Check, Trash2, MapPin, User, 
  BookOpen, Info, X, GripVertical, Edit2, Plus, Copy, AlarmClock, Expand
} from 'lucide-react';

/**
 * Timeline-вид планировщика с часами слева
 * События отображаются как блоки на временной шкале
 * Поддерживает: просмотр, редактирование, удаление, быстрое создание, перетаскивание
 */

const HOUR_HEIGHT = 60; // Высота одного часа в пикселях
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23

// Парсинг времени HH:MM в минуты от начала дня
const parseTime = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

// Форматирование часа
const formatHour = (hour) => {
  return `${hour.toString().padStart(2, '0')}:00`;
};

// Форматирование минут в HH:MM
const formatMinutesToTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// Компонент карточки события на timeline
const TimelineEventCard = ({ 
  event, 
  style, 
  onToggleComplete, 
  onDelete,
  onEdit,
  onMarkSkipped,
  onTimeChange,
  hapticFeedback,
  isOverlapping,
  overlapIndex,
  totalOverlaps,
  timelineRef,
  hourHeight
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const longPressTimer = useRef(null);
  const startY = useRef(0);
  const cardRef = useRef(null);
  const wasDragging = useRef(false); // Флаг для предотвращения открытия модалки после drag
  
  const isScheduleEvent = event.origin === 'schedule';
  const isCompleted = event.completed;
  const isSkipped = event.skipped;
  const isUserEvent = event.origin === 'user';
  
  // Long press для активации перетаскивания
  const handlePointerDown = (e) => {
    if (isScheduleEvent) return; // Не перетаскиваем события из расписания
    
    // Захватываем pointer для отслеживания движения
    e.target.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    longPressTimer.current = setTimeout(() => {
      console.log('🎯 Drag enabled for event:', event.text);
      setIsDragging(true);
      if (hapticFeedback) {
        hapticFeedback('impact', 'heavy');
      }
    }, 300); // 0.3 секунды для активации перетаскивания
  };
  
  const handlePointerMove = (e) => {
    // Если таймер ещё не сработал и палец двигается - отменяем
    if (!isDragging && longPressTimer.current) {
      const deltaY = Math.abs(e.clientY - startY.current);
      if (deltaY > 10) {
        // Слишком большое движение - отменяем long press
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        return;
      }
    }
    
    if (!isDragging) return;
    
    const deltaY = e.clientY - startY.current;
    setDragOffset(deltaY);
  };
  
  const handlePointerUp = (e) => {
    // Освобождаем pointer capture
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore - pointer may not be captured
    }
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    // Если было перетаскивание - устанавливаем флаг чтобы не открывать модалку
    if (isDragging) {
      wasDragging.current = true;
      // Сбрасываем флаг через небольшую задержку (после срабатывания onClick)
      setTimeout(() => {
        wasDragging.current = false;
      }, 100);
    }
    
    if (isDragging && dragOffset !== 0) {
      console.log('📍 Drag ended, offset:', dragOffset);
      
      // Вычисляем новое время на основе смещения
      const pixelsPerMinute = (hourHeight || HOUR_HEIGHT) / 60;
      const minutesDelta = Math.round(dragOffset / pixelsPerMinute);
      const currentStartMinutes = parseTime(event.time_start);
      // Защита от пустого time_end - используем 60 минут по умолчанию
      const currentEndMinutes = parseTime(event.time_end) || (currentStartMinutes + 60);
      
      // Сохраняем ТОЧНУЮ длительность события (разницу между началом и концом)
      const duration = currentEndMinutes - currentStartMinutes;
      
      console.log('📏 Duration preserved:', duration, 'minutes');
      
      let newStartMinutes = currentStartMinutes + minutesDelta;
      // Ограничиваем в пределах дня (0:00 - 24:00)
      newStartMinutes = Math.max(0, Math.min(24 * 60 - Math.max(duration, 0), newStartMinutes));
      // Округляем начало до 5 минут для удобства
      newStartMinutes = Math.round(newStartMinutes / 5) * 5;
      
      // Конечное время = новое начало + ИСХОДНАЯ длительность (duration НЕ меняется!)
      const newEndMinutes = newStartMinutes + duration;
      
      const newStartTime = formatMinutesToTime(newStartMinutes);
      const newEndTime = formatMinutesToTime(Math.max(0, newEndMinutes));
      
      console.log('⏰ Time change:', event.time_start, '->', newStartTime, '| End:', event.time_end, '->', newEndTime, '| Duration kept:', duration, 'min');
      
      if (newStartTime !== event.time_start && onTimeChange) {
        onTimeChange(event, newStartTime, newEndTime);
      }
    }
    
    setIsDragging(false);
    setDragOffset(0);
  };
  
  const handlePointerCancel = (e) => {
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore - pointer may not be captured
    }
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsDragging(false);
    setDragOffset(0);
  };
  
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);
  
  // Цвета в зависимости от типа события
  const getEventColors = () => {
    if (isScheduleEvent) {
      return {
        bg: 'bg-white',
        bgLight: 'bg-blue-100',
        border: 'border-blue-500',
        text: 'text-gray-800',
        textDark: 'text-blue-800',
        accent: 'text-blue-600',
      };
    }
    
    const categoryColors = {
      'study': { bg: 'bg-white', bgLight: 'bg-purple-100', border: 'border-purple-500', text: 'text-gray-800', textDark: 'text-purple-800', accent: 'text-purple-600' },
      'personal': { bg: 'bg-white', bgLight: 'bg-green-100', border: 'border-green-500', text: 'text-gray-800', textDark: 'text-green-800', accent: 'text-green-600' },
      'sport': { bg: 'bg-white', bgLight: 'bg-red-100', border: 'border-red-500', text: 'text-gray-800', textDark: 'text-red-800', accent: 'text-red-600' },
      'work': { bg: 'bg-white', bgLight: 'bg-orange-100', border: 'border-orange-500', text: 'text-gray-800', textDark: 'text-orange-800', accent: 'text-orange-600' },
      'meeting': { bg: 'bg-white', bgLight: 'bg-pink-100', border: 'border-pink-500', text: 'text-gray-800', textDark: 'text-pink-800', accent: 'text-pink-600' },
    };
    
    return categoryColors[event.category] || categoryColors['personal'];
  };
  
  const colors = getEventColors();
  
  const getCategoryLabel = (category) => {
    const labels = {
      'study': 'Учеба',
      'personal': 'Личное',
      'sport': 'Спорт',
      'work': 'Работа',
      'meeting': 'Встреча',
    };
    return labels[category] || category;
  };

  // Вычисляем ширину и позицию при наложении событий
  const overlapStyle = isOverlapping ? {
    width: `calc((100% - 8px) / ${totalOverlaps})`,
    left: `calc(${overlapIndex} * (100% - 8px) / ${totalOverlaps})`,
  } : {};

  // Комбинированный стиль
  const combinedStyle = {
    ...style,
    ...overlapStyle,
    ...(isDragging ? {
      transform: `translateY(${dragOffset}px)`,
      zIndex: 100,
      boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
      transition: 'box-shadow 0.2s',
    } : {})
  };

  return (
    <>
      {/* Карточка события на timeline */}
      <div
        ref={cardRef}
        style={combinedStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={!isDragging ? handlePointerCancel : undefined}
        onPointerCancel={handlePointerCancel}
        onClick={(e) => {
          // Не открываем модалку если было перетаскивание
          if (isDragging || wasDragging.current) return;
          e.stopPropagation();
          hapticFeedback && hapticFeedback('selection');
          setIsExpanded(true);
        }}
        className={`
          absolute rounded-lg cursor-pointer overflow-hidden touch-none select-none
          border-l-4 ${colors.border} ${colors.bg}
          shadow-md hover:shadow-lg transition-shadow
          ${isDragging ? 'ring-2 ring-purple-400 scale-[1.02]' : ''}
          ${(isCompleted || isSkipped) ? 'opacity-50' : ''}
          ${isOverlapping ? '' : 'left-0 right-2'}
          ${!isScheduleEvent ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
      >
        <div className="p-2 h-full flex flex-col">
          {/* Название события */}
          <h4 className={`text-xs font-semibold ${colors.text} leading-tight line-clamp-2 flex items-start gap-1`}>
            {isCompleted && (
              <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
            )}
            {isSkipped && (
              <X className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <span className={isSkipped ? 'line-through' : ''}>{event.text}</span>
          </h4>
          
          {/* Время (если высота позволяет) */}
          {style.height >= 40 && (
            <div className={`text-[10px] ${colors.accent} mt-auto`}>
              {event.time_start} - {event.time_end}
            </div>
          )}
        </div>
        
        {/* Индикатор раскрытия */}
        <div className={`absolute bottom-1 right-1 ${colors.accent} opacity-60`}>
          <Info className="w-3 h-3" />
        </div>
      </div>

      {/* Модальное окно с подробной информацией - рендерится через Portal */}
      {isExpanded && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`
                w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl
              `}
            >
              {/* Заголовок */}
              <div className={`${colors.bg} p-4`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className={`text-lg font-bold ${colors.text} leading-tight flex items-center gap-2`}>
                      {isCompleted && (
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full flex-shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </span>
                      )}
                      {isSkipped && (
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 rounded-full flex-shrink-0">
                          <X className="w-3 h-3 text-white" />
                        </span>
                      )}
                      <span className={isSkipped ? 'line-through opacity-70' : ''}>{event.text}</span>
                    </h3>
                    <div className={`flex items-center gap-2 mt-2 ${colors.text} opacity-90`}>
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {event.time_start} — {event.time_end}
                      </span>
                      {isCompleted && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/30 text-white font-medium ml-1">
                          ✓ Выполнено
                        </span>
                      )}
                      {isSkipped && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/30 text-white font-medium ml-1">
                          ✗ Пропущено
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className={`p-1 rounded-full ${colors.text} opacity-80 hover:opacity-100 hover:bg-white/20`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Бейджи */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {isScheduleEvent && (
                    <span className="text-xs px-2 py-1 rounded-full bg-white/20 text-white font-medium">
                      📚 Пара
                    </span>
                  )}
                  {event.category && isUserEvent && (
                    <span className="text-xs px-2 py-1 rounded-full bg-white/20 text-white font-medium">
                      {getCategoryLabel(event.category)}
                    </span>
                  )}
                  {event.lessonType && (
                    <span className="text-xs px-2 py-1 rounded-full bg-white/20 text-white font-medium">
                      {event.lessonType}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Детали */}
              <div className="p-4 space-y-3">
                {event.teacher && (
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colors.bgLight}`}>
                      <User className={`w-4 h-4 ${colors.textDark}`} />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-medium">Преподаватель</div>
                      <div className="text-sm text-gray-800 font-medium">{event.teacher}</div>
                    </div>
                  </div>
                )}
                
                {event.auditory && (
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colors.bgLight}`}>
                      <MapPin className={`w-4 h-4 ${colors.textDark}`} />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-medium">Аудитория</div>
                      <div className="text-sm text-gray-800 font-medium">{event.auditory}</div>
                    </div>
                  </div>
                )}
                
                {event.subject && isUserEvent && (
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colors.bgLight}`}>
                      <BookOpen className={`w-4 h-4 ${colors.textDark}`} />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-medium">Предмет</div>
                      <div className="text-sm text-gray-800 font-medium">{event.subject}</div>
                    </div>
                  </div>
                )}
                
                {event.notes && (
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${colors.bgLight}`}>
                      <Info className={`w-4 h-4 ${colors.textDark}`} />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 font-medium">Заметки</div>
                      <div className="text-sm text-gray-700">{event.notes}</div>
                    </div>
                  </div>
                )}
                
                {/* Если нет дополнительной информации */}
                {!event.teacher && !event.auditory && !event.subject && !event.notes && (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    Нет дополнительной информации
                  </div>
                )}
              </div>
              
              {/* Кнопки действий */}
              <div className="p-4 pt-0 flex gap-2">
                {/* Кнопка редактирования */}
                <button
                  onClick={() => {
                    hapticFeedback && hapticFeedback('impact', 'light');
                    setIsExpanded(false);
                    onEdit && onEdit(event);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl font-medium text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  {isUserEvent ? 'Редактировать' : 'Подробнее'}
                </button>

                {/* Кнопка завершения (только для пользовательских и не пропущенных) */}
                {isUserEvent && !isSkipped && (
                  <button
                    onClick={() => {
                      hapticFeedback && hapticFeedback('impact', 'light');
                      onToggleComplete && onToggleComplete(event.id);
                      setIsExpanded(false);
                    }}
                    className={`
                      py-3 px-4 rounded-xl font-medium text-sm
                      transition-all active:scale-95 flex items-center justify-center gap-2
                      ${isCompleted 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                    title={isCompleted ? 'Снять отметку выполнения' : 'Отметить выполненным'}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}

                {/* Кнопка пропуска/снятия пропуска (только для пользовательских и не выполненных) */}
                {isUserEvent && !isCompleted && (
                  <button
                    onClick={() => {
                      hapticFeedback && hapticFeedback('impact', 'medium');
                      onMarkSkipped && onMarkSkipped(event.id);
                      setIsExpanded(false);
                    }}
                    className={`
                      py-3 px-4 rounded-xl font-medium text-sm
                      transition-all active:scale-95 flex items-center justify-center gap-2
                      ${isSkipped 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                    title={isSkipped ? 'Снять статус пропущенного' : 'Отметить как пропущенное'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Кнопка удаления */}
                <button
                  onClick={() => {
                    hapticFeedback && hapticFeedback('impact', 'medium');
                    onDelete && onDelete(event.id);
                    setIsExpanded(false);
                  }}
                  className="py-3 px-4 rounded-xl font-medium text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

// Главный компонент Timeline
export const PlannerTimeline = ({ 
  events = [], 
  onToggleComplete, 
  onDelete,
  onEdit,
  onQuickCreate,
  onMarkSkipped,
  onTimeChange,
  hapticFeedback,
  currentDate 
}) => {
  const timelineRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Обновление текущего времени каждую минуту
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  
  // Автопрокрутка к текущему времени или первому событию
  useEffect(() => {
    if (timelineRef.current) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      // Если есть события, прокрутка к первому событию
      if (events.length > 0) {
        const firstEventTime = Math.min(...events.map(e => parseTime(e.time_start)));
        const scrollTarget = Math.max(0, (firstEventTime / 60 - 1)) * HOUR_HEIGHT;
        timelineRef.current.scrollTop = scrollTarget;
      } else {
        // Иначе прокрутка к текущему времени
        const scrollTarget = Math.max(0, (currentMinutes / 60 - 2)) * HOUR_HEIGHT;
        timelineRef.current.scrollTop = scrollTarget;
      }
    }
  }, [events]);
  
  // Вычисление позиции текущего времени
  const currentTimePosition = useMemo(() => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return (minutes / 60) * HOUR_HEIGHT;
  }, [currentTime]);
  
  // Проверка, является ли сегодняшний день выбранным
  const isToday = useMemo(() => {
    if (!currentDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return currentDate === today;
  }, [currentDate]);
  
  // Обработка наложения событий
  const processedEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => parseTime(a.time_start) - parseTime(b.time_start));
    const result = [];
    
    sorted.forEach(event => {
      const startMinutes = parseTime(event.time_start);
      const endMinutes = parseTime(event.time_end) || startMinutes + 60;
      
      // Находим пересекающиеся события
      const overlapping = result.filter(e => {
        const eStart = parseTime(e.time_start);
        const eEnd = parseTime(e.time_end) || eStart + 60;
        return startMinutes < eEnd && endMinutes > eStart;
      });
      
      const overlapGroup = overlapping.length > 0 ? overlapping[0].overlapGroup : result.length;
      const overlapIndex = overlapping.length;
      
      result.push({
        ...event,
        overlapGroup,
        overlapIndex,
        startMinutes,
        endMinutes,
      });
    });
    
    // Обновляем totalOverlaps для каждой группы
    const groups = {};
    result.forEach(e => {
      if (!groups[e.overlapGroup]) groups[e.overlapGroup] = [];
      groups[e.overlapGroup].push(e);
    });
    
    return result.map(e => ({
      ...e,
      totalOverlaps: groups[e.overlapGroup].length,
      isOverlapping: groups[e.overlapGroup].length > 1,
    }));
  }, [events]);

  // Найти просроченные невыполненные события (только пользовательские)
  const overdueEvents = useMemo(() => {
    if (!isToday) return [];
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    return events.filter(event => {
      // Только пользовательские события (не из расписания)
      if (event.origin === 'schedule') return false;
      // Только невыполненные и не пропущенные
      if (event.completed || event.skipped) return false;
      // Время окончания прошло
      const endMinutes = parseTime(event.time_end);
      return endMinutes < currentMinutes;
    });
  }, [events, isToday]);

  // Текущее просроченное событие для показа (первое в списке)
  const [currentOverdueIndex, setCurrentOverdueIndex] = useState(0);
  
  // Сбрасываем индекс при изменении списка просроченных (безопасный способ)
  const overdueEventsLength = overdueEvents.length;
  const safeOverdueIndex = currentOverdueIndex >= overdueEventsLength ? 0 : currentOverdueIndex;
  const currentOverdueEvent = overdueEvents[safeOverdueIndex] || null;

  // Обработчик ответа на просроченное событие
  const handleOverdueResponse = async (completed) => {
    if (!currentOverdueEvent) return;
    
    hapticFeedback && hapticFeedback('impact', 'light');
    
    if (completed) {
      // Отмечаем как выполненное
      onToggleComplete && onToggleComplete(currentOverdueEvent.id);
    } else {
      // Отмечаем как пропущенное
      onMarkSkipped && onMarkSkipped(currentOverdueEvent.id);
    }
  };

  return (
    <div className="relative bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Плашка с просроченным событием */}
      <AnimatePresence>
        {currentOverdueEvent && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200"
          >
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-600 font-medium mb-0.5 flex items-center gap-1">
                    <AlarmClock className="w-3.5 h-3.5" />
                    Событие прошло — выполнено?
                  </p>
                  <p className="text-sm text-gray-800 font-medium truncate">
                    {currentOverdueEvent.text}
                  </p>
                  <p className="text-xs text-gray-500">
                    {currentOverdueEvent.time_start} – {currentOverdueEvent.time_end}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleOverdueResponse(true)}
                    className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 active:scale-95 transition-all shadow-sm"
                  >
                    Да
                  </button>
                  <button
                    onClick={() => handleOverdueResponse(false)}
                    className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 active:scale-95 transition-all shadow-sm"
                  >
                    Нет
                  </button>
                </div>
              </div>
              {overdueEvents.length > 1 && (
                <p className="text-xs text-amber-500 mt-1">
                  +{overdueEvents.length - 1} ещё
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Заголовок с датой */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Расписание дня</span>
          </div>
          <div className="flex items-center gap-2">
            {events.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                {events.length} {events.length === 1 ? 'событие' : events.length < 5 ? 'события' : 'событий'}
              </span>
            )}
            {onQuickCreate && (
              <button
                onClick={() => {
                  hapticFeedback && hapticFeedback('impact', 'light');
                  // По умолчанию создаем событие на текущий час
                  const now = new Date();
                  const startHour = now.getHours();
                  onQuickCreate(formatMinutesToTime(startHour * 60), formatMinutesToTime((startHour + 1) * 60));
                }}
                className="p-1.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                title="Быстрое создание события"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Timeline контейнер */}
      <div 
        ref={timelineRef}
        className="relative overflow-y-auto scrollbar-hide bg-gray-50/50"
        style={{ height: '400px' }}
      >
        <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Часовые линии - кликабельные для быстрого создания */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 flex border-t border-gray-200/70 group"
              style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
              onClick={(e) => {
                // Вычисляем точное время по клику
                if (onQuickCreate) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickY = e.clientY - rect.top;
                  const minutesOffset = Math.floor((clickY / HOUR_HEIGHT) * 60);
                  const totalMinutes = hour * 60 + minutesOffset;
                  
                  // Округляем до 15 минут
                  const roundedMinutes = Math.round(totalMinutes / 15) * 15;
                  const endMinutes = roundedMinutes + 60;
                  
                  hapticFeedback && hapticFeedback('impact', 'light');
                  onQuickCreate(formatMinutesToTime(roundedMinutes), formatMinutesToTime(endMinutes));
                }
              }}
            >
              {/* Время слева */}
              <div className="w-14 flex-shrink-0 pr-2 -mt-2.5">
                <span className="text-xs text-gray-400 font-medium">
                  {formatHour(hour)}
                </span>
              </div>
              
              {/* Разделительная линия с подсветкой при наведении */}
              <div className={`flex-1 border-l border-gray-100 ${onQuickCreate ? 'cursor-pointer hover:bg-blue-50/50 transition-colors' : ''}`} />
            </div>
          ))}
          
          {/* Индикатор текущего времени (только для сегодня и если есть события) */}
          {isToday && events.length > 0 && (
            <div
              className="absolute left-14 right-0 z-20 flex items-center"
              style={{ top: `${currentTimePosition}px` }}
            >
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full -ml-1.5 shadow-md" />
              <div className="flex-1 h-0.5 bg-red-500 shadow-sm" />
            </div>
          )}
          
          {/* События */}
          <div className="absolute left-14 right-0 top-0 bottom-0">
            <AnimatePresence>
              {processedEvents.map((event) => {
                const top = (event.startMinutes / 60) * HOUR_HEIGHT;
                const height = Math.max(
                  ((event.endMinutes - event.startMinutes) / 60) * HOUR_HEIGHT,
                  30 // Минимальная высота
                );
                
                return (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    style={{ top: `${top}px`, height: `${height}px` }}
                    onToggleComplete={onToggleComplete}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onMarkSkipped={onMarkSkipped}
                    onTimeChange={onTimeChange}
                    hapticFeedback={hapticFeedback}
                    isOverlapping={event.isOverlapping}
                    overlapIndex={event.overlapIndex}
                    totalOverlaps={event.totalOverlaps}
                    hourHeight={HOUR_HEIGHT}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Пустое состояние */}
      {events.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-5">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm font-medium">
              Нет событий на этот день
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Синхронизируйте пары или добавьте событие
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlannerTimeline;
