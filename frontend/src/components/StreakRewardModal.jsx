import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

/* ─────────────────────────────────────────
   SVG: Лавровый венок (маленький / большой)
───────────────────────────────────────── */
const LaurelWreathIcon = ({ size = 28, color = '#6B4226' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Левая ветвь */}
    <path d="M7 24 C4 20 3 15 5 10 C6 8 8 7 8 7 C7 10 7 13 9 16" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    <ellipse cx="6.5" cy="11" rx="2.2" ry="1.3" transform="rotate(-40 6.5 11)" fill={color} opacity="0.9"/>
    <ellipse cx="5.5" cy="15" rx="2.2" ry="1.3" transform="rotate(-20 5.5 15)" fill={color} opacity="0.9"/>
    <ellipse cx="6.5" cy="19" rx="2.2" ry="1.3" transform="rotate(5 6.5 19)" fill={color} opacity="0.9"/>
    <ellipse cx="8.5" cy="22.5" rx="2.2" ry="1.3" transform="rotate(25 8.5 22.5)" fill={color} opacity="0.9"/>
    {/* Правая ветвь */}
    <path d="M25 24 C28 20 29 15 27 10 C26 8 24 7 24 7 C25 10 25 13 23 16" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    <ellipse cx="25.5" cy="11" rx="2.2" ry="1.3" transform="rotate(40 25.5 11)" fill={color} opacity="0.9"/>
    <ellipse cx="26.5" cy="15" rx="2.2" ry="1.3" transform="rotate(20 26.5 15)" fill={color} opacity="0.9"/>
    <ellipse cx="25.5" cy="19" rx="2.2" ry="1.3" transform="rotate(-5 25.5 19)" fill={color} opacity="0.9"/>
    <ellipse cx="23.5" cy="22.5" rx="2.2" ry="1.3" transform="rotate(-25 23.5 22.5)" fill={color} opacity="0.9"/>
    {/* Нижняя перевязь */}
    <path d="M10 25 Q16 27.5 22 25" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    {/* Центральный элемент */}
    <circle cx="16" cy="25" r="1.5" fill={color}/>
  </svg>
);

/* ─────────────────────────────────────────
   SVG: Лавровый венок БЕЛЫЙ (для кружков)
───────────────────────────────────────── */
const LaurelWreathSmall = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 24 C4 20 3 15 5 10 C6 8 8 7 8 7 C7 10 7 13 9 16" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    <ellipse cx="6.5" cy="11" rx="2.2" ry="1.3" transform="rotate(-40 6.5 11)" fill="white" opacity="0.95"/>
    <ellipse cx="5.5" cy="15" rx="2.2" ry="1.3" transform="rotate(-20 5.5 15)" fill="white" opacity="0.95"/>
    <ellipse cx="6.5" cy="19" rx="2.2" ry="1.3" transform="rotate(5 6.5 19)" fill="white" opacity="0.95"/>
    <ellipse cx="8.5" cy="22.5" rx="2.2" ry="1.3" transform="rotate(25 8.5 22.5)" fill="white" opacity="0.95"/>
    <path d="M25 24 C28 20 29 15 27 10 C26 8 24 7 24 7 C25 10 25 13 23 16" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    <ellipse cx="25.5" cy="11" rx="2.2" ry="1.3" transform="rotate(40 25.5 11)" fill="white" opacity="0.95"/>
    <ellipse cx="26.5" cy="15" rx="2.2" ry="1.3" transform="rotate(20 26.5 15)" fill="white" opacity="0.95"/>
    <ellipse cx="25.5" cy="19" rx="2.2" ry="1.3" transform="rotate(-5 25.5 19)" fill="white" opacity="0.95"/>
    <ellipse cx="23.5" cy="22.5" rx="2.2" ry="1.3" transform="rotate(-25 23.5 22.5)" fill="white" opacity="0.95"/>
    <path d="M10 25 Q16 27.5 22 25" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <circle cx="16" cy="25" r="1.5" fill="white"/>
  </svg>
);

