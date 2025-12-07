/**
 * Модальное окно редактирования задачи комнаты
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Calendar, Flag, Tag as TagIcon, Users, Check } from 'lucide-react';
import { useTelegram } from '../contexts/TelegramContext';
import TagsInput from './TagsInput';

const CATEGORIES = [
  { id: 'study', name: 'Учеба', emoji: '📚', color: 'blue' },
  { id: 'personal', name: 'Личное', emoji: '🏠', color: 'purple' },
  { id: 'sport', name: 'Спорт', emoji: '🏃', color: 'green' },
  { id: 'project', name: 'Проекты', emoji: '💼', color: 'orange' }
];

const PRIORITIES = [
  { id: 'high', name: 'Высокий', emoji: '🔴', color: 'red' },
  { id: 'medium', name: 'Средний', emoji: '🟡', color: 'yellow' },
  { id: 'low', name: 'Низкий', emoji: '🟢', color: 'green' }
];

const EditRoomTaskModal = ({ isOpen, onClose, task, onSave, roomParticipants = [] }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [tags, setTags] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [assignToAll, setAssignToAll] = useState(true);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const { webApp, user } = useTelegram();

  // Получаем участников кроме владельца задачи
  const otherParticipants = roomParticipants.filter(p => p.telegram_id !== task?.owner_id);

  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      
      // Форматируем дедлайн для input datetime-local
      if (task.deadline) {
        const date = new Date(task.deadline);
        const formatted = date.toISOString().slice(0, 16);
        setDeadline(formatted);
      } else {
        setDeadline('');
      }
      
      setCategory(task.category || '');
      setPriority(task.priority || 'medium');
      setTags(task.tags || []);
      
      // Определяем текущий режим назначения участников
      const currentParticipantIds = (task.participants || [])
        .filter(p => p.role !== 'owner')
        .map(p => p.telegram_id);
      const allOtherIds = otherParticipants.map(p => p.telegram_id);
      
      // Если все участники комнаты есть в задаче - режим "Для всех"
      const isAllAssigned = allOtherIds.every(id => currentParticipantIds.includes(id));
      setAssignToAll(isAllAssigned || currentParticipantIds.length === allOtherIds.length);
      setSelectedParticipants(isAllAssigned ? [] : currentParticipantIds);
      
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, task, roomParticipants.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
      return;
    }

    try {
      setIsSaving(true);
      
      const updateData = {
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        category: category || null,
        priority: priority,
        tags: tags,
        assigned_to: assignToAll ? [] : selectedParticipants  // [] = все, массив = выбранные
      };

      await onSave(task.task_id, updateData);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }

      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      console.error('Error updating task:', error);
      
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

  // Переключение выбора участника
  const toggleParticipant = (participantId) => {
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.selectionChanged();
    }
    setSelectedParticipants(prev => {
      if (prev.includes(participantId)) {
        return prev.filter(id => id !== participantId);
      } else {
        return [...prev, participantId];
      }
    });
  };

  if (!isOpen || !task) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center 
                    px-0 sm:px-4 pb-0 sm:pb-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: '100%', scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: '100%', scale: 0.95 }}
          transition={{
            type: 'spring',
            damping: 30,
            stiffness: 300
          }}
          className="relative w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh]
                   bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
                   rounded-t-[32px] sm:rounded-3xl
                   shadow-2xl border border-gray-700 overflow-hidden
                   flex flex-col"
        >
          {/* Header */}
          <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                  <TagIcon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Редактировать задачу
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
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-5">
              
              {/* Название */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Название задачи *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Название задачи"
                  maxLength={100}
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 sm:px-4 sm:py-3 
                           bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl
                           text-white placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500
                           text-sm sm:text-base touch-manipulation"
                />
              </div>

              {/* Описание */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Описание
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Добавьте описание..."
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2.5 sm:px-4 sm:py-3 
                           bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl
                           text-white placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500
                           text-sm sm:text-base resize-none touch-manipulation"
                />
              </div>

              {/* Дедлайн */}
              <div>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  <Calendar className="w-4 h-4" />
                  Срок выполнения
                </label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2.5 sm:px-4 sm:py-3 
                           bg-gray-800 border border-gray-700 rounded-xl sm:rounded-2xl
                           text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500
                           text-sm sm:text-base touch-manipulation"
                />
              </div>

              {/* Категория */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Категория
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCategory(isSelected ? '' : cat.id);
                          if (webApp?.HapticFeedback) {
                            webApp.HapticFeedback.impactOccurred('light');
                          }
                        }}
                        className={`
                          px-3 py-2 rounded-xl text-sm font-medium
                          transition-all touch-manipulation active:scale-95
                          ${isSelected
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-750 border border-gray-700'
                          }
                        `}
                      >
                        <span className="mr-2">{cat.emoji}</span>
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Приоритет */}
              <div>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  <Flag className="w-4 h-4" />
                  Приоритет
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIORITIES.map((p) => {
                    const isSelected = priority === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPriority(p.id);
                          if (webApp?.HapticFeedback) {
                            webApp.HapticFeedback.impactOccurred('light');
                          }
                        }}
                        className={`
                          px-3 py-2 rounded-xl text-xs font-medium
                          transition-all touch-manipulation active:scale-95
                          ${isSelected
                            ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-750 border border-gray-700'
                          }
                        `}
                      >
                        <span className="mr-1">{p.emoji}</span>
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Теги */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                  Теги
                </label>
                <TagsInput
                  tags={tags}
                  onChange={setTags}
                  maxTags={5}
                  placeholder="Добавить тег..."
                />
              </div>

              {/* Назначить участникам */}
              {otherParticipants.length > 0 && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5 sm:gap-2">
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Назначить участникам
                  </label>
                  
                  {/* Переключатель Для всех / Выбрать */}
                  <div className="flex gap-2 mb-3">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setAssignToAll(true);
                        setSelectedParticipants([]);
                        if (webApp?.HapticFeedback) {
                          webApp.HapticFeedback.selectionChanged();
                        }
                      }}
                      disabled={isSaving}
                      className={`
                        flex-1 px-3 py-2.5 rounded-xl border-2 transition-all text-xs sm:text-sm font-medium flex items-center gap-2 justify-center touch-manipulation
                        ${assignToAll
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-transparent shadow-md'
                          : 'bg-gray-800 border-gray-700 text-gray-300 active:bg-gray-750'
                        }
                        disabled:opacity-50
                      `}
                    >
                      <Users className="w-4 h-4" />
                      Для всех
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setAssignToAll(false);
                        if (webApp?.HapticFeedback) {
                          webApp.HapticFeedback.selectionChanged();
                        }
                      }}
                      disabled={isSaving}
                      className={`
                        flex-1 px-3 py-2.5 rounded-xl border-2 transition-all text-xs sm:text-sm font-medium flex items-center gap-2 justify-center touch-manipulation
                        ${!assignToAll
                          ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white border-transparent shadow-md'
                          : 'bg-gray-800 border-gray-700 text-gray-300 active:bg-gray-750'
                        }
                        disabled:opacity-50
                      `}
                    >
                      <Check className="w-4 h-4" />
                      Выбрать
                    </motion.button>
                  </div>

                  {/* Список участников для выбора */}
                  <AnimatePresence>
                    {!assignToAll && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 overflow-hidden"
                      >
                        {otherParticipants.map((participant) => (
                          <motion.button
                            key={participant.telegram_id}
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => toggleParticipant(participant.telegram_id)}
                            disabled={isSaving}
                            className={`
                              w-full px-3 py-2.5 rounded-xl border-2 transition-all text-xs sm:text-sm font-medium flex items-center gap-3 touch-manipulation
                              ${selectedParticipants.includes(participant.telegram_id)
                                ? 'bg-purple-500/20 border-purple-500 text-white'
                                : 'bg-gray-800 border-gray-700 text-gray-300 active:bg-gray-750'
                              }
                              disabled:opacity-50
                            `}
                          >
                            <div className={`
                              w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                              ${selectedParticipants.includes(participant.telegram_id)
                                ? 'bg-purple-500 border-purple-500'
                                : 'border-gray-600'
                              }
                            `}>
                              {selectedParticipants.includes(participant.telegram_id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-sm font-bold text-white">
                              {participant.first_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="flex-1 text-left">
                              {participant.first_name || participant.username || 'Участник'}
                            </span>
                            {participant.role === 'owner' && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                                Владелец
                              </span>
                            )}
                          </motion.button>
                        ))}
                        {selectedParticipants.length === 0 && (
                          <p className="text-xs text-gray-500 text-center py-2">
                            Выберите хотя бы одного участника
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

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
                       bg-gray-800 hover:bg-gray-750 text-gray-300
                       border border-gray-700 font-medium
                       transition-all active:scale-95 touch-manipulation
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-sm sm:text-base"
            >
              Отмена
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSaving || !title.trim() || (!assignToAll && selectedParticipants.length === 0 && otherParticipants.length > 0)}
              className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl 
                       bg-gradient-to-r from-blue-500 to-indigo-600 
                       hover:from-blue-600 hover:to-indigo-700 text-white font-medium
                       transition-all active:scale-95 touch-manipulation
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2
                       text-sm sm:text-base"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditRoomTaskModal;
