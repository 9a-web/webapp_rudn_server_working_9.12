import React, { useCallback } from 'react';
import { Home, ClipboardList, FileCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const BottomNavigation = React.memo(({ activeTab = 'home', onTabChange, hapticFeedback, isHidden = false }) => {
  const { t } = useTranslation();

  const tabs = [
    {
      id: 'home',
      icon: Home,
      label: t('bottomNav.home', 'Главный экран'),
      gradient: 'from-green-400 to-cyan-400'
    },
    {
      id: 'tasks',
      icon: ClipboardList,
      label: t('bottomNav.tasks', 'Список дел'),
      gradient: 'from-yellow-400 to-orange-400'
    },
    {
      id: 'journal',
      icon: FileCheck,
      label: t('bottomNav.journal', 'Журнал'),
      gradient: 'from-purple-400 to-pink-400'
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
        width: '280px', 
        height: '50px',
        left: '50%',
        overflow: 'visible'
      }}
    >
      {/* Main navigation with rounded corners */}
      <div className="relative h-full">
        {/* Glow effects layer - rendered behind the background */}
        <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible', zIndex: -1 }}>
          <div className="relative h-full px-4 py-1">
            <div className="flex items-center justify-around gap-2 h-full">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <div
                    key={`glow-${tab.id}`}
                    className="flex-1 relative"
                  >
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`absolute inset-0 bg-gradient-to-br ${tab.gradient} blur-2xl`}
                        style={{ borderRadius: '40px', opacity: 0.3 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
        <div className="relative h-full px-4 py-1">
          <div className="flex items-center justify-around gap-2 h-full">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    whileTap={{ scale: 0.92 }}
                    className="relative flex-1 flex items-center justify-center px-3 transition-all duration-300 touch-manipulation"
                    style={{
                      backgroundColor: isActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                      borderRadius: '40px'
                    }}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-white/5 rounded-[40px]"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}

                    {/* Icon with gradient */}
                    <div className="relative">
                      {isActive ? (
                        <div className={`bg-gradient-to-br ${tab.gradient} p-0.5 rounded-xl`}>
                          <div className="bg-[#1C1C1E] rounded-xl p-1.5">
                            <Icon 
                              className="w-5 h-5 text-white relative z-10" 
                              strokeWidth={2.5}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="p-2">
                          <Icon 
                            className="w-5 h-5 text-[#999999] transition-colors duration-300" 
                            strokeWidth={2}
                          />
                        </div>
                      )}
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
