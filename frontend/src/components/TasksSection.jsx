import React, { useState, useEffect } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { ClipboardList, Check, Plus, Edit2, Trash2, X } from 'lucide-react';
import { tasksAPI } from '../services/api';
import { useTelegram } from '../contexts/TelegramContext';
import { AddTaskModal } from './AddTaskModal';

export const TasksSection = () => {
  const { user, hapticFeedback } = useTelegram();
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Загрузка задач при монтировании
  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await tasksAPI.getUserTasks(user.id);
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (taskText) => {
    try {
      const newTask = await tasksAPI.createTask(user.id, taskText);
      setTasks([newTask, ...tasks]);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error; // Пробрасываем ошибку для обработки в модальном окне
    }
  };

  const handleOpenAddModal = () => {
    hapticFeedback?.impactOccurred('light');
    setIsAddModalOpen(true);
  };

  const toggleTask = async (taskId) => {
    try {
      hapticFeedback?.impactOccurred('light');
      const task = tasks.find(t => t.id === taskId);
      const updatedTask = await tasksAPI.updateTask(taskId, { completed: !task.completed });
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const handleStartEdit = (task) => {
    setEditingTaskId(task.id);
    setEditingText(task.text);
    hapticFeedback?.impactOccurred('light');
  };

  const handleSaveEdit = async (taskId) => {
    if (!editingText.trim()) return;
    
    try {
      hapticFeedback?.impactOccurred('medium');
      const updatedTask = await tasksAPI.updateTask(taskId, { text: editingText.trim() });
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
      setEditingTaskId(null);
      setEditingText('');
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingText('');
  };

  const handleDeleteTask = async (taskId) => {
    try {
      hapticFeedback?.impactOccurred('heavy');
      await tasksAPI.deleteTask(taskId);
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Фильтруем задачи на сегодня
  const todayTasks = tasks.slice(0, 10); // Показываем последние 10 задач

  const currentDate = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long'
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-[calc(100vh-140px)] bg-white rounded-t-[40px] mt-6 p-6"
    >
      {/* Header секции */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#1C1C1E]">Список дел</h2>
          <p className="text-sm text-[#999999]">Управляйте своими задачами</p>
        </div>
      </div>

      {/* Карточка с задачами на сегодня */}
      <div className="flex gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-[160px] h-[200px] rounded-3xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200/50 p-4 flex flex-col"
          style={{
            boxShadow: '0 4px 16px rgba(251, 191, 36, 0.1)'
          }}
        >
          {/* Заголовок карточки */}
          <div className="mb-3">
            <h3 className="text-sm font-bold text-[#1C1C1E]">Сегодня</h3>
            <p className="text-xs text-[#999999] mt-0.5">{currentDate}</p>
          </div>

          {/* Список задач */}
          <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-yellow-300 scrollbar-track-transparent">
            {loading ? (
              <div className="text-xs text-[#999999] text-center py-4">Загрузка...</div>
            ) : todayTasks.length === 0 ? (
              <div className="text-xs text-[#999999] text-center py-4">Нет задач</div>
            ) : (
              todayTasks.map((task) => {
                const isEditing = editingTaskId === task.id;
                
                return (
                  <motion.div
                    key={task.id}
                    drag="x"
                    dragConstraints={{ left: -80, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(e, info) => {
                      // Свайп влево для удаления (только на мобильных)
                      if (info.offset.x < -60 && window.innerWidth < 768) {
                        handleDeleteTask(task.id);
                      }
                    }}
                    className="relative"
                  >
                    {/* Фон для свайпа (кнопка удаления) */}
                    <div className="absolute right-0 top-0 bottom-0 w-16 bg-red-500 rounded-lg flex items-center justify-center">
                      <Trash2 className="w-4 h-4 text-white" />
                    </div>
                    
                    {/* Контент задачи */}
                    <motion.div
                      whileTap={{ scale: 0.98 }}
                      className="relative bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-2 group"
                    >
                      {isEditing ? (
                        // Режим редактирования
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit(task.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            className="flex-1 text-xs bg-white border border-yellow-300 rounded px-2 py-1 focus:outline-none focus:border-yellow-400"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(task.id)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        // Обычный режим
                        <div className="flex items-start gap-2">
                          {/* Checkbox */}
                          <div 
                            onClick={() => toggleTask(task.id)}
                            className={`
                              w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center transition-all duration-200 mt-0.5 cursor-pointer
                              ${task.completed 
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-400' 
                                : 'bg-white border-2 border-[#E5E5E5] group-hover:border-yellow-400'
                              }
                            `}
                          >
                            {task.completed && (
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            )}
                          </div>

                          {/* Текст задачи */}
                          <span 
                            className={`
                              flex-1 text-xs leading-tight transition-all duration-200
                              ${task.completed 
                                ? 'text-[#999999] line-through' 
                                : 'text-[#1C1C1E]'
                              }
                            `}
                          >
                            {task.text}
                          </span>
                          
                          {/* Кнопки редактирования/удаления (десктоп) */}
                          <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleStartEdit(task)}
                              className="p-1 text-yellow-600 hover:bg-yellow-100 rounded"
                              title="Редактировать"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                              title="Удалить"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Input для добавления новой задачи */}
          <div className="mt-3 pt-3 border-t border-yellow-200/30">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTask();
                  }
                }}
                placeholder="Новая задача..."
                className="flex-1 text-xs bg-white border border-yellow-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400 placeholder-[#999999]"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleAddTask}
                disabled={!newTaskText.trim()}
                className={`
                  w-7 h-7 rounded-lg flex items-center justify-center transition-all
                  ${newTaskText.trim()
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-400 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
              </motion.button>
            </div>
            
            {/* Счетчик */}
            <p className="text-xs text-[#999999] text-center mt-2">
              {todayTasks.filter(t => t.completed).length} / {todayTasks.length} выполнено
            </p>
          </div>
        </motion.div>

        {/* Placeholder для остального контента справа */}
        <div className="flex-1 flex flex-col items-center justify-center py-16">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400/10 to-orange-400/10 flex items-center justify-center mb-4">
            <ClipboardList className="w-12 h-12 text-yellow-500" strokeWidth={2} />
          </div>
          <h3 className="text-lg font-semibold text-[#1C1C1E] mb-2">
            Раздел в разработке
          </h3>
          <p className="text-sm text-[#999999] text-center max-w-xs">
            Здесь будет расширенный функционал списка дел
          </p>
        </div>
      </div>
    </motion.div>
  );
};
