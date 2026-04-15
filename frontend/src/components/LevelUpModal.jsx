import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { TIER_CONFIG } from '../constants/levelConstants';

/**
 * Модалка Level-Up с конфетти.
 * Показывается при повышении уровня пользователя.
 */
export default function LevelUpModal({ isOpen, onClose, newLevel, newTier, oldTier }) {
  const overlayRef = useRef(null);
  const hasTriggeredConfetti = useRef(false);

  useEffect(() => {
    if (isOpen && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      fireConfetti();
      const t1 = setTimeout(() => fireConfetti(), 350);
      const t2 = setTimeout(() => fireStars(), 700);
      return () => { clearTimeout(t1); clearTimeout(t2); };
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

    confetti({ particleCount: 70, spread: 80, origin: { x: 0.15, y: 0.55 }, colors, disableForReducedMotion: true });
    confetti({ particleCount: 70, spread: 80, origin: { x: 0.85, y: 0.55 }, colors, disableForReducedMotion: true });
  };

  const fireStars = () => {
    confetti({
      particleCount: 25,
      spread: 360,
      startVelocity: 20,
      origin: { x: 0.5, y: 0.45 },
      shapes: ['star'],
      colors: ['#FFD700', '#FFCE2E', '#FFF'],
      scalar: 1.2,
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
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.4, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
            style={{
              width: 'calc(100% - 40px)',
              maxWidth: '340px',
              background: 'linear-gradient(180deg, #1E1E3A 0%, #141428 100%)',
              borderRadius: '28px',
              padding: '36px 28px 28px',
              textAlign: 'center',
              border: `1.5px solid ${tierCfg.color}55`,
              boxShadow: `0 0 60px ${tierCfg.color}22, inset 0 1px 0 rgba(255,255,255,0.06)`,
              position: 'relative',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Фоновый градиент-свечение */}
            <div style={{
              position: 'absolute',
              top: '-60%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '200%',
              height: '200%',
              background: `radial-gradient(ellipse at center, ${tierCfg.color}12 0%, transparent 60%)`,
              pointerEvents: 'none',
            }} />

            {/* Эмодзи */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', damping: 10, stiffness: 180 }}
              style={{ fontSize: '56px', marginBottom: '12px', position: 'relative' }}
            >
              🎉
            </motion.div>

            {/* Заголовок */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 800,
                fontSize: '24px',
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
                position: 'relative',
              }}
            >
              Новый уровень!
            </motion.div>

            {/* Номер уровня */}
            <motion.div
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, type: 'spring', damping: 14 }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 900,
                fontSize: '64px',
                lineHeight: 1,
                background: newTier === 'premium'
                  ? 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)'
                  : tierCfg.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '14px',
                position: 'relative',
                filter: `drop-shadow(0 0 20px ${tierCfg.color}55)`,
              }}
            >
              LV. {newLevel}
            </motion.div>

            {/* Новый тир (если изменился) */}
            {tierChanged && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', damping: 16 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: '20px',
                  background: `${tierCfg.color}18`,
                  border: `1px solid ${tierCfg.color}44`,
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '18px' }}>{tierCfg.emoji}</span>
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 700,
                    fontSize: '14px',
                    color: tierCfg.color,
                  }}
                >
                  Новый статус: {tierCfg.name}
                </span>
              </motion.div>
            )}

            {/* Кнопка закрытия */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onClick={onClose}
              whileTap={{ scale: 0.96 }}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '14px',
                borderRadius: '16px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                color: newTier === 'premium' ? '#1c1c1c' : '#FFFFFF',
                background: newTier === 'premium'
                  ? 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)'
                  : tierCfg.gradient,
                boxShadow: `0 4px 20px ${tierCfg.color}44`,
                position: 'relative',
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
