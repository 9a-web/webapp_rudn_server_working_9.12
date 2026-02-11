/**
 * Модальное окно деталей комнаты с табами
 * Табы: Задачи | Участники | Активность | Настройки
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  X, Users, Share2, Trash2, Plus, Check, Settings,
  Clock, Flag, Calendar, ChevronRight, LogOut,
  CheckCircle, Edit2, Filter, SortAsc, Activity,
  Pin, PinOff, MessageSquare, AlertTriangle, ListChecks
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
  updateRoom,
  togglePinTask
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

const PRIORITY_MAP = { high: 3, medium: 2, low: 1 };

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
  // Фильтры и сортировка
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [showFilters, setShowFilters] = useState(false);

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

      if (webApp?.showPopup && webApp?.isVersionAtLeast?.('6.2')) {
        try {
          webApp.showPopup({
            title: 'Готово!',
            message: 'Ссылка скопирована в буфер обмена',
            buttons: [{ type: 'ok' }]
          });
        } catch (e) { /* ignore */ }
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
      // Добавляем telegram_id для проверки прав на бэкенде
      await updateGroupTask(taskId, {
        ...updateData,
        telegram_id: userSettings?.telegram_id
      });
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

  // Закрепить/открепить задачу
  const handlePinTask = async (task) => {
    try {
      await togglePinTask(task.task_id, userSettings?.telegram_id, !task.pinned);
      await loadRoomTasks();
      if (webApp?.HapticFeedback) {
        webApp.HapticFeedback.impactOccurred('medium');
      }
    } catch (error) {
      console.error('Error pinning task:', error);
    }
  };

  // Хелпер: дедлайн
  const getDeadlineInfo = (deadline) => {
    if (!deadline) return null;
    const now = new Date();
    const dl = new Date(deadline);
    const diffMs = dl - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    if (diffMs < 0) return { label: 'Просрочено', color: 'text-red-400 bg-red-500/15', urgent: true };
    if (diffHours < 24) return { label: `${Math.ceil(diffHours)}ч`, color: 'text-orange-400 bg-orange-500/15', urgent: true };
    if (diffDays < 3) return { label: `${Math.ceil(diffDays)}д`, color: 'text-yellow-400 bg-yellow-500/15', urgent: false };
    return { label: dl.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), color: 'text-gray-400 bg-white/5', urgent: false };
  };

  // Фильтрация и сортировка задач
  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    
    // Фильтр по статусу
    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus);
    }
    // Фильтр по приоритету
    if (filterPriority !== 'all') {
      result = result.filter(t => t.priority === filterPriority);
    }
    
    // Сортировка
    if (sortBy === 'deadline') {
      result.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    } else if (sortBy === 'priority') {
      result.sort((a, b) => (PRIORITY_MAP[b.priority] || 0) - (PRIORITY_MAP[a.priority] || 0));
    }
    
    // Закреплённые всегда вверху
    result.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    
    return result;
  }, [tasks, filterStatus, filterPriority, sortBy]);

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
                    tasks={filteredTasks}
                    isLoading={isLoading}
                    onOpenAddModal={() => setIsAddTaskModalOpen(true)}
                    handleToggleTask={handleToggleTask}
                    handleEditTask={handleEditTask}
                    handleDeleteTask={handleDeleteTask}
                    handleViewTaskDetails={handleViewTaskDetails}
                    handleReorderTasks={handleReorderTasks}
                    handlePinTask={handlePinTask}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                    getTaskProgress={getTaskProgress}
                    getDeadlineInfo={getDeadlineInfo}
                    userSettings={userSettings}
                    isOwner={isOwner}
                    colorScheme={colorScheme}
                    filterStatus={filterStatus}
                    setFilterStatus={setFilterStatus}
                    filterPriority={filterPriority}
                    setFilterPriority={setFilterPriority}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    showFilters={showFilters}
                    setShowFilters={setShowFilters}
                    totalCount={tasks.length}
                  />
                )}

                {activeTab === 'participants' && (
                  <RoomParticipantsList
                    participants={room.participants || []}
                    currentUserId={userSettings?.telegram_id}
                    roomId={room.room_id}
                    onRoleChanged={loadRoomTasks}
                    onParticipantsUpdated={async () => {
                      // Обновить данные комнаты при добавлении участников
                      loadRoomTasks();
                      if (onRoomUpdated) {
                        try {
                          const { getRoomDetail } = await import('../services/roomsAPI');
                          const updatedRoom = await getRoomDetail(room.room_id);
                          onRoomUpdated(updatedRoom);
                        } catch (err) {
                          console.error('Error refreshing room:', err);
                        }
                      }
                    }}
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
        participants={room?.participants || []}
      />

      {/* Edit Task Modal */}
      {editingTask && (
        <EditRoomTaskModal
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          onSave={handleSaveTask}
          roomParticipants={room?.participants || []}
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
  handlePinTask,
  getPriorityColor,
  getStatusColor,
  getTaskProgress,
  getDeadlineInfo,
  userSettings,
  isOwner,
  colorScheme,
  filterStatus,
  setFilterStatus,
  filterPriority,
  setFilterPriority,
  sortBy,
  setSortBy,
  showFilters,
  setShowFilters,
  totalCount
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const hasActiveFilters = filterStatus !== 'all' || filterPriority !== 'all' || sortBy !== 'default';

  return (
    <div className="space-y-3">
      {/* Кнопка добавления + фильтры */}
      <div className="flex gap-2">
        <button
          onClick={onOpenAddModal}
          type="button"
          className={`flex-1 px-4 py-2.5 rounded-xl border-2 border-dashed 
                   ${colorScheme.borderColor} hover:bg-gray-800
                   text-gray-400 hover:text-gray-300
                   transition-all touch-manipulation active:scale-95
                   flex items-center justify-center gap-2 cursor-pointer`}
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium text-sm">Добавить задачу</span>
        </button>
        
        {totalCount > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2.5 rounded-xl border transition-all touch-manipulation active:scale-95
                     ${hasActiveFilters 
                       ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' 
                       : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:text-gray-300'}`}
          >
            <Filter className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Панель фильтров */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-gray-800/70 border border-gray-700 rounded-xl space-y-2.5">
              {/* Статус */}
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Статус</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: 'all', label: 'Все' },
                    { value: 'created', label: 'Новые' },
                    { value: 'in_progress', label: 'В работе' },
                    { value: 'completed', label: 'Готово' },
                    { value: 'overdue', label: 'Просрочено' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterStatus(opt.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                               ${filterStatus === opt.value 
                                 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                 : 'bg-gray-700/50 text-gray-400 border border-transparent hover:bg-gray-700'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Приоритет */}
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Приоритет</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: 'all', label: 'Все' },
                    { value: 'high', label: 'Высокий', color: 'text-red-400' },
                    { value: 'medium', label: 'Средний', color: 'text-yellow-400' },
                    { value: 'low', label: 'Низкий', color: 'text-green-400' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterPriority(opt.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                               ${filterPriority === opt.value 
                                 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                 : `bg-gray-700/50 ${opt.color || 'text-gray-400'} border border-transparent hover:bg-gray-700`}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Сортировка */}
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Сортировка</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: 'default', label: 'По умолчанию' },
                    { value: 'deadline', label: 'По дедлайну' },
                    { value: 'priority', label: 'По приоритету' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSortBy(opt.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                               ${sortBy === opt.value 
                                 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                 : 'bg-gray-700/50 text-gray-400 border border-transparent hover:bg-gray-700'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Сброс фильтров */}
              {hasActiveFilters && (
                <button
                  onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setSortBy('default'); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Счётчик */}
      {hasActiveFilters && (
        <p className="text-xs text-gray-500 px-1">
          Показано {tasks.length} из {totalCount} задач
        </p>
      )}

      {/* Список задач */}
      {tasks.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            {hasActiveFilters ? 'Нет задач по выбранным фильтрам' : 'Нет задач в этой комнате'}
          </p>
          {!hasActiveFilters && (
            <p className="text-sm text-gray-500 mt-1">Добавьте первую задачу выше</p>
          )}
        </div>
      ) : (
        <div className="py-1">
          <Reorder.Group axis="y" values={tasks} onReorder={handleReorderTasks} className="space-y-2.5">
          {tasks.map((task) => {
            const currentUserParticipant = task.participants.find(
              p => p.telegram_id === userSettings?.telegram_id
            );
            const progress = getTaskProgress(task);
            const deadlineInfo = getDeadlineInfo(task.deadline);
            const subtasks = task.subtasks || [];
            const subtasksDone = subtasks.filter(s => s.completed).length;
            const hasSubtasks = subtasks.length > 0;

            return (
              <Reorder.Item key={task.task_id} value={task}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3.5 rounded-xl transition-all group
                           ${task.pinned 
                             ? 'bg-yellow-500/5 border border-yellow-500/20 hover:border-yellow-500/40' 
                             : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'}
                           hover:shadow-lg hover:shadow-indigo-500/5`}
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
                      <div className="flex items-center gap-1.5 mb-1">
                        {task.pinned && (
                          <Pin className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                        )}
                        <h4 className={`
                          text-sm font-medium truncate
                          ${currentUserParticipant?.completed 
                            ? 'line-through text-gray-500' 
                            : 'text-white'
                          }
                        `}>
                          {task.title}
                        </h4>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {/* Приоритет */}
                        <span className={`flex items-center gap-0.5 ${getPriorityColor(task.priority)}`}>
                          <Flag className="w-3 h-3" />
                          {task.priority === 'high' ? 'Выс' : task.priority === 'medium' ? 'Сред' : 'Низ'}
                        </span>

                        {/* Дедлайн с индикацией */}
                        {deadlineInfo && (
                          <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-medium ${deadlineInfo.color}`}>
                            {deadlineInfo.urgent && <AlertTriangle className="w-3 h-3" />}
                            <Calendar className="w-3 h-3" />
                            {deadlineInfo.label}
                          </span>
                        )}

                        {/* Прогресс подзадач */}
                        {hasSubtasks && (
                          <span className={`flex items-center gap-0.5 ${subtasksDone === subtasks.length ? 'text-green-400' : 'text-gray-400'}`}>
                            <ListChecks className="w-3 h-3" />
                            {subtasksDone}/{subtasks.length}
                          </span>
                        )}

                        {/* Комментарии */}
                        {task.comments_count > 0 && (
                          <span className="flex items-center gap-0.5 text-gray-400">
                            <MessageSquare className="w-3 h-3" />
                            {task.comments_count}
                          </span>
                        )}

                        {/* Прогресс участников */}
                        <span className="text-gray-500">
                          {progress}% • {task.participants?.filter(p => p.completed).length}/{task.participants?.length}
                        </span>
                      </div>

                      {/* Progress Bar участников */}
                      {progress > 0 && (
                        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${colorScheme.buttonGradient} transition-all`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}

                      {/* Прогресс подзадач — мини-бар */}
                      {hasSubtasks && (
                        <div className="mt-1.5 h-1 bg-gray-700/50 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                            style={{ width: `${(subtasksDone / subtasks.length) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {(isOwner || task.owner_id === userSettings?.telegram_id) && (
                      <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePinTask(task); }}
                          className={`p-1.5 rounded-lg transition-colors touch-manipulation active:scale-95
                                   ${task.pinned ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-gray-500 hover:bg-gray-700'}`}
                          title={task.pinned ? 'Открепить' : 'Закрепить'}
                        >
                          {task.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleEditTask(task)}
                          className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10
                                   transition-colors touch-manipulation active:scale-95"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.task_id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10
                                   transition-colors touch-manipulation active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
        </div>
      )}
    </div>
  );
};

export default RoomDetailModal;
