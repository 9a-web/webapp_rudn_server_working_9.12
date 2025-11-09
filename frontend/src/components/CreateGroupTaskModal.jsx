import React, { useState, useRef, useEffect } from 'react';
import { X, Users, Calendar, Tag, Flag, UserPlus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, backdropVariants } from '../utils/animations';

/**
 * Модальное окно создания групповой задачи
 */
export const CreateGroupTaskModal = ({ 
  isOpen, 
  onClose, 
  onCreateTask, 
  hapticFeedback,
  telegramId 
}) => {
  const modalRef = useRef(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [category, setCategory] = useState('study');
  const [priority, setPriority] = useState('medium');
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [newUserId, setNewUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Сброс формы при открытии
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setDeadline('');
      setDeadlineTime('23:59');
      setCategory('study');
      setPriority('medium');
      setInvitedUsers([]);
      setNewUserId('');
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Закрытие по клику вне модального окна
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Закрытие по ESC
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (hapticFeedback) hapticFeedback('impact', 'light');
    onClose();
  };

  const handleAddUser = () => {
    if (!newUserId.trim()) {
      setError('Введите Telegram ID или @username');
      return;
    }

    // Проверка формата
    let userId = newUserId.trim();
    
    // Если начинается с @, убираем @
    if (userId.startsWith('@')) {
      userId = userId.substring(1);
    }

    // Проверяем, не добавлен ли уже
    if (invitedUsers.includes(userId)) {
      setError('Пользователь уже добавлен');
      return;
    }

    // Лимит участников
    if (invitedUsers.length >= 9) { // 9 + создатель = 10
      setError('Максимум 9 приглашённых участников');
      return;
    }

    if (hapticFeedback) hapticFeedback('impact', 'light');
    setInvitedUsers([...invitedUsers, userId]);
    setNewUserId('');
    setError('');
  };

  const handleRemoveUser = (userId) => {
    if (hapticFeedback) hapticFeedback('impact', 'light');
    setInvitedUsers(invitedUsers.filter(id => id !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Введите название задачи');
      return;
    }

    if (invitedUsers.length === 0) {
      setError('Пригласите хотя бы одного участника');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Формируем дату дедлайна
      let deadlineDate = null;
      if (deadline) {
        const [year, month, day] = deadline.split('-');
        const [hours, minutes] = deadlineTime.split(':');
        deadlineDate = new Date(year, month - 1, day, hours, minutes);
      }

      // Конвертируем username в числовые ID (для упрощения примера используем как есть)
      // В реальном приложении нужно было бы сделать запрос к API для резолва username
      const invitedUserIds = invitedUsers.map(user => {
        // Если это число, возвращаем как число
        if (!isNaN(user)) {
          return parseInt(user);
        }
        // Иначе - это username, но для демо будем использовать фиктивные ID
        // В продакшене здесь должен быть запрос к API
        return Math.floor(Math.random() * 1000000);
      });

      const taskData = {
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadlineDate ? deadlineDate.toISOString() : null,
        category: category,
        priority: priority,
        telegram_id: telegramId,
        invited_users: invitedUserIds,
      };

      await onCreateTask(taskData);
      
      if (hapticFeedback) hapticFeedback('notification', 'success');
      handleClose();
    } catch (err) {
      setError(err.message || 'Ошибка при создании задачи');
      if (hapticFeedback) hapticFeedback('notification', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
      >
        <motion.div
          ref={modalRef}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="bg-gradient-to-br from-[#2B2B3A] to-[#1E1E28] rounded-3xl w-full max-w-md
                     shadow-2xl border border-indigo-500/20 max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
                              flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Групповая задача</h2>
            </div>
            
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 
                         flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Название */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Название задачи *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Подготовка к экзамену"
                className="w-full px-4 py-3 bg-gray-700/30 border border-gray-600/50 rounded-xl
                           text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50
                           transition-colors"
                disabled={isSubmitting}
              />
            </div>

            {/* Описание */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Описание
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Опишите задачу подробнее..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-700/30 border border-gray-600/50 rounded-xl
                           text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50
                           transition-colors resize-none"
                disabled={isSubmitting}
              />
            </div>

            {/* Дедлайн */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Дедлайн
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="px-4 py-3 bg-gray-700/30 border border-gray-600/50 rounded-xl
                             text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  disabled={isSubmitting}
                />
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  className="px-4 py-3 bg-gray-700/30 border border-gray-600/50 rounded-xl
                             text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Категория и Приоритет */}
            <div className="grid grid-cols-2 gap-4">
              {/* Категория */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Категория
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700/30 border border-gray-600/50 rounded-xl
                             text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  disabled={isSubmitting}
                >
                  <option value="study">🎓 Учёба</option>
                  <option value="personal">👤 Личное</option>
                  <option value="sport">⚽ Спорт</option>
                  <option value="project">📁 Проект</option>
                </select>
              </div>

              {/* Приоритет */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Flag className="w-4 h-4 inline mr-1" />
                  Приоритет
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700/30 border border-gray-600/50 rounded-xl
                             text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  disabled={isSubmitting}
                >
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                </select>
              </div>
            </div>

            {/* Приглашение участников */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <UserPlus className="w-4 h-4 inline mr-1" />
                Пригласить участников *
              </label>
              
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="@username или Telegram ID"
                  className="flex-1 px-4 py-3 bg-gray-700/30 border border-gray-600/50 rounded-xl
                             text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50
                             transition-colors"
                  disabled={isSubmitting}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddUser();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddUser}
                  className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl
                             text-white font-medium transition-colors flex items-center gap-2"
                  disabled={isSubmitting}
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>

              {/* Список приглашённых */}
              {invitedUsers.length > 0 && (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {invitedUsers.map((userId) => (
                    <div
                      key={userId}
                      className="flex items-center justify-between px-3 py-2 bg-gray-700/30 rounded-lg
                                 border border-gray-600/30"
                    >
                      <span className="text-white text-sm">
                        {userId.startsWith('@') ? userId : `@${userId}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(userId)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        disabled={isSubmitting}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-2">
                Приглашено: {invitedUsers.length}/9 участников
              </p>
            </div>

            {/* Ошибка */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-gray-700/50">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl
                         text-white font-medium transition-colors"
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 
                         hover:from-indigo-700 hover:to-purple-700 rounded-xl
                         text-white font-medium transition-colors shadow-lg shadow-indigo-500/30
                         disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !title.trim() || invitedUsers.length === 0}
            >
              {isSubmitting ? 'Создание...' : 'Создать задачу'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
