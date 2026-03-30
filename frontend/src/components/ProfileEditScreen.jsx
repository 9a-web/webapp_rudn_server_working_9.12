import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Camera, Trash2, RotateCcw, Pencil, AlertTriangle } from 'lucide-react';
import GroupSelector from './GroupSelector';
import { userAPI, getBackendURL } from '../services/api';

const ProfileEditScreen = ({ isOpen, onClose, user, userSettings, profilePhoto, hapticFeedback, onGroupChanged }) => {
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [avatarMode, setAvatarMode] = useState('telegram'); // 'telegram' | 'custom' | 'none'
  const [customAvatar, setCustomAvatar] = useState(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  if (!user) return null;

  const initial = (user.first_name?.[0] || user.username?.[0] || '?').toUpperCase();
  const displayName = (user.first_name || user.username || 'User').toUpperCase();
  const groupName = userSettings?.group_name || 'Не выбрана';

  // Текущий аватар
  const currentAvatar = avatarMode === 'custom' ? customAvatar : avatarMode === 'telegram' ? profilePhoto : null;

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomAvatar(ev.target.result);
      setAvatarMode('custom');
      setShowAvatarMenu(false);
      if (hapticFeedback) hapticFeedback('notification', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAvatar = () => {
    setAvatarMode('none');
    setCustomAvatar(null);
    setShowAvatarMenu(false);
    if (hapticFeedback) hapticFeedback('impact', 'medium');
  };

  const handleRestoreTelegram = () => {
    setAvatarMode('telegram');
    setCustomAvatar(null);
    setShowAvatarMenu(false);
    if (hapticFeedback) hapticFeedback('impact', 'light');
  };

  const handleGroupSelected = async (groupData) => {
    setSaving(true);
    try {
      const settings = await userAPI.saveUserSettings({
        telegram_id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        ...groupData,
      });

      if (onGroupChanged) onGroupChanged(settings);
      setShowGroupSelector(false);
      if (hapticFeedback) hapticFeedback('notification', 'success');
    } catch (err) {
      console.error('Error changing group:', err);
      if (hapticFeedback) hapticFeedback('notification', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && !showGroupSelector && (
          <motion.div
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
                if (hapticFeedback) hapticFeedback('impact', 'light');
                onClose();
              }}>
                <ChevronLeft style={{ width: '31px', height: '31px', color: 'rgba(255,255,255,0.7)' }} />
              </button>
              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                color: '#F4F3FC',
              }}>
                Редактирование
              </span>
              <div style={{ width: '31px' }} />
            </motion.div>

            {/* Контент */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              {/* Аватар */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', damping: 20 }}
                style={{ position: 'relative', marginBottom: '12px' }}
              >
                <div
                  onClick={() => {
                    if (hapticFeedback) hapticFeedback('impact', 'light');
                    setShowAvatarMenu(!showAvatarMenu);
                  }}
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '40px',
                    overflow: 'hidden',
                    border: '3px solid rgba(248,185,76,0.3)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {currentAvatar ? (
                    <img
                      src={currentAvatar}
                      alt="Avatar"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span className="text-white text-3xl font-bold">{initial}</span>
                    </div>
                  )}

                  {/* Overlay камера */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: showAvatarMenu ? 1 : 0,
                    transition: 'opacity 0.2s',
                  }}>
                    <Camera style={{ width: '28px', height: '28px', color: '#FFFFFF' }} />
                  </div>
                </div>

                {/* Меню аватара */}
                <AnimatePresence>
                  {showAvatarMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginTop: '8px',
                        background: '#1E1D1A',
                        borderRadius: '16px',
                        padding: '6px',
                        minWidth: '220px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        zIndex: 10,
                      }}
                    >
                      {/* Загрузить свою */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <Camera style={{ width: '18px', height: '18px', color: '#F8B94C' }} />
                        <span style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontWeight: 500,
                          fontSize: '14px',
                          color: '#F4F3FC',
                        }}>Загрузить свою</span>
                      </button>

                      {/* Удалить */}
                      <button
                        onClick={handleDeleteAvatar}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <Trash2 style={{ width: '18px', height: '18px', color: '#EF4444' }} />
                        <span style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontWeight: 500,
                          fontSize: '14px',
                          color: '#EF4444',
                        }}>Удалить фото</span>
                      </button>

                      {/* Вернуть из Telegram */}
                      {avatarMode !== 'telegram' && (
                        <button
                          onClick={handleRestoreTelegram}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <RotateCcw style={{ width: '18px', height: '18px', color: '#3B82F6' }} />
                          <span style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontWeight: 500,
                            fontSize: '14px',
                            color: '#3B82F6',
                          }}>Вернуть из Telegram</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </motion.div>

              <span style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 400,
                fontSize: '12px',
                color: 'rgba(255,255,255,0.3)',
                marginBottom: '32px',
              }}>
                Нажмите на аватар для изменения
              </span>

              {/* Поля */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Имя (readonly) */}
                <motion.div
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <label style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.4)',
                    marginBottom: '6px',
                    display: 'block',
                    paddingLeft: '4px',
                  }}>
                    Имя
                  </label>
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1.5px solid rgba(255,255,255,0.08)',
                  }}>
                    <span style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 600,
                      fontSize: '16px',
                      color: 'rgba(255,255,255,0.35)',
                    }}>
                      @{user.username || 'user'}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 400,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.25)',
                    marginTop: '6px',
                    display: 'block',
                    paddingLeft: '4px',
                  }}>
                    Используется короткое имя (@username) из Telegram
                  </span>
                </motion.div>

                {/* Группа */}
                <motion.div
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <label style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 500,
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.4)',
                    marginBottom: '6px',
                    display: 'block',
                    paddingLeft: '4px',
                  }}>
                    Группа
                  </label>
                  <button
                    onClick={() => {
                      if (hapticFeedback) hapticFeedback('impact', 'light');
                      setShowGroupSelector(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1.5px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <span style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 600,
                      fontSize: '16px',
                      color: '#F8B94C',
                    }}>
                      {groupName}
                    </span>
                    <Pencil style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.3)' }} />
                  </button>

                  {/* Предупреждение */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    marginTop: '8px',
                    paddingLeft: '4px',
                  }}>
                    <AlertTriangle style={{
                      width: '13px',
                      height: '13px',
                      color: '#F8B94C',
                      flexShrink: 0,
                      marginTop: '1px',
                    }} />
                    <span style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontWeight: 400,
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.35)',
                      lineHeight: 1.4,
                    }}>
                      Смена группы повлияет на всё расписание, задачи и другие функции приложения
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GroupSelector overlay */}
      <AnimatePresence>
        {isOpen && showGroupSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[360]"
            style={{ backgroundColor: '#000000' }}
          >
            <GroupSelector
              onGroupSelected={handleGroupSelected}
              onCancel={() => setShowGroupSelector(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ProfileEditScreen;
