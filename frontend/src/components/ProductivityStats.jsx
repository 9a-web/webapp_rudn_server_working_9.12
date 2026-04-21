import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy, CheckCircle2, Calendar, TrendingUp, Zap } from 'lucide-react';

/**
 * Компонент статистики продуктивности для раздела "Список дел"
 * Показывает количество выполненных задач и streak (серия дней подряд)
 */
export const ProductivityStats = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl p-4 mb-4 animate-pulse">
        <div className="h-20 bg-gray-200/30 rounded-xl"></div>
      </div>
    );
  }

  if (!stats) return null;

  const {
    total_completed = 0,
    completed_today = 0,
    completed_this_week = 0,
    current_streak = 0,
    best_streak = 0,
    daily_stats = []
  } = stats;

  // Определяем цвет для streak
  const getStreakColor = (streak) => {
    if (streak >= 7) return 'from-orange-500 to-red-500';
    if (streak >= 3) return 'from-yellow-500 to-orange-500';
    return 'from-blue-500 to-purple-500';
  };

  // Определяем эмодзи для streak
  const getStreakEmoji = (streak) => {
    if (streak >= 30) return '🏆';
    if (streak >= 14) return '⭐';
    if (streak >= 7) return '🔥';
    if (streak >= 3) return '💪';
    return '✨';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10 rounded-2xl p-4 mb-4 border border-purple-500/20"
    >
      {/* Заголовок */}
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-5 h-5 text-purple-500" />
        <span className="font-semibold text-gray-800">Продуктивность</span>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Streak */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className={`bg-gradient-to-br ${getStreakColor(current_streak)} rounded-xl p-3 text-white shadow-lg`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-5 h-5" />
            <span className="text-xs opacity-90">Серия дней</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{current_streak}</span>
            <span className="text-xs opacity-80">{getStreakEmoji(current_streak)}</span>
          </div>
          {best_streak > current_streak && (
            <div className="text-xs opacity-75 mt-1">
              Рекорд: {best_streak} дн.
            </div>
          )}
        </motion.div>

        {/* Выполнено сегодня */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-3 text-white shadow-lg"
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-xs opacity-90">Сегодня</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{completed_today}</span>
            <span className="text-xs opacity-80">задач</span>
          </div>
        </motion.div>
      </div>

      {/* Дополнительная статистика */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-white/50 rounded-xl px-3 py-2 text-center">
          <div className="text-lg font-bold text-blue-600">{completed_this_week}</div>
          <div className="text-xs text-gray-600">За неделю</div>
        </div>
        <div className="flex-1 bg-white/50 rounded-xl px-3 py-2 text-center">
          <div className="text-lg font-bold text-purple-600">{total_completed}</div>
          <div className="text-xs text-gray-600">Всего</div>
        </div>
      </div>

      {/* График активности за 7 дней */}
      {daily_stats.length > 0 && (
        <div className="bg-white/50 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">Последние 7 дней</span>
          </div>
          <div className="flex justify-between items-end gap-1">
            {daily_stats.map((day, index) => {
              const maxCount = Math.max(...daily_stats.map(d => d.count), 1);
              const height = day.count > 0 ? Math.max(20, (day.count / maxCount) * 100) : 8;
              const isToday = index === daily_stats.length - 1;
              
              return (
                <div key={day.date} className="flex flex-col items-center flex-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className={`w-full rounded-t-md min-h-[8px] max-h-[40px] ${
                      day.has_completed
                        ? isToday
                          ? 'bg-gradient-to-t from-green-500 to-emerald-400'
                          : 'bg-gradient-to-t from-blue-500 to-blue-400'
                        : 'bg-gray-200'
                    }`}
                    style={{ height: `${height}%`, minHeight: '8px', maxHeight: '40px' }}
                    title={`${day.day_name}: ${day.count} задач`}
                  />
                  <span className={`text-[10px] mt-1 ${isToday ? 'font-bold text-green-600' : 'text-gray-500'}`}>
                    {day.day_name}
                  </span>
                  {day.count > 0 && (
                    <span className="text-[9px] text-gray-400">{day.count}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Мотивационное сообщение */}
      {current_streak > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-3 flex items-center gap-2 text-xs text-gray-600"
        >
          <Zap className="w-4 h-4 text-yellow-500" />
          {current_streak >= 7 
            ? `Отличная серия! Продолжай в том же духе! 🔥`
            : current_streak >= 3 
              ? `Хороший темп! До недельной серии осталось ${7 - current_streak} дн.`
              : `Начало положено! Выполняй задачи каждый день 💪`
          }
        </motion.div>
      )}
    </motion.div>
  );
};

export default ProductivityStats;
