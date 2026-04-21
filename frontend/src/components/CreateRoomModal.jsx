/**
 * Модальное окно создания комнаты
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Save, Palette } from 'lucide-react';
import { useTelegram } from '../contexts/TelegramContext';
import { ROOM_COLORS, getRoomColor } from '../constants/roomColors';

const CreateRoomModal = ({ isOpen, onClose, onCreateRoom }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [isSaving, setIsSaving] = useState(false);
  const { webApp } = useTelegram();

  useEffect(() => {
    if (isOpen) {
      // Блокируем скролл body при открытии
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Сбрасываем форму при закрытии
      setName('');
      setDescription('');
      setSelectedColor('blue');
      setIsSaving(false);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
      return;
    }

    try {
      setIsSaving(true);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }

      await onCreateRoom({
        name: name.trim(),
        description: description.trim() || null,
        color: selectedColor
      });

      // Закрываем модальное окно после успешного создания
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      console.error('Error creating room:', error);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
      
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.impactOccurred('light');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-[10000]"
          >
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 
                           rounded-t-[32px] sm:rounded-3xl shadow-2xl 
                           w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh]
                           flex flex-col border border-gray-700">
              
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 
                             border-b border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl 
                                 bg-gradient-to-br from-blue-500 to-indigo-600 
                                 flex items-center justify-center shadow-lg">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">
                    Создать комнату
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-700 
                           transition-colors touch-manipulation active:scale-95"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain">
                <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-5">
                  
                  {/* Название комнаты */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                      Название комнаты *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Например: Экзамен по математике"
                      maxLength={50}
                      required
                      autoFocus
                      className="w-full px-3 py-2.5 sm:px-4 sm:py-3 
                               bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl
                               text-white placeholder-gray-500
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               text-sm sm:text-base touch-manipulation"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {name.length}/50 символов
                    </p>
                  </div>

                  {/* Описание */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                      Описание (необязательно)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Краткое описание комнаты..."
                      maxLength={200}
                      rows={3}
                      className="w-full px-3 py-2.5 sm:px-4 sm:py-3 
                               bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl
                               text-white placeholder-gray-500
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               text-sm sm:text-base resize-none touch-manipulation"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {description.length}/200 символов
                    </p>
                  </div>

                  {/* Выбор цвета */}
                  <div>
                    <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-3">
                      <Palette className="w-4 h-4" />
                      Цвет комнаты
                    </label>
                    <div className="grid grid-cols-4 gap-2 sm:gap-3">
                      {ROOM_COLORS.map((color) => {
                        const isSelected = selectedColor === color.id;
                        const colorScheme = getRoomColor(color.id);
                        
                        return (
                          <motion.button
                            key={color.id}
                            type="button"
                            onClick={() => {
                              setSelectedColor(color.id);
                              if (webApp?.HapticFeedback) {
                                webApp.HapticFeedback.impactOccurred('light');
                              }
                            }}
                            whileTap={{ scale: 0.95 }}
                            className={`
                              relative p-3 sm:p-4 rounded-xl sm:rounded-2xl
                              bg-gradient-to-br ${colorScheme.cardGradient}
                              border-2 transition-all touch-manipulation
                              ${isSelected 
                                ? `${colorScheme.borderColor} shadow-lg ${colorScheme.shadowColor}` 
                                : 'border-transparent opacity-60 hover:opacity-80'
                              }
                            `}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-2xl">{color.emoji}</span>
                              <span className={`
                                text-xs font-medium
                                ${isSelected ? 'text-gray-900' : 'text-gray-600'}
                              `}>
                                {color.name}
                              </span>
                            </div>
                            
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-5 h-5 
                                         bg-white rounded-full shadow-md
                                         flex items-center justify-center"
                              >
                                <div className="w-2 h-2 rounded-full"
                                     style={{ backgroundColor: colorScheme.accentColor }}
                                />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Информация */}
                  <div className="bg-blue-500/10 border border-blue-500/20 
                                 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-blue-200">
                      💡 После создания комнаты вы сможете пригласить участников 
                      через ссылку и создавать групповые задачи.
                    </p>
                  </div>

                </div>
              </form>

              {/* Footer */}
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-700 
                             flex gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl 
                           bg-gray-700 hover:bg-gray-600 text-white font-medium
                           transition-colors text-sm sm:text-base
                           disabled:opacity-50 disabled:cursor-not-allowed
                           touch-manipulation active:scale-95"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving || !name.trim()}
                  className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl 
                           bg-gradient-to-r from-blue-500 to-indigo-600 
                           hover:from-blue-600 hover:to-indigo-700
                           text-white font-medium shadow-lg shadow-blue-500/30
                           transition-all text-sm sm:text-base
                           disabled:opacity-50 disabled:cursor-not-allowed
                           touch-manipulation active:scale-95
                           flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent 
                                     rounded-full animate-spin" />
                      <span>Создание...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Создать</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateRoomModal;
