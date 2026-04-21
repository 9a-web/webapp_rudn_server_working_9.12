import React, { useState, useRef, useEffect } from 'react';
import { X, Users, Calendar, Tag, Flag, MessageCircle, Send, CheckCircle, LogOut, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, backdropVariants } from '../utils/animations';

/**
 * Детальный экран групповой задачи
 */
export const GroupTaskDetailModal = ({ 
  isOpen, 
  task,
  comments = [],
  onClose, 
  onToggleComplete,
  onLeave,
  onDelete,
  onAddComment,
  hapticFeedback,
  telegramId,
  isLoading = false
}) => {
  const modalRef = useRef(null);
  const commentsEndRef = useRef(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Прокрутка к последнему комментарию
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

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

  const handleSendComment = async () => {
    if (!commentText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(commentText.trim());
      setCommentText('');
      if (hapticFeedback) hapticFeedback('notification', 'success');
    } catch (error) {
      if (hapticFeedback) hapticFeedback('notification', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleComplete = async () => {
    if (hapticFeedback) hapticFeedback('impact', 'medium');
    await onToggleComplete();
  };

  const handleLeave = async () => {
    if (hapticFeedback) hapticFeedback('impact', 'medium');
    if (window.confirm('Вы уверены, что хотите покинуть задачу?')) {
      await onLeave();
    }
  };

  const handleDelete = async () => {
    if (hapticFeedback) hapticFeedback('impact', 'heavy');
    if (window.confirm('Вы уверены, что хотите удалить эту задачу? Это действие нельзя отменить.')) {
      await onDelete();
    }
  };

  if (!isOpen || !task) return null;

  const currentParticipant = task.participants.find(p => p.telegram_id === telegramId);
  const isOwner = task.owner_id === telegramId;
  const isCompleted = currentParticipant?.completed || false;

  // Определяем цвет прогресс-бара
  const getProgressColor = (percentage) => {
    if (percentage === 100) return 'from-green-400 to-emerald-500';
    if (percentage >= 70) return 'from-blue-400 to-indigo-500';
    if (percentage >= 30) return 'from-yellow-400 to-orange-500';
    return 'from-red-400 to-rose-500';
  };

  // Форматируем дату
  const formatDate = (dateString) => {
    if (!dateString) return 'Не указан';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', { 
      day: 'numeric', 
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCommentTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'только что';
    if (diffMinutes < 60) return `${diffMinutes}м назад`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}ч назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const categoryEmojis = {
    study: '🎓',
    personal: '👤',
    sport: '⚽',
    project: '📁'
  };

  const priorityColors = {
    high: 'text-red-400',
    medium: 'text-yellow-400',
    low: 'text-green-400'
  };

  const priorityLabels = {
    high: 'Высокий',
    medium: 'Средний',
    low: 'Низкий'
  };

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
          className="bg-gradient-to-br from-[#2B2B3A] to-[#1E1E28] rounded-3xl w-full max-w-2xl
                     shadow-2xl border border-indigo-500/20 max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-700/50">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
                                flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white break-words">{task.title}</h2>
              </div>
              {task.description && (
                <p className="text-gray-400 text-sm break-words">{task.description}</p>
              )}
            </div>
            
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 
                         flex items-center justify-center transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Прогресс выполнения */}
            <div className="bg-gray-700/30 rounded-2xl p-4 border border-gray-600/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  📊 Прогресс выполнения
                </h3>
                <span className="text-2xl font-bold text-white">
                  {task.completion_percentage}%
                </span>
              </div>
              
              <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${task.completion_percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`h-full bg-gradient-to-r ${getProgressColor(task.completion_percentage)} rounded-full`}
                />
              </div>
              
              <p className="text-gray-400 text-sm">
                {task.completed_participants} из {task.total_participants} участников выполнили
              </p>
            </div>

            {/* Участники */}
            <div className="bg-gray-700/30 rounded-2xl p-4 border border-gray-600/30">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Участники ({task.total_participants})
              </h3>
              
              <div className="space-y-2">
                {task.participants.map((participant) => (
                  <div
                    key={participant.telegram_id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 
                                      flex items-center justify-center shadow-lg relative">
                        <span className="text-white text-sm font-medium">
                          {participant.first_name.charAt(0).toUpperCase()}
                        </span>
                        {participant.completed && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full 
                                          border-2 border-[#2B2B3A] flex items-center justify-center">
                            <CheckCircle className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {participant.first_name}
                          {participant.role === 'owner' && ' 👑'}
                        </p>
                        {participant.username && (
                          <p className="text-gray-500 text-xs">@{participant.username}</p>
                        )}
                      </div>
                    </div>
                    
                    {participant.completed ? (
                      <span className="text-green-400 text-xs flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Выполнил
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">⏳ В процессе</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Информация о задаче */}
            <div className="bg-gray-700/30 rounded-2xl p-4 border border-gray-600/30 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400">Дедлайн:</span>
                <span className={`font-medium ${task.status === 'overdue' ? 'text-red-400' : 'text-white'}`}>
                  {formatDate(task.deadline)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400">Категория:</span>
                <span className="text-white font-medium">
                  {categoryEmojis[task.category]} {task.category}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Flag className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400">Приоритет:</span>
                <span className={`font-medium ${priorityColors[task.priority]}`}>
                  {priorityLabels[task.priority]}
                </span>
              </div>
            </div>

            {/* Комментарии */}
            <div className="bg-gray-700/30 rounded-2xl p-4 border border-gray-600/30">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Комментарии ({comments.length})
              </h3>
              
              <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
                {comments.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    Пока нет комментариев
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.comment_id}
                      className="bg-gray-700/50 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm font-medium">
                          {comment.first_name}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {formatCommentTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm break-words">{comment.text}</p>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>
              
              {/* Поле ввода комментария */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendComment();
                    }
                  }}
                  placeholder="Написать комментарий..."
                  className="flex-1 px-4 py-2 bg-gray-700/30 border border-gray-600/50 rounded-lg
                             text-white placeholder-gray-500 text-sm focus:outline-none 
                             focus:border-indigo-500/50 transition-colors"
                  disabled={isSubmitting}
                />
                <button
                  onClick={handleSendComment}
                  disabled={!commentText.trim() || isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg
                             text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                             flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer - Actions */}
          <div className="p-6 border-t border-gray-700/50 space-y-3">
            {/* Кнопка выполнения */}
            <button
              onClick={handleToggleComplete}
              disabled={isLoading}
              className={`w-full px-6 py-3 rounded-xl font-medium transition-all
                         ${isCompleted 
                           ? 'bg-gray-700/50 hover:bg-gray-600/50 text-white' 
                           : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/30'
                         } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isCompleted ? 'Отменить выполнение' : 'Отметить выполненной'}
            </button>
            
            {/* Дополнительные действия */}
            <div className="flex gap-3">
              {!isOwner && (
                <button
                  onClick={handleLeave}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-orange-500/20 hover:bg-orange-500/30 
                             border border-orange-500/30 rounded-xl text-orange-400 font-medium
                             transition-colors flex items-center justify-center gap-2
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut className="w-4 h-4" />
                  Покинуть
                </button>
              )}
              
              {isOwner && (
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 
                             border border-red-500/30 rounded-xl text-red-400 font-medium
                             transition-colors flex items-center justify-center gap-2
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить задачу
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
