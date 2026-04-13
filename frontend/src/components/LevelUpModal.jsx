import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const TIER_CONFIG = {
  base:    { name: 'Base',    color: '#4D85FF', gradient: 'linear-gradient(135deg, #4D85FF, #6EA0FF)', emoji: '🔵' },
  medium:  { name: 'Medium',  color: '#FFA04D', gradient: 'linear-gradient(135deg, #FFA04D, #FFB976)', emoji: '🟠' },
  rare:    { name: 'Rare',    color: '#B84DFF', gradient: 'linear-gradient(135deg, #B84DFF, #D47FFF)', emoji: '🟣' },
  premium: { name: 'Premium', color: '#FF4EEA', gradient: 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)', emoji: '✨' },
};

/**
 * Модалка Level-Up с конфетти
 */
export default function LevelUpModal({ isOpen, onClose, newLevel, newTier, oldTier }) {
  const overlayRef = useRef(null);
  const hasTriggeredConfetti = useRef(false);

  useEffect(() => {
    if (isOpen && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      // Первый залп
      fireConfetti();
      // Второй залп с задержкой
      const timer = setTimeout(() => fireConfetti(), 400);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      hasTriggeredConfetti.current = false;
    }
  }, [isOpen]);

  const fireConfetti = () => {
    const tierCfg = TIER_CONFIG[newTier] || TIER_CONFIG.base;
    const colors = newTier === 'premium'
      ? ['#FF4EEA', '#FFCE2E', '#FF8717', '#FFD700']
      : [tierCfg.color, '#FFFFFF', '#FFD700'];

    // Левый залп
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.2, y: 0.6 },
      colors,
      disableForReducedMotion: true,
    });
    // Правый залп
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.8, y: 0.6 },
      colors,
      disableForReducedMotion: true,
    });
  };

  if (!isOpen) return null;

  const tierCfg = TIER_CONFIG[newTier] || TIER_CONFIG.base;
  const tierChanged = oldTier && oldTier !== newTier;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 250 }}
            style={{
              width: 'calc(100% - 40px)',
              maxWidth: '340px',
              background: 'linear-gradient(180deg, #1A1A2E 0%, #16213E 100%)',
              borderRadius: '24px',
              padding: '32px 24px',
              textAlign: 'center',
              border: `1px solid ${tierCfg.color}44`,
              boxShadow: `0 0 40px ${tierCfg.color}33`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Иконка */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', damping: 12, stiffness: 200 }}
              style={{ fontSize: '64px', marginBottom: '16px' }}
            >
              🎉
            </motion.div>

            {/* Заголовок */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 800,
                fontSize: '28px',
                color: '#FFFFFF',
                marginBottom: '8px',
              }}
            >
              Level Up!
            </motion.div>

            {/* Номер уровня */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', damping: 15 }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 800,
                fontSize: '56px',
                lineHeight: 1,
                background: newTier === 'premium'
                  ? 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)'
                  : tierCfg.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '12px',
              }}
            >
              LV. {newLevel}
            </motion.div>

            {/* Новый тир (если изменился) */}
            {tierChanged && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '16px',
                  background: `${tierCfg.color}22`,
                  border: `1px solid ${tierCfg.color}44`,
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '16px' }}>{tierCfg.emoji}</span>
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 700,
                    fontSize: '15px',
                    color: tierCfg.color,
                  }}
                >
                  Новый статус: {tierCfg.name}
                </span>
              </motion.div>
            )}

            {/* Кнопка закрытия */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              onClick={onClose}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                color: newTier === 'premium' ? '#1c1c1c' : '#FFFFFF',
                background: newTier === 'premium'
                  ? 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)'
                  : tierCfg.gradient,
                boxShadow: `0 4px 16px ${tierCfg.color}44`,
              }}
            >
              Отлично!
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
