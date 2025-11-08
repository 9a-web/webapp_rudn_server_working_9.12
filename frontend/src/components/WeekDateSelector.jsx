import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Компонент для выбора дня недели с отображением прогресса выполнения задач
 * Показывает 7 дней недели с:
 * - Коротким названием дня (Пн, Вт, Ср, ...)
 * - Числом месяца
 * - Круговым progress bar для прошедших дней (показывает % выполненных задач)
 * - Неактивным состоянием для будущих дней
 */
export const WeekDateSelector = ({ 
  selectedDate, 
  onDateSelect, 
  tasks = [],
  hapticFeedback 
}) => {
  const [weekDates, setWeekDates] = useState([]);
  
  // Короткие названия дней недели
  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  
  // Генерируем 7 дней начиная с понедельника текущей недели
  useEffect(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Воскресенье, 1 = Понедельник, ...
    
    // Вычисляем понедельник текущей недели
    const monday = new Date(today);
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // Если воскресенье, то -6, иначе 1 - currentDay
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    
    // Создаем массив из 7 дней
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    
    setWeekDates(dates);
  }, []);
  
  // Вычисляем процент выполненных задач для каждого дня
  const getCompletionPercentage = (date) => {
    if (!tasks || tasks.length === 0) return 0;
    
    // Фильтруем задачи для этого дня
    // Учитываем как created_at, так и deadline для более точного подсчета
    const dateStr = date.toISOString().split('T')[0];
    const dayTasks = tasks.filter(task => {
      // Проверяем created_at
      if (task.created_at) {
        const taskCreatedDate = new Date(task.created_at).toISOString().split('T')[0];
        if (taskCreatedDate === dateStr) return true;
      }
      
      // Проверяем deadline
      if (task.deadline) {
        const taskDeadlineDate = new Date(task.deadline).toISOString().split('T')[0];
        if (taskDeadlineDate === dateStr) return true;
      }
      
      return false;
    });
    
    if (dayTasks.length === 0) return 0;
    
    const completedTasks = dayTasks.filter(task => task.completed).length;
    return Math.round((completedTasks / dayTasks.length) * 100);
  };
  
  // Проверяем, является ли день прошедшим
  const isPastDay = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };
  
  // Проверяем, является ли день сегодняшним
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };
  
  // Проверяем, является ли день будущим
  const isFutureDay = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  };
  
  // Проверяем, выбран ли этот день
  const isSelected = (date) => {
    if (!selectedDate) return false;
    return date.toDateString() === new Date(selectedDate).toDateString();
  };
  
  // Обработчик клика на день
  const handleDayClick = (date) => {
    if (isFutureDay(date)) return; // Будущие дни неактивны
    
    if (hapticFeedback) hapticFeedback('impact', 'light');
    if (onDateSelect) onDateSelect(date);
  };
  
  return (
    <div className="mb-4">
      {/* Контейнер с горизонтальной прокруткой */}
      <div className="overflow-x-auto scrollbar-hide -mx-2 px-2">
        <div className="flex gap-2 min-w-max">
          {weekDates.map((date, index) => {
            const past = isPastDay(date);
            const today = isToday(date);
            const future = isFutureDay(date);
            const selected = isSelected(date);
            const completion = past || today ? getCompletionPercentage(date) : 0;
            
            const dayIndex = date.getDay();
            const dayName = dayNames[dayIndex];
            const dateNumber = date.getDate();
            
            return (
              <motion.button
                key={index}
                onClick={() => handleDayClick(date)}
                disabled={future}
                whileTap={!future ? { scale: 0.95 } : {}}
                className={`
                  relative flex-shrink-0 w-14 h-20 rounded-2xl
                  flex flex-col items-center justify-center
                  transition-all duration-300
                  ${future ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  ${selected 
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-400 shadow-lg shadow-yellow-500/30' 
                    : 'bg-white border border-gray-200 hover:border-yellow-300 hover:shadow-md'
                  }
                `}
                style={{
                  touchAction: 'manipulation'
                }}
              >
                {/* Название дня */}
                <span 
                  className={`
                    text-xs font-bold mb-1
                    ${selected ? 'text-white' : future ? 'text-gray-400' : 'text-gray-600'}
                  `}
                >
                  {dayName}
                </span>
                
                {/* Число с круговым progress bar для прошедших/текущего дня */}
                <div className="relative w-10 h-10 flex items-center justify-center">
                  {/* Progress bar (только для прошедших и текущего дня) */}
                  {(past || today) && (
                    <svg 
                      className="absolute inset-0 w-full h-full -rotate-90"
                      viewBox="0 0 40 40"
                    >
                      {/* Фоновый круг */}
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        stroke={selected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.1)'}
                        strokeWidth="2.5"
                        fill="none"
                      />
                      {/* Прогресс круг */}
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        stroke={selected ? '#ffffff' : '#f59e0b'}
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 16}`}
                        strokeDashoffset={`${2 * Math.PI * 16 * (1 - completion / 100)}`}
                        style={{
                          transition: 'stroke-dashoffset 0.5s ease'
                        }}
                      />
                    </svg>
                  )}
                  
                  {/* Число */}
                  <span 
                    className={`
                      relative z-10 text-base font-bold
                      ${selected 
                        ? 'text-white' 
                        : today 
                          ? 'text-orange-600' 
                          : future 
                            ? 'text-gray-400' 
                            : 'text-gray-800'
                      }
                    `}
                  >
                    {dateNumber}
                  </span>
                </div>
                
                {/* Индикатор сегодняшнего дня */}
                {today && !selected && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
      
      {/* Легенда (опционально) */}
      {weekDates.length > 0 && (
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span>Сегодня</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full border-2 border-orange-400 flex items-center justify-center">
              <span className="text-[10px] font-bold text-orange-600">%</span>
            </div>
            <span>Прогресс</span>
          </div>
        </div>
      )}
    </div>
  );
};
