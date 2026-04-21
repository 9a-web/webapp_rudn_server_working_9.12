import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, X } from 'lucide-react';
import { celebrateAchievement } from '../utils/confetti';
import { friendsAPI } from '../services/friendsAPI';

const TIER_CONFIG = {
  base:    { color: '#4D85FF', gradient: 'linear-gradient(135deg, #4D85FF, #6EA0FF)' },
  medium:  { color: '#FFA04D', gradient: 'linear-gradient(135deg, #FFA04D, #FFB976)' },
  rare:    { color: '#B84DFF', gradient: 'linear-gradient(135deg, #B84DFF, #D47FFF)' },
  premium: { color: '#FF4EEA', gradient: 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)' },
};

// Standalone версия для использования в очереди
export const AchievementNotificationContent = ({ achievement, onClose, hapticFeedback, telegramId }) => {
  const [levelInfo, setLevelInfo] = useState(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    // Вибрация при появлении
    hapticFeedback && hapticFeedback('notification', 'success');
    
    // 🎉 ЗАПУСКАЕМ КОНФЕТТИ!
    celebrateAchievement();
  }, [hapticFeedback]);

  // Загружаем XP инфо при появлении
  useEffect(() => {
    if (telegramId) {
      friendsAPI.getUserLevel(telegramId)
        .then(data => {
          if (data) {
            setLevelInfo(data);
            // Анимируем прогресс с задержкой
            const oldProgress = Math.max(0, (data.progress || 0) - ((achievement?.points || 0) / ((data.xp_next_level || 100) - (data.xp_current_level || 0))));
            setAnimatedProgress(Math.max(0, Math.min(oldProgress, 1)));
            setTimeout(() => {
              setAnimatedProgress(data.progress || 0);
            }, 500);
          }
        })
        .catch(() => {});
    }
  }, [telegramId, achievement?.points]);

  if (!achievement) return null;

  const tier = levelInfo?.tier || 'base';
  const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.base;
  const level = levelInfo?.level || 1;
  const xpCurrent = levelInfo?.xp_current_level || 0;
  const xpNext = levelInfo?.xp_next_level || 100;
  const totalXp = levelInfo?.xp || 0;
  const xpNeeded = xpNext - xpCurrent;
  const xpInLevel = totalXp - xpCurrent;

  return (
    <motion.div
      className="fixed top-4 left-0 right-0 mx-auto z-[100] w-[calc(100%-32px)] max-w-md md:w-96"
      initial={{ opacity: 0, y: -100, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: {
          type: "spring",
          damping: 15,
          stiffness: 300
        }
      }}
      exit={{ 
        opacity: 0, 
        y: -100,
        scale: 0.9,
        transition: { duration: 0.3 }
      }}
    >
      <motion.div
        className="bg-gradient-to-br from-[#A3F7BF] via-[#FFE66D] to-[#A3F7BF] p-[2px] rounded-xl shadow-2xl"
        animate={{
          boxShadow: [
            "0 0 20px rgba(163, 247, 191, 0.3)",
            "0 0 40px rgba(163, 247, 191, 0.5)",
            "0 0 20px rgba(163, 247, 191, 0.3)",
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <div 
          className="rounded-xl p-3 relative overflow-hidden border border-white/10"
          style={{
            backgroundColor: 'rgba(42, 42, 42, 0.85)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)'
          }}
        >
          {/* Анимированный фон */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-[#A3F7BF]/10 via-[#FFE66D]/10 to-transparent"
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Контент */}
          <div className="relative z-10">
            <div className="flex items-start gap-2.5">
              {/* Иконка трофея */}
              <motion.div
                className="flex-shrink-0"
                animate={{
                  rotate: [0, -10, 10, -10, 0],
                  scale: [1, 1.1, 1, 1.1, 1],
                }}
                transition={{
                  duration: 0.5,
                  delay: 0.2,
                }}
              >
                <div className="bg-gradient-to-br from-[#FFE66D]/20 to-[#A3F7BF]/20 rounded-lg p-2">
                  <Trophy className="w-5 h-5 text-[#FFE66D]" />
                </div>
              </motion.div>

              {/* Текст */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <h3 className="text-xs font-bold text-[#A3F7BF]">
                    Новое достижение!
                  </h3>
                  <motion.div
                    animate={{
                      rotate: [0, 360],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  >
                    <Star className="w-3 h-3 text-[#FFE66D]" />
                  </motion.div>
                </div>

                <div className="flex items-start gap-2 mb-1.5">
                  <span className="text-2xl flex-shrink-0 leading-none">{achievement.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-white mb-0.5 break-words leading-tight">{achievement.name}</h4>
                    <p className="text-xs text-gray-300 break-words leading-snug">{achievement.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-[#FFE66D]">
                  <Star className="w-3 h-3 flex-shrink-0" />
                  <span>+{achievement.points} $RDN</span>
                </div>
              </div>

              {/* Кнопка закрытия */}
              <button
                onClick={onClose}
                className="flex-shrink-0 p-1 hover:bg-white/10 active:bg-white/20 rounded-full transition-colors touch-manipulation"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* XP прогресс-бар */}
            {levelInfo && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                style={{ marginTop: '10px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '10px',
                    color: tierCfg.color,
                  }}>
                    LV. {level}
                  </span>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.4)',
                  }}>
                    {xpInLevel} / {xpNeeded} XP
                  </span>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.3)',
                  }}>
                    LV. {level + 1}
                  </span>
                </div>

                <div style={{
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <motion.div
                    initial={{ width: `${Math.max(animatedProgress * 100, 0.5)}%` }}
                    animate={{ width: `${Math.max((levelInfo.progress || 0) * 100, 0.5)}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
                    style={{
                      height: '100%',
                      borderRadius: '3px',
                      background: tierCfg.gradient,
                      boxShadow: `0 0 8px ${tierCfg.color}50`,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                  />
                  {/* Блик */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.8, 0] }}
                    transition={{ duration: 1, delay: 0.8 }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: `${100 - Math.max((levelInfo.progress || 0) * 100, 0.5)}%`,
                      width: '16px',
                      height: '100%',
                      background: `linear-gradient(90deg, transparent, ${tierCfg.color}80, transparent)`,
                      borderRadius: '3px',
                      filter: 'blur(1px)',
                    }}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Конфетти эффект */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: i % 2 === 0 ? '#A3F7BF' : '#FFE66D',
                left: `${25 + i * 10}%`,
                top: '50%',
              }}
              initial={{ scale: 0, y: 0 }}
              animate={{
                scale: [0, 1, 0],
                y: [-40, -80, -120],
                x: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 80],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                delay: i * 0.1,
                ease: "easeOut"
              }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export const AchievementNotification = ({ achievement, onClose, hapticFeedback, telegramId }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Вибрация при появлении
    hapticFeedback && hapticFeedback('notification', 'success');
    
    // 🎉 ЗАПУСКАЕМ КОНФЕТТИ!
    celebrateAchievement();
    
    // Автоматически закрываем через 7 секунд
    const timer = setTimeout(() => {
      handleClose();
    }, 7000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!achievement) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <AchievementNotificationContent 
          achievement={achievement}
          onClose={handleClose}
          hapticFeedback={hapticFeedback}
          telegramId={telegramId}
        />
      )}
    </AnimatePresence>
  );
};