/* ─────────────────────────────────────────
   Анимированный числовой счётчик
───────────────────────────────────────── */
const AnimatedCounter = ({ target, duration = 1.2, delay = 0.5 }) => {
  const [display, setDisplay] = useState(0);
  const motionVal = useMotionValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const controls = animate(motionVal, target, {
        duration,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (v) => setDisplay(Math.round(v)),
      });
      return () => controls.stop();
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [target, duration, delay, motionVal]);

  return <span>{display}</span>;
};

/* ─────────────────────────────────────────
   Particle-конфетти при открытии
───────────────────────────────────────── */
const PARTICLE_COUNT = 18;
const COLORS = ['#F7D060', '#E8A020', '#F5C842', '#FFE4A0', '#FFFFFF', '#C8A44A'];

const Particles = ({ active }) => {
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    x: (Math.random() - 0.5) * 260,
    y: -(60 + Math.random() * 180),
    rotate: Math.random() * 360,
    size: 4 + Math.random() * 6,
    delay: Math.random() * 0.4,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
      <AnimatePresence>
        {active && particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
            animate={{
              x: p.x,
              y: p.y,
              opacity: [1, 1, 0],
              scale: [0, 1, 0.6],
              rotate: p.rotate,
            }}
            transition={{ duration: 1.1, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '38%',
              width: p.size,
              height: p.size,
              borderRadius: p.size > 8 ? '50%' : 2,
              backgroundColor: p.color,
              marginLeft: -p.size / 2,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

/* ─────────────────────────────────────────
   Shimmer-эффект на значке
───────────────────────────────────────── */
const BadgeShimmer = () => (
  <motion.div
    initial={{ x: -80, opacity: 0 }}
    animate={{ x: 80, opacity: [0, 0.7, 0] }}
    transition={{ delay: 0.9, duration: 0.7, ease: 'easeInOut' }}
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '40%',
      height: '100%',
      background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)',
      borderRadius: 'inherit',
      pointerEvents: 'none',
    }}
  />
);

/* ─────────────────────────────────────────
   Пятиугольный значок (Gold Pentagon Badge)
───────────────────────────────────────── */
const GoldBadge = ({ show }) => (
  <motion.div
    initial={{ scale: 0, rotate: -20, y: 20 }}
    animate={show ? { scale: 1, rotate: 0, y: 0 } : { scale: 0, rotate: -20, y: 20 }}
    transition={{
      type: 'spring',
      stiffness: 320,
      damping: 18,
      delay: 0.25,
    }}
    style={{ position: 'relative', zIndex: 20 }}
  >
    {/* Внешнее свечение */}
    <motion.div
      animate={{ boxShadow: ['0 0 0px 0px rgba(247,208,96,0)', '0 0 22px 8px rgba(247,208,96,0.35)', '0 0 0px 0px rgba(247,208,96,0)'] }}
      transition={{ delay: 0.8, duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
      style={{
        position: 'absolute',
        inset: -6,
        clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
        borderRadius: 0,
      }}
    />

    {/* Основной пятиугольник */}
    <div
      style={{
        width: 108,
        height: 108,
        clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
        background: 'linear-gradient(150deg, #F7D060 0%, #E8A020 45%, #F5C842 70%, #D4960E 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 32px -4px rgba(180, 120, 0, 0.45), 0 4px 12px rgba(180,120,0,0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Внутренний градиент-оверлей */}
      <div style={{
        position: 'absolute',
        inset: 0,
        clipPath: 'inherit',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 60%)',
      }} />

      {/* Иконка лаврового венка */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={show ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
        transition={{ delay: 0.55, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative', zIndex: 2, marginTop: 6 }}
      >
        <LaurelWreathIcon size={44} color="#6B3A00" />
      </motion.div>

      {/* Shimmer */}
      <BadgeShimmer />
    </div>

    {/* Нижняя тень "левитации" */}
    <div style={{
      position: 'absolute',
      bottom: -10,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 60,
      height: 14,
      background: 'radial-gradient(ellipse, rgba(180,120,0,0.28) 0%, transparent 70%)',
      borderRadius: '50%',
    }} />
  </motion.div>
);

/* ─────────────────────────────────────────
   Трекер недели (7 дней)
───────────────────────────────────────── */
const WeekTracker = ({ streakDays = 3, weekDays, show }) => {
  // weekDays: массив объектов { label: 'Mon', dateNum: 3, done: true }
  const days = weekDays || [
    { label: 'Mon', dateNum: 3,  done: true  },
    { label: 'Tue', dateNum: 4,  done: true  },
    { label: 'Wed', dateNum: 5,  done: true  },
    { label: 'Thu', dateNum: 6,  done: false },
    { label: 'Fri', dateNum: 7,  done: false },
    { label: 'Sat', dateNum: 8,  done: false },
    { label: 'Sun', dateNum: 9,  done: false },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ delay: 0.75, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        width: '100%',
        padding: '0 4px',
      }}
    >
      {days.map((day, idx) => (
        <motion.div
          key={day.label}
          initial={{ opacity: 0, y: 8 }}
          animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ delay: 0.8 + idx * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 7,
            flex: 1,
          }}
        >
          {/* Лейбл дня */}
          <span style={{
            fontSize: 10,
            fontWeight: 500,
            color: '#AEAEB2',
            fontFamily: '-apple-system, "SF Pro Text", Inter, sans-serif',
            letterSpacing: 0.3,
          }}>
            {day.label}
          </span>

          {/* Статус дня */}
          {day.done ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={show ? { scale: 1 } : { scale: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.85 + idx * 0.06 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: '#E5E5EA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              <LaurelWreathSmall size={18} />
            </motion.div>
          ) : (
            <div style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#1C1C1E',
                fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
              }}>
                {day.dateNum}
              </span>
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════
   ГЛАВНЫЙ КОМПОНЕНТ: StreakRewardModal
   Props:
     isOpen        - boolean: показывать/скрывать
     onClose       - function: закрытие
     onClaim       - function: нажатие Claim
     streakDays    - number: количество дней серии (default 3)
     habitName     - string: название привычки (default "Здоровые привычки")
     weekDays      - array: данные недели (опционально)
     subtitle      - string: подзаголовок
═══════════════════════════════════════════════ */
export const StreakRewardModal = ({
  isOpen = false,
  onClose,
  onClaim,
  streakDays = 3,
  habitName = 'Здоровые привычки',
  weekDays,
  subtitle = 'Ты на правильном пути',
}) => {
  const [showParticles, setShowParticles] = useState(false);
  const [claimed, setClaimed] = useState(false);

  // Сбрасываем состояние при открытии
  useEffect(() => {
    if (isOpen) {
      setClaimed(false);
      const t = setTimeout(() => setShowParticles(true), 300);
      const t2 = setTimeout(() => setShowParticles(false), 1800);
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [isOpen]);

  const handleClaim = () => {
    setClaimed(true);
    setShowParticles(true);
    setTimeout(() => {
      setShowParticles(false);
      if (onClaim) onClaim();
      setTimeout(() => { if (onClose) onClose(); }, 400);
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.28)',
              zIndex: 1000,
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          {/* ── Контейнер ── */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 30, mass: 0.8 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '0 16px 28px',
              pointerEvents: 'none',
            }}
          >
            <div style={{ width: '100%', maxWidth: 420, pointerEvents: 'auto', position: 'relative' }}>

              {/* Particles */}
              <Particles active={showParticles} />

              {/* ── Основная карточка ── */}
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ delay: 0.05, type: 'spring', stiffness: 300, damping: 26 }}
                style={{
                  borderRadius: 32,
                  overflow: 'hidden',
                  boxShadow: '0 24px 60px -8px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.1)',
                  position: 'relative',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {/* ─── Серая шапка ─── */}
                <div style={{
                  backgroundColor: '#F2F2F7',
                  paddingTop: 28,
                  paddingBottom: 52,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}>
                  <motion.p
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, duration: 0.4 }}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#AEAEB2',
                      letterSpacing: 1.1,
                      textTransform: 'uppercase',
                      fontFamily: '-apple-system, "SF Pro Text", Inter, sans-serif',
                      margin: 0,
                    }}
                  >
                    {habitName}
                  </motion.p>
                </div>

                {/* ─── Плавающий золотой значок ─── */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginTop: -60,
                  marginBottom: -20,
                  position: 'relative',
                  zIndex: 10,
                }}>
                  <GoldBadge show={isOpen} />
                </div>

                {/* ─── Белое тело ─── */}
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '28px 28px 32px 32px',
                  padding: '32px 28px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  {/* Заголовок "X Day Streak!" */}
                  <motion.h1
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 18, delay: 0.42 }}
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: '#1C1C1E',
                      fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
                      margin: 0,
                      letterSpacing: -0.5,
                      textAlign: 'center',
                    }}
                  >
                    <AnimatedCounter target={streakDays} duration={0.8} delay={0.55} />{' '}
                    {streakDays === 1 ? 'День!' : streakDays < 5 ? 'Дня!' : 'Дней!'}
                  </motion.h1>

                  {/* Подзаголовок */}
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.52, duration: 0.4 }}
                    style={{
                      fontSize: 15,
                      fontWeight: 400,
                      color: '#8E8E93',
                      fontFamily: '-apple-system, "SF Pro Text", Inter, sans-serif',
                      margin: '0 0 16px',
                      textAlign: 'center',
                    }}
                  >
                    {subtitle}
                  </motion.p>

                  {/* Тонкий разделитель */}
                  <motion.div
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ delay: 0.65, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      width: '100%',
                      height: 1,
                      backgroundColor: '#F2F2F7',
                      marginBottom: 16,
                    }}
                  />

                  {/* Трекер недели */}
                  <WeekTracker
                    streakDays={streakDays}
                    weekDays={weekDays}
                    show={isOpen}
                  />
                </div>
              </motion.div>

              {/* ── Кнопка "Claim" ── */}
              <motion.button
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ delay: 0.6, type: 'spring', stiffness: 280, damping: 24 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleClaim}
                disabled={claimed}
                style={{
                  marginTop: 14,
                  width: '100%',
                  height: 56,
                  borderRadius: 100,
                  backgroundColor: claimed ? '#3A3A3C' : '#1C1C1E',
                  border: 'none',
                  cursor: claimed ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 20px -4px rgba(0,0,0,0.35)',
                  transition: 'background-color 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Shimmer на кнопке при claimed */}
                {claimed && (
                  <motion.div
                    initial={{ x: '-120%' }}
                    animate={{ x: '120%' }}
                    transition={{ duration: 0.7, ease: 'easeInOut' }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.12) 50%, transparent 75%)',
                    }}
                  />
                )}

                <AnimatePresence mode="wait">
                  {claimed ? (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.3, 1] }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        style={{ fontSize: 20 }}
                      >
                        ✓
                      </motion.span>
                      <span style={{
                        fontSize: 17,
                        fontWeight: 600,
                        color: '#FFFFFF',
                        fontFamily: '-apple-system, "SF Pro Text", Inter, sans-serif',
                      }}>
                        Получено!
                      </span>
                    </motion.div>
                  ) : (
                    <motion.span
                      key="claim"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{
                        fontSize: 17,
                        fontWeight: 600,
                        color: '#FFFFFF',
                        fontFamily: '-apple-system, "SF Pro Text", Inter, sans-serif',
                        letterSpacing: 0.2,
                      }}
                    >
                      Забрать награду
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Ссылка "Не сейчас" */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75 }}
                onClick={onClose}
                style={{
                  marginTop: 12,
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '6px 0',
                }}
              >
                <span style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#8E8E93',
                  fontFamily: '-apple-system, "SF Pro Text", Inter, sans-serif',
                }}>
                  Не сейчас
                </span>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/* ─────────────────────────────────────────
   ПРЕВЬЮ-КОМПОНЕНТ (для тестирования)
───────────────────────────────────────── */
export const StreakRewardPreview = () => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F2F2F7',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, "SF Pro Text", Inter, sans-serif',
    }}>
      <p style={{ color: '#8E8E93', fontSize: 13, marginBottom: 16 }}>
        Нажми для демонстрации
      </p>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen(true)}
        style={{
          padding: '14px 36px',
          borderRadius: 100,
          backgroundColor: '#1C1C1E',
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}
      >
        🔥 Открыть Streak Reward
      </motion.button>

      <StreakRewardModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onClaim={() => console.log('Claimed!')}
        streakDays={3}
        habitName="Здоровые привычки"
        subtitle="Ты на правильном пути"
      />
    </div>
  );
};

export default StreakRewardModal;
