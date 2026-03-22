import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const ProfileScreen = ({ isOpen, onClose, user, profilePhoto, hapticFeedback }) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!user) return null;

  const initial = (user.first_name?.[0] || user.username?.[0] || '?').toUpperCase();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-[200] flex flex-col items-center"
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

          {/* Аватар — 87px от верха */}
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
            style={{ marginTop: '87px' }}
          >
            <div
              className="overflow-hidden relative"
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '38px',
                border: '3px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 0 60px rgba(255, 255, 255, 0.06)',
              }}
            >
              {/* Fallback — всегда в DOM, виден когда фото не загрузилось */}
              <div
                className="absolute inset-0 flex items-center justify-center text-4xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#FFFFFF',
                }}
              >
                {initial}
              </div>

              {/* Фото — всегда в DOM поверх fallback, скрыто пока не загрузится */}
              {profilePhoto && (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ opacity: imgLoaded ? 1 : 0 }}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => {}}
                />
              )}
            </div>
          </motion.div>

          {/* Online/Offline бейдж */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="flex items-center gap-2"
            style={{
              marginTop: '12px',
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: user.is_online ? '#4ADE80' : '#EF4444',
                boxShadow: user.is_online ? '0 0 6px rgba(74, 222, 128, 0.5)' : '0 0 6px rgba(239, 68, 68, 0.5)',
              }}
            />
            <span
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '14px',
                color: '#FFFFFF',
              }}
            >
              {user.is_online ? 'Online' : 'Offline'}
            </span>
          </motion.div>

          {/* Юзернейм или имя */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            style={{
              marginTop: '16px',
              fontFamily: "'Proxima Nova ExCn', sans-serif",
              fontWeight: 800,
              fontSize: '48px',
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 1.1,
            }}
          >
            {(user.username || user.first_name || '').toUpperCase()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileScreen;
