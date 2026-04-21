/**
 * Модальное окно редактирования задачи комнаты
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Calendar, Flag, Tag as TagIcon } from 'lucide-react';
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

const EditRoomTaskModal = ({ isOpen, onClose, task, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [tags, setTags] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const { webApp } = useTelegram();

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
      
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, task]);

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
        tags: tags
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
              disabled={isSaving || !title.trim()}
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
