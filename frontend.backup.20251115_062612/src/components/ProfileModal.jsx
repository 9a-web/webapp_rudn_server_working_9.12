import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const ProfileModal = ({ 
  isOpen, 
  onClose, 
  user, 
  userSettings,
  profilePhoto,
  hapticFeedback 
}) => {
  const modalRef = useRef(null);

  // Закрытие при клике вне модального окна
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Закрытие при нажатии ESC
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!user) return null;

  // Проверяем, зашел ли пользователь через Telegram или через сайт напрямую
  const isTelegramUser = typeof window !== 'undefined' && 
                          window.Telegram?.WebApp?.initDataUnsafe?.user;
  
  // Формируем полное имя
  const fullName = isTelegramUser 
    ? ([user.first_name, user.last_name].filter(Boolean).join(' ') || 'Пользователь')
    : 'Авторизуйтесь через';
  
  // Получаем username
  const username = isTelegramUser && user.username ? `@${user.username}` : '';

  // Получаем название группы
  const groupName = isTelegramUser 
    ? (userSettings?.group_name || userSettings?.group_id || 'Группа не выбрана')
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay с затемнением */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100]"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            onClick={onClose}
          />

          {/* Модальное окно профиля */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.85, y: -10 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              transition: {
                type: "spring",
                damping: 25,
                stiffness: 400
              }
            }}
            exit={{ 
              opacity: 0, 
              scale: 0.85,
              y: -10,
              transition: { duration: 0.15 }
            }}
            className="fixed z-[101] flex flex-col items-center"
            style={{
              top: '68px',
              right: '20px',
              width: '260px',
              padding: '28px 20px',
              borderRadius: '28px',
              backgroundColor: 'rgba(42, 42, 42, 0.75)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Аватар пользователя */}
            <div 
              className="relative mb-4"
              style={{
                width: '88px',
                height: '88px',
              }}
            >
              <div
                className="w-full h-full rounded-full overflow-hidden"
                style={{
                  border: '3px solid rgba(255, 255, 255, 0.12)',
                  background: isTelegramUser 
                    ? 'linear-gradient(145deg, #404050, #2D2D3A)'
                    : 'linear-gradient(145deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                }}
              >
                {isTelegramUser ? (
                  profilePhoto ? (
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
                      {user.first_name?.[0]?.toUpperCase() || '👤'}
                    </div>
                  )
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center text-4xl"
                    style={{
                      color: '#FFFFFF',
                    }}
                  >
                    🔒
                  </div>
                )}
              </div>
            </div>

            {/* Имя пользователя с градиентом */}
            {isTelegramUser ? (
              <h2 
                className="text-[19px] font-bold text-center mb-3 leading-tight px-2"
                style={{
                  background: 'linear-gradient(100deg, #9AB8E8 0%, #D4A5E8 35%, #FFB4D1 70%, #FFFFFF 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 2px 8px rgba(154, 184, 232, 0.25))',
                  fontWeight: '700',
                  letterSpacing: '-0.01em',
                }}
              >
                {fullName}
              </h2>
            ) : (
              <div className="text-center mb-3 px-2">
                <p 
                  className="text-[16px] font-semibold mb-1.5"
                  style={{
                    color: '#E8E8F0',
                    fontWeight: '600',
                  }}
                >
                  {fullName}
                </p>
                <a
                  href="https://t.me/rudn_mosbot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[17px] font-bold inline-block"
                  style={{
                    background: 'linear-gradient(100deg, #9AB8E8 0%, #D4A5E8 35%, #FFB4D1 70%, #FFFFFF 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 2px 8px rgba(154, 184, 232, 0.25))',
                    fontWeight: '700',
                    textDecoration: 'none',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hapticFeedback) hapticFeedback('impact', 'light');
                  }}
                >
                  @rudn_mosbot
                </a>
              </div>
            )}

            {/* Username и группа */}
            {isTelegramUser && (
              <div className="flex items-center justify-center gap-2 w-full flex-wrap">
                {username && (
                  <span
                    className="text-sm font-medium"
                    style={{ 
                      color: '#FFB4D1',
                      fontWeight: '500',
                    }}
                  >
                    {username}
                  </span>
                )}
                
                {username && groupName && (
                  <span style={{ color: '#555566', fontSize: '14px' }}>•</span>
                )}

                {groupName && (
                  <div
                    className="px-3 py-1.5 rounded-lg text-[13px] font-medium"
                    style={{
                      backgroundColor: '#3A3A48',
                      color: '#E8E8F0',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      fontWeight: '500',
                    }}
                  >
                    {groupName}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
