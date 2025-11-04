import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, ChevronRight, ChevronDown, RefreshCw, Users, ChevronLeft, Share2 } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { getWeekNumberForDate } from '../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { fadeInUp, listItemVariants, buttonVariants, staggerContainer } from '../utils/animations';
import { translateDiscipline, translateLessonType } from '../i18n/subjects';
import { ShareScheduleModal } from './ShareScheduleModal';

export const LiveScheduleSection = ({ 
  selectedDate, 
  mockSchedule, 
  weekNumber = 1,
  onWeekChange,
  groupName,
  onChangeGroup,
  hapticFeedback,
  onDateSelect, // Добавляем коллбек для изменения даты
  telegramId // Telegram ID для трекинга
}) => {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [swipeDirection, setSwipeDirection] = useState(0); // -1 left, 0 none, 1 right
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { t, i18n } = useTranslation();
  
  // Motion values для swipe индикатора
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, 0, 100], [0.5, 0, 0.5]);
  const scale = useTransform(x, [-100, 0, 100], [1.2, 1, 1.2]);
  
  // Refs для swipe detection
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const swipeContainerRef = useRef(null);

  // Update current time every 10 seconds for real-time status updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Определяем, к какой неделе относится выбранная дата
  const selectedWeekNumber = getWeekNumberForDate(selectedDate);

  // Format date for display
  const dayNumber = selectedDate.getDate();
  const dayName = selectedDate.toLocaleDateString('ru-RU', { weekday: 'long' });
  
  // Format date for the button (e.g., "Oct. 12")
  const monthShort = selectedDate.toLocaleDateString('ru-RU', { month: 'short' });
  const dateButton = `${dayNumber} ${monthShort}`;

  // Function to determine class status
  const getClassStatus = (classItem) => {
    const now = new Date(); // Всегда используем актуальное время
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Проверяем, что выбранный день - сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Сбрасываем время для корректного сравнения дат
    
    const selectedDay = new Date(selectedDate);
    selectedDay.setHours(0, 0, 0, 0);
    
    const isToday = selectedDay.getTime() === today.getTime();

    const timeRange = classItem.time.split('-');
    if (timeRange.length !== 2) return { status: t('classStatus.upcoming'), color: '#FF6B6B' };

    const [startHour, startMin] = timeRange[0].trim().split(':').map(Number);
    const [endHour, endMin] = timeRange[1].trim().split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Если выбран прошлый день - все пары закончились
    if (selectedDay < today) {
      return { status: t('classStatus.finished'), color: '#76EF83' };
    }

    // Если выбран будущий день - все пары предстоят
    if (selectedDay > today) {
      return { status: t('classStatus.upcoming'), color: '#FF6B6B' };
    }

    // Если сегодня - проверяем по времени
    if (isToday) {
      if (currentMinutes >= endTime) {
        // Пара закончилась
        return { status: t('classStatus.finished'), color: '#76EF83' };
      } else if (currentMinutes >= startTime && currentMinutes < endTime) {
        // Пара идёт сейчас
        return { status: t('classStatus.inProgress'), color: '#FFC83F' };
      } else {
        // Пара ещё не началась
        return { status: t('classStatus.upcoming'), color: '#FF6B6B' };
      }
    }

    // Fallback - не должен достигаться при корректной логике
    return { status: t('classStatus.upcoming'), color: '#FF6B6B' };
  };

  const toggleExpand = (index) => {
    if (hapticFeedback) hapticFeedback('selection');
    setExpandedIndex(expandedIndex === index ? null : index);
  };
  
  // Навигация между днями
  const navigateDay = useCallback((direction) => {
    if (!onDateSelect) return;
    
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + direction);
    
    if (hapticFeedback) hapticFeedback('impact', 'medium');
    onDateSelect(newDate);
  }, [selectedDate, onDateSelect, hapticFeedback]);
  
  // Обработчики свайпов
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
  }, []);
  
  const handleTouchMove = useCallback((e) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);
    
    // Обновляем motion value для визуальной обратной связи
    if (Math.abs(deltaX) > deltaY) {
      x.set(deltaX);
      
      // Показываем индикатор направления
      if (deltaX > 30) {
        setSwipeDirection(1); // Right - previous day
      } else if (deltaX < -30) {
        setSwipeDirection(-1); // Left - next day
      } else {
        setSwipeDirection(0);
      }
    }
  }, [x]);
  
  const handleTouchEnd = useCallback(() => {
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);
    const threshold = 80; // Минимальное расстояние для срабатывания
    
    // Проверяем, что горизонтальное движение больше вертикального
    if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        // Свайп вправо - предыдущий день
        navigateDay(-1);
      } else {
        // Свайп влево - следующий день
        navigateDay(1);
      }
    }
    
    // Сброс
    animate(x, 0, { duration: 0.3, ease: 'easeOut' });
    setSwipeDirection(0);
  }, [x, navigateDay]);
  
  // Подключаем обработчики
  useEffect(() => {
    const element = swipeContainerRef.current;
    if (!element) return;
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Фильтруем расписание по выбранному дню
  const currentDayName = selectedDate.toLocaleDateString('ru-RU', { weekday: 'long' });
  const formattedDayName = currentDayName.charAt(0).toUpperCase() + currentDayName.slice(1);
  const todaySchedule = mockSchedule.filter(item => item.day === formattedDayName);

  return (
    <div className="bg-white rounded-t-[40px] mt-6 min-h-screen">
      <div className="px-6 md:px-8 lg:px-10 xl:px-12 pt-8 md:pt-10 lg:pt-12 pb-6">
        {/* Header section */}
        <div className="flex items-start justify-between mb-4 md:mb-6">
          <div>
            <h2 
              className="font-bold mb-1 text-2xl md:text-3xl lg:text-4xl"
              style={{ 
                color: '#1C1C1C',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                lineHeight: '1.2'
              }}
            >
              {t('liveScheduleSection.title')}
            </h2>
            {groupName && (
              <p 
                className="mt-1 text-sm md:text-base"
                style={{ 
                  color: '#666666',
                  fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif',
                  fontWeight: 500
                }}
              >
                {t('liveScheduleSection.group', { groupName })}
              </p>
            )}
          </div>
          
          {/* Date button */}
          <button
            className="flex items-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-[30px] transition-all duration-300 hover:opacity-80 border border-white/10"
            style={{ 
              backgroundColor: 'rgba(28, 28, 28, 0.7)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)'
            }}
          >
            <Calendar className="w-4 h-4 md:w-5 md:h-5 text-white" />
            <span 
              className="text-sm md:text-base font-medium text-white"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {dateButton}
            </span>
          </button>
        </div>

        {/* Week selector */}
        {onWeekChange && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                if (hapticFeedback) hapticFeedback('impact', 'medium');
                onWeekChange(1);
              }}
              disabled={selectedWeekNumber === null}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                selectedWeekNumber === 1
                  ? 'bg-black text-white' 
                  : selectedWeekNumber === null
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('liveScheduleSection.currentWeek')}
            </button>
            <button
              onClick={() => {
                if (hapticFeedback) hapticFeedback('impact', 'medium');
                onWeekChange(2);
              }}
              disabled={selectedWeekNumber === null}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                selectedWeekNumber === 2
                  ? 'bg-black text-white' 
                  : selectedWeekNumber === null
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('liveScheduleSection.nextWeek')}
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mb-4">
          {/* Change group button */}
          {onChangeGroup && (
            <button
              onClick={() => {
                if (hapticFeedback) hapticFeedback('impact', 'medium');
                onChangeGroup();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
            >
              <Users className="w-4 h-4" />
              {t('liveScheduleSection.changeGroup')}
            </button>
          )}
          
          {/* Share button */}
          <button
            onClick={() => {
              if (hapticFeedback) hapticFeedback('impact', 'medium');
              setIsShareModalOpen(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg transition-all"
          >
            <Share2 className="w-4 h-4" />
            Поделиться
          </button>
        </div>

        {/* Schedule list with swipe container */}
        <div className="relative" ref={swipeContainerRef}>
          {/* Swipe indicators */}
          <AnimatePresence>
            {swipeDirection !== 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-1/2 z-10 pointer-events-none"
                style={{
                  left: swipeDirection === 1 ? '20px' : 'auto',
                  right: swipeDirection === -1 ? '20px' : 'auto',
                  transform: 'translateY(-50%)'
                }}
              >
                <motion.div
                  style={{ opacity, scale }}
                  className="flex items-center justify-center w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm"
                >
                  {swipeDirection === 1 ? (
                    <ChevronLeft className="w-6 h-6 text-white" />
                  ) : (
                    <ChevronRight className="w-6 h-6 text-white" />
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Schedule content */}
          {todaySchedule.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-base md:text-lg">
                {mockSchedule.length === 0 
                  ? t('liveScheduleSection.loading')
                  : t('liveScheduleSection.noClasses')}
              </p>
            </div>
          ) : (
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-3 md:gap-4"
              initial="initial"
              animate="animate"
              variants={staggerContainer}
            >
              {todaySchedule.map((classItem, index) => {
              const { status, color } = getClassStatus(classItem);
              const isExpanded = expandedIndex === index;

              return (
                <motion.div 
                  key={index}
                  variants={listItemVariants}
                  custom={index}
                  className="rounded-2xl md:rounded-3xl p-4 md:p-5 transition-all duration-300 cursor-pointer hover:shadow-md border border-white/20"
                  style={{ 
                    backgroundColor: 'rgba(245, 245, 245, 0.85)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)'
                  }}
                  onClick={() => toggleExpand(index)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p 
                        className="font-bold mb-2 text-base md:text-lg"
                        style={{ 
                          color: '#2C2C2C',
                          fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif'
                        }}
                      >
                        {translateDiscipline(classItem.discipline, i18n.language)}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span 
                          className="font-medium"
                          style={{ 
                            fontSize: '13px',
                            color: color,
                            fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif'
                          }}
                        >
                          {status}
                        </span>
                        <span 
                          style={{ 
                            fontSize: '13px',
                            color: '#3B3B3B',
                            fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif'
                          }}
                        >
                          , {classItem.time}
                        </span>
                        {classItem.lessonType && (
                          <span 
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ 
                              backgroundColor: '#E0E0E0',
                              color: '#555555',
                              fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif'
                            }}
                          >
                            {translateLessonType(classItem.lessonType, i18n.language)}
                          </span>
                        )}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2 animate-in fade-in duration-200">
                          {classItem.auditory && (
                            <p 
                              style={{ 
                                fontSize: '13px',
                                color: '#999999',
                                fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif'
                              }}
                            >
                              {t('classDetails.auditory')} <span style={{ color: '#3B3B3B' }}>{classItem.auditory}</span>
                            </p>
                          )}
                          {classItem.teacher && (
                            <p 
                              style={{ 
                                fontSize: '13px',
                                color: '#999999',
                                fontFamily: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif'
                              }}
                            >
                              {t('classDetails.teacher')} <span style={{ color: '#3B3B3B' }}>{classItem.teacher}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Chevron icon */}
                    {isExpanded ? (
                      <ChevronDown className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: '#1C1C1C' }} />
                    ) : (
                      <ChevronRight className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: '#1C1C1C' }} />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
        </div>
      </div>

      {/* Share Schedule Modal */}
      <ShareScheduleModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        schedule={mockSchedule}
        selectedDate={selectedDate}
        groupName={groupName}
        hapticFeedback={hapticFeedback}
        telegramId={telegramId}
      />
    </div>
  );
};
