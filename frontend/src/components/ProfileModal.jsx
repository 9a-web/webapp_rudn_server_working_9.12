import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Copy, Users, TrendingUp, Award, ChevronRight, Settings, Trash2, AlertTriangle, X, Snowflake, CheckCircle } from 'lucide-react';
import { getReferralCode, getReferralStats } from '../services/referralAPI';
import { ReferralTree } from './ReferralTree';
import LKConnectionModal from './LKConnectionModal';

export const ProfileModal = ({ 
  isOpen, 
  onClose, 
  user, 
  userSettings,
  profilePhoto,
  hapticFeedback,
  onThemeChange
}) => {
  const modalRef = useRef(null);
  const [referralData, setReferralData] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showReferrals, setShowReferrals] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [newYearThemeMode, setNewYearThemeMode] = useState('auto'); // 'auto', 'always', 'off'
  const [themeLoading, setThemeLoading] = useState(false);
  const [showLKModal, setShowLKModal] = useState(false);
  const [lkConnected, setLkConnected] = useState(false);
  const [lkData, setLkData] = useState(null);

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

  // Загрузка настроек темы при открытии
  useEffect(() => {
    const loadThemeSettings = async () => {
      if (!isOpen || !user?.id) return;

      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
        const response = await fetch(`${backendUrl}/api/user-settings/${user.id}/theme`);
        
        if (response.ok) {
          const data = await response.json();
          setNewYearThemeMode(data.new_year_theme_mode || 'auto');
        }
      } catch (error) {
        console.error('Ошибка загрузки настроек темы:', error);
      }
    };

    loadThemeSettings();
  }, [isOpen, user]);

  // Проверка статуса ЛК РУДН при открытии
  useEffect(() => {
    let isCancelled = false;
    
    const checkLKStatus = async () => {
      if (!isOpen || !user?.id) return;

      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
        const response = await fetch(`${backendUrl}/api/lk/data/${user.id}`);
        
        if (isCancelled) return;
        
        if (response.ok) {
          // Читаем тело ответа безопасно через text() + JSON.parse()
          const responseText = await response.text();
          let data = {};
          try {
            data = responseText ? JSON.parse(responseText) : {};
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            data = {};
          }
          
          if (!isCancelled) {
            setLkConnected(data.lk_connected || false);
            setLkData(data.personal_data || null);
          }
        } else {
          if (!isCancelled) {
            setLkConnected(false);
            setLkData(null);
          }
        }
      } catch (error) {
        console.error('Ошибка проверки статуса ЛК:', error);
        if (!isCancelled) {
          setLkConnected(false);
          setLkData(null);
        }
      }
    };

    checkLKStatus();
    
    return () => {
      isCancelled = true;
    };
  }, [isOpen, user]);

  // Изменение режима новогодней темы
  const changeNewYearThemeMode = async (mode) => {
    if (!user?.id || themeLoading) return;

    setThemeLoading(true);

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/api/user-settings/${user.id}/theme`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_year_theme_mode: mode
        })
      });

      if (response.ok) {
        setNewYearThemeMode(mode);
        if (onThemeChange) {
          onThemeChange(mode);
        }
        if (hapticFeedback) hapticFeedback('impact', 'medium');
      } else {
        throw new Error('Ошибка при сохранении настроек темы');
      }
    } catch (error) {
      console.error('Ошибка при обновлении настроек темы:', error);
      if (hapticFeedback) hapticFeedback('notification', 'error');
    } finally {
      setThemeLoading(false);
    }
  };

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

  // Копирование реферальной ссылки (используем Web App ссылку)
  const copyReferralLink = async () => {
    // Приоритет: Web App ссылка, иначе обычная ссылка
    const linkToCopy = referralData?.referral_link_webapp || referralData?.referral_link;
    if (!linkToCopy) return;
    
    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopiedLink(true);
      if (hapticFeedback) hapticFeedback('impact', 'medium');
      
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Ошибка копирования:', error);
      // Фоллбэк для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = linkToCopy;
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
            className="fixed z-[101] flex flex-col items-center overflow-y-auto scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-gray-800/30"
            style={{
              top: '68px',
              right: '20px',
              width: '290px',
              maxHeight: 'calc(100vh - 88px)',
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

            {/* Кнопка настроек */}
            {isTelegramUser && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="w-full mt-4 pt-4"
                style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
              >
                <button
                  onClick={() => {
                    setShowSettings(true);
                    if (hapticFeedback) hapticFeedback('impact', 'light');
                  }}
                  className="w-full p-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{
                    backgroundColor: 'rgba(75, 85, 99, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Settings className="w-4 h-4 text-gray-300" />
                  <span className="text-sm font-medium text-gray-300">Настройки</span>
                </button>
              </motion.div>
            )}
          </motion.div>

          {/* Модальное окно настроек */}
          <AnimatePresence>
            {showSettings && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[102]"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                  onClick={() => setShowSettings(false)}
                  onTouchStart={(e) => {
                    // Закрываем только если касание было на самом overlay
                    if (e.target === e.currentTarget) {
                      setShowSettings(false);
                    }
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="fixed z-[103] inset-0 flex items-center justify-center p-4"
                  onClick={() => setShowSettings(false)}
                  onTouchStart={(e) => {
                    // Предотвращаем закрытие при касании модалки
                    if (e.target !== e.currentTarget) {
                      e.stopPropagation();
                    }
                  }}
                >
                  <motion.div
                    className="w-full max-w-[320px] p-4 sm:p-6 rounded-3xl max-h-[85vh] overflow-y-auto"
                    style={{
                      backgroundColor: 'rgba(42, 42, 42, 0.95)',
                      backdropFilter: 'blur(40px)',
                      WebkitBackdropFilter: 'blur(40px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                  {/* Заголовок */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Settings className="w-5 h-5 text-gray-400" />
                      Настройки
                    </h3>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  {/* Опции настроек */}
                  <div className="space-y-3">
                    {/* Новогодняя тема - три режима */}
                    <div 
                      className="w-full p-4 rounded-xl transition-all flex flex-col gap-3"
                      style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                          <Snowflake className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-sm font-semibold text-purple-300">Новогодняя тема</p>
                          <p className="text-xs text-gray-500">Снежинки и праздничный декор</p>
                        </div>
                      </div>
                      
                      {/* Три кнопки выбора режима */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Авто */}
                        <button
                          onClick={() => changeNewYearThemeMode('auto')}
                          disabled={themeLoading}
                          className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                            newYearThemeMode === 'auto'
                              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                          } ${themeLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-base">🌙</span>
                            <span>Авто</span>
                          </div>
                        </button>

                        {/* Всегда */}
                        <button
                          onClick={() => changeNewYearThemeMode('always')}
                          disabled={themeLoading}
                          className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                            newYearThemeMode === 'always'
                              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                          } ${themeLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-base">❄️</span>
                            <span>Всегда</span>
                          </div>
                        </button>

                        {/* Выкл */}
                        <button
                          onClick={() => changeNewYearThemeMode('off')}
                          disabled={themeLoading}
                          className={`px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                            newYearThemeMode === 'off'
                              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                          } ${themeLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-base">🔒</span>
                            <span>Выкл</span>
                          </div>
                        </button>
                      </div>

                      {/* Подсказка по текущему режиму */}
                      <div className="text-xs text-gray-500 text-center px-2">
                        {newYearThemeMode === 'auto' && '⚡ Автоматически зимой (дек/янв/фев)'}
                        {newYearThemeMode === 'always' && '🎄 Снег падает круглый год'}
                        {newYearThemeMode === 'off' && '🚫 Тема отключена'}
                      </div>
                    </div>

                    {/* Подключение ЛК РУДН */}
                    <button
                      onClick={() => {
                        setShowLKModal(true);
                        if (hapticFeedback) hapticFeedback('impact', 'light');
                      }}
                      className="w-full p-4 rounded-xl flex items-center gap-3 transition-all active:scale-95"
                      style={{
                        backgroundColor: lkConnected 
                          ? 'rgba(34, 197, 94, 0.1)' 
                          : 'rgba(99, 102, 241, 0.1)',
                        border: lkConnected 
                          ? '1px solid rgba(34, 197, 94, 0.3)' 
                          : '1px solid rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: lkConnected 
                            ? 'rgba(34, 197, 94, 0.2)' 
                            : 'rgba(99, 102, 241, 0.2)',
                        }}
                      >
                        {lkConnected ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <Link2 className="w-5 h-5 text-indigo-400" />
                        )}
                      </div>
                      <div className="text-left flex-1">
                        <p className={`text-sm font-semibold ${lkConnected ? 'text-green-400' : 'text-indigo-300'}`}>
                          {lkConnected ? 'ЛК РУДН подключён' : 'Подключить ЛК РУДН'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {lkConnected 
                            ? (lkData?.full_name || 'lk.rudn.ru') 
                            : 'Синхронизация данных из lk.rudn.ru'}
                        </p>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${lkConnected ? 'text-green-400' : 'text-indigo-400'}`} />
                    </button>

                    {/* Удаление аккаунта */}
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        if (hapticFeedback) hapticFeedback('impact', 'medium');
                      }}
                      className="w-full p-4 rounded-xl flex items-center gap-3 transition-all active:scale-95"
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-red-400">Удалить аккаунт</p>
                        <p className="text-xs text-gray-500">Все данные будут удалены</p>
                      </div>
                    </button>
                  </div>

                  {/* Подтверждение удаления */}
                  <AnimatePresence>
                    {showDeleteConfirm && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mt-4 p-4 rounded-xl"
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                        }}
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-red-400 mb-1">
                              Вы уверены?
                            </p>
                            <p className="text-xs text-gray-400">
                              Это действие необратимо. Все ваши данные, задачи, достижения и статистика будут удалены навсегда.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-300 transition-all active:scale-95"
                            style={{
                              backgroundColor: 'rgba(75, 85, 99, 0.4)',
                            }}
                          >
                            Отмена
                          </button>
                          <button
                            onClick={async () => {
                              if (!user?.id) return;
                              setDeleteLoading(true);
                              try {
                                const backendUrl = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
                                const response = await fetch(`${backendUrl}/api/user/${user.id}`, {
                                  method: 'DELETE',
                                });
                                if (response.ok) {
                                  if (hapticFeedback) hapticFeedback('notification', 'success');
                                  // Закрываем все модалки
                                  setShowDeleteConfirm(false);
                                  setShowSettings(false);
                                  onClose();
                                  // Перезагружаем страницу для очистки состояния
                                  window.location.reload();
                                } else {
                                  throw new Error('Ошибка удаления');
                                }
                              } catch (error) {
                                console.error('Ошибка удаления аккаунта:', error);
                                if (hapticFeedback) hapticFeedback('notification', 'error');
                              } finally {
                                setDeleteLoading(false);
                              }
                            }}
                            disabled={deleteLoading}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                            style={{
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            }}
                          >
                            {deleteLoading ? 'Удаление...' : 'Удалить'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Модальное окно подключения ЛК РУДН */}
          <LKConnectionModal
            isOpen={showLKModal}
            onClose={() => setShowLKModal(false)}
            telegramId={user?.id}
            hapticFeedback={hapticFeedback}
            onConnectionChange={(connected, data) => {
              setLkConnected(connected);
              setLkData(data);
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
};
