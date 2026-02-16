import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Gift, ArrowRight } from 'lucide-react';

const BACKEND_URL = (import.meta.env?.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

/**
 * Модальное окно, показываемое при переходе по реферальной ссылке (после онбординга).
 * 
 * Props:
 * - isOpen: boolean
 * - config: { title, description, image_url, button_text, button_action, button_url, button_navigate_to, reward_points }
 * - onClose: () => void
 * - onNavigate: (tabName) => void  — переход к разделу приложения
 * - onReward: (points) => void     — начисление награды
 */
const ReferralModal = ({ isOpen, config, onClose, onNavigate, onReward }) => {
  if (!isOpen || !config) return null;

  const handleButtonClick = () => {
    switch (config.button_action) {
      case 'open_url':
        if (config.button_url) {
          // В Telegram открываем через openLink, в браузере — через window.open
          if (window.Telegram?.WebApp?.openLink) {
            window.Telegram.WebApp.openLink(config.button_url);
          } else {
            window.open(config.button_url, '_blank');
          }
        }
        onClose();
        break;
      case 'navigate':
        if (config.button_navigate_to && onNavigate) {
          onNavigate(config.button_navigate_to);
        }
        onClose();
        break;
      case 'reward':
        if (onReward && config.reward_points > 0) {
          onReward(config.reward_points);
        }
        onClose();
        break;
      case 'close':
      default:
        onClose();
        break;
    }
  };

  const getButtonIcon = () => {
    switch (config.button_action) {
      case 'open_url': return <ExternalLink className="w-4 h-4" />;
      case 'navigate': return <ArrowRight className="w-4 h-4" />;
      case 'reward': return <Gift className="w-4 h-4" />;
      default: return null;
    }
  };

  const imageUrl = config.image_url 
    ? (config.image_url.startsWith('http') ? config.image_url : `${BACKEND_URL}${config.image_url}`)
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm bg-[#1C1C1E] rounded-3xl overflow-hidden border border-white/[0.08] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Image */}
            {imageUrl && (
              <div className="w-full aspect-[4/3] overflow-hidden">
                <img
                  src={imageUrl}
                  alt={config.title || ''}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6 space-y-4">
              {config.title && (
                <h2 className="text-xl font-bold text-white text-center leading-tight">
                  {config.title}
                </h2>
              )}
              
              {config.description && (
                <p className="text-sm text-gray-400 text-center leading-relaxed">
                  {config.description}
                </p>
              )}

              {/* Reward badge */}
              {config.button_action === 'reward' && config.reward_points > 0 && (
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/20">
                    <Gift className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-amber-400">+{config.reward_points} баллов</span>
                  </div>
                </div>
              )}

              {/* Button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleButtonClick}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:shadow-emerald-500/10"
              >
                {getButtonIcon()}
                {config.button_text || 'OK'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReferralModal;
