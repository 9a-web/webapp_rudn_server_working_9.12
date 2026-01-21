/**
 * PrivacySettingsModal - Настройки приватности профиля
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Users, Trophy, Calendar, Shield, Radio } from 'lucide-react';
import { friendsAPI } from '../services/friendsAPI';

const PrivacySettingsModal = ({ isOpen, onClose, telegramId, hapticFeedback }) => {
  const [settings, setSettings] = useState({
    show_online_status: true,
    show_in_search: true,
    show_friends_list: true,
    show_achievements: true,
    show_schedule: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Загрузка настроек
  useEffect(() => {
    const loadSettings = async () => {
      if (!isOpen || !telegramId) return;
      
      setIsLoading(true);
      try {
        const data = await friendsAPI.getPrivacySettings(telegramId);
        setSettings(data);
      } catch (error) {
        console.error('Error loading privacy settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [isOpen, telegramId]);

  // Сохранение настроек
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await friendsAPI.updatePrivacySettings(telegramId, settings);
      hapticFeedback?.('notification', 'success');
      onClose();
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      hapticFeedback?.('notification', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSetting = (key) => {
    hapticFeedback?.('impact', 'light');
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const settingsItems = [
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
      description: 'Показывать достижения и очки'
    },
    {
      key: 'show_schedule',
      icon: Calendar,
      title: 'Расписание',
      description: 'Друзья могут видеть ваше расписание'
    }
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 rounded-t-3xl max-h-[85vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-xl">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Приватность</h2>
                  <p className="text-sm text-gray-400">Управление видимостью профиля</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-white/10 rounded-xl text-gray-400 hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-4 pb-4 overflow-y-auto max-h-[50vh]">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {settingsItems.map((item) => {
                    const Icon = item.icon;
                    const isEnabled = settings[item.key];
                    
                    return (
                      <button
                        key={item.key}
                        onClick={() => toggleSetting(item.key)}
                        className="w-full flex items-center gap-4 p-4 bg-white/5 rounded-2xl transition-all hover:bg-white/10"
                      >
                        <div className={`p-2 rounded-xl ${isEnabled ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                          <Icon className={`w-5 h-5 ${isEnabled ? 'text-green-400' : 'text-gray-400'}`} />
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
            </div>

            {/* Footer */}
            <div className="px-4 pb-6 pt-3 border-t border-white/10">
              <button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className={`w-full py-3.5 rounded-2xl font-medium transition-all ${
                  isSaving || isLoading
                    ? 'bg-white/10 text-gray-500'
                    : 'bg-purple-500 text-white'
                }`}
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PrivacySettingsModal;
