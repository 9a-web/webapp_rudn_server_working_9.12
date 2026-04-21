import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Shield, Swords, Crown, Gem, Sun,
  ArrowUp, Sparkles,
} from 'lucide-react';
import { TIER_CONFIG } from '../constants/levelConstants';

const TIER_ICONS = {
  base:    Shield,
  medium:  Swords,
  rare:    Crown,
  premium: Gem,
  legend:  Sun,
};

/**
 * LevelUpModal v4.0
 * Peak-End Rule: максимально запоминающийся момент повышения.
 * Legend: грандиозный золотой салют.
 */
export default function LevelUpModal({ isOpen, onClose, newLevel, newTier, oldTier, levelTitle }) {
  const overlayRef = useRef(null);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (isOpen && !confettiFired.current) {
      confettiFired.current = true;
      if (newTier === 'legend') {
        fireLegend();
        const t1 = setTimeout(fireLegend, 300);
        const t2 = setTimeout(fireGold, 600);
        const t3 = setTimeout(fireStars, 900);
        const t4 = setTimeout(fireLegend, 1200);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
      } else {
        fireBurst();
        const t1 = setTimeout(fireBurst, 350);
        const t2 = setTimeout(fireStars, 700);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
    }
    if (!isOpen) confettiFired.current = false;
  }, [isOpen, newTier]);

  const fireBurst = () => {
    const tc = TIER_CONFIG[newTier] || TIER_CONFIG.base;
    const colors = newTier === 'premium'
      ? ['#FF4EEA', '#FFCE2E', '#FF8717', '#FFD700']
      : [tc.color, '#FFFFFF', '#FFD700'];
    confetti({ particleCount: 70, spread: 80, origin: { x: 0.15, y: 0.55 }, colors, disableForReducedMotion: true });
    confetti({ particleCount: 70, spread: 80, origin: { x: 0.85, y: 0.55 }, colors, disableForReducedMotion: true });
  };

  const fireLegend = () => {
    const colors = ['#FFD700', '#FF6B00', '#FF0080', '#7B2FFF', '#FFFFFF'];
    confetti({ particleCount: 100, spread: 120, origin: { x: 0.5, y: 0.5 }, colors, disableForReducedMotion: true, scalar: 1.3 });
    confetti({ particleCount: 60, spread: 80, origin: { x: 0.2, y: 0.4 }, colors, disableForReducedMotion: true });
    confetti({ particleCount: 60, spread: 80, origin: { x: 0.8, y: 0.4 }, colors, disableForReducedMotion: true });
  };

  const fireGold = () => {
    confetti({
      particleCount: 40, spread: 180, startVelocity: 35, gravity: 1.5,
      origin: { x: 0.5, y: 0.1 }, shapes: ['circle'],
      colors: ['#FFD700', '#FFC400', '#FFE44D', '#FFECB3'],
      scalar: 0.8, disableForReducedMotion: true,
    });
  };

  const fireStars = () => {
    confetti({
      particleCount: 25, spread: 360, startVelocity: 20,
      origin: { x: 0.5, y: 0.45 }, shapes: ['star'],
      colors: ['#FFD700', '#FFCE2E', '#FFF'],
      scalar: 1.2, disableForReducedMotion: true,
    });
  };

  if (!isOpen) return null;

  const tc = TIER_CONFIG[newTier] || TIER_CONFIG.base;
  const tierChanged = oldTier && oldTier !== newTier;
  const isLegend = newTier === 'legend';
  const isHighTier = newTier === 'premium' || newTier === 'legend';
  const TIcon = TIER_ICONS[newTier] || Shield;

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
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: isLegend ? 'rgba(0,0,0,0.88)' : 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.4, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
            style={{
              width: 'calc(100% - 40px)', maxWidth: '340px',
              background: isLegend
                ? 'linear-gradient(180deg, #2A1E00 0%, #1A0D00 50%, #141428 100%)'
                : 'linear-gradient(180deg, #1E1E3A 0%, #141428 100%)',
              borderRadius: '28px', padding: '36px 28px 28px',
              textAlign: 'center', position: 'relative', overflow: 'hidden',
              border: `1.5px solid ${tc.color}44`,
              boxShadow: isLegend
                ? `0 0 80px ${tc.color}22, inset 0 1px 0 rgba(255,255,255,0.06)`
                : `0 0 50px ${tc.color}18, inset 0 1px 0 rgba(255,255,255,0.05)`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background glow */}
            <div style={{
              position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
              width: '200%', height: '200%',
              background: `radial-gradient(ellipse at center, ${tc.color}${isLegend ? '18' : '0C'} 0%, transparent 55%)`,
              pointerEvents: 'none',
            }} />

            {/* Legend: pulsing ring */}
            {isLegend && (
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '250px', height: '250px', borderRadius: '50%',
                  border: `2px solid ${tc.color}16`, pointerEvents: 'none',
                }}
              />
            )}

            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', damping: 10, stiffness: 180 }}
              style={{
                width: '72px', height: '72px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                background: `${tc.color}14`, border: `2px solid ${tc.color}33`,
                position: 'relative',
              }}
            >
              <ArrowUp size={isLegend ? 36 : 32} color={tc.color} strokeWidth={2.5} />
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              style={{
                fontFamily: "'Poppins', sans-serif", fontWeight: 800,
                fontSize: isLegend ? '26px' : '22px', color: '#FFFFFF',
                letterSpacing: '-0.02em', marginBottom: '4px', position: 'relative',
              }}
            >
              {isLegend ? 'ЛЕГЕНДА!' : 'Новый уровень!'}
            </motion.div>

            {/* Level number */}
            <motion.div
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, type: 'spring', damping: 14 }}
              style={{
                fontFamily: "'Poppins', sans-serif", fontWeight: 900,
                fontSize: isLegend ? '68px' : '60px', lineHeight: 1,
                background: tc.gradient,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '14px', position: 'relative',
                filter: `drop-shadow(0 0 16px ${tc.color}44)`,
              }}
            >
              LV. {newLevel}
            </motion.div>

            {/* Level title (e.g. "Мастер", "Элита") */}
            {levelTitle && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42, type: 'spring', damping: 16 }}
                style={{
                  fontFamily: "'Poppins', sans-serif", fontWeight: 600,
                  fontSize: '15px', color: `${tc.color}BB`,
                  marginBottom: '10px', letterSpacing: '0.5px',
                }}
              >
                «{levelTitle}»
              </motion.div>
            )}

            {/* New tier badge */}
            {tierChanged && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', damping: 16 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '8px 18px', borderRadius: '20px',
                  background: `${tc.color}14`, border: `1px solid ${tc.color}33`,
                  marginBottom: '8px',
                }}
              >
                <TIcon size={16} color={tc.color} strokeWidth={2.5} />
                <span style={{
                  fontFamily: "'Poppins', sans-serif", fontWeight: 700,
                  fontSize: '13px', color: tc.color,
                }}>
                  Новый статус: {tc.nameRu}
                </span>
              </motion.div>
            )}

            {/* Close button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onClick={onClose}
              whileTap={{ scale: 0.96 }}
              style={{
                marginTop: '20px', width: '100%', padding: '14px',
                borderRadius: '16px', border: 'none', cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif", fontWeight: 600,
                fontSize: '15px',
                color: isHighTier ? '#1c1c1c' : '#FFFFFF',
                background: tc.gradient,
                boxShadow: `0 4px 20px ${tc.color}33`,
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              {isLegend
                ? <><Sparkles size={16} strokeWidth={2.5} /> Невероятно!</>
                : 'Отлично!'
              }
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
