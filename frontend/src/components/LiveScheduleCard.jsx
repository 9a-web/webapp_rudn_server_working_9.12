import React, { useState, useEffect, useMemo, useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { pluralizeMinutes } from '../utils/pluralize';
import { translateDiscipline } from '../i18n/subjects';
import { Snowflake, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const LiveScheduleCard = React.memo(({ 
  currentClass, 
  minutesLeft, 
  concurrentClasses = [],
  scheduleStatus = 'no_classes',
  nextClassInfo = null,
  onSelectConcurrentClass,
  hapticFeedback 
}) => {
  const [time, setTime] = useState(new Date());
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const uniqueId = useId();
  
  const isWinter = theme === 'winter';

  // Индекс выбранной пары среди одновременных
  const selectedIndex = useMemo(() => {
    if (concurrentClasses.length <= 1) return 0;
    const idx = concurrentClasses.findIndex(c => c.discipline === currentClass);
    return idx >= 0 ? idx : 0;
  }, [concurrentClasses, currentClass]);

  const hasConcurrent = concurrentClasses.length > 1;

  // Переключение между одновременными парами
  const switchClass = useCallback((direction) => {
    if (!hasConcurrent || !onSelectConcurrentClass) return;
    const newIndex = (selectedIndex + direction + concurrentClasses.length) % concurrentClasses.length;
    const newClass = concurrentClasses[newIndex];
    if (newClass) {
      onSelectConcurrentClass(newClass.discipline);
      if (hapticFeedback) hapticFeedback('impact', 'light');
    }
  }, [hasConcurrent, selectedIndex, concurrentClasses, onSelectConcurrentClass, hapticFeedback]);

  // Update time every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Progress calculation
  const progressPercentage = useMemo(() => {
    if (!currentClass) return 0;
    if (minutesLeft <= 0) return 100;
    const totalClassDuration = 90;
    const elapsed = totalClassDuration - Math.min(minutesLeft, totalClassDuration);
    return Math.max(0, Math.min(100, (elapsed / totalClassDuration) * 100));
  }, [currentClass, minutesLeft]);

  // Unique gradient/filter IDs to avoid SVG conflicts
  const gradientWinterId = `${uniqueId}-winter`;
  const gradientDefaultId = `${uniqueId}-default`;
  const glowFilterId = `${uniqueId}-glow`;

  // Theme Styles Configuration
  const themeStyles = {
    mainCard: {
      bg: isWinter 
        ? 'linear-gradient(145deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))' 
        : 'rgba(52, 52, 52, 0.7)',
      border: isWinter ? 'border-sky-200/20' : 'border-white/10',
      shadow: isWinter 
        ? '0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 0 32px 0 rgba(56, 189, 248, 0.05)' 
        : '0 4px 20px -4px rgba(0, 0, 0, 0.5)',
      backgroundGradient: isWinter
        ? 'bg-gradient-to-br from-sky-500/10 via-transparent to-transparent'
        : 'bg-gradient-to-br from-accent/20 to-transparent'
    },
    text: {
      primary: isWinter ? '#E0F2FE' : '#FFFFFF',
      secondary: isWinter ? '#94A3B8' : '#999999',
      glowColor: isWinter ? 'rgba(186, 230, 253, 0.5)' : 'rgba(163, 247, 191, 0.5)'
    },
    circle: {
      strokeId: isWinter ? gradientWinterId : gradientDefaultId,
      timeColor: isWinter ? '#F0F9FF' : '#FFFFFF',
    }
  };

  const circumference = 2 * Math.PI * 40;

  // Направление анимации при переключении пар (вверх/вниз)
  const [slideDirection, setSlideDirection] = useState(0);

  const handlePrev = useCallback((e) => {
    e.stopPropagation();
    setSlideDirection(-1);
    switchClass(-1);
  }, [switchClass]);

  const handleNext = useCallback((e) => {
    e.stopPropagation();
    setSlideDirection(1);
    switchClass(1);
  }, [switchClass]);

  return (
    <motion.div 
      className={`relative rounded-3xl p-5 lg:p-8 xl:p-10 shadow-card overflow-hidden border ${themeStyles.mainCard.border}`}
      style={{ 
        background: themeStyles.mainCard.bg,
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        width: '100%',
        boxShadow: themeStyles.mainCard.shadow,
      }}
    >
      {/* Snowflake decoration - Winter only */}
      {isWinter && (
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
           <Snowflake className="w-16 h-16 text-sky-200" />
        </div>
      )}

      {/* Background gradient pulse */}
      <motion.div 
        className={`absolute inset-0 ${themeStyles.mainCard.backgroundGradient}`}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      
      <div className="relative flex items-center justify-between gap-4 lg:gap-6 xl:gap-8">
        {/* Left side - Text content */}
        <div className="flex-1 min-w-0">
          {/* Заголовок — зависит от статуса расписания */}
          <div className="mb-2 lg:mb-3">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentClass ? 'has-class' : scheduleStatus}
                className="font-bold text-base lg:text-lg xl:text-xl"
                style={{ color: themeStyles.text.primary }}
                initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {currentClass 
                  ? t('liveScheduleCard.currentClass')
                  : scheduleStatus === 'day_ended'
                    ? 'Учебный день подошёл к концу! 🎉'
                    : scheduleStatus === 'before_first'
                      ? 'Учебный день ещё не начался!'
                      : scheduleStatus === 'break' && nextClassInfo
                        ? `Сейчас перерыв! Следующая пара: ${translateDiscipline(nextClassInfo.name, i18n.language)}`
                        : t('liveScheduleCard.noClass')
                }
              </motion.p>
            </AnimatePresence>

            {/* === Название предмета + стрелки переключения === */}
            {currentClass && (
              <div className="flex items-start gap-1.5 mt-1">
                {/* Стрелки переключения одновременных пар */}
                {hasConcurrent && (
                  <div className="flex flex-col items-center flex-shrink-0 mt-0.5 -ml-0.5">
                    <motion.button
                      onClick={handlePrev}
                      className="flex items-center justify-center w-6 h-6 rounded-full transition-colors"
                      style={{ 
                        backgroundColor: 'rgba(255,255,255,0.12)',
                      }}
                      whileTap={{ scale: 0.85 }}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
                      aria-label="Previous class"
                    >
                      <ChevronUp className="w-3.5 h-3.5 text-white" />
                    </motion.button>

                    {/* Индикатор позиции */}
                    <span 
                      className="text-[9px] font-semibold leading-none my-0.5 select-none"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      {selectedIndex + 1}/{concurrentClasses.length}
                    </span>

                    <motion.button
                      onClick={handleNext}
                      className="flex items-center justify-center w-6 h-6 rounded-full transition-colors"
                      style={{ 
                        backgroundColor: 'rgba(255,255,255,0.12)',
                      }}
                      whileTap={{ scale: 0.85 }}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.22)' }}
                      aria-label="Next class"
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-white" />
                    </motion.button>
                  </div>
                )}

                {/* Название предмета с анимацией смены — анимируется только текст дисциплины */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <AnimatePresence mode="wait" custom={slideDirection}>
                    <motion.p
                      key={currentClass}
                      custom={slideDirection}
                      initial={{ 
                        opacity: 0, 
                        y: slideDirection >= 0 ? 12 : -12,
                        filter: 'blur(2px)' 
                      }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        filter: 'blur(0px)' 
                      }}
                      exit={{ 
                        opacity: 0, 
                        y: slideDirection >= 0 ? -12 : 12,
                        filter: 'blur(2px)' 
                      }}
                      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                      className="font-bold text-sm lg:text-base xl:text-lg break-words" 
                      style={{ color: '#FFFFFF' }}
                    >
                      {translateDiscipline(currentClass, i18n.language)}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
          <AnimatePresence mode="wait">
            <motion.p 
              key={currentClass ? minutesLeft : scheduleStatus}
              className="font-medium text-xs lg:text-sm xl:text-base" 
              style={{ color: themeStyles.text.secondary }}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {currentClass ? (
                i18n.language === 'ru' 
                  ? `Осталось: ${minutesLeft} ${pluralizeMinutes(minutesLeft)}`
                  : `Time left: ${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'}`
              ) : scheduleStatus === 'before_first' && nextClassInfo
                ? `Готовься к ${translateDiscipline(nextClassInfo.name, i18n.language)}`
                : scheduleStatus === 'break' && nextClassInfo
                  ? `Начнётся через ${nextClassInfo.minutesUntil} ${pluralizeMinutes(nextClassInfo.minutesUntil)}`
                  : scheduleStatus === 'day_ended'
                    ? ''
                    : t('liveScheduleCard.relax')
              }
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Right side - Progress ring */}
        <motion.div 
          className="relative flex items-center justify-center flex-shrink-0 w-28 h-28 lg:w-36 lg:h-36 xl:w-40 xl:h-40"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
        >
          {/* Glow behind ring */}
          <motion.div
            className="absolute w-24 h-24 lg:w-32 lg:h-32 xl:w-36 xl:h-36 rounded-full"
            style={{
              background: isWinter
                ? 'radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(163, 247, 191, 0.3) 0%, rgba(255, 230, 109, 0.15) 40%, transparent 70%)',
              filter: 'blur(10px)',
            }}
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* SVG Ring */}
          <motion.svg 
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            style={{ rotate: -90 }}
          >
            <defs>
              <linearGradient id={gradientWinterId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E0F2FE" />
                <stop offset="50%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0EA5E9" />
              </linearGradient>
              <linearGradient id={gradientDefaultId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A3F7BF" />
                <stop offset="25%" stopColor="#FFE66D" />
                <stop offset="50%" stopColor="#FFB4D1" />
                <stop offset="75%" stopColor="#C4A3FF" />
                <stop offset="100%" stopColor="#80E8FF" />
              </linearGradient>
              <filter id={glowFilterId}>
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Background circle */}
            <circle
              cx="50" cy="50" r="40"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="6"
              fill="none"
            />
            
            {/* Progress circle */}
            <motion.circle
              cx="50" cy="50" r="40"
              stroke={`url(#${themeStyles.circle.strokeId})`}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              filter={`url(#${glowFilterId})`}
              strokeDasharray={circumference}
              animate={{ 
                strokeDashoffset: currentClass 
                  ? circumference * (1 - progressPercentage / 100) 
                  : 0
              }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          </motion.svg>
          
          {/* Time in center */}
          <AnimatePresence mode="wait">
            <motion.span 
              key={formatTime(time)}
              className="relative z-10 text-lg lg:text-2xl xl:text-3xl font-bold" 
              style={{ color: themeStyles.circle.timeColor }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
            >
              {formatTime(time)}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
});
