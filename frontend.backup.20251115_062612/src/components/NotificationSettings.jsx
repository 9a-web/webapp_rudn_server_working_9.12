import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { userAPI, achievementsAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { modalVariants, backdropVariants } from '../utils/animations';
import { pluralizeMinutes } from '../utils/pluralize';

export const NotificationSettings = ({ 
  telegramId, 
  onClose, 
  hapticFeedback,
  showAlert,
  isOpen 
}) => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [notificationTime, setNotificationTime] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Доступные варианты времени уведомления
  const timeOptions = [
    { value: 5, label: `5 ${pluralizeMinutes(5)}` },
    { value: 10, label: `10 ${pluralizeMinutes(10)}` },
    { value: 15, label: `15 ${pluralizeMinutes(15)}` },
    { value: 20, label: `20 ${pluralizeMinutes(20)}` },
    { value: 30, label: `30 ${pluralizeMinutes(30)}` },
  ];

  // Загрузка текущих настроек
  useEffect(() => {
    if (isOpen && telegramId) {
      loadSettings();
    }
  }, [isOpen, telegramId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await userAPI.getNotificationSettings(telegramId);
      setEnabled(settings.notifications_enabled);
      setNotificationTime(settings.notification_time);
    } catch (error) {
      console.error('Error loading notification settings:', error);
      showAlert && showAlert('Ошибка загрузки настроек уведомлений');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      hapticFeedback && hapticFeedback('impact', 'medium');
      
      const response = await userAPI.updateNotificationSettings(telegramId, {
        notifications_enabled: enabled,
        notification_time: notificationTime,
      });
      
      // Проверяем статус тестового уведомления
      if (enabled) {
        if (response.test_notification_sent === false) {
          // Тестовое уведомление не отправлено
          showAlert && showAlert(
            `⚠️ Настройки сохранены, но не удалось отправить тестовое уведомление.\n\n` +
            `Пожалуйста, начните диалог с ботом @rudn_mosbot в Telegram командой /start`
          );
          setSaving(false);
          return; // Не закрываем модальное окно, чтобы пользователь увидел предупреждение
        }
        
        // Отслеживаем настройку уведомлений
        try {
          const result = await achievementsAPI.trackAction(telegramId, 'configure_notifications', {
            notification_time: notificationTime,
            date: new Date().toISOString()
          });
          
          // Если есть новые достижения, можно показать уведомление
          if (result.new_achievements && result.new_achievements.length > 0) {
            console.log('New achievement earned:', result.new_achievements[0]);
          }
        } catch (error) {
          console.error('Failed to track configure_notifications action:', error);
        }
        
        showAlert && showAlert(
          `✅ Уведомления включены! Напоминание за ${notificationTime} ${pluralizeMinutes(notificationTime)}\n\n` +
          `Тестовое уведомление отправлено в бот @rudn_mosbot`
        );
      } else {
        showAlert && showAlert('🔕 Уведомления выключены');
      }
      
      // Закрываем окно после успешного сохранения
      setSaving(false);
      
      // Небольшая задержка перед закрытием для отображения сообщения
      setTimeout(() => {
        onClose && onClose();
      }, 300);
    } catch (error) {
      console.error('Error saving notification settings:', error);
      setSaving(false);
      showAlert && showAlert('Ошибка сохранения настроек');
    }
  };

  const handleToggle = () => {
    hapticFeedback && hapticFeedback('impact', 'light');
    setEnabled(!enabled);
  };

  const handleTimeChange = (time) => {
    hapticFeedback && hapticFeedback('selection');
    setNotificationTime(time);
  };

  if (!isOpen) {
    return null;
  }

  if (loading) {
    return (
      <motion.div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={backdropVariants}
      >
        <motion.div 
          className="bg-white rounded-3xl p-6 w-full max-w-md"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={modalVariants}
        >
          <div className="flex items-center justify-center py-8">
            <motion.div 
              className="rounded-full h-12 w-12 border-b-2 border-black"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={backdropVariants}
    >
      <motion.div 
        className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={modalVariants}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
              {enabled ? (
                <Bell className="w-5 h-5 text-black" />
              ) : (
                <BellOff className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <h2 className="text-xl font-bold text-black">Уведомления</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Toggle Switch */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-black">Получать уведомления</p>
              <p className="text-sm text-gray-500 mt-1">
                Напоминания о предстоящих парах
              </p>
            </div>
            <button
              onClick={handleToggle}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                enabled ? 'bg-black' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Time Selection */}
        {enabled && (
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-gray-600" />
              <p className="font-medium text-black">За сколько уведомлять?</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {timeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleTimeChange(option.value)}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                    notificationTime === option.value
                      ? 'bg-black text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Вы получите уведомление за {notificationTime} {pluralizeMinutes(notificationTime)} до начала каждой пары
            </p>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-900 mb-2">
            💡 <strong>Важно:</strong> Для получения уведомлений необходимо:
          </p>
          <ol className="text-sm text-blue-900 list-decimal list-inside space-y-1">
            <li>Начать диалог с ботом{' '}
              <a 
                href="https://t.me/rudn_pro_bot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold underline hover:text-blue-700"
              >
                @rudn_pro_bot
              </a>
            </li>
            <li>Отправить команду <code className="bg-blue-100 px-1 rounded">/start</code></li>
            <li>Включить уведомления в этом меню</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl text-black bg-gray-100 hover:bg-gray-200 font-medium transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 px-4 rounded-xl text-white bg-black hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default NotificationSettings;
