/**
 * Детальный просмотр задачи с подзадачами, прогрессом и участниками
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Flag, Tag as TagIcon, Users, Edit2, Check } from 'lucide-react';
import { useTelegram } from '../contexts/TelegramContext';
import SubtasksList from './SubtasksList';
import { addSubtask, updateSubtask, deleteSubtask } from '../services/roomsAPI';

const PRIORITY_CONFIG = {
  high: { emoji: '🔴', name: 'Высокий', color: 'text-red-400' },
  medium: { emoji: '🟡', name: 'Средний', color: 'text-yellow-400' },
  low: { emoji: '🟢', name: 'Низкий', color: 'text-green-400' }
};

const CATEGORY_CONFIG = {
  study: { emoji: '📚', name: 'Учеба' },
  personal: { emoji: '🏠', name: 'Личное' },
  sport: { emoji: '🏃', name: 'Спорт' },
  project: { emoji: '💼', name: 'Проекты' }
};

const TaskDetailModal = ({ isOpen, onClose, task, onEdit, onRefresh, isOwner = false }) => {
  const [subtasks, setSubtasks] = useState([]);
  const { webApp } = useTelegram();

  useEffect(() => {
    if (isOpen && task) {
      setSubtasks(task.subtasks || []);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, task]);

  const handleAddSubtask = async (title) => {
    try {
      const updatedTask = await addSubtask(task.task_id, title);
      setSubtasks(updatedTask.subtasks || []);
      
      if (onRefresh) {
        await onRefresh();
      }
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error adding subtask:', error);
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
    }
  };

  const handleUpdateSubtask = async (subtaskId, updateData) => {
    try {
      const updatedTask = await updateSubtask(task.task_id, subtaskId, updateData);
      setSubtasks(updatedTask.subtasks || []);
      
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error updating subtask:', error);
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    try {
      const updatedTask = await deleteSubtask(task.task_id, subtaskId);
      setSubtasks(updatedTask.subtasks || []);
      
      if (onRefresh) {
        await onRefresh();
      }
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error deleting subtask:', error);
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
    }
  };

  const handleClose = () => {
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.impactOccurred('light');
    }
    onClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getParticipantsCompletedCount = () => {
    return task.participants?.filter(p => p.completed).length || 0;
  };

  if (!isOpen || !task) return null;

  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const categoryConfig = task.category ? CATEGORY_CONFIG[task.category] : null;

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
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                  Детали задачи
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && (
                  <button
                    onClick={() => onEdit(task)}
                    className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-700 
                             transition-colors touch-manipulation active:scale-95"
                  >
                    <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-700 
                           transition-colors touch-manipulation active:scale-95"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5">
              
              {/* Название */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  {task.title}
                </h3>
                {task.description && (
                  <p className="text-sm sm:text-base text-gray-300">
                    {task.description}
                  </p>
                )}
              </div>

              {/* Метаданные */}
              <div className="grid grid-cols-2 gap-3">
                {/* Дедлайн */}
                {task.deadline && (
                  <div className="flex items-center gap-2 px-3 py-2 
                               bg-gray-800/50 border border-gray-700 rounded-xl">
                    <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Срок</p>
                      <p className="text-sm text-gray-300 truncate">
                        {formatDate(task.deadline)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Приоритет */}
                <div className="flex items-center gap-2 px-3 py-2 
                             bg-gray-800/50 border border-gray-700 rounded-xl">
                  <Flag className={`w-4 h-4 ${priorityConfig.color} flex-shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Приоритет</p>
                    <p className="text-sm text-gray-300">
                      <span className="mr-1">{priorityConfig.emoji}</span>
                      {priorityConfig.name}
                    </p>
                  </div>
                </div>

                {/* Категория */}
                {categoryConfig && (
                  <div className="flex items-center gap-2 px-3 py-2 
                               bg-gray-800/50 border border-gray-700 rounded-xl col-span-2">
                    <TagIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Категория</p>
                      <p className="text-sm text-gray-300">
                        <span className="mr-1">{categoryConfig.emoji}</span>
                        {categoryConfig.name}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Теги */}
              {task.tags && task.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Теги</h4>
                  <div className="flex flex-wrap gap-2">
                    {task.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2.5 py-1 
                                 bg-gradient-to-r from-purple-500/20 to-pink-500/20 
                                 border border-purple-400/30 rounded-lg
                                 text-xs font-medium text-purple-200"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Прогресс участников */}
              {task.participants && task.participants.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Участники
                    </h4>
                    <span className="text-xs text-gray-500">
                      {getParticipantsCompletedCount()} / {task.participants.length} выполнено
                    </span>
                  </div>
                  <div className="space-y-2">
                    {task.participants.map((participant) => (
                      <div
                        key={participant.telegram_id}
                        className="flex items-center justify-between px-3 py-2
                                 bg-gray-800/50 border border-gray-700 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`
                            w-2 h-2 rounded-full
                            ${participant.completed ? 'bg-green-500' : 'bg-gray-600'}
                          `} />
                          <span className="text-sm text-gray-300">
                            {participant.first_name}
                            {participant.role === 'owner' && (
                              <span className="ml-1 text-xs text-yellow-400">★</span>
                            )}
                          </span>
                        </div>
                        {participant.completed && (
                          <Check className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Подзадачи */}
              <div>
                <SubtasksList
                  subtasks={subtasks}
                  onAdd={handleAddSubtask}
                  onUpdate={handleUpdateSubtask}
                  onDelete={handleDeleteSubtask}
                  onReorder={setSubtasks}
                  isReadOnly={!isOwner}
                />
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TaskDetailModal;
