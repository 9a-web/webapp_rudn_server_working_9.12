import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Clock, Check, Trash2, MapPin, User, BookOpen, Info } from 'lucide-react';

/**
 * Карточка события в планировщике
 * Отображает время слева, название справа, с возможностью развернуть для дополнительной информации
 */
export const PlannerEventCard = ({ 
  event, 
  onToggleComplete, 
  onDelete, 
  hapticFeedback 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isScheduleEvent = event.origin === 'schedule';
  const isCompleted = event.completed;
  const isUserEvent = event.origin === 'user';
  
  // Цвета в зависимости от типа события
  const getEventColors = () => {
    if (isScheduleEvent) {
      return {
        bgGradient: 'from-blue-50 via-blue-50/50 to-white',
        borderColor: 'border-blue-200/50',
        timeColor: 'text-blue-700',
        timeBg: 'bg-blue-100',
        iconBg: 'bg-blue-500',
        titleColor: 'text-gray-900',
        badgeColor: 'bg-blue-100 text-blue-700',
      };
    } else {
      // Пользовательское событие
      const categoryColors = {
        'study': { 
          bgGradient: 'from-purple-50 via-purple-50/50 to-white',
          borderColor: 'border-purple-200/50',
          timeColor: 'text-purple-700',
          timeBg: 'bg-purple-100',
          iconBg: 'bg-purple-500',
          badgeColor: 'bg-purple-100 text-purple-700',
        },
        'personal': {
          bgGradient: 'from-green-50 via-green-50/50 to-white',
          borderColor: 'border-green-200/50',
          timeColor: 'text-green-700',
          timeBg: 'bg-green-100',
          iconBg: 'bg-green-500',
          badgeColor: 'bg-green-100 text-green-700',
        },
        'sport': {
          bgGradient: 'from-red-50 via-red-50/50 to-white',
          borderColor: 'border-red-200/50',
          timeColor: 'text-red-700',
          timeBg: 'bg-red-100',
          iconBg: 'bg-red-500',
          badgeColor: 'bg-red-100 text-red-700',
        },
        'work': {
          bgGradient: 'from-orange-50 via-orange-50/50 to-white',
          borderColor: 'border-orange-200/50',
          timeColor: 'text-orange-700',
          timeBg: 'bg-orange-100',
          iconBg: 'bg-orange-500',
          badgeColor: 'bg-orange-100 text-orange-700',
        },
        'meeting': {
          bgGradient: 'from-pink-50 via-pink-50/50 to-white',
          borderColor: 'border-pink-200/50',
          timeColor: 'text-pink-700',
          timeBg: 'bg-pink-100',
          iconBg: 'bg-pink-500',
          badgeColor: 'bg-pink-100 text-pink-700',
        },
      };
      
      return categoryColors[event.category] || categoryColors['personal'];
    }
  };
  
  const colors = getEventColors();
  
  const getCategoryEmoji = (category) => {
    const categories = {
      'study': '📚',
      'personal': '🏠',
      'sport': '🏃',
      'work': '💼',
      'meeting': '👥',
    };
    return categories[category] || '📝';
  };
  
  const toggleExpand = () => {
    if (hapticFeedback) hapticFeedback('selection');
    setIsExpanded(!isExpanded);
  };
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        relative overflow-hidden rounded-2xl border-2 
        bg-gradient-to-r ${colors.bgGradient} ${colors.borderColor}
        transition-all duration-200
        ${isCompleted ? 'opacity-60' : ''}
        ${isExpanded ? 'shadow-lg' : 'shadow-sm hover:shadow-md'}
      `}
    >
      {/* Основное содержимое карточки */}
      <div className="flex items-stretch">
        {/* Время слева */}
        <div 
          className={`
            flex flex-col items-center justify-center px-4 py-4 
            ${colors.timeBg} min-w-[80px] border-r-2 ${colors.borderColor}
          `}
        >
          <Clock className={`w-5 h-5 ${colors.timeColor} mb-1.5`} />
          <div className={`text-sm font-bold ${colors.timeColor} text-center leading-tight`}>
            {event.time_start}
          </div>
          <div className={`text-xs ${colors.timeColor} opacity-70`}>
            —
          </div>
          <div className={`text-sm font-bold ${colors.timeColor} text-center leading-tight`}>
            {event.time_end}
          </div>
        </div>
        
        {/* Содержимое справа */}
        <div className="flex-1 p-4">
          <div 
            className="cursor-pointer"
            onClick={toggleExpand}
          >
            {/* Заголовок и бейджи */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 pr-2">
                <h3 className={`
                  text-base font-bold leading-tight mb-1.5
                  ${isCompleted ? 'line-through text-gray-500' : colors.titleColor}
                `}>
                  {event.text}
                </h3>
                
                {/* Бейджи */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isScheduleEvent && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badgeColor}`}>
                      Пара
                    </span>
                  )}
                  {event.category && isUserEvent && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badgeColor}`}>
                      {getCategoryEmoji(event.category)} {event.category === 'study' ? 'Учеба' : 
                         event.category === 'personal' ? 'Личное' : 
                         event.category === 'sport' ? 'Спорт' :
                         event.category === 'work' ? 'Работа' :
                         event.category === 'meeting' ? 'Встреча' : event.category}
                    </span>
                  )}
                  {event.lessonType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                      {event.lessonType}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Иконка развертывания */}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className={`w-5 h-5 ${colors.timeColor}`} />
              </motion.div>
            </div>
            
            {/* Краткая информация (всегда видна) */}
            {!isExpanded && (
              <div className="text-sm text-gray-600 space-y-0.5">
                {event.teacher && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate">{event.teacher}</span>
                  </div>
                )}
                {event.auditory && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{event.auditory}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Развернутая информация */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t-2 border-gray-100 space-y-2">
                  {/* Преподаватель */}
                  {event.teacher && (
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded-lg ${colors.timeBg} flex-shrink-0`}>
                        <User className={`w-4 h-4 ${colors.timeColor}`} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 font-medium">Преподаватель</div>
                        <div className="text-sm text-gray-800 font-medium">{event.teacher}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Аудитория */}
                  {event.auditory && (
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded-lg ${colors.timeBg} flex-shrink-0`}>
                        <MapPin className={`w-4 h-4 ${colors.timeColor}`} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 font-medium">Аудитория</div>
                        <div className="text-sm text-gray-800 font-medium">{event.auditory}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Предмет (для пользовательских событий) */}
                  {event.subject && isUserEvent && (
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded-lg ${colors.timeBg} flex-shrink-0`}>
                        <BookOpen className={`w-4 h-4 ${colors.timeColor}`} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 font-medium">Предмет</div>
                        <div className="text-sm text-gray-800 font-medium">{event.subject}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Заметки */}
                  {event.notes && (
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded-lg ${colors.timeBg} flex-shrink-0`}>
                        <Info className={`w-4 h-4 ${colors.timeColor}`} />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-gray-500 font-medium">Заметки</div>
                        <div className="text-sm text-gray-700">{event.notes}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Кнопки действий (только для пользовательских событий) */}
                  {isUserEvent && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hapticFeedback) hapticFeedback('impact', 'light');
                          onToggleComplete && onToggleComplete(event.id);
                        }}
                        className={`
                          flex-1 py-2.5 px-4 rounded-xl font-medium text-sm
                          transition-all active:scale-95
                          ${isCompleted 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }
                        `}
                      >
                        <Check className="w-4 h-4 inline mr-1.5" />
                        {isCompleted ? 'Выполнено' : 'Отметить'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hapticFeedback) hapticFeedback('impact', 'medium');
                          onDelete && onDelete(event.id);
                        }}
                        className="py-2.5 px-4 rounded-xl font-medium text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-all active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default PlannerEventCard;
