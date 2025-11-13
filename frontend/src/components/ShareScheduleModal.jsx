import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, MessageCircle, Image as ImageIcon, X, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { botAPI } from '../services/api';
import { achievementsAPI } from '../services/api';

/**
 * Компонент для шаринга расписания
 */
export const ShareScheduleModal = ({ 
  isOpen, 
  onClose, 
  schedule, 
  selectedDate,
  groupName,
  hapticFeedback,
  telegramId
}) => {
  const [copied, setCopied] = useState(false);
  const [botUsername, setBotUsername] = useState('rudn_pro_bot');
  const [webAppUrl, setWebAppUrl] = useState('');

  // Получаем информацию о боте при монтировании
  useEffect(() => {
    const fetchBotInfo = async () => {
      try {
        const botInfo = await botAPI.getBotInfo();
        if (botInfo && botInfo.username) {
          setBotUsername(botInfo.username);
        }
      } catch (error) {
        console.error('Failed to fetch bot info:', error);
      }
    };

    fetchBotInfo();

    // Определяем URL WebApp
    if (window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
      // Если открыто через Telegram WebApp
      setWebAppUrl(`https://t.me/${botUsername}`);
    } else {
      // Используем текущий URL
      setWebAppUrl(window.location.origin);
    }
  }, [botUsername]);

  if (!isOpen) return null;

  // Форматирование даты
  const formatDate = (date) => {
    return date.toLocaleDateString('ru-RU', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  // Генерация текста расписания
  const generateScheduleText = () => {
    const dateStr = formatDate(selectedDate);
    const dayName = selectedDate.toLocaleDateString('ru-RU', { weekday: 'long' });
    const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    
    const todaySchedule = schedule.filter(item => item.day === formattedDayName);

    if (todaySchedule.length === 0) {
      return `📅 Расписание на ${dateStr}\n${groupName ? `Группа: ${groupName}\n` : ''}\n✨ Пар нет! Свободный день! 🎉`;
    }

    let text = `📅 Расписание на ${dateStr}\n`;
    if (groupName) {
      text += `👥 Группа: ${groupName}\n`;
    }
    text += `\n`;

    todaySchedule.forEach((classItem, index) => {
      text += `${index + 1}. ${classItem.discipline}\n`;
      text += `   ⏰ ${classItem.time}\n`;
      if (classItem.auditory) {
        text += `   📍 ${classItem.auditory}\n`;
      }
      if (classItem.teacher) {
        text += `   👨‍🏫 ${classItem.teacher}\n`;
      }
      text += `\n`;
    });

    text += `\n📱 RUDN Schedule – Telegram WebApp`;
    
    return text;
  };

  // Генерация красивого текста для Telegram
  const generateTelegramText = () => {
    const dateStr = formatDate(selectedDate);
    const dayName = selectedDate.toLocaleDateString('ru-RU', { weekday: 'long' });
    const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    
    const todaySchedule = schedule.filter(item => item.day === formattedDayName);

    if (todaySchedule.length === 0) {
      return `📅 *Расписание на ${dateStr}*\n${groupName ? `Группа: _${groupName}_\n` : ''}\n✨ Пар нет! Свободный день! 🎉`;
    }

    let text = `📅 *Расписание на ${dateStr}*\n`;
    if (groupName) {
      text += `👥 Группа: _${groupName}_\n`;
    }
    text += `\n`;

    todaySchedule.forEach((classItem, index) => {
      text += `*${index + 1}. ${classItem.discipline}*\n`;
      text += `⏰ \`${classItem.time}\`\n`;
      if (classItem.auditory) {
        text += `📍 ${classItem.auditory}\n`;
      }
      if (classItem.teacher) {
        text += `👨‍🏫 ${classItem.teacher}\n`;
      }
      text += `\n`;
    });

    text += `📱 _RUDN Schedule – Telegram WebApp_`;
    
    return text;
  };

  // Копирование в буфер обмена
  const handleCopyToClipboard = async () => {
    try {
      const text = generateScheduleText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (hapticFeedback) hapticFeedback('notification', 'success');
      
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Шаринг через Telegram Web App API
  const handleShareToTelegram = async () => {
    if (hapticFeedback) hapticFeedback('impact', 'medium');
    
    // Отслеживаем действие поделиться расписанием
    if (telegramId) {
      try {
        const result = await achievementsAPI.trackAction(telegramId, 'share_schedule', {
          source: 'share_modal',
          date: new Date().toISOString()
        });
        
        // Если есть новые достижения, можно показать уведомление (опционально)
        if (result.new_achievements && result.new_achievements.length > 0) {
          console.log('New achievement earned:', result.new_achievements[0]);
        }
      } catch (error) {
        console.error('Failed to track share_schedule action:', error);
      }
    }
    
    const text = generateTelegramText();
    
    // Проверяем доступность Telegram Web App API
    if (window.Telegram?.WebApp) {
      // Используем Telegram.WebApp.switchInlineQuery для шаринга
      // Или открываем диалог выбора чата
      const encodedText = encodeURIComponent(text);
      const botUrl = `https://t.me/${botUsername}`;
      const url = `https://t.me/share/url?url=${botUrl}&text=${encodedText}`;
      window.open(url, '_blank');
    } else {
      // Fallback: копируем в буфер
      handleCopyToClipboard();
    }
  };

  // Шаринг как изображение (screenshot)
  const handleShareAsImage = () => {
    if (hapticFeedback) hapticFeedback('impact', 'medium');
    // TODO: Implement screenshot functionality
    alert('Функция скриншота в разработке! 📸');
  };

  // Создание приглашения в группу
  const handleInviteFriends = async () => {
    if (hapticFeedback) hapticFeedback('impact', 'medium');
    
    // Трекинг действия приглашения друга
    if (telegramId) {
      try {
        await achievementsAPI.trackAction(telegramId, 'invite_friend', {
          source: 'share_modal',
          date: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to track invite_friend action:', error);
      }
    }
    
    const inviteText = `🎓 Привет! Я использую RUDN Schedule для просмотра расписания.\n\nПрисоединяйся! 👇`;
    const encodedText = encodeURIComponent(inviteText);
    const botUrl = `https://t.me/${botUsername}`;
    const url = `https://t.me/share/url?url=${botUrl}&text=${encodedText}`;
    window.open(url, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
          />

          {/* Modal Container - адаптивное позиционирование */}
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-6 md:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 leading-tight pr-2">
                    Поделиться расписанием
                  </h2>
                  <button
                    onClick={() => {
                      if (hapticFeedback) hapticFeedback('impact', 'light');
                      onClose();
                    }}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                  </button>
                </div>

                {/* Info */}
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl sm:rounded-2xl">
                  <p className="text-xs sm:text-sm text-gray-600 text-center">
                    📅 {formatDate(selectedDate)}
                  </p>
                  {groupName && (
                    <p className="text-xs text-gray-500 text-center mt-1">
                      Группа: {groupName}
                    </p>
                  )}
                </div>

                {/* Share Options */}
                <div className="space-y-2 sm:space-y-3">
                  {/* Поделиться в Telegram */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleShareToTelegram}
                    className="w-full flex items-center gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg active:shadow-md transition-shadow"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/20">
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate">Отправить в чат</p>
                      <p className="text-xs text-white/80 hidden sm:block">Поделиться через Telegram</p>
                    </div>
                    <Share2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  </motion.button>

                  {/* Копировать текст */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCopyToClipboard}
                    className="w-full flex items-center gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg active:shadow-md transition-shadow"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/20">
                      {copied ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate">
                        {copied ? 'Скопировано!' : 'Копировать текст'}
                      </p>
                      <p className="text-xs text-white/80 hidden sm:block">
                        {copied ? 'Текст в буфере обмена' : 'Скопировать расписание'}
                      </p>
                    </div>
                  </motion.button>

                  {/* Поделиться как изображение */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleShareAsImage}
                    className="w-full flex items-center gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-green-500 to-teal-500 text-white hover:shadow-lg active:shadow-md transition-shadow"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/20">
                      <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate">Сохранить как картинку</p>
                      <p className="text-xs text-white/80 hidden sm:block">Скриншот расписания</p>
                    </div>
                    <span className="text-xs bg-white/20 px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0">Скоро</span>
                  </motion.button>

                  {/* Пригласить друзей */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleInviteFriends}
                    className="w-full flex items-center gap-2 sm:gap-3 md:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 transition-colors"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white">
                      <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate">Пригласить друзей</p>
                      <p className="text-xs text-gray-500 hidden sm:block">Рассказать о приложении</p>
                    </div>
                  </motion.button>
                </div>

                {/* Preview */}
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg sm:rounded-xl max-h-32 sm:max-h-40 md:max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-500 mb-2">Предпросмотр:</p>
                  <pre className="text-[10px] sm:text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                    {generateScheduleText()}
                  </pre>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
