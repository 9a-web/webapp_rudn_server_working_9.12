import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { liveCardVariants, fadeInScale } from '../utils/animations';
import { pluralizeMinutes } from '../utils/pluralize';
import { translateDiscipline } from '../i18n/subjects';
import { Snowflake } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const LiveScheduleCard = React.memo(({ currentClass, minutesLeft }) => {
  const [time, setTime] = useState(new Date());
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  
  const isWinter = theme === 'winter';

  // Оптимизация: обновляем только каждые 10 секунд вместо каждой секунды
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 10000); // Обновление каждые 10 секунд

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Расчет прогресса для progress bar (предполагаем, что пара длится 90 минут)
  const progressPercentage = useMemo(() => {
    if (!currentClass || !minutesLeft) return 0;
    const totalClassDuration = 90; // минут
    const elapsed = totalClassDuration - minutesLeft;
    return Math.max(0, Math.min(100, (elapsed / totalClassDuration) * 100));
  }, [currentClass, minutesLeft]);

  // Theme Styles Configuration
  const themeStyles = {
    // Main card
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
    // Typography
    text: {
      primary: isWinter ? '#E0F2FE' : '#FFFFFF', // Sky-100 vs White
      secondary: isWinter ? '#94A3B8' : '#999999', // Slate-400 vs Gray
      glowColor: isWinter ? 'rgba(186, 230, 253, 0.5)' : 'rgba(163, 247, 191, 0.5)'
    },
    // Progress Circle
    circle: {
      strokeId: isWinter ? "progressGradientWinter" : "progressGradientDefault",
      timeColor: isWinter ? '#F0F9FF' : '#FFFFFF',
    }
  };

  return (
    <motion.div 
      className={`relative rounded-3xl p-6 md:p-8 lg:p-10 shadow-card overflow-hidden border ${themeStyles.mainCard.border}`}
      style={{ 
        background: themeStyles.mainCard.bg,
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        width: '100%',
        boxShadow: themeStyles.mainCard.shadow,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        delay: 0.2,
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1]
      }}
    >
      {/* Frosty patterns decoration (top right) - Only for Winter */}
      {isWinter && (
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
           <Snowflake className="w-16 h-16 text-sky-200" />
        </div>
      )}

      {/* Subtle background gradient с пульсацией */}
      <motion.div 
        className={`absolute inset-0 ${themeStyles.mainCard.backgroundGradient}`}
        animate={{ 
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      ></motion.div>
      
      <div className="relative flex items-center justify-between gap-4 md:gap-6 lg:gap-8">
        {/* Left side - Text content с улучшенными анимациями */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentClass || 'no-class'}
              className="mb-2 md:mb-3"
              initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <motion.p 
                className="font-bold text-base md:text-lg lg:text-xl" 
                style={{ color: themeStyles.text.primary }} 
                animate={currentClass ? {
                  textShadow: [
                    `0 0 0px rgba(0,0,0,0)`,
                    `0 0 10px ${themeStyles.text.glowColor}`,
                    `0 0 0px rgba(0,0,0,0)`
                  ]
                } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {currentClass ? t('liveScheduleCard.currentClass') : t('liveScheduleCard.noClass')}
              </motion.p>
              {currentClass && (
                <motion.p 
                  className="font-bold text-base md:text-lg lg:text-xl break-words" 
                  style={{ color: '#FFFFFF' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {translateDiscipline(currentClass, i18n.language)}
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p 
              key={minutesLeft}
              className="font-medium text-sm md:text-base lg:text-lg" 
              style={{ color: themeStyles.text.secondary }}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {currentClass ? (
                i18n.language === 'ru' 
                  ? `Осталось: ${minutesLeft} ${pluralizeMinutes(minutesLeft)}`
                  : `Time left: ${minutesLeft} ${minutesLeft === 1 ? 'minute' : 'minutes'}`
              ) : t('liveScheduleCard.relax')}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Right side - Progress ring (стиль WeekDateSelector) */}
        <motion.div 
          className="relative flex items-center justify-center flex-shrink-0 w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
        >
          {/* Свечение за кольцом */}
          <motion.div
            className="absolute w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full"
            style={{
              background: isWinter
                ? 'radial-gradient(circle, rgba(56, 189, 248, 0.35) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(163, 247, 191, 0.3) 0%, rgba(255, 230, 109, 0.15) 40%, transparent 70%)',
              filter: 'blur(10px)',
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [0.95, 1.05, 0.95],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* SVG Ring — чистое кольцо как в WeekDateSelector */}
          <motion.svg 
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            style={{ rotate: -90 }}
            animate={{
              scale: [1, 1.03, 1],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <defs>
              <linearGradient id="progressGradientWinter" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E0F2FE" />
                <stop offset="50%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0EA5E9" />
              </linearGradient>
              <linearGradient id="progressGradientDefault" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A3F7BF" />
                <stop offset="25%" stopColor="#FFE66D" />
                <stop offset="50%" stopColor="#FFB4D1" />
                <stop offset="75%" stopColor="#C4A3FF" />
                <stop offset="100%" stopColor="#80E8FF" />
              </linearGradient>
              <filter id="glowFilter">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Фоновый круг */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="6"
              fill="none"
            />
            
            {/* Прогресс круг — с градиентом и свечением */}
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              stroke={`url(#${themeStyles.circle.strokeId})`}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              filter="url(#glowFilter)"
              strokeDasharray={2 * Math.PI * 40}
              initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
              animate={{ 
                strokeDashoffset: currentClass 
                  ? 2 * Math.PI * 40 * (1 - progressPercentage / 100)
                  : 0
              }}
              transition={{ 
                duration: 0.8, 
                ease: 'easeInOut' 
              }}
            />
          </motion.svg>
          
          {/* Время по центру */}
          <AnimatePresence mode="wait">
            <motion.span 
              key={formatTime(time)}
              className="relative z-10 text-lg md:text-xl lg:text-2xl font-bold" 
              style={{ color: themeStyles.circle.timeColor }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              {formatTime(time)}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
});
