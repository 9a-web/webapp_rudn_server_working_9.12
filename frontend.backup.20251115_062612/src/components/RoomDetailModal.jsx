/**
 * Модальное окно деталей комнаты с табами
 * Табы: Задачи | Участники | Активность | Настройки
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  X, Users, Share2, Trash2, Plus, Check, Settings,
  Clock, Flag, Calendar, ChevronRight, LogOut,
  CheckCircle, Edit2, Filter, SortAsc, Activity
} from 'lucide-react';
import { useTelegram } from '../contexts/TelegramContext';
import { 
  getRoomTasks, 
  generateInviteLink, 
  deleteRoom, 
  leaveRoom,
  createRoomTask,
  toggleTaskComplete,
  deleteGroupTask,
  reorderRoomTasks,
  updateRoom
} from '../services/roomsAPI';
import { getRoomColor } from '../constants/roomColors';
import EditRoomTaskModal from './EditRoomTaskModal';
import TaskDetailModal from './TaskDetailModal';
import RoomParticipantsList from './RoomParticipantsList';
import RoomActivityFeed from './RoomActivityFeed';
import RoomStatsPanel from './RoomStatsPanel';
import AddRoomTaskModal from './AddRoomTaskModal';

const TABS = [
  { id: 'tasks', name: 'Задачи', icon: CheckCircle },
  { id: 'participants', name: 'Участники', icon: Users },
  { id: 'activity', name: 'Активность', icon: Activity },
  { id: 'stats', name: 'Статистика', icon: Filter }
];

const RoomDetailModal = ({ isOpen, onClose, room, userSettings, onRoomDeleted, onRoomUpdated }) => {
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskDetailView, setTaskDetailView] = useState(null);
  const { webApp } = useTelegram();

  const isOwner = room && userSettings && room.owner_id === userSettings.telegram_id;
  const colorScheme = room ? getRoomColor(room.color || 'blue') : getRoomColor('blue');

  useEffect(() => {
    if (isOpen && room) {
      loadRoomTasks();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setActiveTab('tasks');
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
      const linkData = await generateInviteLink(room.room_id, userSettings.telegram_id);
      setInviteLink(linkData.invite_link);
      setShowShareOptions(true);

      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.impactOccurred('medium');
      }
    } catch (error) {
      console.error('Error generating invite link:', error);
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }

      if (webApp?.showPopup) {
        webApp.showPopup({
          title: 'Готово!',
          message: 'Ссылка скопирована в буфер обмена',
          buttons: [{ type: 'ok' }]
        });
      }

      setShowShareOptions(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!room || !userSettings || !isOwner) return;

    // Используем window.confirm как фоллбэк если webApp.showPopup не доступен
    const confirmDelete = webApp?.showPopup 
      ? await new Promise((resolve) => {
          webApp.showPopup(
            {
              title: 'Удалить комнату?',
              message: 'Все задачи будут удалены. Это действие нельзя отменить.',
              buttons: [
                { id: 'delete', type: 'destructive', text: 'Удалить' },
                { type: 'cancel' }
              ]
            },
            (buttonId) => resolve(buttonId === 'delete')
          );
        })
      : window.confirm('Удалить комнату? Все задачи будут удалены. Это действие нельзя отменить.');

    if (confirmDelete) {
      try {
        await deleteRoom(room.room_id, userSettings.telegram_id);
        
        if (webApp?.HapticFeedback) {
          webApp.HapticFeedback.notificationOccurred('success');
        }

        if (onRoomDeleted) {
          onRoomDeleted(room.room_id);
        }
        
        onClose();
      } catch (error) {
        console.error('Error deleting room:', error);
        if (webApp?.HapticFeedback) {
          webApp.HapticFeedback.notificationOccurred('error');
        }
        alert('Ошибка при удалении комнаты: ' + error.message);
      }
    }
  };

  const handleLeaveRoom = async () => {
    if (!room || !userSettings || isOwner) return;

    // Используем window.confirm как фоллбэк если webApp.showPopup не доступен
    const confirmLeave = webApp?.showPopup
      ? await new Promise((resolve) => {
          webApp.showPopup(
            {
              title: 'Покинуть комнату?',
              message: 'Вы больше не сможете видеть задачи этой комнаты.',
              buttons: [
                { id: 'leave', type: 'destructive', text: 'Выйти' },
                { type: 'cancel' }
              ]
            },
            (buttonId) => resolve(buttonId === 'leave')
          );
        })
      : window.confirm('Покинуть комнату? Вы больше не сможете видеть задачи этой комнаты.');

    if (confirmLeave) {
      try {
        await leaveRoom(room.room_id, userSettings.telegram_id);
        
        if (webApp?.HapticFeedback) {
          webApp.HapticFeedback.notificationOccurred('success');
        }

        if (onRoomDeleted) {
          onRoomDeleted(room.room_id);
        }
        
        onClose();
      } catch (error) {
        console.error('Error leaving room:', error);
        if (webApp?.HapticFeedback) {
          webApp.HapticFeedback.notificationOccurred('error');
        }
        alert('Ошибка при выходе из комнаты: ' + error.message);
      }
    }
  };

  const handleAddTask = async (taskData) => {
    console.log('handleAddTask called', { taskData, room, userSettings });
    
    if (!room || !userSettings) {
      console.error('Missing room or userSettings', { room, userSettings });
      throw new Error('Отсутствуют данные комнаты или пользователя');
    }

    try {
      console.log('Creating room task...');
      const result = await createRoomTask(room.room_id, {
        ...taskData,
        telegram_id: userSettings.telegram_id
      });
      console.log('Task created successfully:', result);

      await loadRoomTasks();

      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error adding task:', error);
      throw error; // Пробрасываем ошибку в модальное окно
    }
  };

  const handleToggleTask = async (task) => {
    if (!userSettings) return;

    const currentParticipant = task.participants.find(
      p => p.telegram_id === userSettings.telegram_id
    );

    try {
      await toggleTaskComplete(
        task.task_id,
        userSettings.telegram_id,
        !currentParticipant?.completed
      );
      
      await loadRoomTasks();
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.impactOccurred('light');
      }
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!userSettings) return;

    try {
      await deleteGroupTask(taskId, userSettings.telegram_id);
      await loadRoomTasks();
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('error');
      }
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
  };

  const handleSaveTask = async (taskId, updateData) => {
    try {
      const { updateGroupTask } = await import('../services/roomsAPI');
      await updateGroupTask(taskId, updateData);
      await loadRoomTasks();
      
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.notificationOccurred('success');
      }
      
      setEditingTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  };

  const handleViewTaskDetails = (task) => {
    setTaskDetailView(task);
  };

  const handleReorderTasks = async (newOrder) => {
    setTasks(newOrder);
    
    try {
      const taskOrderData = newOrder.map((task, index) => ({
        task_id: task.task_id,
        order: index
      }));
      
      await reorderRoomTasks(room.room_id, taskOrderData);
    } catch (error) {
      console.error('Error reordering tasks:', error);
      await loadRoomTasks();
    }
  };

  const handleClose = () => {
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.impactOccurred('light');
    }
    onClose();
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.impactOccurred('light');
    }
  };

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
      case 'in_progress': return 'text-blue-400';
      case 'overdue': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getTaskProgress = (task) => {
    const totalParticipants = task.participants?.length || 0;
    const completedCount = task.participants?.filter(p => p.completed).length || 0;
    return totalParticipants > 0 ? Math.round((completedCount / totalParticipants) * 100) : 0;
  };

  if (!isOpen || !room) return null;

  return (
    <>
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
            className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh]
                     bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
                     rounded-t-[32px] sm:rounded-3xl
                     shadow-2xl border border-gray-700 overflow-hidden
                     flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${colorScheme.buttonGradient}`}>
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                      {room.name}
                    </h2>
                    {room.description && (
                      <p className="text-xs text-gray-400 truncate">
                        {room.description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-700 
                           transition-colors touch-manipulation active:scale-95"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                </button>
              </div>

              {/* Табы */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-lg
                        text-xs font-medium transition-all whitespace-nowrap
                        touch-manipulation active:scale-95
                        ${isActive
                          ? `bg-gradient-to-r ${colorScheme.buttonGradient} text-white`
                          : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="px-4 py-4 sm:px-6 sm:py-6">
                {activeTab === 'tasks' && (
                  <TasksTab
                    tasks={tasks}
                    isLoading={isLoading}
                    onOpenAddModal={() => setIsAddTaskModalOpen(true)}
                    handleToggleTask={handleToggleTask}
                    handleEditTask={handleEditTask}
                    handleDeleteTask={handleDeleteTask}
                    handleViewTaskDetails={handleViewTaskDetails}
                    handleReorderTasks={handleReorderTasks}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                    getTaskProgress={getTaskProgress}
                    userSettings={userSettings}
                    isOwner={isOwner}
                    colorScheme={colorScheme}
                  />
                )}

                {activeTab === 'participants' && (
                  <RoomParticipantsList
                    participants={room.participants || []}
                    currentUserId={userSettings?.telegram_id}
                    roomId={room.room_id}
                    onRoleChanged={loadRoomTasks}
                  />
                )}

                {activeTab === 'activity' && (
                  <RoomActivityFeed
                    roomId={room.room_id}
                    limit={50}
                  />
                )}

                {activeTab === 'stats' && (
                  <RoomStatsPanel
                    roomId={room.room_id}
                  />
                )}
              </div>
            </div>

            {/* Footer - только для таба задач */}
            {activeTab === 'tasks' && (
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-700 
                           flex gap-2 flex-shrink-0 flex-wrap">
                <button
                  onClick={handleGenerateLink}
                  className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-xl 
                           bg-gradient-to-r ${colorScheme.buttonGradient}
                           hover:opacity-90 text-white font-medium
                           transition-all active:scale-95 touch-manipulation
                           flex items-center justify-center gap-2
                           text-sm`}
                >
                  <Share2 className="w-4 h-4" />
                  Пригласить
                </button>
                
                {isOwner ? (
                  <button
                    onClick={handleDeleteRoom}
                    className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl 
                             bg-gradient-to-r from-red-500 to-pink-600 
                             hover:from-red-600 hover:to-pink-700 text-white font-medium
                             transition-all active:scale-95 touch-manipulation
                             flex items-center justify-center gap-2
                             text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Удалить
                  </button>
                ) : (
                  <button
                    onClick={handleLeaveRoom}
                    className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl 
                             bg-gray-800 hover:bg-gray-750 text-gray-300
                             border border-gray-700 font-medium
                             transition-all active:scale-95 touch-manipulation
                             flex items-center justify-center gap-2
                             text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Выйти
                  </button>
                )}
              </div>
            )}
          </motion.div>

          {/* Share Modal */}
          <AnimatePresence>
            {showShareOptions && inviteLink && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex items-center justify-center p-4
                         bg-black/40 backdrop-blur-sm"
                onClick={() => setShowShareOptions(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-gray-800 rounded-2xl p-6 max-w-md w-full
                           border border-gray-700 shadow-2xl"
                >
                  <h3 className="text-lg font-bold text-white mb-4">
                    Ссылка-приглашение
                  </h3>
                  <div className="bg-gray-900 rounded-xl p-3 mb-4 break-all text-sm text-gray-300">
                    {inviteLink}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className={`w-full px-4 py-3 rounded-xl 
                             bg-gradient-to-r ${colorScheme.buttonGradient}
                             text-white font-medium
                             transition-all active:scale-95 touch-manipulation`}
                  >
                    Скопировать ссылку
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AnimatePresence>

      {/* Add Room Task Modal */}
      <AddRoomTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        onAddTask={handleAddTask}
        roomColor={room?.color}
      />

      {/* Edit Task Modal */}
      {editingTask && (
        <EditRoomTaskModal
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          onSave={handleSaveTask}
        />
      )}

      {/* Task Detail Modal */}
      {taskDetailView && (
        <TaskDetailModal
          isOpen={!!taskDetailView}
          onClose={() => setTaskDetailView(null)}
          task={taskDetailView}
          onEdit={handleEditTask}
          onRefresh={loadRoomTasks}
          isOwner={isOwner}
        />
      )}
    </>
  );
};

// Компонент таба задач
const TasksTab = ({
  tasks,
  isLoading,
  onOpenAddModal,
  handleToggleTask,
  handleEditTask,
  handleDeleteTask,
  handleViewTaskDetails,
  handleReorderTasks,
  getPriorityColor,
  getStatusColor,
  getTaskProgress,
  userSettings,
  isOwner,
  colorScheme
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Кнопка добавления задачи */}
      <button
        onClick={onOpenAddModal}
        type="button"
        className={`w-full px-4 py-3 rounded-xl border-2 border-dashed 
                 ${colorScheme.borderColor} hover:bg-gray-800
                 text-gray-400 hover:text-gray-300
                 transition-all touch-manipulation active:scale-95
                 flex items-center justify-center gap-2 cursor-pointer`}
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">Добавить задачу</span>
      </button>

      {/* Список задач */}
      {tasks.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            Нет задач в этой комнате
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Добавьте первую задачу выше
          </p>
        </div>
      ) : (
        <Reorder.Group axis="y" values={tasks} onReorder={handleReorderTasks} className="space-y-3">
          {tasks.map((task) => {
            const currentUserParticipant = task.participants.find(
              p => p.telegram_id === userSettings?.telegram_id
            );
            const progress = getTaskProgress(task);

            return (
              <Reorder.Item key={task.task_id} value={task}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl
                           hover:border-gray-600 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleTask(task)}
                      className={`
                        flex-shrink-0 w-6 h-6 mt-0.5 rounded-md border-2 
                        flex items-center justify-center transition-all
                        touch-manipulation active:scale-95
                        ${currentUserParticipant?.completed
                          ? `bg-gradient-to-br ${colorScheme.buttonGradient} border-transparent`
                          : 'bg-transparent border-gray-600 hover:border-gray-500'
                        }
                      `}
                    >
                      {currentUserParticipant?.completed && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </button>

                    {/* Task Content */}
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleViewTaskDetails(task)}
                    >
                      <h4 className={`
                        text-sm font-medium mb-1
                        ${currentUserParticipant?.completed 
                          ? 'line-through text-gray-500' 
                          : 'text-white'
                        }
                      `}>
                        {task.title}
                      </h4>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {/* Приоритет */}
                        <span className={`flex items-center gap-1 ${getPriorityColor(task.priority)}`}>
                          <Flag className="w-3 h-3" />
                          {task.priority}
                        </span>

                        {/* Дедлайн */}
                        {task.deadline && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Calendar className="w-3 h-3" />
                            {new Date(task.deadline).toLocaleDateString('ru-RU')}
                          </span>
                        )}

                        {/* Прогресс */}
                        <span className="text-gray-500">
                          {progress}% • {task.participants?.filter(p => p.completed).length}/{task.participants?.length}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      {progress > 0 && (
                        <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${colorScheme.buttonGradient} transition-all`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {isOwner && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditTask(task)}
                          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10
                                   transition-colors touch-manipulation active:scale-95"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.task_id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10
                                   transition-colors touch-manipulation active:scale-95"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}
    </div>
  );
};

export default RoomDetailModal;
