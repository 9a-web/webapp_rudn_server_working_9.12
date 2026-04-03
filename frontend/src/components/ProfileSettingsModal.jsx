/**
 * ProfileSettingsModal - Настройки приватности
 * Полноэкранный стиль, как ProfileEditScreen
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Eye, Users, Trophy, Calendar, Radio, ShieldCogCorner
} from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';

const ProfileSettingsModal = ({ isOpen, onClose, user, userSettings, hapticFeedback }) => {
  const telegramId = user?.id;

  const [privacySettings, setPrivacySettings] = useState({
    show_online_status: true,
    show_in_search: true,
    show_friends_list: true,
    show_achievements: true,
    show_schedule: true,
  });
  const [originalSettings, setOriginalSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Загрузка настроек
  useEffect(() => {
    const load = async () => {
      if (!isOpen || !telegramId) return;
      setIsLoading(true);
      setIsDirty(false);
      try {
        const data = await friendsAPI.getPrivacySettings(telegramId);
        setPrivacySettings(data);
        setOriginalSettings(JSON.stringify(data));
      } catch (err) {
        console.error('Error loading privacy settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen, telegramId]);

  // Сохранение
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await friendsAPI.updatePrivacySettings(telegramId, privacySettings);
      hapticFeedback?.('notification', 'success');
      setSaved(true);
      setIsDirty(false);
      setOriginalSettings(JSON.stringify(privacySettings));
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving privacy:', err);
      hapticFeedback?.('notification', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = (key) => {
    hapticFeedback?.('impact', 'light');
    setPrivacySettings(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
    setIsDirty(true);
  };

  // Bug 16: Автосохранение при закрытии если есть несохранённые изменения
  const handleClose = async () => {
    if (isDirty && !isSaving) {
      try {
        await friendsAPI.updatePrivacySettings(telegramId, privacySettings);
        hapticFeedback?.('notification', 'success');
      } catch (err) {
        console.error('Auto-save privacy on close error:', err);
      }
    }
    setIsDirty(false);
    onClose();
  };

  const privacyItems = [
    {
      key: 'show_online_status',
      icon: Radio,
      title: 'Статус онлайн',
      description: 'Показывать, когда вы в сети',
      activeColor: '#22C55E',
    },
    {
      key: 'show_in_search',
      icon: Eye,
      title: 'Показывать в поиске',
      description: 'Другие могут найти вас',
      activeColor: '#3B82F6',
    },
    {
      key: 'show_friends_list',
      icon: Users,
      title: 'Список друзей',
      description: 'Показывать количество друзей',
      activeColor: '#A855F7',
    },
    {
      key: 'show_achievements',
      icon: Trophy,
      title: 'Достижения',
      description: 'Показывать достижения и $RDN',
      activeColor: '#F8B94C',
    },
    {
      key: 'show_schedule',
      icon: Calendar,
      title: 'Расписание',
      description: 'Друзья могут видеть ваше расписание',
      activeColor: '#EC4899',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="privacy-settings-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[350] flex flex-col"
          style={{ backgroundColor: '#000000' }}
        >
          {/* Верхняя панель */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="flex items-center justify-between px-4"
            style={{ paddingTop: 'calc(var(--header-safe-padding, 0px) + 16px)' }}
          >
            <button onClick={() => {
              hapticFeedback?.('impact', 'light');
              handleClose();
            }}>
              <ChevronLeft style={{ width: '31px', height: '31px', color: 'rgba(255,255,255,0.7)' }} />
            </button>
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              color: '#F4F3FC',
            }}>
              Приватность
            </span>
            <div style={{ width: '31px' }} />
          </motion.div>

          {/* Контент */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 24px 120px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {/* Заголовок секции */}
            <motion.div
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                paddingLeft: '4px',
              }}
            >
              <ShieldCogCorner style={{ width: '16px', height: '16px', color: '#FFBE4E' }} />
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 500,
                fontSize: '12px',
                color: 'rgba(255,255,255,0.4)',
              }}>
                Управление видимостью данных
              </span>
            </motion.div>

            {isLoading ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '48px 0',
              }}>
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
              privacyItems.map((item, idx) => {
                const Icon = item.icon;
                const isEnabled = privacySettings[item.key];

                return (
                  <motion.button
                    key={item.key}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + idx * 0.05 }}
                    onClick={() => toggle(item.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '16px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${isEnabled ? `${item.activeColor}25` : 'rgba(255,255,255,0.06)'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                  >
                    {/* Иконка */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      backgroundColor: isEnabled ? `${item.activeColor}15` : 'rgba(255,255,255,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'background-color 0.2s',
                    }}>
                      <Icon style={{
                        width: '18px',
                        height: '18px',
                        color: isEnabled ? item.activeColor : 'rgba(255,255,255,0.25)',
                        transition: 'color 0.2s',
                      }} />
                    </div>

                    {/* Текст */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 600,
                        fontSize: '14px',
                        color: '#F4F3FC',
                        lineHeight: 1.2,
                      }}>
                        {item.title}
                      </span>
                      <span style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 400,
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.3)',
                        lineHeight: 1.2,
                      }}>
                        {item.description}
                      </span>
                    </div>

                    {/* Toggle */}
                    <div style={{
                      width: '44px',
                      height: '26px',
                      borderRadius: '13px',
                      padding: '3px',
                      backgroundColor: isEnabled ? item.activeColor : 'rgba(255,255,255,0.1)',
                      transition: 'background-color 0.25s ease',
                      flexShrink: 0,
                    }}>
                      <motion.div
                        animate={{ x: isEnabled ? 18 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '10px',
                          backgroundColor: '#FFFFFF',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }}
                      />
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>

          {/* Кнопка сохранения — фиксированная снизу, видна только при изменениях */}
          <AnimatePresence>
            {(isDirty || saved) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25 }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '16px 24px 32px',
                  background: 'linear-gradient(transparent, #000000 30%)',
                }}
              >
                <button
                  onClick={handleSave}
                  disabled={isSaving || isLoading}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '16px',
                    border: 'none',
                    cursor: isSaving || isLoading ? 'not-allowed' : 'pointer',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '15px',
                    color: '#000000',
                    background: saved
                      ? '#22C55E'
                      : isSaving || isLoading
                        ? 'rgba(255,255,255,0.1)'
                        : 'linear-gradient(135deg, #F8B94C 0%, #FFBE4E 100%)',
                    transition: 'opacity 0.2s',
                    opacity: isSaving || isLoading ? 0.5 : 1,
                  }}
                >
                  {saved ? '✓ Сохранено' : isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileSettingsModal;
