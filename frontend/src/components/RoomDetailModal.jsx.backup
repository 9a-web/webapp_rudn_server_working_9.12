/**
 * Модальное окно деталей комнаты со списком задач
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, Share2, Trash2, Plus, Check, 
  Clock, Flag, Calendar, ChevronRight 
} from 'lucide-react';
import { useTelegram } from '../contexts/TelegramContext';
import { 
  getRoomTasks, 
  generateInviteLink, 
  deleteRoom, 
  leaveRoom,
  createRoomTask 
} from '../services/roomsAPI';

const RoomDetailModal = ({ isOpen, onClose, room, userSettings, onRoomDeleted }) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const { webApp } = useTelegram();

  const isOwner = room && userSettings && room.owner_id === userSettings.telegram_id;

  useEffect(() => {
    if (isOpen && room) {
      loadRoomTasks();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, room]);

  const loadRoomTasks = async () => {
    if (!room) return;
    
    try {
      setIsLoading(true);
      const roomTasks = await getRoomTasks(room.room_id);
      setTasks(roomTasks);
    } catch (error) {
      console.error('Error loading room tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!room || !userSettings) return;

    try {
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.impactOccurred('medium');
      }

      const linkData = await generateInviteLink(room.room_id, userSettings.telegram_id);
      setInviteLink(linkData.invite_link);
      setShowShareOptions(true);

      // Копируем ссылку в буфер обмена
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(linkData.invite_link);
        if (webApp?.showAlert) {
          webApp.showAlert('Ссылка скопирована в буфер обмена!');
        }
      }
    } catch (error) {
      console.error('Error generating invite link:', error);
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
    }
  };

  const handleShareLink = () => {
    if (!inviteLink) return;

    const shareText = `Присоединяйтесь к комнате "${room.name}" в RUDN Schedule!\n\n${inviteLink}`;

    if (navigator.share) {
      navigator.share({
        title: `Комната: ${room.name}`,
        text: shareText
      });
    } else if (webApp?.openTelegramLink) {
      const encodedText = encodeURIComponent(shareText);
      webApp.openTelegramLink(`https://t.me/share/url?url=${encodedText}`);
    }
  };

  const handleDeleteRoom = async () => {
    if (!room || !userSettings || !isOwner) return;

    if (webApp?.showConfirm) {
      const confirmed = await new Promise(resolve => {
        webApp.showConfirm(
          'Вы уверены, что хотите удалить эту комнату? Все задачи будут удалены.',
          (result) => resolve(result)
        );
      });

      if (!confirmed) return;
    } else {
      if (!window.confirm('Вы уверены, что хотите удалить эту комнату?')) return;
    }

    try {
      await deleteRoom(room.room_id, userSettings.telegram_id);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }

      onRoomDeleted && onRoomDeleted(room.room_id);
      onClose();
    } catch (error) {
      console.error('Error deleting room:', error);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
    }
  };

  const handleLeaveRoom = async () => {
    if (!room || !userSettings || isOwner) return;

    if (webApp?.showConfirm) {
      const confirmed = await new Promise(resolve => {
        webApp.showConfirm(
          'Вы уверены, что хотите покинуть эту комнату?',
          (result) => resolve(result)
        );
      });

      if (!confirmed) return;
    } else {
      if (!window.confirm('Вы уверены, что хотите покинуть эту комнату?')) return;
    }

    try {
      await leaveRoom(room.room_id, userSettings.telegram_id);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }

      onRoomDeleted && onRoomDeleted(room.room_id);
      onClose();
    } catch (error) {
      console.error('Error leaving room:', error);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !room || !userSettings) return;

    try {
      const taskData = {
        room_id: room.room_id,
        title: newTaskTitle.trim(),
        telegram_id: userSettings.telegram_id
      };

      await createRoomTask(room.room_id, taskData);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }

      setNewTaskTitle('');
      setShowAddTask(false);
      
      // Перезагружаем задачи
      await loadRoomTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      
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

  if (!isOpen || !room) return null;

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'overdue': return 'text-red-400';
      case 'in_progress': return 'text-blue-400';
      default: return 'text-gray-400';
    }
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
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 
                       sm:-translate-x-1/2 sm:-translate-y-1/2
                       sm:w-full sm:max-w-2xl sm:max-h-[90vh]
                       bg-gradient-to-br from-gray-900 to-gray-800 
                       rounded-3xl shadow-2xl border border-gray-700
                       flex flex-col z-[10000]"
          >
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 
                           border-b border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl 
                               bg-gradient-to-br from-blue-500 to-indigo-600 
                               flex items-center justify-center shadow-lg flex-shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-white truncate">
                    {room.name}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {room.total_participants} участников • {room.total_tasks} задач
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-gray-700 
                         transition-colors touch-manipulation active:scale-95 flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              
              {/* Описание */}
              {room.description && (
                <div className="mb-4 p-3 bg-gray-800 rounded-xl">
                  <p className="text-sm text-gray-300">{room.description}</p>
                </div>
              )}

              {/* Прогресс */}
              <div className="mb-6 p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 
                             border border-blue-500/20 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-200">
                    Общий прогресс
                  </span>
                  <span className="text-sm font-bold text-blue-300">
                    {room.completion_percentage}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${room.completion_percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  {room.completed_tasks} из {room.total_tasks} задач выполнено
                </p>
              </div>

              {/* Кнопка добавления задачи */}
              {!showAddTask && (
                <button
                  onClick={() => setShowAddTask(true)}
                  className="w-full mb-4 px-4 py-3 rounded-xl
                           bg-gradient-to-r from-blue-500 to-indigo-600
                           hover:from-blue-600 hover:to-indigo-700
                           text-white font-medium shadow-lg shadow-blue-500/30
                           transition-all touch-manipulation active:scale-95
                           flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Добавить задачу</span>
                </button>
              )}

              {/* Форма добавления задачи */}
              {showAddTask && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-4 bg-gray-800 rounded-xl border border-gray-700"
                >
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Название задачи..."
                    autoFocus
                    className="w-full mb-3 px-4 py-3 bg-gray-900 border border-gray-700 
                             rounded-xl text-white placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newTaskTitle.trim()) {
                        handleAddTask();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowAddTask(false);
                        setNewTaskTitle('');
                      }}
                      className="flex-1 px-4 py-2 rounded-xl bg-gray-700 
                               hover:bg-gray-600 text-white font-medium
                               transition-colors touch-manipulation active:scale-95"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleAddTask}
                      disabled={!newTaskTitle.trim()}
                      className="flex-1 px-4 py-2 rounded-xl 
                               bg-gradient-to-r from-blue-500 to-indigo-600
                               hover:from-blue-600 hover:to-indigo-700
                               text-white font-medium
                               disabled:opacity-50 disabled:cursor-not-allowed
                               transition-all touch-manipulation active:scale-95"
                    >
                      Добавить
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Список задач */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  Задачи комнаты
                </h3>
                
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent 
                                   rounded-full animate-spin" />
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Пока нет задач в этой комнате</p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <motion.div
                      key={task.task_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-gray-800 rounded-xl border border-gray-700
                               hover:border-blue-500/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white mb-1">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-xs text-gray-400 mb-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs">
                            <span className={`flex items-center gap-1 ${getStatusColor(task.status)}`}>
                              <Check className="w-3 h-3" />
                              {task.completed_participants}/{task.total_participants}
                            </span>
                            {task.deadline && (
                              <span className="flex items-center gap-1 text-gray-400">
                                <Calendar className="w-3 h-3" />
                                {new Date(task.deadline).toLocaleDateString('ru-RU')}
                              </span>
                            )}
                            <span className={`flex items-center gap-1 ${getPriorityColor(task.priority)}`}>
                              <Flag className="w-3 h-3" />
                              {task.priority}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-xs font-medium text-blue-400">
                              {task.completion_percentage}%
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-700 flex gap-2 flex-shrink-0">
              <button
                onClick={handleGenerateLink}
                className="flex-1 px-4 py-3 rounded-xl
                         bg-gradient-to-r from-green-500 to-emerald-600
                         hover:from-green-600 hover:to-emerald-700
                         text-white font-medium shadow-lg shadow-green-500/30
                         transition-all touch-manipulation active:scale-95
                         flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Пригласить</span>
              </button>
              
              {isOwner ? (
                <button
                  onClick={handleDeleteRoom}
                  className="px-4 py-3 rounded-xl
                           bg-red-500/20 hover:bg-red-500/30
                           text-red-400 font-medium border border-red-500/30
                           transition-all touch-manipulation active:scale-95
                           flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Удалить</span>
                </button>
              ) : (
                <button
                  onClick={handleLeaveRoom}
                  className="px-4 py-3 rounded-xl
                           bg-gray-700 hover:bg-gray-600
                           text-white font-medium
                           transition-all touch-manipulation active:scale-95"
                >
                  Выйти
                </button>
              )}
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RoomDetailModal;
