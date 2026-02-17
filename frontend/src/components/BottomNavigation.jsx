import React, { useCallback, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Home, ClipboardList, FileCheck, Music, Users, Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const BottomNavigation = React.memo(({ activeTab = 'home', onTabChange, hapticFeedback, isHidden = false, onBackFromFriends }) => {
  const { t } = useTranslation();

  const tabs = [
    { id: 'home', icon: Home, shortLabel: t('bottomNav.homeShort', 'Главная'), gradient: 'from-green-400 to-cyan-400', color: '#34d399' },
    { id: 'tasks', icon: ClipboardList, shortLabel: t('bottomNav.tasksShort', 'Задачи'), gradient: 'from-yellow-400 to-orange-400', color: '#fbbf24' },
    { id: 'journal', icon: FileCheck, shortLabel: t('bottomNav.journalShort', 'Журнал'), gradient: 'from-indigo-400 to-blue-400', color: '#818cf8' },
    { id: 'music', icon: Music, shortLabel: t('bottomNav.musicShort', 'Музыка'), gradient: 'from-pink-400 to-red-400', color: '#f472b6' },
  ];

  const containerRef = useRef(null);
  const tabRefs = useRef({});
  const backBtnRef = useRef(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const container = containerRef.current;
    const activeEl = activeTab === 'friends' ? backBtnRef.current : tabRefs.current[activeTab];
    if (!container || !activeEl) return;
    const cRect = container.getBoundingClientRect();
    const tRect = activeEl.getBoundingClientRect();
    setPillStyle({ left: tRect.left - cRect.left, width: tRect.width });
  }, [activeTab]);

  // Re-measure whenever activeTab changes AND continuously via ResizeObserver
  useLayoutEffect(() => {
    measure();
  }, [activeTab, measure]);

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (!el) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    // Also re-measure a few times during the text expand animation
    const t1 = setTimeout(measure, 50);
    const t2 = setTimeout(measure, 150);
    const t3 = setTimeout(measure, 300);

    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', measure);
    };
  }, [activeTab, measure]);

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
        {/* Glow */}
        <motion.div
          className="absolute pointer-events-none blur-2xl"
          animate={{ left: pillStyle.left, width: pillStyle.width, opacity: pillStyle.width > 0 ? 0.3 : 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          style={{
            top: 0, height: '100%', borderRadius: '9999px', zIndex: -1,
            background: activeTabData ? `linear-gradient(135deg, ${activeTabData.color}, ${activeTabData.color}88)` : 'transparent',
          }}
        />

        {/* Background */}
        <div
          className="absolute inset-0 border border-white/10"
          style={{
            borderRadius: '9999px', overflow: 'hidden',
            backgroundColor: 'rgba(28, 28, 30, 0.7)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          }}
        />

        {/* Content */}
        <div ref={containerRef} className="relative h-full px-2 py-1">
          {/* Sliding pill — follows measured left+width */}
          <motion.div
            className="absolute bg-white/[0.07] border border-white/[0.1]"
            animate={{ left: pillStyle.left, width: pillStyle.width }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            style={{ top: '4px', height: '42px', borderRadius: '9999px' }}
          />

          <div className="flex items-center justify-center gap-0 h-full">
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
                    paddingLeft: isActive ? '6px' : '8px',
                    paddingRight: isActive ? '14px' : '8px',
                    borderRadius: '9999px',
                    minWidth: isActive ? '42px' : '38px',
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

                    {isActive && (
                      <span className="text-white text-[13px] font-semibold whitespace-nowrap">
                        {tab.shortLabel}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Кнопка "Назад" из раздела Друзья */}
            {activeTab === 'friends' && onBackFromFriends && (
              <motion.button
                key="back-from-friends"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => {
                  if (hapticFeedback?.impactOccurred) {
                    try { hapticFeedback.impactOccurred('light'); } catch (e) {}
                  }
                  onBackFromFriends();
                }}
                className="relative flex items-center justify-center touch-manipulation active:scale-[0.92] transition-transform duration-150 ml-1"
                style={{
                  height: '42px',
                  paddingLeft: '8px',
                  paddingRight: '8px',
                  borderRadius: '9999px',
                  minWidth: '38px',
                }}
              >
                <div className="p-2">
                  <Undo2 className="w-5 h-5 text-[#c084fc] transition-colors duration-300" strokeWidth={2} />
                </div>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
});
