import React, { useCallback } from 'react';
import { Home, ClipboardList, FileCheck, Music, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const BottomNavigation = React.memo(({ activeTab = 'home', onTabChange, hapticFeedback, isHidden = false }) => {
  const { t } = useTranslation();

  const tabs = [
    {
      id: 'home',
      icon: Home,
      label: t('bottomNav.home', 'Главный экран'),
      shortLabel: t('bottomNav.homeShort', 'Главная'),
      gradient: 'from-green-400 to-cyan-400'
    },
    {
      id: 'tasks',
      icon: ClipboardList,
      label: t('bottomNav.tasks', 'Список дел'),
      shortLabel: t('bottomNav.tasksShort', 'Задачи'),
      gradient: 'from-yellow-400 to-orange-400'
    },
    {
      id: 'journal',
      icon: FileCheck,
      label: t('bottomNav.journal', 'Журнал'),
      shortLabel: t('bottomNav.journalShort', 'Журнал'),
      gradient: 'from-indigo-400 to-blue-400'
    },
    {
      id: 'friends',
      icon: Users,
      label: t('bottomNav.friends', 'Друзья'),
      shortLabel: t('bottomNav.friendsShort', 'Друзья'),
      gradient: 'from-purple-400 to-pink-400'
    },
    {
      id: 'music',
      icon: Music,
      label: t('bottomNav.music', 'Музыка'),
      shortLabel: t('bottomNav.musicShort', 'Музыка'),
      gradient: 'from-pink-400 to-red-400'
    }
  ];

  const handleTabClick = useCallback((tabId) => {
    if (hapticFeedback?.impactOccurred) {
      try {
        hapticFeedback.impactOccurred('light');
      } catch (e) {
        // Haptic feedback not available
      }
    }
    onTabChange?.(tabId);
  }, [hapticFeedback, onTabChange]);

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0, x: '-50%' }}
      animate={{ 
        y: isHidden ? 100 : 0, 
        opacity: isHidden ? 0 : 1, 
        x: '-50%' 
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed bottom-4 z-50"
      style={{ 
        left: '50%',
        overflow: 'visible'
      }}
    >
      {/* Main navigation with rounded corners */}
      <div className="relative" style={{ height: '50px' }}>
        {/* Glow effects layer */}
        <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible', zIndex: -1 }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return isActive ? (
              <motion.div
                key={`glow-${tab.id}`}
                layoutId="navGlow"
                className={`absolute inset-0 bg-gradient-to-br ${tab.gradient} blur-2xl`}
                style={{ borderRadius: '40px', opacity: 0.25 }}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
              />
            ) : null;
          })}
        </div>

        {/* Background with blur and border */}
        <div 
          className="absolute inset-0 border border-white/10"
          style={{ 
            borderRadius: '80px', 
            overflow: 'hidden',
            backgroundColor: 'rgba(28, 28, 30, 0.7)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)'
          }}
        />
        
        {/* Content container */}
        <div className="relative h-full px-2 py-1">
          <div className="flex items-center justify-center gap-1 h-full">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    whileTap={{ scale: 0.92 }}
                    layout
                    className="relative flex items-center justify-center transition-all duration-300 touch-manipulation"
                    style={{
                      height: '42px',
                      padding: isActive ? '0 14px' : '0 12px',
                      borderRadius: '40px',
                      minWidth: isActive ? 'auto' : '42px',
                    }}
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  >
                    {/* Active pill background */}
                    {isActive && (
                      <motion.div
                        layoutId="activeNavPill"
                        className="absolute inset-0 bg-white/[0.07] border border-white/[0.1]"
                        style={{ borderRadius: '40px' }}
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                      />
                    )}

                    {/* Icon + Label */}
                    <div className="relative z-10 flex items-center gap-2">
                      {isActive ? (
                        <motion.div 
                          className={`bg-gradient-to-br ${tab.gradient} p-0.5 rounded-xl`}
                          layout
                        >
                          <div className="bg-[#1C1C1E] rounded-xl p-1.5">
                            <Icon 
                              className="w-5 h-5 text-white" 
                              strokeWidth={2.5}
                            />
                          </div>
                        </motion.div>
                      ) : (
                        <div className="p-2">
                          <Icon 
                            className="w-5 h-5 text-[#999999] transition-colors duration-300" 
                            strokeWidth={2}
                          />
                        </div>
                      )}

                      <AnimatePresence mode="wait">
                        {isActive && (
                          <motion.span
                            key={`label-${tab.id}`}
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="text-white text-[13px] font-semibold whitespace-nowrap overflow-hidden pr-1"
                          >
                            {tab.shortLabel}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>
                );
              })}
          </div>
        </div>
      </div>
    </motion.nav>
  );
});
