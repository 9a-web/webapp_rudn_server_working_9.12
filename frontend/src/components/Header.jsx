import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, User, Sparkles, ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { headerItemVariants } from '../utils/animations';
import { MenuModal } from './MenuModal';
import { ProfileModal } from './ProfileModal';
import { rainbowConfetti } from '../utils/confetti';
import { botAPI } from '../services/api';

export const Header = React.memo(({ user, userSettings, onNotificationsClick, onAnalyticsClick, onAchievementsClick, hapticFeedback, onMenuStateChange, onProfileStateChange, onThemeChange, unreadNotificationsCount = 0, hasNewNotification = false, onQRScanned }) => {
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

  // Уведомляем родительский компонент о состоянии ProfileModal
  useEffect(() => {
    if (onProfileStateChange) {
      onProfileStateChange(isProfileOpen);
    }
  }, [isProfileOpen, onProfileStateChange]);

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
      <header 
        className="px-6 md:px-8 lg:px-10 py-5 md:py-6 flex items-center justify-between"
        style={{
          paddingTop: 'calc(var(--header-safe-padding) + 1.25rem)', // 1.25rem = py-5
          paddingBottom: '1.25rem' // py-5
        }}
      >
        {/* Left side - Logo and text */}
        <motion.div 
          className="flex items-center gap-3 md:gap-4 cursor-pointer select-none relative"
          custom={0}
          initial="initial"
          animate="animate"
          variants={headerItemVariants}
          onClick={handleLogoClick}
          whileTap={{ scale: 0.95 }}
        >
          {/* Индикатор прогресса кликов */}
          <AnimatePresence>
            {logoClickCount > 0 && logoClickCount < 10 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center"
              >
                {/* Кольцо прогресса */}
                <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                  />
                  <motion.circle
                    cx="10"
                    cy="10"
                    r="8"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={50.27}
                    initial={{ strokeDashoffset: 50.27 }}
                    animate={{ strokeDashoffset: 50.27 - (50.27 * logoClickCount / 10) }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#67E8F9" />
                      <stop offset="50%" stopColor="#A78BFA" />
                      <stop offset="100%" stopColor="#F472B6" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Число кликов */}
                <span 
                  className="absolute text-[9px] font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #67E8F9, #A78BFA)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {logoClickCount}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div 
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center relative"
            animate={logoClickCount > 0 ? {
              rotate: [0, -8, 8, -4, 4, 0],
              scale: [1, 1.08, 1]
            } : {}}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            {/* Свечение при кликах */}
            <AnimatePresence>
              {logoClickCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.4, scale: 1.2 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 rounded-full blur-lg"
                  style={{
                    background: `linear-gradient(135deg, 
                      rgba(103, 232, 249, ${0.1 + logoClickCount * 0.05}), 
                      rgba(167, 139, 250, ${0.1 + logoClickCount * 0.05}), 
                      rgba(244, 114, 182, ${0.1 + logoClickCount * 0.05})
                    )`
                  }}
                />
              )}
            </AnimatePresence>
            <img 
              src="/logorudn.svg" 
              alt="RUDN Logo" 
              className="w-full h-full object-contain relative z-10"
            />
          </motion.div>
          <h1 className="text-sm md:text-base lg:text-lg font-bold tracking-tight leading-tight" style={{ color: '#E7E7E7' }}>
            <span className="block">Rudn</span>
            <span className="block">Schedule</span>
          </h1>
        </motion.div>

        {/* Right side - Notifications, Menu, and Profile buttons */}
        <div className="flex items-center gap-2">
          {/* Notifications button */}
          <motion.button
            onClick={() => {
              if (hapticFeedback) hapticFeedback('impact', 'medium');
              onNotificationsClick();
            }}
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl border border-white/10 transition-all duration-300 relative group"
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
            <div className="absolute inset-0 rounded-xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-400/20 via-rose-400/20 to-red-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            
            {/* Pulse ripple waves animation - при новом уведомлении */}
            <AnimatePresence>
              {hasNewNotification && (
                <>
                  {/* Первая волна - очень плавная анимация */}
                  <motion.div
                    key="ripple1"
                    className="absolute inset-0 rounded-xl border border-pink-500/40"
                    initial={{ scale: 1, opacity: 0 }}
                    animate={{ 
                      scale: [1, 1.6],
                      opacity: [0.5, 0]
                    }}
                    transition={{ 
                      duration: 7, 
                      repeat: Infinity,
                      ease: [0.25, 0.1, 0.25, 1]
                    }}
                  />
                  {/* Вторая волна с задержкой */}
                  <motion.div
                    key="ripple2"
                    className="absolute inset-0 rounded-xl border border-red-500/30"
                    initial={{ scale: 1, opacity: 0 }}
                    animate={{ 
                      scale: [1, 1.8],
                      opacity: [0.4, 0]
                    }}
                    transition={{ 
                      duration: 7, 
                      repeat: Infinity,
                      delay: 2.33,
                      ease: [0.25, 0.1, 0.25, 1]
                    }}
                  />
                  {/* Третья волна */}
                  <motion.div
                    key="ripple3"
                    className="absolute inset-0 rounded-xl border border-purple-500/25"
                    initial={{ scale: 1, opacity: 0 }}
                    animate={{ 
                      scale: [1, 2],
                      opacity: [0.3, 0]
                    }}
                    transition={{ 
                      duration: 7, 
                      repeat: Infinity,
                      delay: 4.66,
                      ease: [0.25, 0.1, 0.25, 1]
                    }}
                  />
                  {/* Свечение кнопки - мягкое пульсирование */}
                  <motion.div
                    key="glow"
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-pink-500/20 via-red-500/20 to-purple-500/20"
                    initial={{ opacity: 0.15 }}
                    animate={{ 
                      opacity: [0.15, 0.4, 0.15]
                    }}
                    transition={{ 
                      duration: 7, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                </>
              )}
            </AnimatePresence>
            
            {/* Bell icon с анимацией покачивания - плавное и синхронизированное */}
            <motion.div
              className="relative z-10"
              animate={hasNewNotification ? {
                rotate: [0, -8, 8, -5, 5, -2, 2, 0],
                scale: [1, 1.05, 1.05, 1.02, 1.02, 1, 1, 1],
              } : {}}
              transition={hasNewNotification ? {
                duration: 1.4,
                repeat: Infinity,
                repeatDelay: 5.6,
                ease: "easeInOut"
              } : {}}
            >
              <Bell className="w-5 h-5 md:w-6 md:h-6" style={{ color: hasNewNotification ? '#ff6b9d' : '#E7E7E7' }} />
            </motion.div>
            
            {/* Unread notifications badge */}
            {unreadNotificationsCount > 0 && (
              <motion.span 
                className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 z-30 shadow-lg"
                animate={hasNewNotification ? {
                  scale: [1, 1.1, 1],
                } : {}}
                transition={hasNewNotification ? {
                  duration: 7,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : {}}
              >
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </motion.span>
            )}
          </motion.button>

          {/* Menu button - скрыта */}
          {/* <motion.button
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
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 via-pink-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <Menu className="w-5 h-5 md:w-6 md:h-6 relative z-10" style={{ color: '#E7E7E7' }} />
          </motion.button> */}

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
        onThemeChange={onThemeChange}
      />

      {/* Easter Egg Message - Элегантное уведомление */}
      <AnimatePresence>
        {showEasterEgg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
              opacity: 1, 
              scale: 1
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.95
            }}
            transition={{
              type: "spring",
              damping: 20,
              stiffness: 300,
              mass: 0.8
            }}
            className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
          >
            {/* Внешнее свечение */}
            <div 
              className="absolute -inset-4 rounded-3xl opacity-60 blur-2xl"
              style={{
                background: 'linear-gradient(135deg, #67E8F9, #A78BFA, #F472B6)',
              }}
            />
            
            {/* Основной контейнер */}
            <div 
              className="relative px-8 py-5 rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
              style={{
                background: 'rgba(20, 20, 25, 0.85)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              }}
            >
              {/* Градиентная полоска сверху */}
              <motion.div 
                className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                style={{
                  background: 'linear-gradient(90deg, #67E8F9, #A78BFA, #F472B6, #34D399)',
                  backgroundSize: '200% 100%',
                }}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              />
              
              {/* Мягкое внутреннее свечение */}
              <div 
                className="absolute inset-0 rounded-2xl opacity-30"
                style={{
                  background: 'radial-gradient(ellipse at center top, rgba(167, 139, 250, 0.3), transparent 70%)',
                }}
              />

              {/* Контент */}
              <div className="relative text-center">
                {/* Иконка */}
                <motion.div 
                  className="text-3xl mb-2"
                  animate={{
                    scale: [1, 1.15, 1],
                    rotate: [0, -5, 5, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Sparkles className="w-8 h-8" style={{ color: '#A78BFA' }} />
                </motion.div>
                
                {/* Заголовок */}
                <h3 
                  className="text-lg font-semibold mb-1"
                  style={{
                    background: 'linear-gradient(135deg, #67E8F9, #A78BFA, #F472B6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Секрет раскрыт!
                </h3>
                
                {/* Подзаголовок */}
                <p className="text-sm text-white/70">
                  Ты нашёл пасхалку
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
