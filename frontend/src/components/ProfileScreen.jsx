import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const ProfileScreen = ({ isOpen, onClose, user, profilePhoto, hapticFeedback }) => {
  if (!user) return null;

  // Первая буква имени для fallback-аватара
  const initial = (user.first_name?.[0] || user.username?.[0] || '?').toUpperCase();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
          style={{ backgroundColor: '#000000' }}
        >
          {/* Кнопка назад */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            onClick={() => {
              if (hapticFeedback) hapticFeedback('impact', 'light');
              onClose();
            }}
            className="absolute top-0 left-0 p-4 z-10"
            style={{
              paddingTop: 'calc(var(--header-safe-padding, 0px) + 16px)',
            }}
          >
            <ArrowLeft className="w-6 h-6 text-white/70" />
          </motion.button>

          {/* Аватар по центру */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{
              type: 'spring',
              damping: 22,
              stiffness: 260,
              delay: 0.08,
            }}
            className="relative"
          >
            <div
              className="w-28 h-28 rounded-full overflow-hidden"
              style={{
                border: '3px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 0 60px rgba(255, 255, 255, 0.06)',
              }}
            >
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-4xl font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#FFFFFF',
                  }}
                >
                  {initial}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileScreen;
