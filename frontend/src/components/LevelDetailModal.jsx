import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Таблица порогов (должна совпадать с бэкендом level_system.py)
 */
const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700,
  1000, 1400, 1900, 2500,
  3200, 4000, 5000, 6200,
  7600, 9200, 11000, 13000,
  15500, 18500, 22000,
];

const TIER_CONFIG = {
  base:    { name: 'Base',    color: '#4D85FF', gradient: 'linear-gradient(135deg, #4D85FF, #6EA0FF)', emoji: '🔵' },
  medium:  { name: 'Medium',  color: '#FFA04D', gradient: 'linear-gradient(135deg, #FFA04D, #FFB976)', emoji: '🟠' },
  rare:    { name: 'Rare',    color: '#B84DFF', gradient: 'linear-gradient(135deg, #B84DFF, #D47FFF)', emoji: '🟣' },
  premium: { name: 'Premium', color: '#FF4EEA', gradient: 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)', emoji: '✨' },
};

const TIER_RANGES = [
  { min: 1,  max: 4,  tier: 'base' },
  { min: 5,  max: 9,  tier: 'medium' },
  { min: 10, max: 19, tier: 'rare' },
  { min: 20, max: 50, tier: 'premium' },
];

/**
 * Модалка детальной информации об уровне.
 * Открывается при нажатии на бейдж LV. в профиле.
 */
export default function LevelDetailModal({ isOpen, onClose, levelData, hapticFeedback }) {
  const overlayRef = useRef(null);
  const [animateProgress, setAnimateProgress] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Запускаем анимацию прогресс-бара с задержкой
      setAnimateProgress(false);
      const timer = setTimeout(() => setAnimateProgress(true), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, levelData?.xp]);

  if (!levelData) return null;

  const {
    level = 1,
    tier = 'base',
    xp = 0,
    xp_current_level = 0,
    xp_next_level = 100,
    progress = 0,
  } = levelData;

  const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.base;
  const xpInLevel = xp - xp_current_level;
  const xpNeeded = xp_next_level - xp_current_level;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'linear-gradient(180deg, #1A1A2E 0%, #16213E 100%)',
              borderRadius: '24px 24px 0 0',
              padding: '24px 20px 40px',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ручка закрытия */}
            <div
              style={{
                width: '40px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                margin: '0 auto 20px',
              }}
            />

            {/* Заголовок: уровень + тир */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 20px',
                  borderRadius: '20px',
                  background: tier === 'premium' ? tierCfg.gradient : `${tierCfg.color}22`,
                  border: `1px solid ${tierCfg.color}44`,
                }}
              >
                <span style={{ fontSize: '20px' }}>{tierCfg.emoji}</span>
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 700,
                    fontSize: '18px',
                    ...(tier === 'premium' ? {
                      color: '#1c1c1c',
                    } : {
                      color: tierCfg.color,
                    }),
                  }}
                >
                  {tierCfg.name}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 800,
                  fontSize: '48px',
                  lineHeight: 1.1,
                  color: '#FFFFFF',
                  marginTop: '12px',
                }}
              >
                LV. {level}
              </div>
              <div
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 400,
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.5)',
                  marginTop: '4px',
                }}
              >
                {xp.toLocaleString()} XP
              </div>
            </div>

            {/* Прогресс-бар */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  LV. {level}
                </span>
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '13px',
                    color: tierCfg.color,
                  }}
                >
                  {xpInLevel} / {xpNeeded} XP
                </span>
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  LV. {level + 1}
                </span>
              </div>

              {/* Полоска прогресса */}
              <div
                style={{
                  height: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: animateProgress ? `${Math.max(progress * 100, 1)}%` : '0%' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    height: '100%',
                    borderRadius: '6px',
                    background: tier === 'premium'
                      ? 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)'
                      : tierCfg.gradient,
                    boxShadow: `0 0 12px ${tierCfg.color}66`,
                  }}
                />
              </div>
            </div>

            {/* Карта тиров */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              {TIER_RANGES.map((range) => {
                const tc = TIER_CONFIG[range.tier];
                const isActive = tier === range.tier;
                return (
                  <div
                    key={range.tier}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      backgroundColor: isActive ? `${tc.color}22` : 'rgba(255,255,255,0.04)',
                      border: isActive ? `1px solid ${tc.color}66` : '1px solid rgba(255,255,255,0.06)',
                      opacity: isActive ? 1 : 0.5,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div style={{ fontSize: '16px', marginBottom: '4px' }}>{tc.emoji}</div>
                    <div
                      style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 600,
                        fontSize: '11px',
                        color: isActive ? tc.color : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {tc.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 400,
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.35)',
                        marginTop: '2px',
                      }}
                    >
                      LV. {range.min}–{range.max}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
