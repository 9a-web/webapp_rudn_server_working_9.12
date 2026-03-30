import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { ChevronLeft, Trophy, Settings, QrCode, X, Sliders, Smartphone, Users, Link2, Snowflake, Trash2, AlertTriangle, GraduationCap, Pen, ShieldCogCorner } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { friendsAPI } from '../services/friendsAPI';
import ProfileSettingsModal from './ProfileSettingsModal';
import ProfileEditScreen from './ProfileEditScreen';
import DevicesModal from './DevicesModal';
import LKConnectionModal from './LKConnectionModal';

const ADMIN_UIDS = ['765963392', '1311283832'];

const TABS = [
  { id: 'general', label: 'Общее' },
  { id: 'friends', label: 'Друзья' },
  { id: 'materials', label: 'Материалы' },
];

const ProfileScreen = ({ isOpen, onClose, user, userSettings, profilePhoto, hapticFeedback, onThemeChange }) => {
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

  const isAdmin = useMemo(() => {
    if (!user?.id) return false;
    return ADMIN_UIDS.includes(String(user.id));
  }, [user?.id]);

  // Bottom Sheet drag
  const sheetY = useMotionValue(0);
  const sheetBg = useTransform(sheetY, [0, 400], ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']);

  const loadQRData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await friendsAPI.getProfileQR(user.id);
      setQrData(data);
    } catch (err) {
      console.error('Failed to load QR data:', err);
    }
  }, [user?.id]);

  const handleQRClick = () => {
    if (hapticFeedback) hapticFeedback('impact', 'light');
    loadQRData();
    setShowQR(true);
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
      icon: ShieldCogCorner,
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
      action: () => { /* TODO */ },
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
          {/* Верхняя панель навигации */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4"
            style={{
              paddingTop: 'calc(var(--header-safe-padding, 0px) + 16px)',
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
                  fontSize: '21px',
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
                  fontSize: '21px',
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
                  fontSize: '21px',
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

      {/* QR-код оверлей */}
      <AnimatePresence>
        {showQR && (
          <motion.div
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
              }}>
                {qrData?.qr_data ? (
                  <QRCodeSVG
                    value={qrData.qr_data}
                    size={200}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="M"
                  />
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
                    Загрузка...
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Bottom Sheet */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
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
        onOpenPrivacy={() => {
          setShowProfileEdit(false);
          setTimeout(() => setShowProfileSettings(true), 200);
        }}
      />

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

      {/* Delete Confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
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
                  onClick={() => {
                    // TODO: delete account API call
                    setShowDeleteConfirm(false);
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
                    cursor: 'pointer',
                  }}
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
};

export default ProfileScreen;
