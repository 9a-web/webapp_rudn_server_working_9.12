/**
 * ProfileSettingsModal - Настройки приватности
 * Полноэкранный стиль как ProfileEditScreen, с дебаунс-автосохранением
 * и неблокирующим тостом о статусе.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Eye, Users, Trophy, Calendar, Radio, ShieldCheck,
  CheckCircle2, AlertCircle, Loader2, Info,
} from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';

const DEBOUNCE_MS = 600;

const ProfileSettingsModal = ({ isOpen, onClose, user, userSettings, hapticFeedback }) => {
  const telegramId = user?.id;

  const [privacySettings, setPrivacySettings] = useState({
    show_online_status: true,
    show_in_search: true,
    show_friends_list: true,
    show_achievements: true,
    show_schedule: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  const [lastError, setLastError] = useState(null);

  const debounceTimer = useRef(null);
  const latestSettings = useRef(privacySettings);
  const mountedRef = useRef(true);

  // Обновляем ref при каждом изменении
  useEffect(() => {
    latestSettings.current = privacySettings;
  }, [privacySettings]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Загрузка настроек
  useEffect(() => {
    const load = async () => {
      if (!isOpen || !telegramId) return;
      setIsLoading(true);
      setSaveStatus('idle');
      setLastError(null);
      try {
        const data = await friendsAPI.getPrivacySettings(telegramId);
        if (mountedRef.current) setPrivacySettings(data);
      } catch (err) {
        console.error('Error loading privacy settings:', err);
        if (mountedRef.current) {
          setLastError('Не удалось загрузить настройки');
          setSaveStatus('error');
        }
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };
    load();
  }, [isOpen, telegramId]);

  const doSave = useCallback(async (settings) => {
    if (!telegramId) return;
    setSaveStatus('saving');
    try {
      await friendsAPI.updatePrivacySettings(telegramId, settings);
      if (!mountedRef.current) return;
      setSaveStatus('saved');
      hapticFeedback?.('notification', 'success');
      // Сбрасываем "saved" через 1.5с — вернёмся в idle
      setTimeout(() => {
        if (mountedRef.current && saveStatus !== 'pending') setSaveStatus('idle');
      }, 1500);
    } catch (err) {
      console.error('Error saving privacy:', err);
      if (!mountedRef.current) return;
      setLastError(err?.message || 'Ошибка сохранения');
      setSaveStatus('error');
      hapticFeedback?.('notification', 'error');
    }
  }, [telegramId, hapticFeedback, saveStatus]);

  const scheduleSave = useCallback((newSettings) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSaveStatus('pending');
    debounceTimer.current = setTimeout(() => {
      doSave(newSettings);
    }, DEBOUNCE_MS);
  }, [doSave]);

  const toggle = (key) => {
    hapticFeedback?.('impact', 'light');
    setPrivacySettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      scheduleSave(next);
      return next;
    });
  };

  const handleClose = async () => {
    // Если есть отложенное сохранение — дождёмся
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      try {
        await doSave(latestSettings.current);
      } catch {/* noop, пользователь увидит toast */}
    }
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
      warning: !privacySettings.show_in_search ? 'Профиль скрыт из поиска — QR-код и прямые ссылки недоступны для не-друзей' : null,
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
              <ShieldCheck style={{ width: '16px', height: '16px', color: '#FFBE4E' }} />
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
                <Loader2 style={{
                  width: '32px',
                  height: '32px',
                  color: '#F8B94C',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            ) : (
              privacyItems.map((item, idx) => {
                const Icon = item.icon;
                const isEnabled = privacySettings[item.key];

                return (
                  <React.Fragment key={item.key}>
                    <motion.button
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
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
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
                          lineHeight: 1.3,
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

                    {/* Предупреждение под пунктом если активно */}
                    {item.warning && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          display: 'flex',
                          gap: '8px',
                          padding: '10px 14px',
                          marginTop: '-2px',
                          marginBottom: '6px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(251, 191, 36, 0.08)',
                          border: '1px solid rgba(251, 191, 36, 0.15)',
                          overflow: 'hidden',
                        }}
                      >
                        <Info style={{ width: '14px', height: '14px', color: '#FBBF24', flexShrink: 0, marginTop: '1px' }} />
                        <span style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontSize: '11px',
                          color: 'rgba(251, 191, 36, 0.8)',
                          lineHeight: 1.4,
                        }}>
                          {item.warning}
                        </span>
                      </motion.div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>

          {/* Toast со статусом сохранения — фиксированный снизу */}
          <AnimatePresence>
            {saveStatus !== 'idle' && (
              <motion.div
                key={saveStatus}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.22 }}
                style={{
                  position: 'absolute',
                  bottom: 24,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '999px',
                  backgroundColor: saveStatus === 'error' ? 'rgba(239, 68, 68, 0.92)'
                                 : saveStatus === 'saved' ? 'rgba(34, 197, 94, 0.92)'
                                 : 'rgba(0, 0, 0, 0.85)',
                  backdropFilter: 'blur(12px)',
                  border: saveStatus === 'error' ? '1px solid rgba(239, 68, 68, 0.3)'
                         : saveStatus === 'saved' ? '1px solid rgba(34, 197, 94, 0.3)'
                         : '1px solid rgba(255,255,255,0.1)',
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 500,
                  fontSize: '13px',
                  color: '#FFFFFF',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                }}>
                  {saveStatus === 'pending' && (
                    <>
                      <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 0.8s linear infinite' }} />
                      Изменения…
                    </>
                  )}
                  {saveStatus === 'saving' && (
                    <>
                      <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 0.8s linear infinite' }} />
                      Сохраняем…
                    </>
                  )}
                  {saveStatus === 'saved' && (
                    <>
                      <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                      Сохранено
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <>
                      <AlertCircle style={{ width: '14px', height: '14px' }} />
                      {lastError || 'Не удалось сохранить'}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileSettingsModal;
