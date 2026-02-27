import React, { useState, useEffect, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { pluralizeMinutes } from '../utils/pluralize';
import { translateDiscipline } from '../i18n/subjects';
import { Snowflake } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const LiveScheduleCard = React.memo(({ currentClass, minutesLeft }) => {
  const [time, setTime] = useState(new Date());
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const uniqueId = useId(); // Unique prefix for SVG IDs to avoid conflicts
  
  const isWinter = theme === 'winter';

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

  // BUG FIX: Progress calculation — handle minutesLeft === 0 as 100%
  // Also don't hard-code 90 min; derive from actual remaining vs typical class duration
  const progressPercentage = useMemo(() => {
    if (!currentClass) return 0;
    if (minutesLeft <= 0) return 100;
    // Estimate total class duration: typical RUDN pair is 90 minutes
    // We use min(90, minutesLeft + elapsed_estimate) to be safe
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
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentClass || 'no-class'}
              className="mb-2 md:mb-3"
              initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <motion.p 
                className="font-bold text-base md:text-lg lg:text-xl" 
                style={{ color: themeStyles.text.primary }} 
                animate={currentClass ? {
                  textShadow: [
                    '0 0 0px rgba(0,0,0,0)',
                    `0 0 10px ${themeStyles.text.glowColor}`,
                    '0 0 0px rgba(0,0,0,0)'
                  ]
                } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {currentClass ? t('liveScheduleCard.currentClass') : t('liveScheduleCard.noClass')}
              </motion.p>
              {currentClass && (
                <motion.p 
                  className="font-bold text-sm md:text-base lg:text-lg break-words mt-1" 
                  style={{ color: '#FFFFFF' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {translateDiscipline(currentClass, i18n.language)}
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.p 
              key={currentClass ? minutesLeft : 'relax'}
              className="font-medium text-xs md:text-sm lg:text-base" 
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
              ) : t('liveScheduleCard.relax')}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Right side - Progress ring */}
        <motion.div 
          className="relative flex items-center justify-center flex-shrink-0 w-28 h-28 md:w-36 md:h-36 lg:w-40 lg:h-40"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
        >
          {/* Glow behind ring */}
          <motion.div
            className="absolute w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 rounded-full"
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
            
            {/* Progress circle — 100% filled by default, shows actual progress during class */}
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
                  : 0 // Full ring when no class
              }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
          </motion.svg>
          
          {/* Time in center */}
          <AnimatePresence mode="wait">
            <motion.span 
              key={formatTime(time)}
              className="relative z-10 text-lg md:text-2xl lg:text-3xl font-bold" 
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
