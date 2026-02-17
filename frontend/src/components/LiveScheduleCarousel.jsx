import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, BarChart3, Clock, Calendar, TrendingUp, Flame } from 'lucide-react';
import { LiveScheduleCard } from './LiveScheduleCard';
import { WeatherWidget } from './WeatherWidget';
import { AchievementsModal } from './AchievementsModal';
import { AnalyticsModal } from './AnalyticsModal';
import {
  calculateScheduleStats,
  findBusiestDay,
  findLightestDay,
  getWeekLoadChart,
  formatHours,
} from '../utils/analytics';

export const LiveScheduleCarousel = ({ 
  currentClass, 
  minutesLeft, 
  hapticFeedback,
  allAchievements,
  userAchievements,
  userStats,
  user,
  schedule,
  isAchievementsOpen,
  setIsAchievementsOpen,
  isAnalyticsOpen,
  setIsAnalyticsOpen
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Рассчитываем статистику для карточки
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

  const cards = [
    { id: 0, type: 'schedule' },
    { id: 1, type: 'weather' },
    { id: 2, type: 'achievements' },
    { id: 3, type: 'stats' }
  ];

  const handlePrevious = (e) => {
    e.stopPropagation();
    hapticFeedback && hapticFeedback('impact', 'light');
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    hapticFeedback && hapticFeedback('impact', 'light');
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const currentCard = cards[currentIndex];

  // Максимальное количество пар для масштабирования графика
  const maxClasses = stats ? Math.max(...stats.weekChart.map(d => d.classes), 1) : 1;

  return (
    <>
      {/* Вертикальная карусель справа от основной карточки - для ВСЕХ устройств */}
      <div className="flex gap-0 md:gap-4 mt-4 md:mt-0 items-start pl-6 pr-15 md:px-0 md:overflow-visible">
        {/* Основная карточка слева - меняется в зависимости от currentIndex */}
        <div className="flex-1 relative md:overflow-visible">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.3 }}
            >
              {currentCard.type === 'schedule' && (
                <LiveScheduleCard 
                  currentClass={currentClass} 
                  minutesLeft={minutesLeft}
                />
              )}

              {currentCard.type === 'weather' && (
                <div style={{ paddingBottom: '38px' }}>
                  {/* 3-я карточка */}
                  <motion.div 
                    className="absolute rounded-3xl mx-auto left-0 right-0 border border-white/5"
                    style={{ 
                      backgroundColor: 'rgba(33, 33, 33, 0.6)',
                      backdropFilter: 'blur(20px) saturate(150%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                      width: '83.4%',
                      height: '140px',
                      top: '38px', // 25px от 2-й карточки (13 + 25 = 38)
                      zIndex: 1
                    }}
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.6 }}
                  />
                  {/* 2-я карточка */}
                  <motion.div 
                    className="absolute rounded-3xl mx-auto left-0 right-0 border border-white/5"
                    style={{ 
                      backgroundColor: 'rgba(44, 44, 44, 0.65)',
                      backdropFilter: 'blur(30px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(30px) saturate(160%)',
                      width: '93%',
                      height: '156px',
                      top: '13px', // 13px от 1-й карточки
                      zIndex: 2
                    }}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                  />
                  {/* 1-я карточка - основная с погодой */}
                  <motion.div 
                    className="relative rounded-3xl overflow-hidden border border-white/10"
                    style={{ 
                      backgroundColor: 'rgba(52, 52, 52, 0.7)',
                      backdropFilter: 'blur(40px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                      width: '100%',
                      zIndex: 3
                    }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <div className="p-4">
                      <WeatherWidget hapticFeedback={hapticFeedback} />
                    </div>
                  </motion.div>
                </div>
              )}

              {currentCard.type === 'achievements' && user && (
                <div 
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAchievementsOpen(true);
                  }}
                  style={{ paddingBottom: '38px' }}
                >
                  {/* 3-я карточка */}
                  <motion.div 
                    className="absolute rounded-3xl mx-auto left-0 right-0 border border-white/5"
                    style={{ 
                      backgroundColor: 'rgba(33, 33, 33, 0.6)',
                      backdropFilter: 'blur(20px) saturate(150%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                      width: '83.4%',
                      height: '140px',
                      top: '38px', // 25px от 2-й карточки (13 + 25 = 38)
                      zIndex: 1
                    }}
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.6 }}
                  />
                  {/* 2-я карточка */}
                  <motion.div 
                    className="absolute rounded-3xl mx-auto left-0 right-0 border border-white/5"
                    style={{ 
                      backgroundColor: 'rgba(44, 44, 44, 0.65)',
                      backdropFilter: 'blur(30px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(30px) saturate(160%)',
                      width: '93%',
                      height: '156px',
                      top: '13px', // 13px от 1-й карточки
                      zIndex: 2
                    }}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                  />
                  {/* 1-я карточка - основная с достижениями */}
                  <motion.div 
                    className="relative rounded-3xl p-6 overflow-hidden border border-white/10"
                    style={{ 
                      backgroundColor: 'rgba(52, 52, 52, 0.7)',
                      backdropFilter: 'blur(40px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                      width: '100%',
                      zIndex: 3
                    }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-br from-[#FFE66D]/20 to-transparent"
                      animate={{ opacity: [0.3, 0.5, 0.3] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-3xl">🏆</span>
                          <h3 className="text-xl font-bold text-white">Достижения</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-[#FFE66D]">
                            {userStats?.total_points || 0}
                          </div>
                          <div className="text-xs text-gray-400">очков</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-3xl font-bold text-white mb-1">
                            {userStats?.achievements_count || 0}/{allAchievements.length}
                          </div>
                          <div className="text-sm text-gray-400">Получено</div>
                        </div>

                        {/* Последние 3 достижения */}
                        <div className="flex gap-2">
                          {userAchievements.slice(0, 3).map((ua, idx) => (
                            <motion.div
                              key={idx}
                              className="text-3xl"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.3 + idx * 0.1 }}
                            >
                              {ua.achievement.emoji}
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 text-center text-sm text-[#A3F7BF]">
                        Нажмите, чтобы открыть
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* 4-я карточка - Статистика */}
              {currentCard.type === 'stats' && stats && (
                <div 
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticFeedback && hapticFeedback('impact', 'medium');
                    setIsAnalyticsOpen(true);
                  }}
                  style={{ paddingBottom: '38px' }}
                >
                  {/* 3-я карточка (фон) */}
                  <motion.div 
                    className="absolute rounded-3xl mx-auto left-0 right-0 border border-white/5"
                    style={{ 
                      backgroundColor: 'rgba(33, 33, 33, 0.6)',
                      backdropFilter: 'blur(20px) saturate(150%)',
                      WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                      width: '83.4%',
                      height: '140px',
                      top: '38px',
                      zIndex: 1
                    }}
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.6 }}
                  />
                  {/* 2-я карточка (средняя) */}
                  <motion.div 
                    className="absolute rounded-3xl mx-auto left-0 right-0 border border-white/5"
                    style={{ 
                      backgroundColor: 'rgba(44, 44, 44, 0.65)',
                      backdropFilter: 'blur(30px) saturate(160%)',
                      WebkitBackdropFilter: 'blur(30px) saturate(160%)',
                      width: '93%',
                      height: '156px',
                      top: '13px',
                      zIndex: 2
                    }}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                  />
                  {/* 1-я карточка - основная со статистикой */}
                  <motion.div 
                    className="relative rounded-3xl p-5 overflow-hidden border border-white/10"
                    style={{ 
                      backgroundColor: 'rgba(52, 52, 52, 0.7)',
                      backdropFilter: 'blur(40px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                      width: '100%',
                      zIndex: 3
                    }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {/* Градиентный фон */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-br from-[#80E8FF]/15 via-[#A3F7BF]/10 to-[#C4A3FF]/15"
                      animate={{ opacity: [0.3, 0.5, 0.3] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    />
                    
                    <div className="relative">
                      {/* Заголовок */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#80E8FF]/30 to-[#A3F7BF]/30 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-[#80E8FF]" />
                          </div>
                          <h3 className="text-lg font-bold text-white">Статистика</h3>
                        </div>
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#A3F7BF]/10 border border-[#A3F7BF]/20">
                          <TrendingUp className="w-3.5 h-3.5 text-[#A3F7BF]" />
                          <span className="text-xs font-medium text-[#A3F7BF]">неделя</span>
                        </div>
                      </div>

                      {/* Основные метрики в 2х2 сетке */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {/* Всего пар */}
                        <div className="bg-gradient-to-br from-[#A3F7BF]/10 to-transparent rounded-xl p-2.5 border border-[#A3F7BF]/10">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Calendar className="w-3.5 h-3.5 text-[#A3F7BF]" />
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Пар</span>
                          </div>
                          <div className="text-xl font-bold text-white">{stats.totalClasses}</div>
                        </div>
                        
                        {/* Часов */}
                        <div className="bg-gradient-to-br from-[#FFE66D]/10 to-transparent rounded-xl p-2.5 border border-[#FFE66D]/10">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Clock className="w-3.5 h-3.5 text-[#FFE66D]" />
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Часов</span>
                          </div>
                          <div className="text-xl font-bold text-white">{formatHours(stats.totalHours)}</div>
                        </div>
                        
                        {/* Загруженный день */}
                        <div className="bg-gradient-to-br from-[#FFB4D1]/10 to-transparent rounded-xl p-2.5 border border-[#FFB4D1]/10">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Flame className="w-3.5 h-3.5 text-[#FFB4D1]" />
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Макс</span>
                          </div>
                          <div className="text-sm font-bold text-white truncate">
                            {stats.busiestDay?.day?.slice(0, 2) || '—'}
                            <span className="text-xs text-[#FFB4D1] ml-1">
                              {stats.busiestDay?.classCount || 0} пар
                            </span>
                          </div>
                        </div>
                        
                        {/* Среднее */}
                        <div className="bg-gradient-to-br from-[#C4A3FF]/10 to-transparent rounded-xl p-2.5 border border-[#C4A3FF]/10">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <TrendingUp className="w-3.5 h-3.5 text-[#C4A3FF]" />
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">В день</span>
                          </div>
                          <div className="text-xl font-bold text-white">{stats.averageClassesPerDay}</div>
                        </div>
                      </div>

                      {/* Мини-график недели */}
                      <div className="bg-[#1F1F1F]/50 rounded-xl p-3 border border-gray-700/30">
                        <div className="flex items-end justify-between gap-1 h-10">
                          {stats.weekChart.map((dayData, index) => (
                            <div key={dayData.day} className="flex-1 flex flex-col items-center gap-1">
                              <motion.div 
                                className="w-full rounded-sm"
                                style={{
                                  background: dayData.classes > 0 
                                    ? `linear-gradient(180deg, #A3F7BF, #80E8FF)`
                                    : 'rgba(75, 75, 75, 0.5)',
                                  minHeight: '4px'
                                }}
                                initial={{ height: 0 }}
                                animate={{ 
                                  height: dayData.classes > 0 
                                    ? `${Math.max(20, (dayData.classes / maxClasses) * 100)}%`
                                    : '4px'
                                }}
                                transition={{ duration: 0.5, delay: index * 0.05 }}
                              />
                              <span className="text-[9px] text-gray-500 font-medium">
                                {dayData.shortDay}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Подсказка */}
                      <div className="mt-3 text-center">
                        <span className="text-xs text-[#80E8FF]/80">
                          Нажмите для подробной аналитики →
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Заглушка если нет расписания для статистики */}
              {currentCard.type === 'stats' && !stats && (
                <div style={{ paddingBottom: '38px' }}>
                  <motion.div 
                    className="absolute rounded-3xl mx-auto left-0 right-0 border border-white/5"
                    style={{ 
                      backgroundColor: 'rgba(33, 33, 33, 0.6)',
                      backdropFilter: 'blur(20px) saturate(150%)',
                      width: '83.4%',
                      height: '140px',
                      top: '38px',
                      zIndex: 1
                    }}
                  />
                  <motion.div 
                    className="absolute rounded-3xl mx-auto left-0 right-0 border border-white/5"
                    style={{ 
                      backgroundColor: 'rgba(44, 44, 44, 0.65)',
                      backdropFilter: 'blur(30px) saturate(160%)',
                      width: '93%',
                      height: '156px',
                      top: '13px',
                      zIndex: 2
                    }}
                  />
                  <motion.div 
                    className="relative rounded-3xl p-6 overflow-hidden border border-white/10"
                    style={{ 
                      backgroundColor: 'rgba(52, 52, 52, 0.7)',
                      backdropFilter: 'blur(40px) saturate(180%)',
                      width: '100%',
                      zIndex: 3
                    }}
                  >
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <BarChart3 className="w-12 h-12 text-gray-600 mb-3" />
                      <h3 className="text-lg font-bold text-gray-400 mb-1">Статистика</h3>
                      <p className="text-sm text-gray-500">
                        Выберите группу для<br/>просмотра аналитики
                      </p>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Вертикальная карусель справа - скрыта на десктопах (md и больше) */}
        <div 
          className="flex flex-col items-center justify-center gap-3 md:hidden ml-[5px] pr-[10px]"
          style={{
            // Компенсируем paddingBottom карточек (38px / 2 = 19px) для центрирования по основной карточке
            marginTop: currentCard.type === 'schedule' ? '0' : '-19px'
          }}
        >
          {/* Кнопка вверх */}
          <motion.button
            onClick={handlePrevious}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800/80 hover:bg-gray-700/80 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronUp className="w-4 h-4 text-white" />
          </motion.button>

          {/* Вертикальные индикаторы */}
          <div className="flex flex-col justify-center gap-2">
            {cards.map((card, index) => (
              <motion.button
                key={card.id}
                onClick={(e) => {
                  e.stopPropagation();
                  hapticFeedback && hapticFeedback('impact', 'light');
                  setCurrentIndex(index);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? 'bg-[#A3F7BF] h-6' : 'bg-gray-600'
                }`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              />
            ))}
          </div>

          {/* Кнопка вниз */}
          <motion.button
            onClick={handleNext}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800/80 hover:bg-gray-700/80 transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronDown className="w-4 h-4 text-white" />
          </motion.button>
        </div>
      </div>

      {/* Модалка достижений */}
      {user && (
        <AchievementsModal
          isOpen={isAchievementsOpen}
          onClose={() => setIsAchievementsOpen(false)}
          allAchievements={allAchievements}
          userAchievements={userAchievements}
          userStats={userStats}
          hapticFeedback={hapticFeedback}
        />
      )}

      {/* Модалка аналитики */}
      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        schedule={schedule}
        userStats={userStats}
        hapticFeedback={hapticFeedback}
      />
    </>
  );
};
