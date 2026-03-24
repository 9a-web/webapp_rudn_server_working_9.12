import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Trophy } from 'lucide-react';

const TABS = [
  { id: 'general', label: 'Общее' },
  { id: 'friends', label: 'Друзья' },
  { id: 'materials', label: 'Материалы' },
];

const ProfileScreen = ({ isOpen, onClose, user, userSettings, profilePhoto, hapticFeedback }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

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
            <ChevronLeft style={{ width: '31px', height: '31px', color: 'rgba(255,255,255,0.7)' }} />
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
            style={{ marginTop: '67px' }}
          >
            <div
              className="overflow-hidden relative"
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '44px',
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

          {/* Online/Offline и Level бейджи */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="flex items-center"
            style={{ marginTop: '12px', gap: '16px' }}
          >
            {/* Online/Offline */}
            <div
              className="flex items-center gap-2"
              style={{
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
                  fontSize: '12px',
                  color: '#FFFFFF',
                }}
              >
                {user.is_online ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Level */}
            <div
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                backgroundColor: '#F7B84B',
              }}
            >
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '12px',
                  color: '#1c1c1c',
                }}
              >
                LV. {user.level || 74}
              </span>
            </div>
          </motion.div>

          {/* Юзернейм или имя */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            style={{
              marginTop: '8px',
              fontFamily: "'Proxima Nova ExCn', sans-serif",
              fontWeight: 800,
              fontSize: '56px',
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 1.1,
            }}
          >
            {(user.username || user.first_name || '').toUpperCase()}
          </motion.div>

          {/* Группа */}
          {userSettings?.group_name && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.3 }}
              style={{
                marginTop: '-6px',
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '14px',
                color: '#FF4E9D',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {userSettings.group_name}
              <Trophy style={{ width: '16px', height: '16px', color: '#FFB54E', marginLeft: '8px', flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#FFB54E',
                  marginLeft: '3px',
                }}
              >
                (#{user.rank || 1})
              </span>
            </motion.div>
          )}

          {/* Друзья и $RDN */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="flex items-start justify-center"
            style={{ marginTop: '10px', gap: '40px', marginBottom: '30px' }}
          >
            {/* Количество друзей */}
            <div className="flex flex-col items-center">
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '18px',
                  color: '#FFBE4E',
                  lineHeight: 1.2,
                }}
              >
                {user.friends_count || 0}
              </span>
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#FFFFFF',
                  marginTop: '2px',
                }}
              >
                {(() => {
                  const n = user.friends_count || 0;
                  const mod10 = n % 10;
                  const mod100 = n % 100;
                  if (mod100 >= 11 && mod100 <= 19) return 'Друзей';
                  if (mod10 === 1) return 'Друг';
                  if (mod10 >= 2 && mod10 <= 4) return 'Друга';
                  return 'Друзей';
                })()}
              </span>
            </div>

            {/* Уровень */}
            <div className="flex flex-col items-center">
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '18px',
                  lineHeight: 1.2,
                  ...(() => {
                    const tier = (user.tier || 'premium').toLowerCase();
                    if (tier === 'premium') return {
                      background: 'linear-gradient(90deg, #FF4EEA 0%, #FFCE2E 50%, #FF8717 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    };
                    const colors = { base: '#4D85FF', medium: '#FFA04D', rare: '#B84DFF' };
                    return { color: colors[tier] || '#4D85FF' };
                  })(),
                }}
              >
                {(() => {
                  const tier = (user.tier || 'premium').toLowerCase();
                  const names = { base: 'Base', medium: 'Medium', rare: 'Rare', premium: 'Premium' };
                  return names[tier] || 'Base';
                })()}
              </span>
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#FFFFFF',
                  marginTop: '2px',
                }}
              >
                Уровень
              </span>
            </div>

            {/* $RDN */}
            <div className="flex flex-col items-center">
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '18px',
                  color: '#FFBE4E',
                  lineHeight: 1.2,
                }}
              >
                {user.rdn_balance || 0}
              </span>
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#FFFFFF',
                  marginTop: '2px',
                }}
              >
                $RDN
              </span>
            </div>
          </motion.div>

          {/* Нижний прямоугольник с свечением */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.35, ease: 'easeOut' }}
            style={{
              marginTop: 'auto',
              width: '100%',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {/* Свечение наверх */}
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% - 32px)',
                left: 0,
                width: '100%',
                height: '257px',
                background: 'linear-gradient(180deg, rgba(248, 185, 76, 0) 0%, rgba(248, 185, 76, 0.30) 100%)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            {/* Сам прямоугольник */}
            <div
              style={{
                width: '100%',
                minHeight: '430px',
                borderRadius: '32px 32px 0 0',
                background: 'linear-gradient(180deg, #1E1D1A 0%, #1C1C1C 100%)',
                position: 'relative',
                zIndex: 1,
                padding: '24px 20px 0',
              }}
            >
              {/* Табы */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '28px',
                }}
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (hapticFeedback) hapticFeedback('impact', 'light');
                    }}
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 600,
                      fontSize: '14px',
                      color: activeTab === tab.id ? '#F8B94C' : '#F4F3FC',
                      background: 'none',
                      border: activeTab === tab.id ? '2px solid #F8B94C' : '2px solid transparent',
                      borderRadius: '12px',
                      padding: '6px 14px',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'color 0.2s ease, border-color 0.2s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileScreen;
