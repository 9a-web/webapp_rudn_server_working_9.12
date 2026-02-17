import React, { useCallback, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Home, ClipboardList, FileCheck, Music, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const BottomNavigation = React.memo(({ activeTab = 'home', onTabChange, hapticFeedback, isHidden = false }) => {
  const { t } = useTranslation();

  const tabs = [
    { id: 'home', icon: Home, shortLabel: t('bottomNav.homeShort', 'Главная'), gradient: 'from-green-400 to-cyan-400', color: '#34d399' },
    { id: 'tasks', icon: ClipboardList, shortLabel: t('bottomNav.tasksShort', 'Задачи'), gradient: 'from-yellow-400 to-orange-400', color: '#fbbf24' },
    { id: 'journal', icon: FileCheck, shortLabel: t('bottomNav.journalShort', 'Журнал'), gradient: 'from-indigo-400 to-blue-400', color: '#818cf8' },
    { id: 'friends', icon: Users, shortLabel: t('bottomNav.friendsShort', 'Друзья'), gradient: 'from-purple-400 to-pink-400', color: '#c084fc' },
    { id: 'music', icon: Music, shortLabel: t('bottomNav.musicShort', 'Музыка'), gradient: 'from-pink-400 to-red-400', color: '#f472b6' },
  ];

  const containerRef = useRef(null);
  const tabRefs = useRef({});
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  // Measure active tab position and update pill
  const updatePill = useCallback(() => {
    const container = containerRef.current;
    const activeEl = tabRefs.current[activeTab];
    if (!container || !activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = activeEl.getBoundingClientRect();

    setPillStyle({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
    });
  }, [activeTab]);

  useLayoutEffect(() => {
    // Small delay to let DOM settle after tab content change
    const raf = requestAnimationFrame(updatePill);
    return () => cancelAnimationFrame(raf);
  }, [activeTab, updatePill]);

  // Also update on resize
  useEffect(() => {
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [updatePill]);

  const handleTabClick = useCallback((tabId) => {
    if (hapticFeedback?.impactOccurred) {
      try { hapticFeedback.impactOccurred('light'); } catch (e) {}
    }
    onTabChange?.(tabId);
  }, [hapticFeedback, onTabChange]);

  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0, x: '-50%' }}
      animate={{ y: isHidden ? 100 : 0, opacity: isHidden ? 0 : 1, x: '-50%' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed bottom-4 z-50"
      style={{ left: '50%', overflow: 'visible' }}
    >
      <div className="relative" style={{ height: '50px' }}>
        {/* Glow behind active tab */}
        <motion.div
          className="absolute pointer-events-none blur-2xl"
          animate={{
            left: pillStyle.left,
            width: pillStyle.width,
            opacity: pillStyle.width > 0 ? 0.3 : 0,
          }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          style={{
            top: 0,
            height: '100%',
            borderRadius: '9999px',
            background: activeTabData ? `linear-gradient(135deg, ${activeTabData.color}, ${activeTabData.color}88)` : 'transparent',
            zIndex: -1,
          }}
        />

        {/* Background */}
        <div
          className="absolute inset-0 border border-white/10"
          style={{
            borderRadius: '9999px',
            overflow: 'hidden',
            backgroundColor: 'rgba(28, 28, 30, 0.7)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          }}
        />

        {/* Content */}
        <div ref={containerRef} className="relative h-full px-2 py-1">
          {/* Sliding pill */}
          <motion.div
            className="absolute bg-white/[0.07] border border-white/[0.1]"
            animate={{
              left: pillStyle.left,
              width: pillStyle.width,
            }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            style={{
              top: '4px',
              height: '42px',
              borderRadius: '9999px',
            }}
          />

          <div className="flex items-center justify-center gap-1 h-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  onClick={() => handleTabClick(tab.id)}
                  className="relative flex items-center justify-center touch-manipulation active:scale-[0.92] transition-transform duration-150"
                  style={{
                    height: '42px',
                    padding: isActive ? '0 14px' : '0 12px',
                    borderRadius: '9999px',
                    minWidth: '42px',
                  }}
                >
                  <div className="relative z-10 flex items-center gap-2">
                    {isActive ? (
                      <div className={`bg-gradient-to-br ${tab.gradient} p-0.5 rounded-xl`}>
                        <div className="bg-[#1C1C1E] rounded-xl p-1.5">
                          <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                        </div>
                      </div>
                    ) : (
                      <div className="p-2">
                        <Icon className="w-5 h-5 text-[#999999] transition-colors duration-300" strokeWidth={2} />
                      </div>
                    )}

                    <AnimatePresence mode="wait">
                      {isActive && (
                        <motion.span
                          key={`label-${tab.id}`}
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="text-white text-[13px] font-semibold whitespace-nowrap overflow-hidden pr-1"
                        >
                          {tab.shortLabel}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.nav>
  );
});
