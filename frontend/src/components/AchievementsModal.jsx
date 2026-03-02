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

  // Функция для получения текущего прогресса по типу достижения
  const getAchievementProgress = (achievement) => {
    if (!userStats || achievement.requirement <= 1) {
      return null;
    }

    let current = 0;
    const requirement = achievement.requirement;

    switch (achievement.type) {
      case 'group_explorer':
        current = userStats.unique_groups?.length || 0;
        break;
      case 'social_butterfly':
        current = userStats.friends_invited || 0;
        break;
      case 'schedule_gourmet':
        current = userStats.schedule_views || 0;
        break;
      case 'attentive_student':
        current = userStats.detailed_views || 0;
        break;
      case 'chart_lover':
        current = userStats.analytics_views || 0;
        break;
      case 'ambassador':
        current = userStats.schedule_shares || 0;
        break;
      case 'explorer':
        current = userStats.menu_items_visited?.length || 0;
        break;
      case 'first_week':
        current = userStats.active_days?.length || 0;
        break;
      case 'productive_day':
        current = userStats.tasks_completed_today || 0;
        break;
      case 'early_riser_tasks':
        current = userStats.tasks_completed_early || 0;
        break;
      case 'task_specialist':
        current = userStats.tasks_created_total || 0;
        break;
      case 'lightning_fast':
        current = userStats.tasks_completed_today || 0;
        break;
      case 'flawless':
        current = userStats.tasks_completed_on_time || 0;
        break;
      case 'marathon_runner':
        current = userStats.task_streak_current || 0;
        break;
      case 'completion_master':
        current = userStats.tasks_completed_total || 0;
        break;
      case 'perfectionist':
        current = userStats.achievements_count || 0;
        break;
      // БАГ-ФИХ: добавлены прогресс-бары для достижений за друзей
      case 'friendly':
        current = userStats.friends_count || 0;
        break;
      case 'first_friend':
        current = userStats.friends_count || 0;
        break;
      case 'interfaculty':
        current = userStats.friends_faculties_count || 0;
        break;
      case 'networker':
        current = userStats.friends_faculties_count || 0;
        break;
      case 'recruiter':
        current = userStats.users_invited || 0;
        break;
      case 'influencer':
        current = userStats.users_invited || 0;
        break;
      default:
        return null;
    }

    // Ограничиваем текущее значение до requirement
    current = Math.min(current, requirement);
    const percentage = Math.round((current / requirement) * 100);

    return { current, requirement, percentage };
  };

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
                  const progress = !isEarned ? getAchievementProgress(achievement) : null;

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

                          {/* Прогресс бар для незавершенных достижений */}
                          {progress && (
                            <div className="mb-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-400">
                                  {progress.current} / {progress.requirement}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {progress.percentage}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-[#A3F7BF] to-[#FFE66D]"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress.percentage}%` }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className={`flex items-center gap-1 text-sm font-semibold ${
                              isEarned ? 'text-[#FFE66D]' : 'text-gray-600'
                            }`}>
                              <Star className="w-4 h-4" />
                              <span>{achievement.points} $RDN</span>
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
