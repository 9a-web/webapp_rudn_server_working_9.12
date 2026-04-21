import React from 'react';
import { Languages, BarChart3, Trophy, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

export const MenuModal = React.memo(({ 
  isOpen, 
  onClose, 
  onCalendarClick, 
  onNotificationsClick, 
  onAnalyticsClick, 
  onAchievementsClick,
  hapticFeedback 
}) => {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    if (hapticFeedback) hapticFeedback('impact', 'light');
    const newLang = i18n.language === 'ru' ? 'en' : 'ru';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  const handleMenuItemClick = (action) => {
    if (hapticFeedback) hapticFeedback('impact', 'medium');
    action();
    onClose();
  };

  const menuItems = [
    {
      id: 'achievements',
      icon: Trophy,
      label: t('menu.achievements', 'Достижения'),
      color: '#FFE66D',
      action: onAchievementsClick,
      show: !!onAchievementsClick,
      disabled: false
    },
    {
      id: 'analytics',
      icon: BarChart3,
      label: t('menu.analytics', 'Аналитика'),
      color: '#80E8FF',
      action: onAnalyticsClick,
      show: !!onAnalyticsClick
    }
  ];

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const modalVariants = {
    hidden: { 
      opacity: 0,
      scale: 0.9,
      y: -20
    },
    visible: { 
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: -20,
      transition: {
        duration: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (custom) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: custom * 0.1,
        type: "spring",
        stiffness: 300,
        damping: 25
      }
    })
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed top-20 right-6 md:right-8 lg:right-10 z-50 w-72 md:w-80"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div 
              className="rounded-2xl shadow-2xl overflow-hidden border border-white/10"
              style={{
                backgroundColor: 'rgba(42, 42, 42, 0.75)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)'
              }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">
                  {t('menu.title', 'Меню')}
                </h3>
                <button
                  onClick={() => {
                    if (hapticFeedback) hapticFeedback('impact', 'light');
                    onClose();
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5 text-gray-300" />
                </button>
              </div>

              {/* Menu Items */}
              <div className="p-3">
                {menuItems.filter(item => item.show).map((item, index) => {
                  const Icon = item.icon;
                  const isDisabled = item.disabled;
                  
                  return (
                    <motion.button
                      key={item.id}
                      custom={index}
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      onClick={isDisabled ? undefined : () => handleMenuItemClick(item.action)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group ${
                        isDisabled 
                          ? 'opacity-40 cursor-not-allowed' 
                          : 'hover:bg-white/10 cursor-pointer'
                      }`}
                    >
                      <div 
                        className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${
                          !isDisabled && 'group-hover:scale-110'
                        }`}
                        style={{ backgroundColor: `${item.color}20` }}
                      >
                        <Icon 
                          className="w-6 h-6" 
                          style={{ color: item.color }}
                        />
                      </div>
                      <span className="text-base font-medium text-white flex-1 text-left">
                        {item.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-black/20 border-t border-white/10">
                <p className="text-xs text-gray-400 text-center">
                  {t('menu.footer', 'RUDN Schedule')}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});