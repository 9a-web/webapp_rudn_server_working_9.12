import React, { useMemo } from 'react';
import { X, BarChart3, Clock, Calendar, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, backdropVariants } from '../utils/animations';
import {
  calculateScheduleStats,
  findBusiestDay,
  findLightestDay,
  getWeekLoadChart,
  formatHours,
  calculateDayBusyPercentage,
} from '../utils/analytics';

export const AnalyticsModal = ({ isOpen, onClose, schedule, hapticFeedback }) => {
  // Рассчитываем статистику
  const stats = useMemo(() => {
    if (!schedule || schedule.length === 0) {
      return null;
    }
    
    const basicStats = calculateScheduleStats(schedule);
    const busiestDay = findBusiestDay(basicStats.classesByDay);
    const lightestDay = findLightestDay(basicStats.classesByDay);
    const weekChart = getWeekLoadChart(basicStats.classesByDay);
    
    return {
      ...basicStats,
      busiestDay,
      lightestDay,
      weekChart,
    };
  }, [schedule]);

  const handleClose = () => {
    hapticFeedback && hapticFeedback('impact', 'light');
    onClose();
  };

  if (!stats) {
    return null;
  }

  // Максимальное количество пар для масштабирования графика
  const maxClasses = Math.max(...stats.weekChart.map(d => d.classes), 1);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10"
              style={{
                backgroundColor: 'rgba(42, 42, 42, 0.8)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)'
              }}
              variants={modalVariants}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div 
                className="sticky top-0 border-b border-gray-700 p-4 flex items-center justify-between z-10"
                style={{
                  backgroundColor: 'rgba(42, 42, 42, 0.95)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)'
                }}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#A3F7BF]" />
                  <h2 className="text-xl font-bold text-white">Учебная аналитика</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Основные метрики */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Всего пар */}
                  <motion.div
                    className="bg-gradient-to-br from-[#A3F7BF]/10 to-[#FFE66D]/10 rounded-2xl p-4 border border-[#A3F7BF]/20"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Calendar className="w-6 h-6 text-[#A3F7BF] mb-2" />
                    <div className="text-2xl font-bold text-white">{stats.totalClasses}</div>
                    <div className="text-sm text-gray-400">Всего пар</div>
                  </motion.div>

                  {/* Часов обучения */}
                  <motion.div
                    className="bg-gradient-to-br from-[#FFE66D]/10 to-[#FFB4D1]/10 rounded-2xl p-4 border border-[#FFE66D]/20"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Clock className="w-6 h-6 text-[#FFE66D] mb-2" />
                    <div className="text-2xl font-bold text-white">{formatHours(stats.totalHours)}</div>
                    <div className="text-sm text-gray-400">Часов обучения</div>
                  </motion.div>

                  {/* Средняя загрузка */}
                  <motion.div
                    className="bg-gradient-to-br from-[#FFB4D1]/10 to-[#C4A3FF]/10 rounded-2xl p-4 border border-[#FFB4D1]/20"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TrendingUp className="w-6 h-6 text-[#FFB4D1] mb-2" />
                    <div className="text-2xl font-bold text-white">{stats.averageClassesPerDay}</div>
                    <div className="text-sm text-gray-400">Пар в день</div>
                  </motion.div>

                  {/* Занятых дней */}
                  <motion.div
                    className="bg-gradient-to-br from-[#C4A3FF]/10 to-[#80E8FF]/10 rounded-2xl p-4 border border-[#C4A3FF]/20"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Calendar className="w-6 h-6 text-[#C4A3FF] mb-2" />
                    <div className="text-2xl font-bold text-white">{stats.busyDays}</div>
                    <div className="text-sm text-gray-400">Учебных дней</div>
                  </motion.div>
                </div>

                {/* График загруженности по дням */}
                <div className="bg-[#1F1F1F] rounded-2xl p-4 border border-gray-700">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#80E8FF]" />
                    Загруженность по дням
                  </h3>
                  <div className="space-y-3">
                    {stats.weekChart.map((dayData, index) => (
                      <div key={dayData.day} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-300">{dayData.shortDay}</span>
                          <span className="text-gray-400">{dayData.classes} пар</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: `linear-gradient(90deg, #A3F7BF, #FFE66D, #FFB4D1)`,
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(dayData.classes / maxClasses) * 100}%` }}
                            transition={{ duration: 0.8, delay: index * 0.1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Самый загруженный и свободный день */}
                <div className="grid grid-cols-2 gap-3">
                  {stats.busiestDay && (
                    <div className="bg-[#1F1F1F] rounded-2xl p-4 border border-red-500/20">
                      <div className="text-xs text-gray-400 mb-1">Самый загруженный</div>
                      <div className="text-lg font-bold text-white">{stats.busiestDay.day}</div>
                      <div className="text-sm text-red-400">{stats.busiestDay.classCount} пар</div>
                    </div>
                  )}
                  {stats.lightestDay && (
                    <div className="bg-[#1F1F1F] rounded-2xl p-4 border border-green-500/20">
                      <div className="text-xs text-gray-400 mb-1">Самый свободный</div>
                      <div className="text-lg font-bold text-white">{stats.lightestDay.day}</div>
                      <div className="text-sm text-green-400">{stats.lightestDay.classCount} пар</div>
                    </div>
                  )}
                </div>

                {/* Дополнительная информация */}
                <div className="bg-gradient-to-r from-[#A3F7BF]/5 to-[#80E8FF]/5 rounded-2xl p-4 border border-gray-700">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    💡 В среднем у вас <span className="text-[#FFE66D] font-semibold">{stats.averageClassesPerDay} пары</span> в день.
                    Общая нагрузка составляет <span className="text-[#A3F7BF] font-semibold">{formatHours(stats.totalHours)}</span> в неделю.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
