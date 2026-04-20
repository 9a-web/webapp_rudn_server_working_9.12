import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { ChevronLeft, Trophy, Settings, QrCode, X, Sliders, Smartphone, Users, Link2, Snowflake, Trash2, AlertTriangle, GraduationCap, Pen, ShieldCheck, Copy, Award, ChevronRight, Star, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { friendsAPI } from '../services/friendsAPI';
import { getReferralCode, getReferralStats } from '../services/referralAPI';
import { getBackendURL, achievementsAPI } from '../services/api';
import { clearAllLocalAuthData } from '../utils/authStorage';
import ProfileSettingsModal from './ProfileSettingsModal';
import ProfileEditScreen from './ProfileEditScreen';
import DevicesModal from './DevicesModal';
import LKConnectionModal from './LKConnectionModal';
import LevelDetailModal from './LevelDetailModal';
import LevelUpModal from './LevelUpModal';
import GraffitiEditor from './GraffitiEditor';
import WallGraffiti from './WallGraffiti';
import { getTierColor, getTierName, getTierConfig, renderStars } from '../constants/levelConstants';

const ADMIN_UIDS = ['765963392', '1311283832'];

const TABS = [
  { id: 'general', label: 'Общее' },
  { id: 'friends', label: 'Друзья' },
  { id: 'achievements', label: 'Достижения' },
  { id: 'materials', label: 'Материалы' },
];

const ProfileScreen = ({ isOpen, onClose, user, userSettings, profilePhoto, hapticFeedback, onThemeChange, initialTab }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [showSettings, setShowSettings] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);

  // Sub-modals
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [showLKModal, setShowLKModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [referralData, setReferralData] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Bug 9: Актуальные данные профиля с сервера
  const [profileData, setProfileData] = useState(null);
  
  // === Система уровней ===
  const [showLevelDetail, setShowLevelDetail] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState(null);
  const prevLevelRef = useRef(null);
  const prevTierRef = useRef(null);
  
  // Friends list state
  const [friendsList, setFriendsList] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Achievements state
  const [allAchievements, setAllAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);

  // ========== GRAFFITI (display only — editing moved to GraffitiEditor) ==========
  const [headerGraffitiUrl, setHeaderGraffitiUrl] = useState(null);
  const [showGraffitiEditor, setShowGraffitiEditor] = useState(false);

  const tabsContainerRef = useRef(null);
  const tabRefs = useRef({});
  const scrollContainerRef = useRef(null);

  // Загрузка граффити для отображения в шапке
  useEffect(() => {
    if (isOpen && user?.id) {
      friendsAPI.getGraffiti(user.id)
        .then(data => {
          if (data?.graffiti_data) setHeaderGraffitiUrl(data.graffiti_data);
          else setHeaderGraffitiUrl(null);
        })
        .catch(() => setHeaderGraffitiUrl(null));
    }
    if (!isOpen) setHeaderGraffitiUrl(null);
  }, [isOpen, user?.id]);

  // ========== END GRAFFITI ==========

  // Реакция на initialTab — открыть нужный таб извне
  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [isOpen, initialTab]);


  const isAdmin = useMemo(() => {
    if (!user?.id) return false;
    return ADMIN_UIDS.includes(String(user.id));
  }, [user?.id]);

  // Bug 9: Загрузка актуальных данных профиля с сервера
  // FIX: Убрана зависимость от showLevelUp — предотвращает рекурсию и дубли
  const levelUpShownRef = useRef(false);

  const refreshProfile = useCallback(() => {
    if (!user?.id) return;

    // 1. Загрузка профиля
    friendsAPI.getUserProfile(user.id, user.id)
      .then(data => {
        if (!data) return;
        setProfileData(data);

        const newLevel = data.level || 1;
        const newTier = data.tier || 'base';

        // Level-up detection: ТОЛЬКО через сравнение с ref, НЕ дублируя pending
        if (prevLevelRef.current !== null && newLevel > prevLevelRef.current && !levelUpShownRef.current) {
          levelUpShownRef.current = true;
          setLevelUpData({ newLevel, newTier, oldTier: prevTierRef.current || 'base', levelTitle: data.level_title || '' });
          setShowLevelUp(true);
        }

        prevLevelRef.current = newLevel;
        prevTierRef.current = newTier;
      })
      .catch(err => console.error('Error loading own profile:', err));

    // 2. Проверяем pending level-up с бэкенда (consumed after read)
    //    Показываем ТОЛЬКО если profile detection не сработал
    friendsAPI.getPendingLevelUp(user.id)
      .then(data => {
        if (data?.has_level_up && !levelUpShownRef.current) {
          levelUpShownRef.current = true;
          setLevelUpData({
            newLevel: data.new_level,
            newTier: data.new_tier,
            oldTier: data.old_tier,
            levelTitle: data.level_title || '',
          });
          setShowLevelUp(true);
          prevLevelRef.current = data.new_level;
          prevTierRef.current = data.new_tier;
        }
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (isOpen && user?.id) {
      levelUpShownRef.current = false; // Сбрасываем при каждом открытии
      refreshProfile();
      // Activity ping — заменяет старый side-effect в GET /profile
      friendsAPI.pingActivity(user.id).catch(() => {});
    }
  }, [isOpen, user?.id, refreshProfile]);

  // Периодический ping активности каждые 2 минуты, пока профиль открыт
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    const interval = setInterval(() => {
      friendsAPI.pingActivity(user.id).catch(() => {});
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isOpen, user?.id]);

  // Bug 11: Сброс состояния при закрытии профиля
  useEffect(() => {
    if (!isOpen) {
      setFriendsList([]);
      setProfileData(null);
      setActiveTab('general');
      setImgLoaded(false);
      setShowGraffitiEditor(false);
    }
  }, [isOpen]);

  // Блокировка скролла фона при открытом профиле
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.touchAction = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Bottom Sheet drag
  const sheetY = useMotionValue(0);
  const sheetBg = useTransform(sheetY, [0, 400], ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']);

  const [qrError, setQrError] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  const loadQRData = useCallback(async () => {
    if (!user?.id) return;
    setQrLoading(true);
    setQrError(null);
    try {
      // Передаём requester_telegram_id — владелец всегда получит QR даже если show_in_search=false
      const data = await friendsAPI.getProfileQR(user.id, user.id);
      setQrData(data);
    } catch (err) {
      console.error('Failed to load QR data:', err);
      setQrError(err?.message || 'Не удалось загрузить QR');
    } finally {
      setQrLoading(false);
    }
  }, [user?.id]);

  const handleQRClick = () => {
    if (hapticFeedback) hapticFeedback('impact', 'light');
    loadQRData();
    setShowQR(true);
  };

  // Загрузка реферальных данных
  const loadReferralData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [codeData, statsData] = await Promise.all([
        getReferralCode(user.id),
        getReferralStats(user.id),
      ]);
      setReferralData(codeData);
      setReferralStats(statsData);
    } catch (err) {
      console.error('Failed to load referral data:', err);
    }
  }, [user?.id]);

  // Bug 11: Загрузка друзей при каждом переключении на таб (обновление)
  useEffect(() => {
    if (activeTab === 'friends' && user?.id) {
      setFriendsLoading(true);
      friendsAPI.getFriends(user.id)
        .then(data => setFriendsList(data?.friends || []))
        .catch(err => console.error('Failed to load friends:', err))
        .finally(() => setFriendsLoading(false));
    }
  }, [activeTab, user?.id]);

  // Загрузка достижений при переключении на таб
  useEffect(() => {
    if (activeTab === 'achievements' && user?.id) {
      setAchievementsLoading(true);
      Promise.all([
        achievementsAPI.getAllAchievements(),
        achievementsAPI.getUserAchievements(user.id),
      ])
        .then(([all, userAch]) => {
          setAllAchievements(all || []);
          setUserAchievements(userAch || []);
        })
        .catch(err => console.error('Failed to load achievements:', err))
        .finally(() => setAchievementsLoading(false));
    }
  }, [activeTab, user?.id]);

  // Копирование реферальной ссылки
  const copyReferralLink = async () => {
    const linkToCopy = referralData?.referral_link_webapp || referralData?.referral_link;
    if (!linkToCopy) return;
    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopiedLink(true);
      if (hapticFeedback) hapticFeedback('impact', 'medium');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
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

  const handleSettingsClick = () => {
    if (hapticFeedback) hapticFeedback('impact', 'light');
    setShowSettings(true);
  };

  const closeSheet = () => {
    setShowSettings(false);
  };

  const settingsItems = [
    {
      id: 'profile',
      icon: ShieldCheck,
      label: 'Настройки приватности',
      sublabel: 'Управление видимостью данных',
      color: '#FFBE4E',
      action: () => { closeSheet(); setTimeout(() => setShowProfileSettings(true), 200); },
    },
    {
      id: 'devices',
      icon: Smartphone,
      label: 'Устройства',
      sublabel: 'Управление сессиями',
      color: '#8B5CF6',
      action: () => { closeSheet(); setTimeout(() => setShowDevices(true), 200); },
    },
    {
      id: 'referral',
      icon: Users,
      label: 'Реферальная программа',
      sublabel: 'Приглашай друзей',
      color: '#3B82F6',
      action: () => { closeSheet(); setTimeout(() => { setShowReferral(true); loadReferralData(); }, 200); },
    },
    ...(isAdmin ? [{
      id: 'lk',
      icon: GraduationCap,
      label: 'ЛК РУДН',
      sublabel: 'Подключение личного кабинета',
      color: '#10B981',
      action: () => { closeSheet(); setTimeout(() => setShowLKModal(true), 200); },
    }] : []),
    {
      id: 'delete',
      icon: Trash2,
      label: 'Удалить аккаунт',
      sublabel: '',
      color: '#EF4444',
      action: () => { closeSheet(); setTimeout(() => setShowDeleteConfirm(true), 200); },
      danger: true,
    },
  ];

  if (!user) return null;

  const initial = (user.first_name?.[0] || user.username?.[0] || '?').toUpperCase();

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="profile-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-[200] flex flex-col"
          style={{ backgroundColor: '#000000', overscrollBehavior: 'contain' }}
        >
          {/* Верхняя панель навигации — фиксирована */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="flex items-center justify-between px-4"
            style={{
              paddingTop: 'calc(var(--header-safe-padding, 0px) + 16px)',
              paddingBottom: '8px',
              position: 'relative',
              zIndex: 10,
              flexShrink: 0,
            }}
          >
            {/* Кнопка назад */}
            <button
              onClick={() => {
                if (hapticFeedback) hapticFeedback('impact', 'light');
                onClose();
              }}
            >
              <ChevronLeft style={{ width: '31px', height: '31px', color: 'rgba(255,255,255,0.7)' }} />
            </button>

            {/* QR, Редактирование профиля и Настройки */}
            <div className="flex items-center gap-3">
              <button onClick={handleQRClick}>
                <QrCode style={{ width: '24px', height: '24px', color: 'rgba(255,255,255,0.7)' }} />
              </button>
              <button onClick={() => {
                if (hapticFeedback) hapticFeedback('impact', 'light');
                setShowProfileEdit(true);
              }}>
                <Pen style={{ width: '24px', height: '24px', color: 'rgba(255,255,255,0.7)' }} />
              </button>
              <button onClick={handleSettingsClick}>
                <Settings style={{ width: '24px', height: '24px', color: '#E1E1E1' }} />
              </button>
            </div>
          </motion.div>

          {/* === Единый скроллируемый контейнер === */}
          <div
            ref={scrollContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >

          {/* ===== ШАПКА ПРОФИЛЯ с граффити-фоном ===== */}
          <div style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflow: 'hidden',
            paddingBottom: '18px',
          }}>
            {/* Граффити как фоновый слой шапки */}
            {headerGraffitiUrl && (
              <div style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                opacity: 0.55,
                pointerEvents: 'none',
              }}>
                <img
                  src={headerGraffitiUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                  }}
                />
                {/* Градиент для плавного перехода к чёрному фону внизу */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '60px',
                  background: 'linear-gradient(to top, #000000, transparent)',
                }} />
              </div>
            )}

          {/* Аватар */}
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
            style={{ marginTop: '12px' }}
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
                  backgroundColor: (profileData?.is_online ?? user.is_online) ? '#4ADE80' : '#EF4444',
                  boxShadow: (profileData?.is_online ?? user.is_online) ? '0 0 6px rgba(74, 222, 128, 0.5)' : '0 0 6px rgba(239, 68, 68, 0.5)',
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
                {(profileData?.is_online ?? user.is_online) ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Level — кликабельный бейдж с shimmer, анимированными звёздами и XP мини-баром */}
            {(() => {
              const currentTier = profileData?.tier || 'base';
              const tc = getTierConfig(currentTier);
              const isHighTier = currentTier === 'legend' || currentTier === 'premium';
              const starCount = Math.min(profileData?.stars || 0, 4);
              const xpProg = profileData?.xp_progress ?? 0;
              return (
                <div
                  onClick={() => { setShowLevelDetail(true); if (hapticFeedback) hapticFeedback('impact', 'light'); }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  {/* Badge pill */}
                  <div
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      background: isHighTier ? tc.gradient : tc.color,
                      animation: isHighTier ? 'levelPulse 2s ease-in-out infinite' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    {/* (b) Shimmer overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        overflow: 'hidden',
                        borderRadius: '20px',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '-20%',
                          left: '-50%',
                          width: '45%',
                          height: '140%',
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                          animation: 'badgeShimmer 2.8s ease-in-out infinite',
                          animationDelay: '0.5s',
                        }}
                      />
                    </div>

                    {/* Level text */}
                    <span
                      style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 700,
                        fontSize: '12px',
                        color: '#1c1c1c',
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      LV. {profileData?.level ?? 1}
                    </span>

                    {/* (c) Animated stars with stagger */}
                    {starCount > 0 && (
                      <span
                        style={{
                          display: 'inline-flex',
                          gap: '1px',
                          position: 'relative',
                          zIndex: 1,
                        }}
                      >
                        {Array.from({ length: starCount }).map((_, i) => (
                          <motion.span
                            key={i}
                            initial={{ opacity: 0, scale: 0.3 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              delay: 0.3 + i * 0.12,
                              type: 'spring',
                              stiffness: 400,
                              damping: 12,
                            }}
                            style={{
                              fontFamily: "'Poppins', sans-serif",
                              fontSize: '10px',
                              color: '#1c1c1c',
                              display: 'inline-block',
                              animation: `starTwinkle ${1.8 + i * 0.2}s ease-in-out infinite`,
                              animationDelay: `${1 + i * 0.3}s`,
                            }}
                          >
                            ★
                          </motion.span>
                        ))}
                      </span>
                    )}
                  </div>

                  {/* (d) XP mini progress bar */}
                  <div
                    style={{
                      width: '80%',
                      height: '3px',
                      borderRadius: '2px',
                      backgroundColor: 'rgba(255, 255, 255, 0.10)',
                      marginTop: '4px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.max(xpProg * 100, 2)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                      style={{
                        height: '100%',
                        borderRadius: '2px',
                        background: tc.gradient,
                        boxShadow: `0 0 6px ${tc.color}55`,
                        animation: 'xpBarGlow 2s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>
              );
            })()}
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
              fontSize: '47px',
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
                fontSize: '16px',
                color: '#FF4E9D',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {userSettings.group_name}
              <Trophy style={{ width: '14.5px', height: '14.5px', color: '#FFB54E', marginLeft: '8px', flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '14.5px',
                  color: '#FFB54E',
                  marginLeft: '3px',
                }}
              >
                🔥{profileData?.visit_streak_current ?? 0}
              </span>
            </motion.div>
          )}

          {/* Друзья и $RDN */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="flex items-start justify-center"
            style={{ marginTop: '10px', gap: '40px' }}
          >
            {/* Количество друзей */}
            <div className="flex flex-col items-center">
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '21px',
                  color: '#FFBE4E',
                  lineHeight: 1.2,
                }}
              >
                {profileData?.friends_count ?? user.friends_count ?? 0}
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
                  const n = profileData?.friends_count ?? user.friends_count ?? 0;
                  const mod10 = n % 10;
                  const mod100 = n % 100;
                  if (mod100 >= 11 && mod100 <= 19) return 'Друзей';
                  if (mod10 === 1) return 'Друг';
                  if (mod10 >= 2 && mod10 <= 4) return 'Друга';
                  return 'Друзей';
                })()}
              </span>
            </div>

            {/* Уровень — реальный тир из backend + анимированные звёзды + XP бар */}
            {(() => {
              const currentTier = profileData?.tier || 'base';
              const tc = getTierConfig(currentTier);
              const isHighTier = currentTier === 'legend' || currentTier === 'premium';
              const starCount = Math.min(profileData?.stars || 0, 4);
              const xpProg = profileData?.xp_progress ?? 0;
              return (
                <div className="flex flex-col items-center" onClick={() => { setShowLevelDetail(true); if (hapticFeedback) hapticFeedback('impact', 'light'); }} style={{ cursor: 'pointer' }}>
                  <span
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 600,
                      fontSize: '24px',
                      lineHeight: 1.2,
                      ...(isHighTier ? {
                        background: tc.gradient,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      } : {
                        color: tc.color,
                      }),
                    }}
                  >
                    {tc.nameRu}
                  </span>
                  {/* Animated stars row */}
                  {starCount > 0 && (
                    <div style={{ display: 'flex', gap: '2px', marginTop: '1px' }}>
                      {Array.from({ length: starCount }).map((_, i) => (
                        <motion.span
                          key={i}
                          initial={{ opacity: 0, scale: 0, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{
                            delay: 0.5 + i * 0.15,
                            type: 'spring',
                            stiffness: 350,
                            damping: 14,
                          }}
                          style={{
                            fontSize: '12px',
                            color: tc.color,
                            display: 'inline-block',
                            animation: `starTwinkle ${2 + i * 0.25}s ease-in-out infinite`,
                            animationDelay: `${1.5 + i * 0.4}s`,
                            filter: `drop-shadow(0 0 2px ${tc.color}66)`,
                          }}
                        >
                          ★
                        </motion.span>
                      ))}
                    </div>
                  )}
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
                  {/* XP mini progress bar */}
                  <div
                    style={{
                      width: '52px',
                      height: '3px',
                      borderRadius: '2px',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      marginTop: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.max(xpProg * 100, 2)}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.6 }}
                      style={{
                        height: '100%',
                        borderRadius: '2px',
                        background: tc.gradient,
                        boxShadow: `0 0 4px ${tc.color}44`,
                        animation: 'xpBarGlow 2s ease-in-out infinite',
                      }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* $RDN */}
            <div className="flex flex-col items-center">
              <span
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '21px',
                  color: '#FFBE4E',
                  lineHeight: 1.2,
                }}
              >
                {profileData?.total_points ?? user.rdn_balance ?? 0}
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
          </div>{/* ===== КОНЕЦ ШАПКИ С ГРАФФИТИ-ФОНОМ ===== */}

          {/* Табы */}
          <div
            ref={tabsContainerRef}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              padding: '15px 20px',
              backgroundColor: '#000000',
              width: '100%',
              flexShrink: 0,
              minHeight: '56px',
              scrollBehavior: 'smooth',
            }}
            className="scrollbar-hide"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[tab.id] = el; }}
                onClick={() => {
                  // Мгновенный скролл наверх ДО смены таба — шапка видна сразу
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
                  }
                  setActiveTab(tab.id);
                  if (hapticFeedback) hapticFeedback('impact', 'light');
                  // Автоскролл к активному табу (горизонтальный)
                  const btn = tabRefs.current[tab.id];
                  const container = tabsContainerRef.current;
                  if (btn && container) {
                    const btnRect = btn.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const targetScroll = container.scrollLeft + (btnRect.left - containerRect.left) - (containerRect.width / 2) + (btnRect.width / 2);
                    const startScroll = container.scrollLeft;
                    const diff = targetScroll - startScroll;
                    const duration = 250;
                    let startTime = null;
                    const easeOut = (t) => 1 - (1 - t) * (1 - t);
                    const step = (timestamp) => {
                      if (!startTime) startTime = timestamp;
                      const progress = Math.min((timestamp - startTime) / duration, 1);
                      container.scrollLeft = startScroll + diff * easeOut(progress);
                      if (progress < 1) requestAnimationFrame(step);
                    };
                    requestAnimationFrame(step);
                  }
                }}
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '15px',
                  color: activeTab === tab.id ? '#F8B94C' : '#88888B',
                  background: activeTab === tab.id
                    ? 'rgba(248, 185, 76, 0.08)'
                    : 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: activeTab === tab.id ? '1px solid rgba(248, 185, 76, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px',
                  padding: '10px 22px',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.25s ease',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>{/* конец табов */}

          {/* Контент табов */}
          <div
            style={{
              width: '100%',
              padding: '16px 20px 100px',
            }}
          >
            <AnimatePresence mode="wait">
              {activeTab === 'general' ? (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}
                >
                  {/* Инфо о шапке граффити */}
                  <div style={{
                    textAlign: 'center',
                    padding: '8px 0 0',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.15)',
                  }}>
                    {headerGraffitiUrl
                      ? 'Граффити отображается в шапке профиля ✨'
                      : 'Добавьте граффити шапки через редактирование профиля 🎨'}
                  </div>

                  {/* Стена граффити */}
                  <WallGraffiti
                    user={user}
                    profileOwnerId={user?.id}
                    hapticFeedback={hapticFeedback}
                  />
                </motion.div>
              ) : activeTab === 'friends' ? (
                <motion.div
                  key="friends"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                >
                  {friendsLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        border: '2px solid rgba(248,185,76,0.3)',
                        borderTopColor: '#F8B94C',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                    </div>
                  ) : friendsList.length > 0 ? (
                    friendsList.map((friend) => (
                      <div
                        key={friend.telegram_id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '16px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '14px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                            {(friend.first_name?.[0] || '?').toUpperCase()}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontWeight: 600,
                            fontSize: '14px',
                            color: '#F4F3FC',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {[friend.first_name, friend.last_name].filter(Boolean).join(' ') || 'Пользователь'}
                          </span>
                          {friend.group_name && (
                            <span style={{
                              fontFamily: "'Poppins', sans-serif",
                              fontWeight: 400,
                              fontSize: '12px',
                              color: 'rgba(255,255,255,0.35)',
                            }}>
                              {friend.group_name}
                            </span>
                          )}
                        </div>
                        {friend.is_online && (
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#4ADE80',
                            boxShadow: '0 0 6px rgba(74,222,128,0.5)',
                            flexShrink: 0,
                          }} />
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{
                      padding: '32px 0',
                      textAlign: 'center',
                    }}>
                      <Users style={{ width: '40px', height: '40px', color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                      <span style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 500,
                        fontSize: '14px',
                        color: 'rgba(255,255,255,0.3)',
                      }}>
                        Пока нет друзей
                      </span>
                    </div>
                  )}
                </motion.div>
              ) : activeTab === 'achievements' ? (
                <motion.div
                  key="achievements"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  {achievementsLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        border: '2px solid rgba(248,185,76,0.3)',
                        borderTopColor: '#F8B94C',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                    </div>
                  ) : (
                    <>
                      {/* Статистика достижений */}
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
                        <div style={{
                          flex: 1,
                          background: 'linear-gradient(135deg, rgba(248,185,76,0.1) 0%, rgba(248,185,76,0.04) 100%)',
                          borderRadius: '16px',
                          padding: '14px',
                          border: '1px solid rgba(248,185,76,0.15)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <Star style={{ width: '14px', height: '14px', color: '#F8B94C' }} />
                            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Очки</span>
                          </div>
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '22px', color: '#F4F3FC' }}>
                            {profileData?.total_points || 0}
                          </span>
                        </div>
                        <div style={{
                          flex: 1,
                          background: 'linear-gradient(135deg, rgba(163,247,191,0.1) 0%, rgba(163,247,191,0.04) 100%)',
                          borderRadius: '16px',
                          padding: '14px',
                          border: '1px solid rgba(163,247,191,0.15)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <Trophy style={{ width: '14px', height: '14px', color: '#A3F7BF' }} />
                            <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 400, fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Получено</span>
                          </div>
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '22px', color: '#F4F3FC' }}>
                            {userAchievements.length}/{allAchievements.length}
                          </span>
                        </div>
                      </div>

                      {/* Список достижений */}
                      {(() => {
                        const earnedIds = new Set(userAchievements.map(ua => ua.achievement?.id));
                        const sorted = [...allAchievements].sort((a, b) => {
                          const ae = earnedIds.has(a.id) ? 1 : 0;
                          const be = earnedIds.has(b.id) ? 1 : 0;
                          if (ae !== be) return be - ae;
                          return a.points - b.points;
                        });
                        return sorted.map((ach) => {
                          const earned = userAchievements.find(ua => ua.achievement?.id === ach.id);
                          const isEarned = !!earned;
                          return (
                            <div
                              key={ach.id}
                              style={{
                                padding: '14px 16px',
                                borderRadius: '16px',
                                background: isEarned
                                  ? 'linear-gradient(135deg, rgba(163,247,191,0.08) 0%, rgba(248,185,76,0.06) 100%)'
                                  : 'rgba(255,255,255,0.03)',
                                border: isEarned
                                  ? '1px solid rgba(163,247,191,0.2)'
                                  : '1px solid rgba(255,255,255,0.06)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {/* Emoji */}
                              <div style={{
                                fontSize: '32px',
                                lineHeight: 1,
                                flexShrink: 0,
                                opacity: isEarned ? 1 : 0.3,
                                filter: isEarned ? 'none' : 'grayscale(1)',
                              }}>
                                {ach.emoji}
                              </div>

                              {/* Info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                                  <span style={{
                                    fontFamily: "'Poppins', sans-serif",
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    color: isEarned ? '#F4F3FC' : 'rgba(255,255,255,0.35)',
                                  }}>
                                    {ach.name}
                                  </span>
                                  {!isEarned && <Lock style={{ width: '14px', height: '14px', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />}
                                </div>
                                <span style={{
                                  fontFamily: "'Poppins', sans-serif",
                                  fontWeight: 400,
                                  fontSize: '12px',
                                  color: isEarned ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                                  display: 'block',
                                  marginBottom: '6px',
                                }}>
                                  {ach.description}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Star style={{ width: '13px', height: '13px', color: isEarned ? '#F8B94C' : 'rgba(255,255,255,0.2)' }} />
                                    <span style={{
                                      fontFamily: "'Poppins', sans-serif",
                                      fontWeight: 600,
                                      fontSize: '12px',
                                      color: isEarned ? '#F8B94C' : 'rgba(255,255,255,0.2)',
                                    }}>
                                      {ach.points} $RDN
                                    </span>
                                  </div>
                                  {isEarned && earned.earned_at && (
                                    <span style={{
                                      fontFamily: "'Poppins', sans-serif",
                                      fontWeight: 400,
                                      fontSize: '11px',
                                      color: 'rgba(255,255,255,0.3)',
                                    }}>
                                      {new Date(earned.earned_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}

                      {allAchievements.length === 0 && (
                        <div style={{ padding: '32px 0', textAlign: 'center' }}>
                          <Trophy style={{ width: '40px', height: '40px', color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                          <span style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontWeight: 500,
                            fontSize: '14px',
                            color: 'rgba(255,255,255,0.3)',
                          }}>
                            Достижения загружаются...
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="materials"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div style={{
                    padding: '32px 0',
                    textAlign: 'center',
                  }}>
                    <Sliders style={{ width: '40px', height: '40px', color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
                    <span style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 500,
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.3)',
                      display: 'block',
                    }}>
                      Скоро появится
                    </span>
                    <span style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 400,
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.2)',
                      marginTop: '4px',
                      display: 'block',
                    }}>
                      Учебные материалы, заметки и файлы
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>{/* конец контента табов */}

          </div>{/* === Конец единого скроллируемого контейнера === */}

          {/* Свечение внизу */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '300px',
              background: 'linear-gradient(180deg, rgba(248, 185, 76, 0) 0%, rgba(248, 185, 76, 0.30) 100%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>

      {/* QR-код оверлей */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            key="qr-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[250] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
            onClick={() => setShowQR(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#1C1C1C',
                borderRadius: '24px',
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                position: 'relative',
                minWidth: '280px',
              }}
            >
              <button
                onClick={() => setShowQR(false)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <X style={{ width: '20px', height: '20px', color: 'rgba(255,255,255,0.5)' }} />
              </button>

              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                color: '#F4F3FC',
              }}>
                QR-код профиля
              </span>

              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '16px',
                position: 'relative',
                minWidth: '232px',
                minHeight: '232px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {qrData?.qr_data && !qrError ? (
                  <QRCodeSVG
                    value={qrData.qr_data}
                    size={200}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="M"
                  />
                ) : qrError ? (
                  <div style={{
                    width: '200px',
                    height: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: '#555',
                    fontFamily: "'Poppins', sans-serif",
                    textAlign: 'center',
                    padding: '8px',
                  }}>
                    <span style={{ fontSize: '28px' }}>⚠️</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>Ошибка</span>
                    <span style={{ fontSize: '11px', color: '#888', lineHeight: 1.3 }}>{qrError}</span>
                    <button
                      onClick={() => loadQRData()}
                      style={{
                        marginTop: '4px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        background: '#F8B94C',
                        border: 'none',
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Повторить
                    </button>
                  </div>
                ) : (
                  <div style={{
                    width: '200px',
                    height: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '14px',
                  }}>
                    {qrLoading ? 'Загрузка...' : '—'}
                  </div>
                )}
              </div>

              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '13px',
                color: 'rgba(255,255,255,0.5)',
                textAlign: 'center',
              }}>
                Покажи друзьям для добавления
              </span>

              {/* Кнопка "Поделиться" */}
              {qrData?.qr_data && (
                <button
                  onClick={() => {
                    if (hapticFeedback) hapticFeedback('impact', 'light');
                    const text = qrData.display_name ? `Добавь меня в друзья: ${qrData.display_name}` : 'Добавь меня в друзья';
                    const url = qrData.qr_data;
                    try {
                      if (window.Telegram?.WebApp?.openTelegramLink) {
                        window.Telegram.WebApp.openTelegramLink(
                          `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
                        );
                      } else if (navigator.share) {
                        navigator.share({ title: 'Мой профиль', text, url });
                      } else {
                        navigator.clipboard?.writeText(url);
                      }
                    } catch (e) { console.warn('share failed', e); }
                  }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '999px',
                    background: 'linear-gradient(135deg, #F8B94C 0%, #FFD586 100%)',
                    border: 'none',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    cursor: 'pointer',
                    boxShadow: '0 6px 18px rgba(248, 185, 76, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  Поделиться ссылкой
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Bottom Sheet */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            key="settings-overlay"
            className="fixed inset-0 z-[300]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ backgroundColor: sheetBg }}
            onClick={closeSheet}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) {
                  closeSheet();
                }
              }}
              style={{ y: sheetY }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0"
            >
              {/* Контейнер */}
              <div
                style={{
                  background: 'linear-gradient(180deg, #1E1D1A 0%, #141414 100%)',
                  borderRadius: '24px 24px 0 0',
                  padding: '12px 20px 40px',
                  maxHeight: '70vh',
                  overflowY: 'auto',
                }}
              >
                {/* Ручка */}
                <div style={{
                  width: '40px',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  margin: '0 auto 20px',
                }} />

                {/* Заголовок */}
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: '18px',
                  color: '#F4F3FC',
                  marginBottom: '20px',
                  paddingLeft: '4px',
                }}>
                  Настройки
                </div>

                {/* Кнопки */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {settingsItems.map((item, idx) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.2 }}
                      onClick={() => {
                        if (hapticFeedback) hapticFeedback('impact', 'light');
                        item.action();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '14px 16px',
                        borderRadius: '16px',
                        background: item.danger
                          ? 'rgba(239, 68, 68, 0.08)'
                          : 'rgba(255,255,255,0.04)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        width: '100%',
                        textAlign: 'left',
                      }}
                    >
                      {/* Иконка */}
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        backgroundColor: `${item.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <item.icon style={{
                          width: '20px',
                          height: '20px',
                          color: item.color,
                        }} />
                      </div>

                      {/* Текст */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontWeight: 600,
                          fontSize: '15px',
                          color: item.danger ? '#EF4444' : '#F4F3FC',
                          lineHeight: 1.2,
                        }}>
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontWeight: 400,
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.35)',
                            lineHeight: 1.2,
                          }}>
                            {item.sublabel}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-модалы */}
      {showProfileSettings && (
        <div className="relative z-[350]">
          <ProfileSettingsModal
            isOpen={showProfileSettings}
            onClose={() => setShowProfileSettings(false)}
            user={user}
            userSettings={userSettings}
            hapticFeedback={hapticFeedback}
          />
        </div>
      )}

      {/* Экран редактирования профиля */}
      <ProfileEditScreen
        isOpen={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
        user={user}
        userSettings={userSettings}
        profilePhoto={profilePhoto}
        hapticFeedback={hapticFeedback}
        onProfileUpdated={refreshProfile}
        onOpenGraffitiEditor={() => {
          setShowProfileEdit(false);
          setTimeout(() => setShowGraffitiEditor(true), 200);
        }}
        headerGraffitiUrl={headerGraffitiUrl}
        onOpenPrivacy={() => {
          setShowProfileEdit(false);
          setTimeout(() => setShowProfileSettings(true), 200);
        }}
      />

      <AnimatePresence>
        {showGraffitiEditor && (
          <GraffitiEditor
            isOpen={showGraffitiEditor}
            onClose={() => setShowGraffitiEditor(false)}
            user={user}
            userSettings={userSettings}
            profilePhoto={profilePhoto}
            hapticFeedback={hapticFeedback}
            profileData={profileData}
            onGraffitiSaved={(url) => setHeaderGraffitiUrl(url)}
          />
        )}
      </AnimatePresence>

      {showDevices && (
        <div className="relative z-[350]">
          <DevicesModal
            isOpen={showDevices}
            onClose={() => setShowDevices(false)}
            user={user}
            hapticFeedback={hapticFeedback}
          />
        </div>
      )}

      {showLKModal && (
        <div className="relative z-[350]">
          <LKConnectionModal
            isOpen={showLKModal}
            onClose={() => setShowLKModal(false)}
            user={user}
            hapticFeedback={hapticFeedback}
          />
        </div>
      )}

      {/* Referral Bottom Sheet */}
      <AnimatePresence>
        {showReferral && (
          <motion.div
            key="referral-overlay"
            className="fixed inset-0 z-[350]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
            onClick={() => setShowReferral(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0"
            >
              <div style={{
                background: 'linear-gradient(180deg, #1E1D1A 0%, #141414 100%)',
                borderRadius: '24px 24px 0 0',
                padding: '12px 20px 40px',
                maxHeight: '70vh',
                overflowY: 'auto',
              }}>
                {/* Ручка */}
                <div style={{
                  width: '40px', height: '4px', borderRadius: '2px',
                  backgroundColor: 'rgba(255,255,255,0.2)', margin: '0 auto 20px',
                }} />

                <div style={{
                  fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '18px',
                  color: '#F4F3FC', marginBottom: '20px', paddingLeft: '4px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <Users style={{ width: '20px', height: '20px', color: '#3B82F6' }} />
                  Реферальная программа
                </div>

                {!referralData ? (
                  <div style={{ textAlign: 'center', padding: '24px' }}>
                    <div style={{
                      width: '32px', height: '32px', border: '2px solid rgba(59,130,246,0.3)',
                      borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                      margin: '0 auto',
                    }} />
                    <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginTop: '12px', display: 'block' }}>
                      Загрузка...
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Код */}
                    <div style={{
                      padding: '16px', borderRadius: '16px',
                      background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                      marginBottom: '12px',
                    }}>
                      <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                        Ваш код
                      </span>
                      <div style={{
                        fontFamily: "'Poppins', monospace", fontWeight: 700, fontSize: '22px',
                        color: '#60A5FA', marginTop: '4px',
                      }}>
                        {referralData.referral_code}
                      </div>
                    </div>

                    {/* Кнопка копирования */}
                    <button
                      onClick={copyReferralLink}
                      style={{
                        width: '100%', padding: '14px', borderRadius: '14px',
                        border: 'none', cursor: 'pointer',
                        fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '15px',
                        color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        background: copiedLink
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                        transition: 'all 0.2s',
                        marginBottom: '16px',
                      }}
                    >
                      {copiedLink ? (
                        <><Award style={{ width: '18px', height: '18px' }} /> Скопировано!</>
                      ) : (
                        <><Copy style={{ width: '18px', height: '18px' }} /> Копировать ссылку</>
                      )}
                    </button>

                    {/* Статистика */}
                    {referralStats && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)', textAlign: 'center' }}>
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '22px', color: '#34D399' }}>
                            {referralStats.level_1_count || 0}
                          </span>
                          <br />
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Уровень 1</span>
                        </div>
                        <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', textAlign: 'center' }}>
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '22px', color: '#60A5FA' }}>
                            {referralStats.level_2_count || 0}
                          </span>
                          <br />
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Уровень 2</span>
                        </div>
                        <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)', textAlign: 'center' }}>
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '22px', color: '#A78BFA' }}>
                            {referralStats.level_3_count || 0}
                          </span>
                          <br />
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Уровень 3</span>
                        </div>
                        <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', textAlign: 'center' }}>
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '22px', color: '#FBBF24' }}>
                            {referralStats.total_referral_points || 0}
                          </span>
                          <br />
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Заработано</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            key="delete-overlay"
            className="fixed inset-0 z-[350] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#1C1C1C',
                borderRadius: '24px',
                padding: '28px 24px',
                maxWidth: '320px',
                width: '90%',
                textAlign: 'center',
              }}
            >
              <AlertTriangle style={{ width: '40px', height: '40px', color: '#EF4444', margin: '0 auto 12px' }} />
              <div style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                color: '#F4F3FC',
                marginBottom: '8px',
              }}>
                Удалить аккаунт?
              </div>
              <div style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '13px',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: '20px',
                lineHeight: 1.4,
              }}>
                Все данные будут безвозвратно удалены
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: '#F4F3FC',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Отмена
                </button>
                <button
                  disabled={deleteLoading}
                  onClick={async () => {
                    if (!user?.id || deleteLoading) return;
                    setDeleteLoading(true);
                    try {
                      const backendUrl = getBackendURL();
                      const response = await fetch(`${backendUrl}/api/user/${user.id}`, {
                        method: 'DELETE',
                      });
                      if (response.ok) {
                        if (hapticFeedback) hapticFeedback('notification', 'success');
                        // Полная очистка всех локальных данных (JWT + legacy)
                        clearAllLocalAuthData();
                        setShowDeleteConfirm(false);
                        onClose();
                        // Переходим на страницу входа (AuthGate больше не пропустит без JWT)
                        window.location.replace('/login');
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
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#EF4444',
                    border: 'none',
                    color: '#FFFFFF',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: deleteLoading ? 'not-allowed' : 'pointer',
                    opacity: deleteLoading ? 0.6 : 1,
                  }}
                >
                  {deleteLoading ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модалка деталей уровня */}
      <LevelDetailModal
        isOpen={showLevelDetail}
        onClose={() => setShowLevelDetail(false)}
        levelData={profileData ? {
          level: profileData.level || 1,
          tier: profileData.tier || 'base',
          xp: profileData.xp || 0,
          xp_current_level: profileData.xp_current_level || 0,
          xp_next_level: profileData.xp_next_level || 100,
          progress: profileData.xp_progress || 0,
          stars: profileData.stars || 1,
          title: profileData.level_title || '',
        } : null}
        hapticFeedback={hapticFeedback}
        telegramId={user?.id}
      />

      {/* Модалка Level-Up с конфетти */}
      <LevelUpModal
        isOpen={showLevelUp}
        onClose={() => setShowLevelUp(false)}
        newLevel={levelUpData?.newLevel}
        newTier={levelUpData?.newTier}
        oldTier={levelUpData?.oldTier}
        levelTitle={levelUpData?.levelTitle || profileData?.level_title || ''}
      />
    </>
  );
};

export default ProfileScreen;
