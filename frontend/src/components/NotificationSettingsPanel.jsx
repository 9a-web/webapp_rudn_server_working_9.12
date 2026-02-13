/**
 * NotificationSettingsPanel - Настройки уведомлений
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ArrowLeft, Bell, BellOff, Calendar, Users, 
  Home, Trophy, MessageSquare, AlertCircle, Clock, Send
} from 'lucide-react';
import { notificationsAPI } from '../services/notificationsAPI';

const CATEGORIES = [
  {
    key: 'study',
    icon: Calendar,
    color: 'blue',
    title: 'Учебные',
    description: 'Уведомления о парах и расписании',
    settings: [
      { key: 'study_enabled', label: 'Включить' },
      { key: 'study_push', label: 'Push в Telegram' },
      { key: 'study_minutes_before', label: 'За сколько минут', type: 'select', options: [5, 10, 15, 20, 30] }
    ]
  },
  {
    key: 'social',
    icon: Users,
    color: 'purple',
    title: 'Социальные',
    description: 'Заявки в друзья и сообщения',
    settings: [
      { key: 'social_enabled', label: 'Включить' },
      { key: 'social_push', label: 'Push в Telegram' },
      { key: 'social_messages', label: 'Сообщения от друзей' },
      { key: 'social_friend_requests', label: 'Заявки в друзья' },
      { key: 'social_friend_accepted', label: 'Принятие заявок' }
    ]
  },
  {
    key: 'rooms',
    icon: Home,
    color: 'green',
    title: 'Комнаты',
    description: 'Задачи и приглашения в комнаты',
    settings: [
      { key: 'rooms_enabled', label: 'Включить' },
      { key: 'rooms_push', label: 'Push в Telegram' },
      { key: 'rooms_new_tasks', label: 'Новые задачи' },
      { key: 'rooms_assignments', label: 'Назначения задач' },
      { key: 'rooms_completions', label: 'Выполнение задач' }
    ]
  },
  {
    key: 'journal',
    icon: MessageSquare,
    color: 'indigo',
    title: 'Журнал',
    description: 'Отметки посещаемости',
    settings: [
      { key: 'journal_enabled', label: 'Включить' },
      { key: 'journal_push', label: 'Push в Telegram' }
    ]
  },
  {
    key: 'achievements',
    icon: Trophy,
    color: 'yellow',
    title: 'Достижения',
    description: 'Новые достижения и очки',
    settings: [
      { key: 'achievements_enabled', label: 'Включить' },
      { key: 'achievements_push', label: 'Push в Telegram' }
    ]
  },
  {
    key: 'system',
    icon: AlertCircle,
    color: 'gray',
    title: 'Системные',
    description: 'Обновления и объявления',
    settings: [
      { key: 'system_enabled', label: 'Включить' },
      { key: 'system_push', label: 'Push в Telegram' }
    ]
  }
];

const NotificationSettingsPanel = ({ isOpen, onClose, telegramId, hapticFeedback }) => {
  const [settings, setSettings] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Загрузка настроек
  useEffect(() => {
    const loadSettings = async () => {
      if (!isOpen || !telegramId) return;
      
      setIsLoading(true);
      try {
        const data = await notificationsAPI.getSettings(telegramId);
        setSettings(data);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [isOpen, telegramId]);

  // Сохранение настроек
  const saveSettings = async (newSettings) => {
    setIsSaving(true);
    try {
      await notificationsAPI.updateSettings(telegramId, newSettings);
      setSettings(newSettings);
      hapticFeedback?.('notification', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      hapticFeedback?.('notification', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Переключение настройки
  const toggleSetting = (key) => {
    hapticFeedback?.('impact', 'light');
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Изменение select
  const changeSetting = (key, value) => {
    hapticFeedback?.('impact', 'light');
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Переключение всех уведомлений
  const toggleAll = () => {
    hapticFeedback?.('impact', 'medium');
    const newValue = !settings.notifications_enabled;
    const newSettings = { ...settings, notifications_enabled: newValue };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

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

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-gray-900 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-white">Настройки уведомлений</h2>
                <p className="text-sm text-gray-400">Управление категориями</p>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Главный переключатель */}
                  <button
                    onClick={toggleAll}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      settings.notifications_enabled 
                        ? 'bg-purple-500/20 border border-purple-500/50' 
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${settings.notifications_enabled ? 'bg-purple-500' : 'bg-gray-600'}`}>
                      {settings.notifications_enabled ? (
                        <Bell className="w-6 h-6 text-white" />
                      ) : (
                        <BellOff className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-white">
                        {settings.notifications_enabled ? 'Уведомления включены' : 'Уведомления выключены'}
                      </h3>
                      <p className="text-sm text-gray-400">
                        Главный переключатель всех уведомлений
                      </p>
                    </div>
                    <div className={`w-12 h-7 rounded-full p-1 transition-colors ${
                      settings.notifications_enabled ? 'bg-purple-500' : 'bg-gray-600'
                    }`}>
                      <motion.div
                        animate={{ x: settings.notifications_enabled ? 20 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="w-5 h-5 bg-white rounded-full shadow-md"
                      />
                    </div>
                  </button>

                  {/* Категории */}
                  {settings.notifications_enabled && (
                    <div className="space-y-2 pt-2">
                      {CATEGORIES.map((category) => {
                        const Icon = category.icon;
                        const isExpanded = expandedCategory === category.key;
                        const isEnabled = settings[`${category.key}_enabled`];
                        
                        return (
                          <div key={category.key} className="bg-white/5 rounded-2xl overflow-hidden">
                            {/* Category header */}
                            <button
                              onClick={() => setExpandedCategory(isExpanded ? null : category.key)}
                              className="w-full flex items-center gap-3 p-4"
                            >
                              <div className={`p-2 rounded-xl bg-${category.color}-500/20`}>
                                <Icon className={`w-5 h-5 text-${category.color}-400`} />
                              </div>
                              <div className="flex-1 text-left">
                                <h4 className="font-medium text-white">{category.title}</h4>
                                <p className="text-xs text-gray-500">{category.description}</p>
                              </div>
                              <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                                isEnabled ? 'bg-green-500' : 'bg-gray-600'
                              }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSetting(`${category.key}_enabled`);
                                }}
                              >
                                <motion.div
                                  animate={{ x: isEnabled ? 16 : 0 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                  className="w-5 h-5 bg-white rounded-full shadow-md"
                                />
                              </div>
                            </button>
                            
                            {/* Expanded settings */}
                            <AnimatePresence>
                              {isExpanded && isEnabled && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-white/10"
                                >
                                  <div className="p-4 space-y-3">
                                    {category.settings.slice(1).map((setting) => (
                                      <div key={setting.key} className="flex items-center justify-between">
                                        <span className="text-sm text-gray-300">{setting.label}</span>
                                        
                                        {setting.type === 'select' ? (
                                          <select
                                            value={settings[setting.key] || setting.options[1]}
                                            onChange={(e) => changeSetting(setting.key, parseInt(e.target.value))}
                                            className="px-3 py-1.5 bg-white/10 rounded-lg text-white text-sm border-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                          >
                                            {setting.options.map((opt) => (
                                              <option key={opt} value={opt}>{opt} мин</option>
                                            ))}
                                          </select>
                                        ) : (
                                          <button
                                            onClick={() => toggleSetting(setting.key)}
                                            className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                                              settings[setting.key] ? 'bg-green-500' : 'bg-gray-600'
                                            }`}
                                          >
                                            <motion.div
                                              animate={{ x: settings[setting.key] ? 16 : 0 }}
                                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                              className="w-5 h-5 bg-white rounded-full shadow-md"
                                            />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationSettingsPanel;
