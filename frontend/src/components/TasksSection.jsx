import React, { useState, useEffect } from 'react';
import { motion, PanInfo, Reorder, useDragControls } from 'framer-motion';
import { ClipboardList, Check, Plus, Edit2, Trash2, X, Flag, Calendar, AlertCircle, Filter, SortAsc, Zap, Bell, Star, Clock, ChevronDown, GripVertical } from 'lucide-react';
import { tasksAPI, scheduleAPI } from '../services/api';
import { useTelegram } from '../contexts/TelegramContext';
import { AddTaskModal } from './AddTaskModal';
import { WeekDateSelector } from './WeekDateSelector';

export const TasksSection = ({ userSettings, selectedDate, weekNumber, onModalStateChange }) => {
  const { user, hapticFeedback } = useTelegram();
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [scheduleSubjects, setScheduleSubjects] = useState([]);
  
  // Выбранная дата для отображения задач (по умолчанию - сегодня)
  const [tasksSelectedDate, setTasksSelectedDate] = useState(new Date());
  
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

  // Уведомляем родительский компонент об изменении состояния модального окна
  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(isAddModalOpen);
    }
  }, [isAddModalOpen, onModalStateChange]);

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

  // Обновление порядка задач после перетаскивания в карточке "Сегодня"
  const handleReorderTasks = (newOrder) => {
    console.log('🔄 Reorder triggered!', {
      oldOrder: todayTasks.map(t => ({ id: t.id, text: t.text })),
      newOrder: newOrder.map(t => ({ id: t.id, text: t.text }))
    });
    
    // newOrder содержит только задачи из todayTasks (первые 10)
    // Нужно обновить порядок в полном массиве tasks
    
    // Создаем Map для быстрого поиска новых позиций
    const orderMap = new Map();
    newOrder.forEach((task, index) => {
      orderMap.set(task.id, index);
    });
    
    // Обновляем tasks, сохраняя порядок из newOrder для задач в todayTasks
    const updatedTasks = [...tasks].sort((a, b) => {
      const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity;
      const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity;
      
      // Если обе задачи из todayTasks - сортируем по новому порядку
      if (orderA !== Infinity && orderB !== Infinity) {
        return orderA - orderB;
      }
      // Если только одна задача из todayTasks - она идет первой
      if (orderA !== Infinity) return -1;
      if (orderB !== Infinity) return 1;
      
      // Для остальных задач сохраняем текущий порядок
      return 0;
    });
    
    setTasks(updatedTasks);
    
    console.log('✅ Tasks reordered successfully');
    
    // Здесь можно добавить сохранение порядка на сервер при необходимости
    hapticFeedback && hapticFeedback('impact', 'light');
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

  // Шаблоны быстрых задач
  const quickActionTemplates = [
    { 
      text: 'Подготовиться к лекции', 
      category: 'study', 
      priority: 'medium',
      icon: '📖'
    },
    { 
      text: 'Сдать лабораторную работу', 
      category: 'study', 
      priority: 'high',
      icon: '🔬'
    },
    { 
      text: 'Повторить материал', 
      category: 'study', 
      priority: 'medium',
      icon: '📝'
    },
    { 
      text: 'Выполнить домашнее задание', 
      category: 'study', 
      priority: 'high',
      icon: '✏️'
    },
  ];

  // Создание задачи из шаблона
  const handleQuickAction = async (template) => {
    try {
      hapticFeedback && hapticFeedback('impact', 'medium');
      const newTask = await tasksAPI.createTask(user.id, template.text, {
        category: template.category,
        priority: template.priority,
      });
      setTasks([newTask, ...tasks]);
      setShowQuickActions(false);
    } catch (error) {
      console.error('Error creating quick task:', error);
    }
  };

  // Фильтрация и сортировка задач
  const getFilteredAndSortedTasks = () => {
    let filtered = [...tasks];
    
    // Фильтр по категории
    if (selectedCategory) {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }
    
    // Фильтр по приоритету
    if (selectedPriority) {
      filtered = filtered.filter(t => t.priority === selectedPriority);
    }
    
    // Сортировка
    filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
      } else if (sortBy === 'deadline') {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      } else {
        // По умолчанию - по дате создания (новые сверху)
        return new Date(b.created_at) - new Date(a.created_at);
      }
    });
    
    return filtered;
  };

  // Группировка задач по срокам
  const groupTasksByDeadline = () => {
    const filteredTasks = getFilteredAndSortedTasks();
    const now = new Date();
    
    const overdue = [];
    const today = [];
    const thisWeek = [];
    const later = [];
    const noDeadline = [];
    
    filteredTasks.forEach(task => {
      if (!task.deadline) {
        noDeadline.push(task);
        return;
      }
      
      const deadline = new Date(task.deadline);
      const diffHours = (deadline - now) / (1000 * 60 * 60);
      const diffDays = diffHours / 24;
      
      if (diffHours < 0) {
        overdue.push(task);
      } else if (diffHours < 24) {
        today.push(task);
      } else if (diffDays < 7) {
        thisWeek.push(task);
      } else {
        later.push(task);
      }
    });
    
    return { overdue, today, thisWeek, later, noDeadline };
  };

  // Фильтруем задачи для выбранной даты
  const getTasksForSelectedDate = () => {
    const selectedDateStr = tasksSelectedDate.toISOString().split('T')[0];
    return getFilteredAndSortedTasks().filter(task => {
      if (!task.created_at) return false;
      const taskDate = new Date(task.created_at).toISOString().split('T')[0];
      return taskDate === selectedDateStr;
    }).slice(0, 10);
  };
  
  const todayTasks = getTasksForSelectedDate();

  const currentDate = tasksSelectedDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long'
  });
  
  // Обработчик выбора даты
  const handleDateSelect = (date) => {
    setTasksSelectedDate(date);
  };

  const groupedTasks = groupTasksByDeadline();
  const categories = [
    { id: 'study', label: 'Учеба', emoji: '📚', color: 'from-blue-400 to-blue-500' },
    { id: 'personal', label: 'Личное', emoji: '🏠', color: 'from-green-400 to-green-500' },
    { id: 'sport', label: 'Спорт', emoji: '🏃', color: 'from-red-400 to-red-500' },
    { id: 'project', label: 'Проекты', emoji: '💼', color: 'from-purple-400 to-purple-500' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-[calc(100vh-140px)] bg-white rounded-t-[40px] mt-6 p-6"
    >
      {/* Header секции */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1C1C1E]">Список дел</h2>
            <p className="text-sm text-[#999999]">
              {tasks.length} задач · {tasks.filter(t => t.completed).length} выполнено
            </p>
          </div>
        </div>
        
        {/* Кнопки управления */}
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              hapticFeedback && hapticFeedback('impact', 'light');
              setShowFilters(!showFilters);
            }}
            className={`p-2 rounded-xl transition-colors ${
              showFilters || selectedCategory || selectedPriority
                ? 'bg-yellow-100 text-yellow-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Фильтры"
          >
            <Filter className="w-5 h-5" />
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              hapticFeedback && hapticFeedback('impact', 'light');
              const sortOptions = ['created', 'priority', 'deadline'];
              const currentIndex = sortOptions.indexOf(sortBy);
              setSortBy(sortOptions[(currentIndex + 1) % sortOptions.length]);
            }}
            className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            title={`Сортировка: ${sortBy === 'created' ? 'По дате' : sortBy === 'priority' ? 'По приоритету' : 'По дедлайну'}`}
          >
            <SortAsc className="w-5 h-5" />
          </motion.button>
          
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              hapticFeedback && hapticFeedback('impact', 'light');
              setShowQuickActions(!showQuickActions);
            }}
            className={`p-2 rounded-xl transition-colors ${
              showQuickActions
                ? 'bg-orange-100 text-orange-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Быстрые действия"
          >
            <Zap className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Панель фильтров */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 space-y-3 overflow-hidden"
        >
          {/* Фильтр по категориям */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Категории</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  hapticFeedback && hapticFeedback('selection');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !selectedCategory
                    ? 'bg-gray-200 text-gray-800'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Все
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === cat.id ? null : cat.id);
                    hapticFeedback && hapticFeedback('selection');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? `bg-gradient-to-r ${cat.color} text-white`
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Фильтр по приоритетам */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Приоритеты</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedPriority(null);
                  hapticFeedback && hapticFeedback('selection');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !selectedPriority
                    ? 'bg-gray-200 text-gray-800'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => {
                  setSelectedPriority(selectedPriority === 'high' ? null : 'high');
                  hapticFeedback && hapticFeedback('selection');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedPriority === 'high'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                🔥 Высокий
              </button>
              <button
                onClick={() => {
                  setSelectedPriority(selectedPriority === 'medium' ? null : 'medium');
                  hapticFeedback && hapticFeedback('selection');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedPriority === 'medium'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                ⚡️ Средний
              </button>
              <button
                onClick={() => {
                  setSelectedPriority(selectedPriority === 'low' ? null : 'low');
                  hapticFeedback && hapticFeedback('selection');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedPriority === 'low'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                ✅ Низкий
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Панель быстрых действий */}
      {showQuickActions && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 overflow-hidden"
        >
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-4 border border-orange-200/50">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-orange-600" />
              <p className="text-sm font-bold text-gray-800">Быстрые шаблоны</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickActionTemplates.map((template, idx) => (
                <motion.button
                  key={idx}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleQuickAction(template)}
                  className="p-3 bg-white rounded-xl text-left hover:shadow-md transition-shadow border border-gray-100"
                >
                  <div className="text-lg mb-1">{template.icon}</div>
                  <p className="text-xs font-medium text-gray-800 leading-tight">
                    {template.text}
                  </p>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Карточка с задачами и группы по дедлайнам */}
      <div className="space-y-4">
        {/* Карточка "Сегодня" */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full max-w-2xl rounded-3xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200/50 p-4 flex flex-col"
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
          <div className="flex-1 space-y-2">
            {loading ? (
              <div className="text-xs text-[#999999] text-center py-4">Загрузка...</div>
            ) : todayTasks.length === 0 ? (
              <div className="text-xs text-[#999999] text-center py-4">Нет задач</div>
            ) : (
              <Reorder.Group 
                axis="y" 
                values={todayTasks} 
                onReorder={handleReorderTasks}
                className="min-h-[100px] list-none"
                style={{ padding: 0, margin: 0 }}
              >
                {todayTasks.map((task) => (
                  <TodayTaskItem
                    key={task.id}
                    task={task}
                    isEditing={editingTaskId === task.id}
                    editingText={editingText}
                    setEditingText={setEditingText}
                    onToggle={toggleTask}
                    onSaveEdit={handleSaveEdit}
                    onCancelEdit={handleCancelEdit}
                    onDelete={handleDeleteTask}
                    getCategoryEmoji={getCategoryEmoji}
                    getPriorityColor={getPriorityColor}
                    getDeadlineStatus={getDeadlineStatus}
                    hapticFeedback={hapticFeedback}
                  />
                ))}
              </Reorder.Group>
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

        {/* Группы задач по дедлайнам */}
        <div className="space-y-4 max-w-2xl">
          {/* Просроченные задачи */}
          {groupedTasks.overdue.length > 0 && (
            <TaskGroup
              title="Просроченные"
              icon={<AlertCircle className="w-5 h-5 text-red-600" />}
              tasks={groupedTasks.overdue}
              accentColor="red"
              onToggle={toggleTask}
              onEdit={handleStartEdit}
              onDelete={handleDeleteTask}
              editingTaskId={editingTaskId}
              editingText={editingText}
              setEditingText={setEditingText}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              getCategoryEmoji={getCategoryEmoji}
              getPriorityColor={getPriorityColor}
              getDeadlineStatus={getDeadlineStatus}
              hapticFeedback={hapticFeedback}
            />
          )}

          {/* Задачи на сегодня */}
          {groupedTasks.today.length > 0 && (
            <TaskGroup
              title="Сегодня"
              icon={<Calendar className="w-5 h-5 text-orange-600" />}
              tasks={groupedTasks.today}
              accentColor="orange"
              onToggle={toggleTask}
              onEdit={handleStartEdit}
              onDelete={handleDeleteTask}
              editingTaskId={editingTaskId}
              editingText={editingText}
              setEditingText={setEditingText}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              getCategoryEmoji={getCategoryEmoji}
              getPriorityColor={getPriorityColor}
              getDeadlineStatus={getDeadlineStatus}
              hapticFeedback={hapticFeedback}
            />
          )}

          {/* Задачи на этой неделе */}
          {groupedTasks.thisWeek.length > 0 && (
            <TaskGroup
              title="На этой неделе"
              icon={<Clock className="w-5 h-5 text-blue-600" />}
              tasks={groupedTasks.thisWeek}
              accentColor="blue"
              onToggle={toggleTask}
              onEdit={handleStartEdit}
              onDelete={handleDeleteTask}
              editingTaskId={editingTaskId}
              editingText={editingText}
              setEditingText={setEditingText}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              getCategoryEmoji={getCategoryEmoji}
              getPriorityColor={getPriorityColor}
              getDeadlineStatus={getDeadlineStatus}
              hapticFeedback={hapticFeedback}
            />
          )}

          {/* Задачи позже */}
          {groupedTasks.later.length > 0 && (
            <TaskGroup
              title="Позже"
              icon={<Star className="w-5 h-5 text-purple-600" />}
              tasks={groupedTasks.later}
              accentColor="purple"
              onToggle={toggleTask}
              onEdit={handleStartEdit}
              onDelete={handleDeleteTask}
              editingTaskId={editingTaskId}
              editingText={editingText}
              setEditingText={setEditingText}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              getCategoryEmoji={getCategoryEmoji}
              getPriorityColor={getPriorityColor}
              getDeadlineStatus={getDeadlineStatus}
              hapticFeedback={hapticFeedback}
            />
          )}

          {/* Задачи без дедлайна */}
          {groupedTasks.noDeadline.length > 0 && (
            <TaskGroup
              title="Без срока"
              icon={<ClipboardList className="w-5 h-5 text-gray-600" />}
              tasks={groupedTasks.noDeadline}
              accentColor="gray"
              onToggle={toggleTask}
              onEdit={handleStartEdit}
              onDelete={handleDeleteTask}
              editingTaskId={editingTaskId}
              editingText={editingText}
              setEditingText={setEditingText}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              getCategoryEmoji={getCategoryEmoji}
              getPriorityColor={getPriorityColor}
              getDeadlineStatus={getDeadlineStatus}
              hapticFeedback={hapticFeedback}
            />
          )}
        </div>
      </div>

      {/* Модальное окно добавления задачи */}
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTask={handleAddTask}
        hapticFeedback={hapticFeedback}
        scheduleSubjects={scheduleSubjects}
      />
    </motion.div>
  );
};

// Компонент задачи для карточки "Сегодня" с drag and drop
const TodayTaskItem = ({ 
  task, 
  isEditing, 
  editingText, 
  setEditingText,
  onToggle,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  getCategoryEmoji,
  getPriorityColor,
  getDeadlineStatus,
  hapticFeedback
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={dragControls}
      className="mb-2"
      style={{ listStyle: 'none' }}
    >
      {/* Контент задачи */}
      <div className="relative bg-white rounded-lg p-2 group shadow-sm"
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
                  onSaveEdit(task.id);
                } else if (e.key === 'Escape') {
                  onCancelEdit();
                }
              }}
              className="flex-1 text-xs bg-white border border-yellow-300 rounded px-2 py-1 focus:outline-none focus:border-yellow-400"
              autoFocus
            />
            <button
              onClick={() => onSaveEdit(task.id)}
              className="p-1 text-green-600 hover:bg-green-100 rounded"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1 text-red-600 hover:bg-red-100 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          // Обычный режим
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              {/* Drag Handle (3 полоски) */}
              <div
                onPointerDown={(e) => {
                  console.log('👆 Drag handle clicked for task:', task.id, task.text);
                  e.stopPropagation();
                  if (hapticFeedback) hapticFeedback('impact', 'light');
                  dragControls.start(e);
                  console.log('🚀 Drag controls started');
                }}
                className="flex-shrink-0 cursor-grab active:cursor-grabbing mt-0.5 touch-none select-none"
                style={{ touchAction: 'none' }}
              >
                <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors pointer-events-none" />
              </div>
              
              {/* Checkbox */}
              <div 
                onClick={() => onToggle(task.id)}
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
              
              {/* Кнопка удаления (всегда видна) */}
              <button
                onClick={() => {
                  hapticFeedback && hapticFeedback('impact', 'medium');
                  onDelete(task.id);
                }}
                className="flex-shrink-0 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                title="Удалить задачу"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Reorder.Item>
  );
};

// Компонент группы задач
const TaskGroup = ({ 
  title, 
  icon, 
  tasks, 
  accentColor,
  onToggle,
  onEdit,
  onDelete,
  editingTaskId,
  editingText,
  setEditingText,
  onSaveEdit,
  onCancelEdit,
  getCategoryEmoji,
  getPriorityColor,
  getDeadlineStatus,
  hapticFeedback,
  onReorder
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [localTasks, setLocalTasks] = useState(tasks);

  // Обновляем локальный стейт при изменении пропсов
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const accentColors = {
    red: { bg: 'from-red-50 to-red-100', border: 'border-red-200', text: 'text-red-600' },
    orange: { bg: 'from-orange-50 to-orange-100', border: 'border-orange-200', text: 'text-orange-600' },
    blue: { bg: 'from-blue-50 to-blue-100', border: 'border-blue-200', text: 'text-blue-600' },
    purple: { bg: 'from-purple-50 to-purple-100', border: 'border-purple-200', text: 'text-purple-600' },
    gray: { bg: 'from-gray-50 to-gray-100', border: 'border-gray-200', text: 'text-gray-600' },
  };

  const colors = accentColors[accentColor] || accentColors.gray;

  const handleReorder = (newOrder) => {
    setLocalTasks(newOrder);
    if (onReorder) {
      onReorder(newOrder);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl bg-gradient-to-br ${colors.bg} border ${colors.border} overflow-hidden`}
    >
      {/* Заголовок группы */}
      <button
        onClick={() => {
          setIsExpanded(!isExpanded);
          hapticFeedback && hapticFeedback('selection');
        }}
        className="w-full flex items-center justify-between p-4 hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className={`text-sm font-bold ${colors.text}`}>{title}</h3>
          <span className="text-xs text-gray-500">
            ({tasks.filter(t => t.completed).length}/{tasks.length})
          </span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className={`w-5 h-5 ${colors.text}`} />
        </motion.div>
      </button>

      {/* Список задач */}
      {isExpanded && (
        <Reorder.Group 
          axis="y" 
          values={localTasks} 
          onReorder={handleReorder}
          className="px-4 pb-4 space-y-2"
        >
          {localTasks.map((task) => {
            const isEditing = editingTaskId === task.id;
            
            return (
              <Reorder.Item
                key={task.id}
                value={task}
                className="relative"
                dragListener={false}
                dragControls={undefined}
              >
                {/* Контент задачи */}
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  className="relative bg-white rounded-lg p-3 group shadow-sm"
                >
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            onSaveEdit(task.id);
                          } else if (e.key === 'Escape') {
                            onCancelEdit();
                          }
                        }}
                        className="flex-1 text-sm bg-gray-50 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-yellow-400"
                        autoFocus
                      />
                      <button
                        onClick={() => onSaveEdit(task.id)}
                        className="p-1 text-green-600 hover:bg-green-100 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={onCancelEdit}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      {/* Drag Handle */}
                      <Reorder.Item
                        value={task}
                        dragListener={true}
                        className="flex-shrink-0 cursor-grab active:cursor-grabbing mt-0.5"
                        onDragStart={() => {
                          hapticFeedback && hapticFeedback('impact', 'light');
                        }}
                      >
                        <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors" />
                      </Reorder.Item>

                      {/* Checkbox */}
                      <div 
                        onClick={() => onToggle(task.id)}
                        className={`
                          w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-all duration-200 mt-0.5 cursor-pointer
                          ${task.completed 
                            ? 'bg-gradient-to-br from-yellow-400 to-orange-400' 
                            : 'bg-white border-2 border-gray-300 group-hover:border-yellow-400'
                          }
                        `}
                      >
                        {task.completed && (
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        )}
                      </div>

                      {/* Текст и метаданные */}
                      <div className="flex-1 min-w-0">
                        <span 
                          className={`
                            block text-sm leading-tight transition-all duration-200
                            ${task.completed 
                              ? 'text-gray-400 line-through' 
                              : 'text-gray-800'
                            }
                          `}
                        >
                          {task.text}
                        </span>
                        
                        {/* Метки */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {task.category && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                              {getCategoryEmoji(task.category)}
                            </span>
                          )}
                          {task.priority && task.priority !== 'medium' && (
                            <Flag className={`w-3 h-3 ${getPriorityColor(task.priority)}`} />
                          )}
                          {task.subject && (
                            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              📖 {task.subject}
                            </span>
                          )}
                          {task.deadline && (() => {
                            const deadlineStatus = getDeadlineStatus(task.deadline);
                            return deadlineStatus && (
                              <div className={`flex items-center gap-1 text-xs ${deadlineStatus.color} ${deadlineStatus.bgColor} px-2 py-0.5 rounded-full`}>
                                <Calendar className="w-3 h-3" />
                                <span>{deadlineStatus.text}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      
                      {/* Кнопка удаления (всегда видна) */}
                      <button
                        onClick={() => {
                          hapticFeedback && hapticFeedback('impact', 'medium');
                          onDelete(task.id);
                        }}
                        className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"
                        title="Удалить задачу"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </motion.div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}
    </motion.div>
  );
};
