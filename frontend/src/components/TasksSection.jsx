import React, { useState, useEffect } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { ClipboardList, Check, Plus, Edit2, Trash2, X, Flag, Calendar, AlertCircle, Filter, SortAsc, Zap, Bell, Star, Clock, ChevronDown } from 'lucide-react';
import { tasksAPI, scheduleAPI } from '../services/api';
import { useTelegram } from '../contexts/TelegramContext';
import { AddTaskModal } from './AddTaskModal';

export const TasksSection = ({ userSettings, selectedDate, weekNumber }) => {
  const { user, hapticFeedback } = useTelegram();
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [scheduleSubjects, setScheduleSubjects] = useState([]);
  
  // Фильтры и сортировка
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [sortBy, setSortBy] = useState('created'); // created, priority, deadline
  const [showFilters, setShowFilters] = useState(false);
  
  // Шаблоны быстрых действий
  const [showQuickActions, setShowQuickActions] = useState(false);
  
  // Категории задач с эмодзи
  const getCategoryEmoji = (category) => {
    const categories = {
      'study': '📚',
      'personal': '🏠',
      'sport': '🏃',
      'project': '💼',
    };
    return categories[category] || '';
  };
  
  // Цвет приоритета
  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'text-green-600',
      'medium': 'text-yellow-600',
      'high': 'text-red-600',
    };
    return colors[priority] || colors['medium'];
  };
  
  // Проверка дедлайна
  const getDeadlineStatus = (deadline) => {
    if (!deadline) return null;
    
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffHours = (deadlineDate - now) / (1000 * 60 * 60);
    
    if (diffHours < 0) {
      return { text: 'Просрочено', color: 'text-red-600', bgColor: 'bg-red-50' };
    } else if (diffHours < 24) {
      return { text: 'Сегодня', color: 'text-orange-600', bgColor: 'bg-orange-50' };
    } else if (diffHours < 48) {
      return { text: 'Завтра', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    }
    return { text: deadlineDate.toLocaleDateString('ru-RU'), color: 'text-gray-600', bgColor: 'bg-gray-50' };
  };

  // Загрузка задач при монтировании
  useEffect(() => {
    if (user) {
      loadTasks();
      loadScheduleSubjects();
    }
  }, [user, userSettings, weekNumber]);

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

  // Загрузка предметов из расписания для интеграции
  const loadScheduleSubjects = async () => {
    if (!userSettings) return;
    
    try {
      const scheduleData = await scheduleAPI.getSchedule({
        facultet_id: userSettings.facultet_id,
        level_id: userSettings.level_id,
        kurs: userSettings.kurs,
        form_code: userSettings.form_code,
        group_id: userSettings.group_id,
        week_number: weekNumber || 1,
      });
      
      // Извлекаем уникальные предметы
      const subjects = [...new Set(scheduleData.events?.map(e => e.discipline) || [])];
      setScheduleSubjects(subjects);
    } catch (error) {
      console.error('Error loading schedule subjects:', error);
    }
  };

  const handleAddTask = async (taskData) => {
    try {
      // taskData теперь может быть строкой (старый формат) или объектом (новый формат)
      const requestData = typeof taskData === 'string' 
        ? { text: taskData }
        : taskData;
      
      const newTask = await tasksAPI.createTask(user.id, requestData.text, {
        category: requestData.category,
        priority: requestData.priority,
        deadline: requestData.deadline,
        subject: requestData.subject,
      });
      setTasks([newTask, ...tasks]);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error; // Пробрасываем ошибку для обработки в модальном окне
    }
  };

  const handleOpenAddModal = () => {
    hapticFeedback && hapticFeedback('impact', 'light');
    setIsAddModalOpen(true);
  };

  const toggleTask = async (taskId) => {
    try {
      hapticFeedback && hapticFeedback('impact', 'light');
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
    hapticFeedback && hapticFeedback('impact', 'light');
  };

  const handleSaveEdit = async (taskId) => {
    if (!editingText.trim()) return;
    
    try {
      hapticFeedback && hapticFeedback('impact', 'medium');
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
      hapticFeedback && hapticFeedback('impact', 'heavy');
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
          className="w-[370px] h-[250px] rounded-3xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200/50 p-4 flex flex-col"
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
                        <div className="flex flex-col gap-1.5">
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
                            <div className="flex-1 min-w-0">
                              <span 
                                className={`
                                  block text-xs leading-tight transition-all duration-200
                                  ${task.completed 
                                    ? 'text-[#999999] line-through' 
                                    : 'text-[#1C1C1E]'
                                  }
                                `}
                              >
                                {task.text}
                              </span>
                              
                              {/* Метки: категория, приоритет, предмет */}
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {task.category && (
                                  <span className="text-xs">
                                    {getCategoryEmoji(task.category)}
                                  </span>
                                )}
                                {task.priority && task.priority !== 'medium' && (
                                  <Flag className={`w-2.5 h-2.5 ${getPriorityColor(task.priority)}`} />
                                )}
                                {task.subject && (
                                  <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    {task.subject}
                                  </span>
                                )}
                              </div>
                              
                              {/* Дедлайн */}
                              {task.deadline && (() => {
                                const deadlineStatus = getDeadlineStatus(task.deadline);
                                return deadlineStatus && (
                                  <div className={`flex items-center gap-1 mt-1 text-[9px] ${deadlineStatus.color} ${deadlineStatus.bgColor} px-1.5 py-0.5 rounded w-fit`}>
                                    {deadlineStatus.text === 'Просрочено' && <AlertCircle className="w-2.5 h-2.5" />}
                                    <Calendar className="w-2.5 h-2.5" />
                                    <span>{deadlineStatus.text}</span>
                                  </div>
                                );
                              })()}
                            </div>
                            
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
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Кнопка добавления новой задачи */}
          <div className="mt-3 pt-3 border-t border-yellow-200/30">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenAddModal}
              className="w-full py-2 bg-gradient-to-br from-yellow-400 to-orange-400 text-white rounded-lg flex items-center justify-center gap-2 font-medium text-xs shadow-sm hover:shadow-md transition-shadow"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Добавить задачу
            </motion.button>
            
            {/* Счетчик */}
            <p className="text-xs text-[#999999] text-center mt-2">
              {todayTasks.filter(t => t.completed).length} / {todayTasks.length} выполнено
            </p>
          </div>
        </motion.div>
      </div>

      {/* Модальное окно добавления задачи */}
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTask={handleAddTask}
        hapticFeedback={hapticFeedback}
      />
    </motion.div>
  );
};
