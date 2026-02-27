import React, { useState, useMemo, useCallback } from 'react';
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

// ─── Stack animation config ───────────────────
const SPRING = { type: 'spring', stiffness: 320, damping: 28, mass: 0.8 };

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
  const [direction, setDirection] = useState(1);

  const stats = useMemo(() => {
    if (!schedule || schedule.length === 0) return null;
    const basicStats = calculateScheduleStats(schedule);
    return {
      ...basicStats,
      busiestDay: findBusiestDay(basicStats.classesByDay),
      lightestDay: findLightestDay(basicStats.classesByDay),
      weekChart: getWeekLoadChart(basicStats.classesByDay),
    };
  }, [schedule]);

  const cards = useMemo(() => [
    { id: 'schedule',     type: 'schedule' },
    { id: 'weather',      type: 'weather' },
    { id: 'achievements', type: 'achievements' },
    { id: 'stats',        type: 'stats' },
  ], []);

  const handlePrevious = useCallback((e) => {
    e.stopPropagation();
    hapticFeedback?.('impact', 'light');
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  }, [hapticFeedback, cards.length]);

  const handleNext = useCallback((e) => {
    e.stopPropagation();
    hapticFeedback?.('impact', 'light');
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  }, [hapticFeedback, cards.length]);

  const goToCard = useCallback((index, e) => {
    e.stopPropagation();
    hapticFeedback?.('impact', 'light');
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [hapticFeedback, currentIndex]);

  const currentCard = cards[currentIndex];
  const maxClasses = stats ? Math.max(...stats.weekChart.map(d => d.classes), 1) : 1;

  const sharedCardStyle = useMemo(() => ({
    backgroundColor: 'rgba(52, 52, 52, 0.7)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    width: '100%',
  }), []);

  // ─── Direction-aware variants for front card ─
  const frontCardVariants = {
    enter: (dir) => ({
      y: dir >= 0 ? 30 : -70,
      scale: dir >= 0 ? 0.92 : 0.96,
      opacity: 0,
    }),
    center: {
      y: 0,
      scale: 1,
      opacity: 1,
      zIndex: 30,
    },
    exit: (dir) => ({
      y: dir >= 0 ? -70 : 30,
      scale: dir >= 0 ? 0.96 : 0.92,
      opacity: 0,
      zIndex: 40,
    }),
  };

  // ─── Card content renderer ─────────────────
  const renderCardContent = (type) => {
    switch (type) {
      case 'schedule':
        return (
          <LiveScheduleCard 
            currentClass={currentClass} 
            minutesLeft={minutesLeft}
          />
        );

      case 'weather':
        return (
          <div 
            className="relative rounded-3xl overflow-hidden border border-white/10"
            style={{ ...sharedCardStyle, minHeight: '130px' }}
          >
            <div className="p-4">
              <WeatherWidget hapticFeedback={hapticFeedback} />
            </div>
          </div>
        );

      case 'achievements':
        return (
          <div 
            className="relative rounded-3xl p-5 overflow-hidden border border-white/10 cursor-pointer"
            style={{ ...sharedCardStyle, minHeight: '130px' }}
            onClick={(e) => {
              e.stopPropagation();
              if (user) setIsAchievementsOpen(true);
            }}
          >
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-[#FFE66D]/20 to-transparent"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative">
              {user ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🏆</span>
                      <h3 className="text-lg font-bold text-white">Достижения</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-[#FFE66D]">{userStats?.total_points || 0}</div>
                      <div className="text-[10px] text-gray-400">очков</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-white mb-0.5">
                        {userStats?.achievements_count || 0}/{allAchievements?.length || 0}
                      </div>
                      <div className="text-xs text-gray-400">Получено</div>
                    </div>
                    <div className="flex gap-2">
                      {(userAchievements || []).slice(0, 3).map((ua, idx) => (
                        <span key={idx} className="text-2xl">{ua.achievement?.emoji || '🎯'}</span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 text-center text-xs text-[#A3F7BF]">Нажмите, чтобы открыть</div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <span className="text-3xl mb-2">🏆</span>
                  <h3 className="text-lg font-bold text-gray-400 mb-1">Достижения</h3>
                  <p className="text-xs text-gray-500">Войдите для просмотра</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'stats':
        if (!stats) {
          return (
            <div className="relative rounded-3xl p-5 overflow-hidden border border-white/10"
              style={{ ...sharedCardStyle, minHeight: '130px' }}>
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <BarChart3 className="w-10 h-10 text-gray-600 mb-2" />
                <h3 className="text-base font-bold text-gray-400 mb-0.5">Статистика</h3>
                <p className="text-xs text-gray-500">Выберите группу для<br/>просмотра аналитики</p>
              </div>
            </div>
          );
        }
        return (
          <div 
            className="relative rounded-3xl p-4 overflow-hidden border border-white/10 cursor-pointer"
            style={{ ...sharedCardStyle, minHeight: '130px' }}
            onClick={(e) => {
              e.stopPropagation();
              hapticFeedback?.('impact', 'medium');
              setIsAnalyticsOpen(true);
            }}
          >
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-[#80E8FF]/15 via-[#A3F7BF]/10 to-[#C4A3FF]/15"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#80E8FF]/30 to-[#A3F7BF]/30 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-[#80E8FF]" />
                  </div>
                  <h3 className="text-base font-bold text-white">Статистика</h3>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#A3F7BF]/10 border border-[#A3F7BF]/20">
                  <TrendingUp className="w-3 h-3 text-[#A3F7BF]" />
                  <span className="text-[10px] font-medium text-[#A3F7BF]">неделя</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <div className="bg-gradient-to-br from-[#A3F7BF]/10 to-transparent rounded-xl p-2 border border-[#A3F7BF]/10">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Calendar className="w-3 h-3 text-[#A3F7BF]" />
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide">Пар</span>
                  </div>
                  <div className="text-lg font-bold text-white">{stats.totalClasses}</div>
                </div>
                <div className="bg-gradient-to-br from-[#FFE66D]/10 to-transparent rounded-xl p-2 border border-[#FFE66D]/10">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Clock className="w-3 h-3 text-[#FFE66D]" />
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide">Часов</span>
                  </div>
                  <div className="text-lg font-bold text-white">{formatHours(stats.totalHours)}</div>
                </div>
                <div className="bg-gradient-to-br from-[#FFB4D1]/10 to-transparent rounded-xl p-2 border border-[#FFB4D1]/10">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Flame className="w-3 h-3 text-[#FFB4D1]" />
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide">Макс</span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {stats.busiestDay?.day?.slice(0, 2) || '—'}
                    <span className="text-[10px] text-[#FFB4D1] ml-1">{stats.busiestDay?.classCount || 0} пар</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-[#C4A3FF]/10 to-transparent rounded-xl p-2 border border-[#C4A3FF]/10">
                  <div className="flex items-center gap-1 mb-0.5">
                    <TrendingUp className="w-3 h-3 text-[#C4A3FF]" />
                    <span className="text-[9px] text-gray-400 uppercase tracking-wide">В день</span>
                  </div>
                  <div className="text-lg font-bold text-white">{stats.averageClassesPerDay}</div>
                </div>
              </div>
              <div className="bg-[#1F1F1F]/50 rounded-xl p-2.5 border border-gray-700/30">
                <div className="flex items-end justify-between gap-1 h-8">
                  {stats.weekChart.map((dayData, index) => (
                    <div key={dayData.day} className="flex-1 flex flex-col items-center gap-0.5">
                      <motion.div 
                        className="w-full rounded-sm"
                        style={{
                          background: dayData.classes > 0 ? 'linear-gradient(180deg, #A3F7BF, #80E8FF)' : 'rgba(75, 75, 75, 0.5)',
                          minHeight: '3px'
                        }}
                        initial={{ height: 0 }}
                        animate={{ height: dayData.classes > 0 ? `${Math.max(20, (dayData.classes / maxClasses) * 100)}%` : '3px' }}
                        transition={{ duration: 0.4, delay: index * 0.04 }}
                      />
                      <span className="text-[8px] text-gray-500 font-medium">{dayData.shortDay}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 text-center">
                <span className="text-[10px] text-[#80E8FF]/80">Нажмите для подробной аналитики →</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="relative mt-4 lg:mt-0 lg:flex lg:gap-4 lg:px-0 lg:overflow-visible">
        <div className="flex-1 relative lg:overflow-visible pl-6 pr-[52px] lg:pl-0 lg:pr-0">
          
          {/* 
            STACKED CARD CONTAINER
            max-w constraints for proper sizing
            lg:mx-auto centers on desktop
          */}
          <div className="relative mt-4 lg:mt-0 max-w-[400px] md:max-w-[400px] lg:max-w-[500px] xl:max-w-[560px] md:mx-auto" style={{ paddingBottom: '22px' }}>
            
            {/* 3rd background card (deepest) — dark solid, always visible */}
            <motion.div 
              className="absolute rounded-3xl left-0 right-0 mx-auto border border-white/5"
              style={{ 
                backgroundColor: 'rgba(33, 33, 33, 0.6)',
                backdropFilter: 'blur(20px) saturate(150%)',
                WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                width: '84%',
                top: '12px',
                bottom: 0,
                zIndex: 1,
              }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            />
            
            {/* 2nd background card (middle) — dark solid, always visible */}
            <motion.div 
              className="absolute rounded-3xl left-0 right-0 mx-auto border border-white/5"
              style={{ 
                backgroundColor: 'rgba(44, 44, 44, 0.65)',
                backdropFilter: 'blur(30px) saturate(160%)',
                WebkitBackdropFilter: 'blur(30px) saturate(160%)',
                width: '92%',
                top: '6px',
                bottom: '10px',
                zIndex: 2,
              }}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.45 }}
            />

            {/* Front card — actual content, direction-aware animation */}
            <div className="relative" style={{ zIndex: 3 }}>
              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.div
                  key={currentCard.id}
                  custom={direction}
                  variants={frontCardVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    ...SPRING,
                    opacity: { duration: 0.2, ease: 'easeOut' },
                  }}
                  style={{ transformOrigin: 'top center' }}
                >
                  {renderCardContent(currentCard.type)}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── NAVIGATION: Mobile + Tablet (vertical, right side) ── */}
        <div className="absolute right-[6px] top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-2.5 lg:hidden z-[50]">
          <motion.button
            onClick={handlePrevious}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800/80 active:bg-gray-600/80 transition-colors"
            whileTap={{ scale: 0.88 }}
          >
            <ChevronUp className="w-4 h-4 text-white" />
          </motion.button>

          <div className="flex flex-col items-center gap-1.5">
            {cards.map((card, index) => (
              <motion.button
                key={card.id}
                onClick={(e) => goToCard(index, e)}
                className="rounded-full"
                animate={{
                  width: 8,
                  height: index === currentIndex ? 20 : 8,
                  backgroundColor: index === currentIndex ? '#A3F7BF' : 'rgb(75, 85, 99)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              />
            ))}
          </div>

          <motion.button
            onClick={handleNext}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800/80 active:bg-gray-600/80 transition-colors"
            whileTap={{ scale: 0.88 }}
          >
            <ChevronDown className="w-4 h-4 text-white" />
          </motion.button>
        </div>

        {/* Desktop: no navigation controls */}
      </div>

      {/* Modals */}
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
