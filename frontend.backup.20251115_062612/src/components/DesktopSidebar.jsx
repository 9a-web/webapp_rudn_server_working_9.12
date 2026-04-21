import React from 'react';
import { WeatherWidget } from './WeatherWidget';
import { Trophy, TrendingUp, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const DesktopSidebar = ({ 
  user,
  userStats, 
  userAchievements,
  allAchievements,
  onAchievementsClick,
  onAnalyticsClick,
  onCalendarClick 
}) => {
  const { t } = useTranslation();

  return (
    <div className="hidden md:block md:sticky md:top-6 space-y-6 h-fit">
      {/* Погодный виджет */}
      <WeatherWidget />
      
      {/* Быстрая статистика достижений */}
      {user && userStats && (
        <div 
          className="rounded-3xl p-6 shadow-card border border-white/10"
          style={{
            backgroundColor: 'rgba(52, 52, 52, 0.7)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)'
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t('achievements.title', 'Достижения')}
            </h3>
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          
          <div className="space-y-4">
            {/* Общие очки */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('achievements.totalPoints', 'Всего очков')}
              </span>
              <span className="text-2xl font-bold text-yellow-400">
                {userStats.total_points || 0}
              </span>
            </div>
            
            {/* Прогресс достижений */}
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">
                  {t('achievements.progress', 'Прогресс')}
                </span>
                <span className="text-foreground font-medium">
                  {userAchievements?.length || 0} / {allAchievements?.length || 0}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-yellow-400 to-orange-400 h-full transition-all duration-500"
                  style={{ 
                    width: `${allAchievements?.length > 0 
                      ? ((userAchievements?.length || 0) / allAchievements.length) * 100 
                      : 0}%` 
                  }}
                />
              </div>
            </div>
            
            {/* Кнопка "Все достижения" */}
            {onAchievementsClick && (
              <button
                onClick={onAchievementsClick}
                className="w-full mt-4 px-4 py-2.5 bg-gradient-to-r from-yellow-400/10 to-orange-400/10 
                         hover:from-yellow-400/20 hover:to-orange-400/20 
                         text-yellow-400 rounded-xl font-medium text-sm
                         transition-all duration-300 border border-yellow-400/20"
              >
                {t('achievements.viewAll', 'Посмотреть все')}
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Быстрые действия */}
      <div 
        className="rounded-3xl p-6 shadow-card border border-white/10"
        style={{
          backgroundColor: 'rgba(52, 52, 52, 0.7)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)'
        }}
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {t('sidebar.quickActions', 'Быстрые действия')}
        </h3>
        
        <div className="space-y-3">
          {/* Аналитика */}
          {onAnalyticsClick && (
            <button
              onClick={onAnalyticsClick}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-cyan-400/10 to-blue-400/10 
                       hover:from-cyan-400/20 hover:to-blue-400/20 
                       text-cyan-400 rounded-xl font-medium text-sm
                       transition-all duration-300 border border-cyan-400/20"
            >
              <TrendingUp className="w-4 h-4" />
              <span>{t('menu.analytics', 'Аналитика')}</span>
            </button>
          )}
          
          {/* Календарь */}
          {onCalendarClick && (
            <button
              onClick={onCalendarClick}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-400/10 to-emerald-400/10 
                       hover:from-green-400/20 hover:to-emerald-400/20 
                       text-green-400 rounded-xl font-medium text-sm
                       transition-all duration-300 border border-green-400/20"
            >
              <Calendar className="w-4 h-4" />
              <span>{t('header.calendar', 'Календарь')}</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Последние достижения */}
      {userAchievements && userAchievements.length > 0 && (
        <div 
          className="rounded-3xl p-6 shadow-card border border-white/10"
          style={{
            backgroundColor: 'rgba(52, 52, 52, 0.7)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)'
          }}
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {t('achievements.recent', 'Последние достижения')}
          </h3>
          
          <div className="space-y-3">
            {userAchievements.slice(0, 3).map((userAch, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl"
              >
                <div className="text-2xl">{userAch.achievement.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {userAch.achievement.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    +{userAch.achievement.points} {t('achievements.points', 'очков')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
