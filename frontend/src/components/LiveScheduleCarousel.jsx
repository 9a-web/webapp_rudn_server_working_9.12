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
// These define how each "layer" in the stack looks
const STACK = [
  { y: 0,  scale: 1,    opacity: 1,    zIndex: 30 }, // pos 0 — front
  { y: 10, scale: 0.96, opacity: 0.60, zIndex: 20 }, // pos 1 — middle
  { y: 20, scale: 0.92, opacity: 0.30, zIndex: 10 }, // pos 2 — back
];

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
  const [direction, setDirection] = useState(1); // 1=forward, -1=backward

  // Schedule stats
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

  // ─── Navigation ────────────────────────────
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

  // ─── 3 visible cards in stack order ────────
  const stackCards = useMemo(() => {
    return [0, 1, 2].map(offset => {
      const idx = (currentIndex + offset) % cards.length;
      return { ...cards[idx], stackPos: offset };
    });
  }, [currentIndex, cards]);

  const maxClasses = stats ? Math.max(...stats.weekChart.map(d => d.classes), 1) : 1;

  // ─── Shared styles ─────────────────────────
  const sharedCardStyle = {
    backgroundColor: 'rgba(52, 52, 52, 0.7)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    width: '100%',
  };

  // ─── Card content renderer ─────────────────
  const renderCardContent = useCallback((type, isActive) => {
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
  }, [currentClass, minutesLeft, hapticFeedback, user, userStats, allAchievements, userAchievements, stats, maxClasses, setIsAchievementsOpen, setIsAnalyticsOpen, sharedCardStyle]);

  // ─── Exit/enter variants (direction-aware) ─
  const cardVariants = {
    enter: (dir) => ({
      y: dir >= 0 ? STACK[2].y + 10 : -70,
      scale: dir >= 0 ? STACK[2].scale - 0.04 : 0.96,
      opacity: 0,
      zIndex: dir >= 0 ? 5 : 40,
    }),
    exit: (dir) => ({
      y: dir >= 0 ? -70 : STACK[2].y + 10,
      scale: dir >= 0 ? 0.96 : STACK[2].scale - 0.04,
      opacity: 0,
      zIndex: dir >= 0 ? 40 : 5,
    }),
  };

  return (
    <>
      <div className="relative mt-4 md:mt-0 md:flex md:gap-4 md:px-0 md:overflow-visible">
        {/* Card stack area */}
        <div className="flex-1 relative md:overflow-visible pl-6 pr-[52px] md:pl-0 md:pr-0">
          <div className="relative mt-4 md:mt-0" style={{ paddingBottom: '22px' }}>
            
            {/* 
              ═══════════════════════════════════════════
              CARD STACK — 3 visible cards at once
              
              The front card (stackPos 0) is position:relative 
              → it sets the container height.
              
              Cards at stackPos 1 & 2 are position:absolute
              → they float behind, slightly offset & scaled.
              
              AnimatePresence + popLayout handles exit:
              the old front card is removed from flow and 
              plays its exit animation on top.
              ═══════════════════════════════════════════
            */}
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              {stackCards.map(({ id, type, stackPos }) => {
                const pos = STACK[stackPos];
                const isActive = stackPos === 0;

                return (
                  <motion.div
                    key={id}
                    custom={direction}
                    variants={cardVariants}
                    initial="enter"
                    animate={{
                      y: pos.y,
                      scale: pos.scale,
                      opacity: pos.opacity,
                      zIndex: pos.zIndex,
                    }}
                    exit="exit"
                    transition={{
                      ...SPRING,
                      opacity: { duration: 0.2, ease: 'easeOut' },
                    }}
                    className="origin-top"
                    style={{
                      position: isActive ? 'relative' : 'absolute',
                      top: isActive ? undefined : 0,
                      left: isActive ? undefined : 0,
                      right: isActive ? undefined : 0,
                      pointerEvents: isActive ? 'auto' : 'none',
                      transformOrigin: 'top center',
                    }}
                  >
                    {/* Render actual card content for all visible cards */}
                    {renderCardContent(type, isActive)}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* ── NAVIGATION (mobile only) ── */}
        <div className="absolute right-[6px] top-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-2.5 md:hidden z-[50]">
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
