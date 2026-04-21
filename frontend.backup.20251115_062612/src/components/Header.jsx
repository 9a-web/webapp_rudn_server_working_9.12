import React, { useState, useRef, useEffect } from 'react';
import { Menu, Calendar, Bell, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { headerItemVariants } from '../utils/animations';
import { MenuModal } from './MenuModal';
import { ProfileModal } from './ProfileModal';
import { rainbowConfetti } from '../utils/confetti';
import { botAPI } from '../services/api';

export const Header = React.memo(({ user, userSettings, onCalendarClick, onNotificationsClick, onAnalyticsClick, onAchievementsClick, hapticFeedback, onMenuStateChange }) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const clickTimerRef = useRef(null);
  const photoLoadedRef = useRef(false);

  // Загрузка фото профиля пользователя
  useEffect(() => {
    const loadProfilePhoto = async () => {
      if (user?.id && !photoLoadedRef.current) {
        setPhotoLoading(true);
        setPhotoError(false);
        try {
          const photoUrl = await botAPI.getUserProfilePhoto(user.id);
          if (photoUrl) {
            setProfilePhoto(photoUrl);
            photoLoadedRef.current = true;
            console.log('Profile photo loaded successfully:', photoUrl);
          } else {
            console.log('No profile photo available for user');
            setPhotoError(true);
          }
        } catch (error) {
          console.error('Failed to load profile photo:', error);
          setPhotoError(true);
        } finally {
          setPhotoLoading(false);
        }
      }
    };

    loadProfilePhoto();
  }, [user?.id]);

  // Уведомляем родительский компонент о состоянии MenuModal
  useEffect(() => {
    if (onMenuStateChange) {
      onMenuStateChange(isMenuOpen);
    }
  }, [isMenuOpen, onMenuStateChange]);

  const handleMenuClick = () => {
    if (hapticFeedback) hapticFeedback('impact', 'medium');
    setIsMenuOpen(!isMenuOpen);
  };

  const handleProfileClick = () => {
    if (hapticFeedback) hapticFeedback('impact', 'medium');
    setIsProfileOpen(!isProfileOpen);
    
    // Если фото не загрузилось, пробуем загрузить снова
    if (photoError && user?.id) {
      console.log('Retrying profile photo load...');
      photoLoadedRef.current = false;
      setPhotoError(false);
      setProfilePhoto(null);
      // Загрузка произойдёт автоматически через useEffect
      botAPI.getUserProfilePhoto(user.id).then(url => {
        if (url) {
          setProfilePhoto(url);
          photoLoadedRef.current = true;
        }
      });
    }
  };

  const handleLogoClick = () => {
    // Увеличиваем счётчик кликов
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);

    // Лёгкая вибрация при каждом клике
    if (hapticFeedback) hapticFeedback('impact', 'light');

    // Сбрасываем таймер
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    // Если достигли 10 кликов - запускаем пасхалку!
    if (newCount >= 10) {
      activateEasterEgg();
      setLogoClickCount(0);
      return;
    }

    // Сбрасываем счётчик через 2 секунды неактивности
    clickTimerRef.current = setTimeout(() => {
      setLogoClickCount(0);
    }, 2000);
  };

  const activateEasterEgg = () => {
    // Сильная вибрация
    if (hapticFeedback) hapticFeedback('notification', 'success');
    
    // Запускаем радужное конфетти!
    rainbowConfetti();
    
    // Показываем секретное сообщение
    setShowEasterEgg(true);
    
    // Скрываем через 4 секунды
    setTimeout(() => {
      setShowEasterEgg(false);
    }, 4000);
  };

  return (
    <>
      <header className="px-6 md:px-8 lg:px-10 py-5 md:py-6 flex items-center justify-between">
        {/* Left side - Logo and text */}
        <motion.div 
          className="flex items-center gap-3 md:gap-4 cursor-pointer select-none"
          custom={0}
          initial="initial"
          animate="animate"
          variants={headerItemVariants}
          onClick={handleLogoClick}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div 
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center"
            animate={logoClickCount > 0 ? {
              rotate: [0, -10, 10, -10, 10, 0],
              scale: [1, 1.1, 1]
            } : {}}
            transition={{ duration: 0.5 }}
          >
            <img 
              src="/LogoRudn.png" 
              alt="RUDN Logo" 
              className="w-full h-full object-contain"
            />
          </motion.div>
          <h1 className="text-sm md:text-base lg:text-lg font-bold tracking-tight leading-tight" style={{ color: '#E7E7E7' }}>
            <span className="block">Rudn</span>
            <span className="block">Schedule</span>
          </h1>
        </motion.div>

        {/* Right side - Calendar, Notifications, Menu, and Profile buttons */}
        <div className="flex items-center gap-2">
          {/* Calendar button */}
          <motion.button
            onClick={() => {
              if (hapticFeedback) hapticFeedback('impact', 'medium');
              onCalendarClick();
            }}
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl border border-white/10 transition-all duration-300 relative overflow-hidden group"
            style={{
              backgroundColor: 'rgba(52, 52, 52, 0.6)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)'
            }}
            aria-label="Open calendar"
            custom={1}
            initial="initial"
            animate="animate"
            variants={headerItemVariants}
          >
            {/* Gradient glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 via-teal-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <Calendar className="w-5 h-5 md:w-6 md:h-6 relative z-10" style={{ color: '#E7E7E7' }} />
          </motion.button>

          {/* Notifications button */}
          <motion.button
            onClick={() => {
              if (hapticFeedback) hapticFeedback('impact', 'medium');
              onNotificationsClick();
            }}
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl border border-white/10 transition-all duration-300 relative overflow-hidden group"
            style={{
              backgroundColor: 'rgba(52, 52, 52, 0.6)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)'
            }}
            aria-label="Open notifications"
            custom={2}
            initial="initial"
            animate="animate"
            variants={headerItemVariants}
          >
            {/* Gradient glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-400/20 via-rose-400/20 to-red-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <Bell className="w-5 h-5 md:w-6 md:h-6 relative z-10" style={{ color: '#E7E7E7' }} />
          </motion.button>

          {/* Menu button */}
          <motion.button
            onClick={handleMenuClick}
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl border border-white/10 transition-all duration-300 relative overflow-hidden group"
            style={{
              backgroundColor: 'rgba(52, 52, 52, 0.6)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)'
            }}
            aria-label="Open menu"
            custom={3}
            initial="initial"
            animate="animate"
            variants={headerItemVariants}
          >
            {/* Gradient glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 via-pink-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <Menu className="w-5 h-5 md:w-6 md:h-6 relative z-10" style={{ color: '#E7E7E7' }} />
          </motion.button>

          {/* Profile button */}
          {user && (
            <motion.button
              onClick={handleProfileClick}
              className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-full transition-all duration-300 relative overflow-hidden group border-2 border-white/10 hover:border-cyan-400/30"
              style={{
                backgroundColor: 'rgba(52, 52, 52, 0.6)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)'
              }}
              aria-label="Open profile"
              custom={4}
              initial="initial"
              animate="animate"
              variants={headerItemVariants}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Gradient glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 via-blue-400/20 to-indigo-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
              
              {profilePhoto && !photoError ? (
                <img 
                  src={profilePhoto} 
                  alt="Profile Avatar" 
                  className="w-full h-full object-cover rounded-full relative z-10"
                  style={{ objectPosition: 'center' }}
                  onLoad={() => {
                    console.log('Profile photo loaded into img element');
                  }}
                  onError={(e) => {
                    // Если не удалось загрузить фото, показываем иконку
                    console.error('Failed to load profile photo image, showing default icon');
                    setPhotoError(true);
                    setProfilePhoto(null);
                    photoLoadedRef.current = false;
                  }}
                />
              ) : photoLoading ? (
                <div className="w-full h-full flex items-center justify-center relative z-10">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <User 
                  className="w-5 h-5 md:w-6 md:h-6 relative z-10" 
                  style={{ color: '#E7E7E7' }} 
                />
              )}
            </motion.button>
          )}
        </div>
      </header>

      {/* Menu Modal */}
      <MenuModal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onCalendarClick={onCalendarClick}
        onNotificationsClick={onNotificationsClick}
        onAnalyticsClick={onAnalyticsClick}
        onAchievementsClick={onAchievementsClick}
        hapticFeedback={hapticFeedback}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        userSettings={userSettings}
        profilePhoto={profilePhoto}
        hapticFeedback={hapticFeedback}
      />

      {/* Easter Egg Message */}
      <AnimatePresence>
        {showEasterEgg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -50 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              transition: {
                type: "spring",
                damping: 15,
                stiffness: 300
              }
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.8,
              y: -50,
              transition: { duration: 0.3 }
            }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 rounded-2xl shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #A3F7BF, #FFE66D, #FFB4D1, #C4A3FF, #80E8FF)',
              backgroundSize: '300% 300%',
              animation: 'gradient 3s ease infinite'
            }}
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="text-center"
            >
              <p className="text-2xl font-bold text-white mb-1">
                🎉 Секрет раскрыт! 🎉
              </p>
              <p className="text-sm text-white/90">
                Ты нашёл пасхалку! {logoClickCount > 10 ? `(${logoClickCount} кликов!)` : ''}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
