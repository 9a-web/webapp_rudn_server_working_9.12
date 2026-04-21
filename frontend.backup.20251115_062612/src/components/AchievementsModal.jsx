import React, { useMemo } from 'react';
import { X, Trophy, Star, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, backdropVariants } from '../utils/animations';

export const AchievementsModal = ({ 
  isOpen, 
  onClose, 
  allAchievements = [], 
  userAchievements = [], 
  userStats = null,
  hapticFeedback 
}) => {
  // Создаем мапу полученных достижений
  const earnedMap = useMemo(() => {
    const map = {};
    userAchievements.forEach(ua => {
      map[ua.achievement.id] = ua;
    });
    return map;
  }, [userAchievements]);

  // Сортируем достижения: сначала полученные, потом заблокированные
  const sortedAchievements = useMemo(() => {
    return [...allAchievements].sort((a, b) => {
      const aEarned = earnedMap[a.id] ? 1 : 0;
      const bEarned = earnedMap[b.id] ? 1 : 0;
      if (aEarned !== bEarned) return bEarned - aEarned;
      return a.points - b.points;
    });
  }, [allAchievements, earnedMap]);

  const handleClose = () => {
    hapticFeedback && hapticFeedback('impact', 'light');
    onClose();
  };

  const totalPoints = userStats?.total_points || 0;
  const achievementsCount = userStats?.achievements_count || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10"
              style={{
                backgroundColor: 'rgba(42, 42, 42, 0.8)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)'
              }}
              variants={modalVariants}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div 
                className="sticky top-0 border-b border-gray-700 p-4 z-10"
                style={{
                  backgroundColor: 'rgba(42, 42, 42, 0.95)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-[#FFE66D]" />
                    <h2 className="text-xl font-bold text-white">Достижения</h2>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Статистика */}
                <div className="flex gap-3">
                  <div className="flex-1 bg-gradient-to-br from-[#FFE66D]/10 to-[#FFE66D]/5 rounded-xl p-3 border border-[#FFE66D]/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-4 h-4 text-[#FFE66D]" />
                      <span className="text-xs text-gray-400">Очки</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{totalPoints}</div>
                  </div>
                  <div className="flex-1 bg-gradient-to-br from-[#A3F7BF]/10 to-[#A3F7BF]/5 rounded-xl p-3 border border-[#A3F7BF]/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="w-4 h-4 text-[#A3F7BF]" />
                      <span className="text-xs text-gray-400">Получено</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {achievementsCount}/{allAchievements.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {sortedAchievements.map((achievement) => {
                  const earned = earnedMap[achievement.id];
                  const isEarned = !!earned;

                  return (
                    <motion.div
                      key={achievement.id}
                      className={`rounded-2xl p-4 border transition-all ${
                        isEarned
                          ? 'bg-gradient-to-br from-[#A3F7BF]/10 to-[#FFE66D]/10 border-[#A3F7BF]/30'
                          : 'bg-gray-800/30 border-gray-700/50'
                      }`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: isEarned ? 1.02 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Иконка */}
                        <div className={`flex-shrink-0 ${isEarned ? '' : 'opacity-30 grayscale'}`}>
                          <div className="text-4xl">{achievement.emoji}</div>
                        </div>

                        {/* Информация */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className={`font-bold ${isEarned ? 'text-white' : 'text-gray-500'}`}>
                              {achievement.name}
                            </h3>
                            {!isEarned && <Lock className="w-4 h-4 text-gray-600 flex-shrink-0" />}
                          </div>
                          
                          <p className={`text-sm mb-2 ${isEarned ? 'text-gray-300' : 'text-gray-600'}`}>
                            {achievement.description}
                          </p>

                          <div className="flex items-center justify-between">
                            <div className={`flex items-center gap-1 text-sm font-semibold ${
                              isEarned ? 'text-[#FFE66D]' : 'text-gray-600'
                            }`}>
                              <Star className="w-4 h-4" />
                              <span>{achievement.points} очков</span>
                            </div>

                            {isEarned && earned.earned_at && (
                              <span className="text-xs text-gray-500">
                                {new Date(earned.earned_at).toLocaleDateString('ru-RU', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Footer */}
              <div 
                className="sticky bottom-0 border-t border-gray-700 p-4"
                style={{
                  backgroundColor: 'rgba(42, 42, 42, 0.95)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)'
                }}
              >
                <p className="text-xs text-gray-500 text-center">
                  Продолжайте использовать приложение, чтобы получить больше достижений!
                </p>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
