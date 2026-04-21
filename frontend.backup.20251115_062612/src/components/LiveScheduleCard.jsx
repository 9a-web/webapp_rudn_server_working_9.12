import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { liveCardVariants, fadeInScale } from '../utils/animations';
import { pluralizeMinutes } from '../utils/pluralize';
import { translateDiscipline } from '../i18n/subjects';

export const LiveScheduleCard = React.memo(({ currentClass, minutesLeft }) => {
  const [time, setTime] = useState(new Date());
  const { t, i18n } = useTranslation();

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

  return (
    <div className="mt-4 md:mt-0 flex justify-start md:justify-center pl-0 pr-6 md:px-0">
      <motion.div 
        className="relative w-full max-w-[400px] md:max-w-[500px] lg:max-w-[560px] md:overflow-visible" 
        style={{ paddingBottom: '38px' }}
        initial="initial"
        animate="animate"
        variants={liveCardVariants}
      >
        {/* 3-я карточка - самая маленькая и дальняя с параллакс эффектом */}
        <motion.div 
          className="absolute rounded-3xl mx-auto left-0 right-0 border border-white/5"
          style={{ 
            backgroundColor: 'rgba(33, 33, 33, 0.6)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)',
            width: '83.4%', // 311/373
            height: '140px',
            top: '38px', // 25px от 2-й карточки (13 + 25 = 38)
            zIndex: 1
          }}
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            delay: 0.1,
            duration: 0.6,
            ease: [0.25, 0.1, 0.25, 1]
          }}
        ></motion.div>
        {/* 2-я карточка - средняя с параллакс эффектом */}
        <motion.div 
          className="absolute rounded-3xl mx-auto left-0 right-0 border border-white/5"
          style={{ 
            backgroundColor: 'rgba(44, 44, 44, 0.65)',
            backdropFilter: 'blur(30px) saturate(160%)',
            WebkitBackdropFilter: 'blur(30px) saturate(160%)',
            width: '93%', // 347/373
            height: '156px',
            top: '13px', // 13px от 1-й карточки
            zIndex: 2
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
          className="relative rounded-3xl p-6 md:p-8 lg:p-10 shadow-card overflow-hidden border border-white/10"
          style={{ 
            backgroundColor: 'rgba(52, 52, 52, 0.7)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            width: '100%',
            zIndex: 3
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            delay: 0.2,
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1]
          }}
        >
          {/* Subtle background gradient с пульсацией */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent"
            animate={{ 
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{
              duration: 3,
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
                    style={{ color: '#FFFFFF' }}
                    animate={currentClass ? {
                      textShadow: [
                        '0 0 0px rgba(163, 247, 191, 0)',
                        '0 0 10px rgba(163, 247, 191, 0.5)',
                        '0 0 0px rgba(163, 247, 191, 0)'
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
                  style={{ color: '#999999' }}
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
                  background: 'radial-gradient(circle, rgba(163, 247, 191, 0.6) 0%, rgba(255, 230, 109, 0.5) 25%, rgba(255, 180, 209, 0.5) 50%, rgba(196, 163, 255, 0.5) 75%, rgba(128, 232, 255, 0.6) 100%)',
                  filter: 'blur(25px)'
                }}
                animate={{ 
                  scale: [1, 1.15, 1],
                  opacity: [0.6, 0.9, 0.6]
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
                {/* Gradient definitions */}
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
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
                
                {/* Background circle - темное фоновое кольцо с плавной анимацией */}
                <motion.circle
                  cx="60"
                  cy="60"
                  r={circleRadius}
                  stroke="url(#progressGradient)"
                  strokeWidth="14"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ opacity: 0.3 }}
                  animate={currentClass ? {
                    opacity: [0.3, 0.4, 0.5, 0.4, 0.3]
                  } : {
                    opacity: 0.3
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatType: "loop"
                  }}
                />
                
                {/* Progress circle - яркое кольцо, заполняется во время пары */}
                <motion.circle
                  cx="60"
                  cy="60"
                  r={circleRadius}
                  stroke="url(#progressGradient)"
                  strokeWidth="15"
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
                      ? 'drop-shadow(0 0 12px rgba(163, 247, 191, 0.8)) drop-shadow(0 0 20px rgba(163, 247, 191, 0.5))' 
                      : 'url(#glowFilter)'
                  }}
                  opacity={1}
                />
              </svg>
              
              {/* Center content with time */}
              <motion.div 
                className="relative w-20 h-20 md:w-22 md:h-22 lg:w-24 lg:h-24 rounded-full flex items-center justify-center z-10 border border-white/10" 
                style={{ 
                  backgroundColor: 'rgba(52, 52, 52, 0.8)',
                  backdropFilter: 'blur(30px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(180%)'
                }}
                animate={{ 
                  boxShadow: currentClass 
                    ? [
                        '0 0 0 rgba(163, 247, 191, 0)',
                        '0 0 20px rgba(163, 247, 191, 0.3)',
                        '0 0 0 rgba(163, 247, 191, 0)'
                      ]
                    : [
                        '0 0 0 rgba(128, 232, 255, 0)',
                        '0 0 15px rgba(128, 232, 255, 0.2)',
                        '0 0 0 rgba(128, 232, 255, 0)'
                      ]
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
                    style={{ color: '#FFFFFF' }}
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
