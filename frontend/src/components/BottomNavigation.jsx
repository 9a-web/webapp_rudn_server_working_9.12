import React, { useCallback, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Compass, NotebookText, FileCheck, AudioLines, Users, Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const BottomNavigation = React.memo(({ activeTab = 'home', onTabChange, hapticFeedback, isHidden = false, onBackFromFriends }) => {
  const { t } = useTranslation();

  const tabs = [
    { id: 'home', icon: Compass, shortLabel: t('bottomNav.homeShort', 'Главная'), gradient: 'from-green-400 to-cyan-400', color: '#34d399' },
    { id: 'tasks', icon: NotebookText, shortLabel: 'Продуктивность', gradient: 'from-yellow-400 to-orange-400', color: '#fbbf24' },
    { id: 'journal', icon: FileCheck, shortLabel: t('bottomNav.journalShort', 'Журнал'), gradient: 'from-indigo-400 to-blue-400', color: '#818cf8' },
    { id: 'music', icon: Music, shortLabel: t('bottomNav.musicShort', 'Музыка'), gradient: 'from-pink-400 to-red-400', color: '#f472b6' },
  ];

  const outerRef = useRef(null);
  const tabRefs = useRef({});
  const backBtnRef = useRef(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const targetEl = activeTab === 'friends' ? backBtnRef.current : tabRefs.current[activeTab];
    if (!targetEl) return;
    const oRect = outer.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();
    setPillStyle({ left: tRect.left - oRect.left, width: tRect.width });
  }, [activeTab]);

  useLayoutEffect(() => {
    measure();
  }, [activeTab, measure]);

  useEffect(() => {
    const targetEl = activeTab === 'friends' ? backBtnRef.current : tabRefs.current[activeTab];
    if (!targetEl) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(targetEl);

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

  const activeTabData = activeTab === 'friends'
    ? { id: 'friends', color: '#ef4444' }
    : tabs.find(t => t.id === activeTab);

  const showBackButton = activeTab === 'friends' && onBackFromFriends;

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0, x: '-50%' }}
      animate={{ y: isHidden ? 100 : 0, opacity: isHidden ? 0 : 1, x: '-50%' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed bottom-4 z-50"
      style={{ left: '50%', overflow: 'visible' }}
    >
      {/* Outer wrapper — pill измеряется относительно него */}
      <div ref={outerRef} className="relative flex items-center gap-1.5" style={{ height: '50px' }}>

        {/* Glow за pill */}
        <motion.div
          className="absolute pointer-events-none blur-2xl"
          animate={{ left: pillStyle.left, width: pillStyle.width, opacity: pillStyle.width > 0 ? 0.3 : 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          style={{
            top: 0, height: '100%', borderRadius: '9999px', zIndex: 0,
            background: activeTabData ? `linear-gradient(135deg, ${activeTabData.color}, ${activeTabData.color}88)` : 'transparent',
          }}
        />

        {/* Sliding pill — перемещается между вкладками И кнопкой */}
        <motion.div
          className="absolute bg-white/[0.07] border border-white/[0.1] pointer-events-none"
          animate={{ left: pillStyle.left, width: pillStyle.width }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          style={{ top: '4px', height: '42px', borderRadius: '9999px', zIndex: 2 }}
        />

        {/* Main nav bar */}
        <div className="relative" style={{ height: '50px' }}>
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

          {/* Tabs */}
          <div className="relative h-full px-2 py-1">
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
            </div>
          </div>
        </div>

        {/* Круглая кнопка "Назад" — справа от навбара */}
        <AnimatePresence>
          {showBackButton && (
            <motion.button
              ref={backBtnRef}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={() => {
                if (hapticFeedback?.impactOccurred) {
                  try { hapticFeedback.impactOccurred('light'); } catch (e) {}
                }
                onBackFromFriends();
              }}
              className="relative flex items-center justify-center touch-manipulation active:scale-[0.92] transition-transform duration-150 border border-white/10"
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(28, 28, 30, 0.7)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                flexShrink: 0,
                zIndex: 3,
              }}
            >
              <Undo2 className="w-5 h-5" style={{ color: '#ef4444' }} strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
});
