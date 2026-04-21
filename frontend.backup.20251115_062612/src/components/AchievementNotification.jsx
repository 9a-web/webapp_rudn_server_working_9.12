import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, X } from 'lucide-react';
import { celebrateAchievement } from '../utils/confetti';

export const AchievementNotification = ({ achievement, onClose, hapticFeedback }) => {
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
        <motion.div
          className="fixed top-4 right-4 z-[100] w-[calc(100%-32px)] max-w-md md:w-96"
          initial={{ opacity: 0, x: 400, scale: 0.8 }}
          animate={{ 
            opacity: 1, 
            x: 0, 
            scale: 1,
            transition: {
              type: "spring",
              damping: 15,
              stiffness: 300
            }
          }}
          exit={{ 
            opacity: 0, 
            x: 400,
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
                      <span>+{achievement.points} очков</span>
                    </div>
                  </div>

                  {/* Кнопка закрытия */}
                  <button
                    onClick={handleClose}
                    className="flex-shrink-0 p-1 hover:bg-white/10 active:bg-white/20 rounded-full transition-colors touch-manipulation"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
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
      )}
    </AnimatePresence>
  );
};
