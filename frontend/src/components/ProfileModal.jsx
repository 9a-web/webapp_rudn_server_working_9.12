import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Copy, Users, TrendingUp, Award, ChevronRight } from 'lucide-react';
import { getReferralCode, getReferralStats } from '../services/referralAPI';
import { ReferralTree } from './ReferralTree';

export const ProfileModal = ({ 
  isOpen, 
  onClose, 
  user, 
  userSettings,
  profilePhoto,
  hapticFeedback 
}) => {
  const modalRef = useRef(null);
  const [referralData, setReferralData] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);

  // Загрузка реферальных данных при открытии
  useEffect(() => {
    const loadReferralData = async () => {
      if (!isOpen || !user?.id) return;
      
      setLoading(true);
      try {
        const [codeData, statsData] = await Promise.all([
          getReferralCode(user.id),
          getReferralStats(user.id)
        ]);
        
        setReferralData(codeData);
        setReferralStats(statsData);
      } catch (error) {
        console.error('Ошибка загрузки реферальных данных:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReferralData();
  }, [isOpen, user]);

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

  // Копирование реферальной ссылки
  const copyReferralLink = async () => {
    if (!referralData?.referral_link) return;
    
    try {
      await navigator.clipboard.writeText(referralData.referral_link);
      setCopiedLink(true);
      if (hapticFeedback) hapticFeedback('impact', 'medium');
      
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Ошибка копирования:', error);
      // Фоллбэк для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = referralData.referral_link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

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
              <div className="flex items-center justify-center gap-2 w-full flex-wrap mb-4">
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

            {/* Реферальная программа */}
            {isTelegramUser && referralData && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="w-full mt-4 pt-4"
                style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
              >
                {/* Заголовок */}
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Реферальная программа
                  </h3>
                </div>

                {/* Реферальный код */}
                <div
                  className="mb-3 p-3 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(196, 163, 255, 0.15) 100%)',
                    border: '1px solid rgba(167, 139, 250, 0.3)',
                  }}
                >
                  <p className="text-xs text-gray-400 mb-1">Ваш код</p>
                  <p className="text-lg font-bold text-purple-300 font-mono">
                    {referralData.referral_code}
                  </p>
                </div>

                {/* Кнопка копирования ссылки */}
                <button
                  onClick={copyReferralLink}
                  className="w-full p-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{
                    background: copiedLink 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                  }}
                >
                  {copiedLink ? (
                    <>
                      <Award className="w-4 h-4 text-white" />
                      <span className="text-sm font-semibold text-white">Скопировано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-white" />
                      <span className="text-sm font-semibold text-white">Копировать ссылку</span>
                    </>
                  )}
                </button>

                {/* Статистика */}
                {referralStats && (
                  <div className="mt-4 space-y-2">
                    {/* Общая статистика */}
                    <div className="grid grid-cols-2 gap-2">
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: 'rgba(52, 211, 153, 0.1)',
                          border: '1px solid rgba(52, 211, 153, 0.2)',
                        }}
                      >
                        <p className="text-xs text-gray-400">Уровень 1</p>
                        <p className="text-lg font-bold text-green-400">
                          {referralStats.level_1_count}
                        </p>
                      </div>
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: 'rgba(96, 165, 250, 0.1)',
                          border: '1px solid rgba(96, 165, 250, 0.2)',
                        }}
                      >
                        <p className="text-xs text-gray-400">Уровень 2</p>
                        <p className="text-lg font-bold text-blue-400">
                          {referralStats.level_2_count}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: 'rgba(167, 139, 250, 0.1)',
                          border: '1px solid rgba(167, 139, 250, 0.2)',
                        }}
                      >
                        <p className="text-xs text-gray-400">Уровень 3</p>
                        <p className="text-lg font-bold text-purple-400">
                          {referralStats.level_3_count}
                        </p>
                      </div>
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: 'rgba(251, 191, 36, 0.1)',
                          border: '1px solid rgba(251, 191, 36, 0.2)',
                        }}
                      >
                        <p className="text-xs text-gray-400">Заработано</p>
                        <p className="text-lg font-bold text-yellow-400">
                          {referralStats.total_referral_points}
                        </p>
                      </div>
                    </div>

                    {/* Кнопка показать рефералов */}
                    {(referralStats.level_1_count + referralStats.level_2_count + referralStats.level_3_count) > 0 && (
                      <button
                        onClick={() => {
                          setShowReferrals(!showReferrals);
                          if (hapticFeedback) hapticFeedback('impact', 'light');
                        }}
                        className="w-full p-2 rounded-lg flex items-center justify-between text-sm font-medium text-purple-300 hover:bg-purple-500/10 transition-colors"
                      >
                        <span>Мои рефералы</span>
                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${showReferrals ? 'rotate-90' : ''}`}
                        />
                      </button>
                    )}

                    {/* Список рефералов */}
                    <AnimatePresence>
                      {showReferrals && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-purple-900/20"
                        >
                          {referralStats.level_1_referrals.length > 0 && (
                            <div>
                              <p className="text-xs text-green-400 font-semibold mb-1">
                                Уровень 1 ({referralStats.level_1_referrals.length})
                              </p>
                              {referralStats.level_1_referrals.map((ref) => (
                                <div
                                  key={ref.telegram_id}
                                  className="flex items-center justify-between p-2 rounded-lg mb-1"
                                  style={{
                                    backgroundColor: 'rgba(52, 211, 153, 0.08)',
                                    border: '1px solid rgba(52, 211, 153, 0.15)',
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xs font-bold text-white">
                                      {ref.first_name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <span className="text-xs text-white font-medium">
                                      {ref.first_name || 'Пользователь'}
                                    </span>
                                  </div>
                                  <span className="text-xs text-green-400 font-semibold">
                                    +{ref.points_earned_for_referrer}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {referralStats.level_2_referrals.length > 0 && (
                            <div>
                              <p className="text-xs text-blue-400 font-semibold mb-1">
                                Уровень 2 ({referralStats.level_2_referrals.length})
                              </p>
                              {referralStats.level_2_referrals.map((ref) => (
                                <div
                                  key={ref.telegram_id}
                                  className="flex items-center justify-between p-2 rounded-lg mb-1"
                                  style={{
                                    backgroundColor: 'rgba(96, 165, 250, 0.08)',
                                    border: '1px solid rgba(96, 165, 250, 0.15)',
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-xs font-bold text-white">
                                      {ref.first_name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <span className="text-xs text-white font-medium">
                                      {ref.first_name || 'Пользователь'}
                                    </span>
                                  </div>
                                  <span className="text-xs text-blue-400 font-semibold">
                                    +{ref.points_earned_for_referrer}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {referralStats.level_3_referrals.length > 0 && (
                            <div>
                              <p className="text-xs text-purple-400 font-semibold mb-1">
                                Уровень 3 ({referralStats.level_3_referrals.length})
                              </p>
                              {referralStats.level_3_referrals.map((ref) => (
                                <div
                                  key={ref.telegram_id}
                                  className="flex items-center justify-between p-2 rounded-lg mb-1"
                                  style={{
                                    backgroundColor: 'rgba(167, 139, 250, 0.08)',
                                    border: '1px solid rgba(167, 139, 250, 0.15)',
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-xs font-bold text-white">
                                      {ref.first_name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <span className="text-xs text-white font-medium">
                                      {ref.first_name || 'Пользователь'}
                                    </span>
                                  </div>
                                  <span className="text-xs text-purple-400 font-semibold">
                                    +{ref.points_earned_for_referrer}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
