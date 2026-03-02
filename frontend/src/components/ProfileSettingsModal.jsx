/**
 * ProfileSettingsModal - Настройки профиля
 * Объединяет настройки конфиденциальности, дизайна и другие
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Eye, EyeOff, Users, Trophy, Calendar, Shield, Radio,
  Palette, Snowflake, Settings, ChevronRight, Sparkles
} from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';
import { getBackendURL } from '../utils/config';

const ProfileSettingsModal = ({ isOpen, onClose, telegramId, hapticFeedback, onThemeChange }) => {
  const [activeTab, setActiveTab] = useState('privacy'); // 'privacy' | 'design'
  
  // Privacy settings state
  const [privacySettings, setPrivacySettings] = useState({
    show_online_status: true,
    show_in_search: true,
    show_friends_list: true,
    show_achievements: true,
    show_schedule: true
  });
  const [isLoadingPrivacy, setIsLoadingPrivacy] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  // Design settings state
  const [newYearThemeMode, setNewYearThemeMode] = useState('auto');
  const [isLoadingDesign, setIsLoadingDesign] = useState(false);
  const [isSavingDesign, setIsSavingDesign] = useState(false);

  // Загрузка настроек приватности
  useEffect(() => {
    const loadPrivacySettings = async () => {
      if (!isOpen || !telegramId) return;
      
      setIsLoadingPrivacy(true);
      try {
        const data = await friendsAPI.getPrivacySettings(telegramId);
        setPrivacySettings(data);
      } catch (error) {
        console.error('Error loading privacy settings:', error);
      } finally {
        setIsLoadingPrivacy(false);
      }
    };

    if (activeTab === 'privacy') {
      loadPrivacySettings();
    }
  }, [isOpen, telegramId, activeTab]);

  // Загрузка настроек дизайна
  useEffect(() => {
    const loadDesignSettings = async () => {
      if (!isOpen || !telegramId) return;

      setIsLoadingDesign(true);
      try {
        const backendUrl = getBackendURL();
        const response = await fetch(`${backendUrl}/api/user-settings/${telegramId}/theme`);
        
        if (response.ok) {
          const responseText = await response.text();
          let data = {};
          try {
            data = responseText ? JSON.parse(responseText) : {};
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            data = {};
          }
          setNewYearThemeMode(data.new_year_theme_mode || 'auto');
        }
      } catch (error) {
        console.error('Error loading design settings:', error);
      } finally {
        setIsLoadingDesign(false);
      }
    };

    if (activeTab === 'design') {
      loadDesignSettings();
    }
  }, [isOpen, telegramId, activeTab]);

  // Сохранение настроек приватности
  const handleSavePrivacy = async () => {
    setIsSavingPrivacy(true);
    try {
      await friendsAPI.updatePrivacySettings(telegramId, privacySettings);
      hapticFeedback?.('notification', 'success');
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      hapticFeedback?.('notification', 'error');
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  // Изменение режима новогодней темы
  const changeNewYearThemeMode = async (mode) => {
    if (!telegramId || isSavingDesign) return;

    setIsSavingDesign(true);
    try {
      const backendUrl = getBackendURL();
      const response = await fetch(`${backendUrl}/api/user-settings/${telegramId}/theme`, {
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
        hapticFeedback?.('impact', 'medium');
      } else {
        throw new Error('Error saving theme settings');
      }
    } catch (error) {
      console.error('Error updating theme settings:', error);
      hapticFeedback?.('notification', 'error');
    } finally {
      setIsSavingDesign(false);
    }
  };

  const togglePrivacySetting = (key) => {
    hapticFeedback?.('impact', 'light');
    setPrivacySettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const privacyItems = [
    {
      key: 'show_online_status',
      icon: Radio,
      title: 'Статус онлайн',
      description: 'Показывать, когда вы в сети'
    },
    {
      key: 'show_in_search',
      icon: Eye,
      title: 'Показывать в поиске',
      description: 'Другие могут найти вас'
    },
    {
      key: 'show_friends_list',
      icon: Users,
      title: 'Список друзей',
      description: 'Показывать количество друзей'
    },
    {
      key: 'show_achievements',
      icon: Trophy,
      title: 'Достижения',
      description: 'Показывать достижения и $RDN'
    },
    {
      key: 'show_schedule',
      icon: Calendar,
      title: 'Расписание',
      description: 'Друзья могут видеть ваше расписание'
    }
  ];

  const tabs = [
    { id: 'privacy', label: 'Конфиденциальность', icon: Shield },
    { id: 'design', label: 'Дизайн', icon: Palette }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[111] bg-gray-900 rounded-t-3xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
                  <Settings className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Настройки профиля</h2>
                  <p className="text-sm text-gray-400">Персонализация и приватность</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white/10 rounded-xl text-gray-400 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-4 pb-4">
              <div className="flex gap-2 p-1 bg-gray-800/50 rounded-2xl">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        hapticFeedback?.('impact', 'light');
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                        isActive 
                          ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="px-4 pb-4 overflow-y-auto max-h-[50vh]">
              {/* Privacy Tab */}
              {activeTab === 'privacy' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {isLoadingPrivacy ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {privacyItems.map((item) => {
                        const Icon = item.icon;
                        const isEnabled = privacySettings[item.key];
                        
                        return (
                          <button
                            key={item.key}
                            onClick={() => togglePrivacySetting(item.key)}
                            className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl transition-all hover:bg-white/10 active:scale-[0.98]"
                          >
                            <div className={`p-2 rounded-xl transition-colors ${isEnabled ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                              <Icon className={`w-5 h-5 transition-colors ${isEnabled ? 'text-green-400' : 'text-gray-400'}`} />
                            </div>
                            
                            <div className="flex-1 text-left">
                              <h3 className="font-medium text-white">{item.title}</h3>
                              <p className="text-sm text-gray-400">{item.description}</p>
                            </div>

                            {/* Toggle */}
                            <div
                              className={`w-12 h-7 rounded-full p-1 transition-colors ${
                                isEnabled ? 'bg-green-500' : 'bg-gray-600'
                              }`}
                            >
                              <motion.div
                                animate={{ x: isEnabled ? 20 : 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                className="w-5 h-5 bg-white rounded-full shadow-md"
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Design Tab */}
              {activeTab === 'design' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {isLoadingDesign ? (
                    <div className="flex justify-center py-8">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Новогодняя тема */}
                      <div 
                        className="w-full p-4 rounded-2xl transition-all"
                        style={{
                          backgroundColor: 'rgba(139, 92, 246, 0.1)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                        }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 rounded-xl bg-purple-500/20">
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
                            disabled={isSavingDesign}
                            className={`px-3 py-3 rounded-xl text-xs font-medium transition-all ${
                              newYearThemeMode === 'auto'
                                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                            } ${isSavingDesign ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                          >
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="text-lg">🌙</span>
                              <span>Авто</span>
                            </div>
                          </button>

                          {/* Всегда */}
                          <button
                            onClick={() => changeNewYearThemeMode('always')}
                            disabled={isSavingDesign}
                            className={`px-3 py-3 rounded-xl text-xs font-medium transition-all ${
                              newYearThemeMode === 'always'
                                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                            } ${isSavingDesign ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                          >
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="text-lg">❄️</span>
                              <span>Всегда</span>
                            </div>
                          </button>

                          {/* Выкл */}
                          <button
                            onClick={() => changeNewYearThemeMode('off')}
                            disabled={isSavingDesign}
                            className={`px-3 py-3 rounded-xl text-xs font-medium transition-all ${
                              newYearThemeMode === 'off'
                                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                            } ${isSavingDesign ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                          >
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="text-lg">🔒</span>
                              <span>Выкл</span>
                            </div>
                          </button>
                        </div>

                        {/* Подсказка по текущему режиму */}
                        <div className="text-xs text-gray-500 text-center px-2 mt-3">
                          {newYearThemeMode === 'auto' && '⚡ Автоматически зимой (дек/янв/фев)'}
                          {newYearThemeMode === 'always' && '🎄 Снег падает круглый год'}
                          {newYearThemeMode === 'off' && '🚫 Тема отключена'}
                        </div>
                      </div>

                      {/* Дополнительная подсказка */}
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-indigo-300 mb-1">Скоро больше тем!</p>
                            <p className="text-xs text-gray-400">Мы работаем над новыми темами оформления для вашего профиля</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 pb-6 pt-3 border-t border-white/10">
              {activeTab === 'privacy' ? (
                <button
                  onClick={handleSavePrivacy}
                  disabled={isSavingPrivacy || isLoadingPrivacy}
                  className={`w-full py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] ${
                    isSavingPrivacy || isLoadingPrivacy
                      ? 'bg-white/10 text-gray-500'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                  }`}
                >
                  {isSavingPrivacy ? 'Сохранение...' : 'Сохранить настройки'}
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full py-3.5 rounded-2xl font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 transition-all active:scale-[0.98]"
                >
                  Готово
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileSettingsModal;
