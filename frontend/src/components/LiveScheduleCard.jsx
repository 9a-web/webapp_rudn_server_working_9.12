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

  // SVG circle параметры
  const circleRadius = 42;
  const circleCircumference = 2 * Math.PI * circleRadius;
  
  // Адаптивная толщина круга: тоньше на планшете и десктопе
  const [isTabletOrDesktop, setIsTabletOrDesktop] = useState(false);
  
  useEffect(() => {
    const checkSize = () => setIsTabletOrDesktop(window.innerWidth >= 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);
  
  const bgStrokeWidth = isTabletOrDesktop ? 12 : 14;
  const progressStrokeWidth = isTabletOrDesktop ? 13 : 15;

  // Theme Styles Configuration
  const themeStyles = {
    // 3rd card (back)
    card3: {
      bg: isWinter ? 'rgba(30, 41, 59, 0.5)' : 'rgba(33, 33, 33, 0.6)',
      border: isWinter ? 'border-sky-300/10' : 'border-white/5',
      shadow: isWinter ? '0 8px 32px 0 rgba(31, 38, 135, 0.15)' : 'none'
    },
    // 2nd card (middle)
    card2: {
      bg: isWinter ? 'rgba(30, 41, 59, 0.6)' : 'rgba(44, 44, 44, 0.65)',
      border: isWinter ? 'border-sky-300/15' : 'border-white/5',
      shadow: isWinter ? '0 8px 32px 0 rgba(31, 38, 135, 0.2)' : 'none'
    },
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
      bgGradient: isWinter
        ? 'radial-gradient(circle, rgba(125, 211, 252, 0.5) 0%, rgba(56, 189, 248, 0.4) 50%, rgba(14, 165, 233, 0.3) 100%)'
        : 'radial-gradient(circle, rgba(163, 247, 191, 0.6) 0%, rgba(255, 230, 109, 0.5) 25%, rgba(255, 180, 209, 0.5) 50%, rgba(196, 163, 255, 0.5) 75%, rgba(128, 232, 255, 0.6) 100%)',
      strokeId: isWinter ? "progressGradientWinter" : "progressGradientDefault",
      bgStroke: isWinter ? "rgba(56, 189, 248, 0.2)" : "url(#progressGradientDefault)",
      centerBg: isWinter ? 'rgba(30, 41, 59, 0.7)' : 'rgba(52, 52, 52, 0.8)',
      centerBorder: isWinter ? 'border-sky-300/20' : 'border-white/10',
      timeColor: isWinter ? '#F0F9FF' : '#FFFFFF',
      shadowActive: isWinter
        ? ['0 0 0 rgba(56, 189, 248, 0)', '0 0 20px rgba(56, 189, 248, 0.3)', '0 0 0 rgba(56, 189, 248, 0)']
        : ['0 0 0 rgba(163, 247, 191, 0)', '0 0 20px rgba(163, 247, 191, 0.3)', '0 0 0 rgba(163, 247, 191, 0)'],
      shadowInactive: isWinter
        ? ['0 0 0 rgba(14, 165, 233, 0)', '0 0 15px rgba(14, 165, 233, 0.2)', '0 0 0 rgba(14, 165, 233, 0)']
        : ['0 0 0 rgba(128, 232, 255, 0)', '0 0 15px rgba(128, 232, 255, 0.2)', '0 0 0 rgba(128, 232, 255, 0)']
    }
  };

  return (
    <div className="mt-4 md:mt-0 flex justify-start md:justify-center pl-0 pr-6 md:px-0">
      <motion.div 
        className="relative w-full max-w-[400px] md:max-w-[500px] lg:max-w-[560px] md:overflow-visible" 
        style={{ paddingBottom: '38px' }}
        initial="initial"
        animate="animate"
        variants={liveCardVariants}
      >
        {/* 3-я карточка - самая маленькая и дальняя */}
        <motion.div 
          className={`absolute rounded-3xl mx-auto left-0 right-0 border ${themeStyles.card3.border}`}
          style={{ 
            backgroundColor: themeStyles.card3.bg,
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            width: '83.4%', // 311/373
            height: '140px',
            top: '38px', // 25px от 2-й карточки (13 + 25 = 38)
            zIndex: 1,
            boxShadow: themeStyles.card3.shadow
          }}
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            delay: 0.1,
            duration: 0.6,
            ease: [0.25, 0.1, 0.25, 1]
          }}
        ></motion.div>
        {/* 2-я карточка - средняя */}
        <motion.div 
          className={`absolute rounded-3xl mx-auto left-0 right-0 border ${themeStyles.card2.border}`}
          style={{ 
            backgroundColor: themeStyles.card2.bg,
            backdropFilter: 'blur(30px) saturate(160%)',
            WebkitBackdropFilter: 'blur(30px) saturate(160%)',
            width: '93%', // 347/373
            height: '156px',
            top: '13px', // 13px от 1-й карточки
            zIndex: 2,
            boxShadow: themeStyles.card2.shadow
          }}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            delay: 0.15,
            duration: 0.5,
            ease: [0.25, 0.1, 0.25, 1]
          }}
        ></motion.div>
        
        {/* 1-я карточка - основная (самая большая) */}
        <motion.div 
          className={`relative rounded-3xl p-6 md:p-8 lg:p-10 shadow-card overflow-hidden border ${themeStyles.mainCard.border}`}
          style={{ 
            background: themeStyles.mainCard.bg,
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            width: '100%',
            zIndex: 3,
            boxShadow: themeStyles.mainCard.shadow
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
                    className="font-bold text-base md:text-lg lg:text-xl break-words" 
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
                  className="font-medium text-sm md:text-base lg:text-lg break-words" 
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

            {/* Right side - Gradient circle with time and progress bar */}
            <motion.div 
              className="relative flex items-center justify-center flex-shrink-0 w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36"
              style={{ overflow: 'visible' }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: [1, 1.02, 1],
                opacity: 1
              }}
              transition={{ 
                scale: {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                opacity: {
                  duration: 0.4,
                  delay: 0.3
                }
              }}
            >
              {/* Glowing background effect */}
              <motion.div
                className="absolute w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 rounded-full"
                style={{
                  background: themeStyles.circle.bgGradient,
                  filter: isWinter ? 'blur(20px)' : 'blur(25px)'
                }}
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              
              {/* SVG Progress Bar (всегда отображается) */}
              <svg 
                className="absolute w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36"
                style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
                viewBox="0 0 120 120"
              >
                <defs>
                  {/* Winter Gradient */}
                  <linearGradient id="progressGradientWinter" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E0F2FE" /> {/* Sky-100 */}
                    <stop offset="50%" stopColor="#38BDF8" /> {/* Sky-400 */}
                    <stop offset="100%" stopColor="#0EA5E9" /> {/* Sky-500 */}
                  </linearGradient>
                  
                  {/* Default Gradient */}
                  <linearGradient id="progressGradientDefault" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#A3F7BF" />
                    <stop offset="25%" stopColor="#FFE66D" />
                    <stop offset="50%" stopColor="#FFB4D1" />
                    <stop offset="75%" stopColor="#C4A3FF" />
                    <stop offset="100%" stopColor="#80E8FF" />
                  </linearGradient>

                  <filter id="glowFilter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                {/* Background circle */}
                <motion.circle
                  cx="60"
                  cy="60"
                  r={circleRadius}
                  stroke={themeStyles.circle.bgStroke.includes('url') ? themeStyles.circle.bgStroke : themeStyles.circle.bgStroke}
                  strokeWidth={bgStrokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  initial={{ opacity: 0.3 }}
                  animate={currentClass ? {
                    opacity: [0.3, 0.5, 0.3]
                  } : {
                    opacity: 0.3
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear",
                    times: [0, 0.5, 1]
                  }}
                />
                
                {/* Progress circle */}
                <motion.circle
                  cx="60"
                  cy="60"
                  r={circleRadius}
                  stroke={`url(#${themeStyles.circle.strokeId})`}
                  strokeWidth={progressStrokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  initial={{ 
                    strokeDasharray: circleCircumference,
                    strokeDashoffset: 0
                  }}
                  animate={{ 
                    strokeDashoffset: currentClass 
                      ? circleCircumference - (circleCircumference * progressPercentage) / 100
                      : 0
                  }}
                  transition={{ 
                    duration: 1,
                    ease: [0.25, 0.1, 0.25, 1]
                  }}
                  style={{
                    filter: currentClass 
                      ? `drop-shadow(0 0 12px ${isWinter ? 'rgba(56, 189, 248, 0.6)' : 'rgba(163, 247, 191, 0.8)'})`
                      : 'url(#glowFilter)'
                  }}
                  opacity={1}
                />
              </svg>
              
              {/* Center content with time */}
              <motion.div 
                className={`relative w-20 h-20 md:w-22 md:h-22 lg:w-24 lg:h-24 rounded-full flex items-center justify-center z-10 border ${themeStyles.circle.centerBorder}`} 
                style={{ 
                  backgroundColor: themeStyles.circle.centerBg,
                  backdropFilter: 'blur(30px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(180%)'
                }}
                animate={{ 
                  boxShadow: currentClass 
                    ? themeStyles.circle.shadowActive
                    : themeStyles.circle.shadowInactive
                }}
                transition={{ 
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.span 
                    key={formatTime(time)}
                    className="text-lg md:text-xl lg:text-2xl font-bold" 
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
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
});
