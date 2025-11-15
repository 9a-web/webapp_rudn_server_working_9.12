import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  // Используем useCallback для оптимизации и мemoization
  const getCompletionPercentage = useCallback((date) => {
    if (!tasks || tasks.length === 0) return 0;
    
    // Фильтруем задачи для этого дня используя ту же логику, что и в TasksSection
    const dateStr = date.toISOString().split('T')[0];
    
    // Сегодняшняя дата для проверки задач без дат
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const dayTasks = tasks.filter(task => {
      // ПРИОРИТЕТ 1: Задачи с target_date
      if (task.target_date) {
        const targetDateStr = new Date(task.target_date).toISOString().split('T')[0];
        return targetDateStr === dateStr;
      }
      
      // ПРИОРИТЕТ 2: Задачи с deadline (но без target_date)
      if (task.deadline) {
        const deadlineStr = new Date(task.deadline).toISOString().split('T')[0];
        return deadlineStr === dateStr;
      }
      
      // ПРИОРИТЕТ 3: Задачи без target_date и без deadline - показываем только на сегодня
      if (!task.target_date && !task.deadline) {
        return dateStr === todayStr;
      }
      
      return false;
    });
    
    if (dayTasks.length === 0) return 0;
    
    const completedTasks = dayTasks.filter(task => task.completed).length;
    return Math.round((completedTasks / dayTasks.length) * 100);
  }, [tasks]); // Пересчитываем только когда tasks изменяются
  
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
    // Разрешаем клики на все дни (включая будущие)
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
            
            // Генерируем уникальный ключ с датой и количеством задач для форсирования обновления
            const uniqueKey = `${date.toISOString().split('T')[0]}-${completion}`;
            
            return (
              <motion.button
                key={uniqueKey}
                onClick={() => handleDayClick(date)}
                whileTap={{ scale: 0.95 }}
                className={`
                  relative flex-shrink-0 w-14 h-20 rounded-2xl
                  flex flex-col items-center justify-center
                  transition-all duration-300 cursor-pointer
                  ${selected 
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-400 shadow-lg shadow-yellow-500/30' 
                    : future
                      ? 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md opacity-70'
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
                    ${selected ? 'text-white' : future ? 'text-blue-500' : 'text-gray-600'}
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
                      <motion.circle
                        cx="20"
                        cy="20"
                        r="16"
                        stroke={selected ? '#ffffff' : '#f59e0b'}
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 16}
                        initial={{ strokeDashoffset: 2 * Math.PI * 16 }}
                        animate={{ 
                          strokeDashoffset: 2 * Math.PI * 16 * (1 - completion / 100)
                        }}
                        transition={{ 
                          duration: 0.5, 
                          ease: 'easeInOut' 
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
                            ? 'text-blue-600' 
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
    </div>
  );
};
