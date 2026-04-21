import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * TaskCompletionBanner — баннер, всплывающий сверху при выполнении задачи.
 * Показывает название задачи, начисленный XP и анимированный прогресс-бар.
 */

const TIER_CONFIG = {
  base:    { color: '#4D85FF', gradient: 'linear-gradient(135deg, #4D85FF, #6EA0FF)' },
  medium:  { color: '#FFA04D', gradient: 'linear-gradient(135deg, #FFA04D, #FFB976)' },
  rare:    { color: '#B84DFF', gradient: 'linear-gradient(135deg, #B84DFF, #D47FFF)' },
  premium: { color: '#FF4EEA', gradient: 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)' },
};

export default function TaskCompletionBanner({ isVisible, onClose, data }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [showXpPop, setShowXpPop] = useState(false);
  const [countedXp, setCountedXp] = useState(0);
  const timerRef = useRef(null);
  const autoCloseRef = useRef(null);

  const {
    taskText = '',
    xpAwarded = 0,
    xpInfo = null,
  } = data || {};

  const tier = xpInfo?.tier || 'base';
  const level = xpInfo?.level || 1;
  const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.base;

  // Рассчитываем старый и новый прогресс
  const newProgress = xpInfo?.progress || 0;
  const xpCurrent = xpInfo?.xp_current_level || 0;
  const xpNext = xpInfo?.xp_next_level || 100;
  const totalXp = xpInfo?.xp || 0;
  const xpNeeded = xpNext - xpCurrent;
  const xpInLevel = totalXp - xpCurrent;

  // Прогресс ДО начисления (приблизительный)
  const oldProgress = useMemo(() => {
    if (!xpInfo || xpNeeded <= 0) return 0;
    const oldXpInLevel = Math.max(0, xpInLevel - xpAwarded);
    return Math.min(Math.max(oldXpInLevel / xpNeeded, 0), 1);
  }, [xpInfo, xpAwarded, xpInLevel, xpNeeded]);

  useEffect(() => {
    if (isVisible && xpInfo) {
      // Устанавливаем начальный прогресс (старый)
      setAnimatedProgress(oldProgress);
      setShowXpPop(false);
      setCountedXp(0);

      // Через небольшую задержку анимируем до нового
      const t1 = setTimeout(() => {
        setAnimatedProgress(newProgress);
        setShowXpPop(true);
      }, 400);

      // Анимация счётчика XP
      const t2 = setTimeout(() => {
        animateCounter(0, xpAwarded, 600);
      }, 500);

      // Автозакрытие через 4 секунды
      autoCloseRef.current = setTimeout(() => {
        onClose?.();
      }, 4000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
      };
    }
  }, [isVisible, xpInfo, xpAwarded]);

  // Сброс при закрытии
  useEffect(() => {
    if (!isVisible) {
      setAnimatedProgress(0);
      setShowXpPop(false);
      setCountedXp(0);
    }
  }, [isVisible]);

  const animateCounter = (from, to, duration) => {
    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      setCountedXp(current);
      if (progress < 1) {
        timerRef.current = requestAnimationFrame(step);
      }
    };
    timerRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, []);

  const leveledUp = xpInfo?.leveled_up;

  return (
    <AnimatePresence>
      {isVisible && data && (
        <motion.div
          initial={{ y: -120, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -120, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={() => onClose?.()}
          style={{
            position: 'fixed',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            width: 'calc(100% - 24px)',
            maxWidth: '420px',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(20,20,40,0.97), rgba(30,25,55,0.97))',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '20px',
              padding: '14px 16px 12px',
              border: `1px solid ${tierCfg.color}30`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${tierCfg.color}15`,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Верхняя цветная полоска */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: tierCfg.gradient,
              }}
            />

            {/* Основная строка: задача + XP */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
              {/* Левая часть: иконка + текст задачи */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 300, delay: 0.1 }}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: `${tierCfg.color}18`,
                    border: `1px solid ${tierCfg.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '16px',
                  }}
                >
                  ✅
                </motion.div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 600,
                      fontSize: '13px',
                      color: '#F4F3FC',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '200px',
                    }}
                  >
                    {taskText || 'Задача выполнена'}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 400,
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.4)',
                      marginTop: '1px',
                    }}
                  >
                    LV. {level}
                  </div>
                </div>
              </div>

              {/* Правая часть: XP badge */}
              <AnimatePresence>
                {showXpPop && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: `${tierCfg.color}20`,
                      border: `1px solid ${tierCfg.color}40`,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 700,
                        fontSize: '15px',
                        color: tierCfg.color,
                      }}
                    >
                      +{countedXp}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 500,
                        fontSize: '11px',
                        color: `${tierCfg.color}AA`,
                        marginLeft: '2px',
                      }}
                    >
                      XP
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* XP прогресс-бар */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  {xpInLevel} / {xpNeeded}
                </span>
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  {Math.round(newProgress * 100)}%
                </span>
              </div>

              {/* Прогресс-бар */}
              <div
                style={{
                  height: '8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Фоновая полоска (старый прогресс) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${Math.max(oldProgress * 100, 0.5)}%`,
                    borderRadius: '4px',
                    background: `${tierCfg.color}30`,
                  }}
                />
                {/* Анимированная полоска (новый прогресс) */}
                <motion.div
                  initial={{ width: `${Math.max(oldProgress * 100, 0.5)}%` }}
                  animate={{ width: `${Math.max(animatedProgress * 100, 0.5)}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    borderRadius: '4px',
                    background: tierCfg.gradient,
                    boxShadow: `0 0 10px ${tierCfg.color}50`,
                  }}
                />
                {/* Блик на конце полоски */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.2, delay: 0.5 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: `${100 - Math.max(animatedProgress * 100, 0.5)}%`,
                    width: '20px',
                    height: '100%',
                    background: `linear-gradient(90deg, transparent, ${tierCfg.color}80, transparent)`,
                    borderRadius: '4px',
                    filter: 'blur(2px)',
                  }}
                />
              </div>
            </div>

            {/* Level UP badge */}
            {leveledUp && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                style={{
                  marginTop: '8px',
                  textAlign: 'center',
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 700,
                  fontSize: '12px',
                  color: tierCfg.color,
                  padding: '4px 0',
                  background: `${tierCfg.color}10`,
                  borderRadius: '8px',
                  border: `1px solid ${tierCfg.color}20`,
                }}
              >
                🎉 Новый уровень! LV. {xpInfo?.new_level || level}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
