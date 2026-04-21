import React, { useState, useEffect } from 'react';
import { motion, Reorder, useDragControls } from 'framer-motion';
import { ClipboardList, Check, Plus, Edit2, Trash2, X, Flag, Calendar, AlertCircle, Filter, SortAsc, Zap, Bell, Star, Clock, ChevronDown, GripVertical, Users } from 'lucide-react';
import { tasksAPI, scheduleAPI } from '../services/api';
import { groupTasksAPI } from '../services/groupTasksAPI';
import { useTelegram } from '../contexts/TelegramContext';
import { AddTaskModal } from './AddTaskModal';
import { EditTaskModal } from './EditTaskModal';
import { WeekDateSelector } from './WeekDateSelector';
import { tasksCompleteConfetti } from '../utils/confetti';
import { GroupTaskCard } from './GroupTaskCard';
import { CreateGroupTaskModal } from './CreateGroupTaskModal';
import { GroupTaskDetailModal } from './GroupTaskDetailModal';
import RoomCard from './RoomCard';
import CreateRoomModal from './CreateRoomModal';
import RoomDetailModal from './RoomDetailModal';
import * as roomsAPI from '../services/roomsAPI';

export const TasksSection = ({ userSettings, selectedDate, weekNumber, onModalStateChange }) => {
  const { user, hapticFeedback } = useTelegram();
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [scheduleSubjects, setScheduleSubjects] = useState([]);
  
  // Выбранная дата для отображения задач (по умолчанию - сегодня)
  const [tasksSelectedDate, setTasksSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  
  // Фильтры и сортировка
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [sortBy, setSortBy] = useState('created'); // created, priority, deadline
  const [showFilters, setShowFilters] = useState(false);
  
  // Шаблоны быстрых действий
  const [showQuickActions, setShowQuickActions] = useState(false);
  
  // Комнаты (Rooms)
  const [rooms, setRooms] = useState([]);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isRoomDetailModalOpen, setIsRoomDetailModalOpen] = useState(false);
  
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

  // Уведомляем родительский компонент об изменении состояния модальных окон
  useEffect(() => {
    if (onModalStateChange) {
      onModalStateChange(isAddModalOpen || isEditModalOpen || isCreateRoomModalOpen || isRoomDetailModalOpen);
    }
  }, [isAddModalOpen, isEditModalOpen, isCreateRoomModalOpen, isRoomDetailModalOpen, onModalStateChange]);

  // Загрузка комнат при монтировании
  useEffect(() => {
    if (userSettings?.telegram_id) {
      loadRooms();
    }
  }, [userSettings]);

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

  const loadRooms = async () => {
    try {
      const userRooms = await roomsAPI.getUserRooms(userSettings.telegram_id);
      setRooms(userRooms || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const handleCreateRoom = async (roomData) => {
    console.log('handleCreateRoom called', { roomData, userSettings });
    
    if (!userSettings?.telegram_id) {
      const errorMsg = 'Не удалось получить данные пользователя. Перезагрузите страницу.';
      alert(errorMsg);
      throw new Error(errorMsg);
    }
    
    try {
      const requestData = {
        ...roomData,
        telegram_id: userSettings.telegram_id
      };
      console.log('Creating room with data:', requestData);
      
      const newRoom = await roomsAPI.createRoom(requestData);
      console.log('Room created successfully:', newRoom);
      
      setRooms(prev => [...prev, newRoom]);
      setIsCreateRoomModalOpen(false);
      hapticFeedback && hapticFeedback('notification', 'success');
    } catch (error) {
      console.error('Error creating room:', error);
      console.error('Error details:', {
        response: error.response,
        message: error.message,
        stack: error.stack
      });
      
      hapticFeedback && hapticFeedback('notification', 'error');
      
      // Показываем понятное сообщение об ошибке
      const errorMessage = error.response?.data?.detail || error.message || 'Неизвестная ошибка';
      alert('Ошибка при создании комнаты: ' + errorMessage);
      
      // Пробрасываем ошибку дальше
      throw error;
    }
  };

  const handleRoomClick = (room) => {
    setSelectedRoom(room);
    setIsRoomDetailModalOpen(true);
    hapticFeedback && hapticFeedback('impact', 'light');
  };

  const handleRoomDeleted = (roomId) => {
    setRooms(prev => prev.filter(r => r.room_id !== roomId));
    setIsRoomDetailModalOpen(false);
    setSelectedRoom(null);
  };

  // Обновление порядка задач после перетаскивания в карточке "Сегодня"
  const handleReorderTasks = async (newOrder) => {
    console.log('🔄 Reorder triggered!', {
      oldOrder: todayTasks.map(t => ({ id: t.id, text: t.text, order: t.order })),
      newOrder: newOrder.map(t => ({ id: t.id, text: t.text }))
    });
    
    // Немедленно обновляем UI для плавности
    const reorderedTaskIds = newOrder.map(t => t.id);
    
    // Создаем Map для быстрого поиска
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    
    // Собираем новый порядок: сначала перетянутые задачи, потом остальные
    const updatedTasks = [
      ...newOrder.map((task, index) => ({ ...task, order: index })),
      ...tasks.filter(t => !reorderedTaskIds.includes(t.id))
    ];
    
    setTasks(updatedTasks);
    
    // Сохраняем порядок на сервер
    try {
      const taskOrders = newOrder.map((task, index) => ({
        id: task.id,
        order: index
      }));
      
      console.log('💾 Saving order to server:', taskOrders);
      await tasksAPI.reorderTasks(taskOrders);
      console.log('✅ Tasks reordered and saved to server');
      hapticFeedback && hapticFeedback('impact', 'light');
    } catch (error) {
      console.error('❌ Error saving task order:', error);
      // В случае ошибки перезагружаем задачи
      loadTasks();
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
        target_date: requestData.target_date,  // Передаем target_date
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
      const wasCompleted = task.completed;
      const updatedTask = await tasksAPI.updateTask(taskId, { completed: !task.completed });
      const updatedTasks = tasks.map(t => t.id === taskId ? updatedTask : t);
      setTasks(updatedTasks);
      
      // Проверяем, завершены ли все задачи на выбранную дату
      if (!wasCompleted && updatedTask.completed) {
        // Получаем задачи для выбранной даты
        const selectedDateStr = tasksSelectedDate.toISOString().split('T')[0];
        const tasksForDate = updatedTasks.filter(t => {
          // Проверяем target_date (приоритет)
          if (t.target_date) {
            const targetDateStr = new Date(t.target_date).toISOString().split('T')[0];
            if (targetDateStr === selectedDateStr) return true;
          }
          // Проверяем deadline
          if (t.deadline) {
            const taskDeadlineDate = new Date(t.deadline).toISOString().split('T')[0];
            if (taskDeadlineDate === selectedDateStr) return true;
          }
          // Задачи без target_date и deadline показываем только на сегодня
          if (!t.target_date && !t.deadline) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (selectedDateStr === todayStr) return true;
          }
          return false;
        });
        
        // Если задач больше 2 и все выполнены - запускаем конфетти
        if (tasksForDate.length > 2) {
          const allCompleted = tasksForDate.every(t => t.completed);
          if (allCompleted) {
            // Сильная вибрация для успеха
            hapticFeedback && hapticFeedback('notification', 'success');
            // Запускаем конфетти с небольшой задержкой
            setTimeout(() => {
              tasksCompleteConfetti();
            }, 300);
          }
        }
      }
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

  // Открыть модальное окно редактирования задачи
  const handleOpenEditModal = (task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
    hapticFeedback && hapticFeedback('impact', 'light');
  };

  // Редактирование задачи (все метаданные)
  const handleEditTask = async (taskId, updates) => {
    try {
      hapticFeedback && hapticFeedback('impact', 'medium');
      const updatedTask = await tasksAPI.updateTask(taskId, updates);
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
      setIsEditModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Error editing task:', error);
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
      
      // Форматируем target_date для выбранной даты (без UTC конвертации)
      let targetDateISO = null;
      if (tasksSelectedDate) {
        const targetDate = new Date(tasksSelectedDate);
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        targetDateISO = `${year}-${month}-${day}T00:00:00`;
      }
      
      const newTask = await tasksAPI.createTask(user.id, template.text, {
        category: template.category,
        priority: template.priority,
        target_date: targetDateISO,  // Добавляем target_date для привязки к выбранной дате
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

  // Примечание: groupTasksByDeadline() удалена, так как все задачи теперь отображаются в одной карточке

  // Получаем все задачи для выбранной даты с сортировкой по приоритету
  const getTasksForSelectedDate = () => {
    const filteredTasks = getFilteredAndSortedTasks();
    
    // Используем выбранную дату для фильтрации
    const selectedDateStart = new Date(tasksSelectedDate);
    selectedDateStart.setHours(0, 0, 0, 0);
    
    const selectedDateEnd = new Date(tasksSelectedDate);
    selectedDateEnd.setHours(23, 59, 59, 999);
    
    // Сегодняшняя дата для проверки задач без target_date
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const allTasks = [];
    
    filteredTasks.forEach(task => {
      // ПРИОРИТЕТ 1: Задачи с target_date - показываем на соответствующую дату
      if (task.target_date) {
        const targetDate = new Date(task.target_date);
        targetDate.setHours(0, 0, 0, 0);
        
        if (targetDate.getTime() === selectedDateStart.getTime()) {
          allTasks.push(task);
        }
        return;
      }
      
      // ПРИОРИТЕТ 2: Задачи с deadline но без target_date - показываем на дату deadline
      if (task.deadline) {
        const deadline = new Date(task.deadline);
        deadline.setHours(0, 0, 0, 0);
        
        if (deadline.getTime() === selectedDateStart.getTime()) {
          allTasks.push(task);
        }
        return;
      }
      
      // ПРИОРИТЕТ 3: Задачи без target_date и без deadline - показываем ТОЛЬКО на сегодня
      if (selectedDateStart.getTime() === todayStart.getTime()) {
        allTasks.push(task);
      }
    });
    
    // Сортируем задачи: сначала по order (drag & drop), затем по приоритету
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    allTasks.sort((a, b) => {
      // 1. СНАЧАЛА ПО СТАТУСУ ВЫПОЛНЕНИЯ (невыполненные сверху)
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1; // false (невыполненные) идут первыми
      }
      
      // 2. Потом по order (если установлен) - только для задач с одинаковым статусом
      const orderA = a.order !== undefined ? a.order : 999999;
      const orderB = b.order !== undefined ? b.order : 999999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // 3. Потом по приоритету
      const priorityA = priorityOrder[a.priority] || 2;
      const priorityB = priorityOrder[b.priority] || 2;
      return priorityB - priorityA;
    });
    
    // Возвращаем ВСЕ задачи без ограничения
    return allTasks;
  };
  
  const todayTasks = getTasksForSelectedDate();

  const currentDate = tasksSelectedDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long'
  });
  
  // Определяем название для карточки задач
  const getCardTitle = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(tasksSelectedDate);
    selected.setHours(0, 0, 0, 0);
    
    if (selected.getTime() === today.getTime()) {
      return 'Сегодня';
    }
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (selected.getTime() === tomorrow.getTime()) {
      return 'Завтра';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (selected.getTime() === yesterday.getTime()) {
      return 'Вчера';
    }
    
    // Для других дней показываем день недели
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    return dayNames[selected.getDay()];
  };
  
  // Обработчик выбора даты
  const handleDateSelect = (date) => {
    setTasksSelectedDate(date);
  };
  
  // Примечание: getTaskGroupTitle() удалена, так как разделы TaskGroup больше не используются

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
              {todayTasks.length} задач · {todayTasks.filter(t => t.completed).length} выполнено
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

      {/* Селектор дней недели */}
      <WeekDateSelector
        selectedDate={tasksSelectedDate}
        onDateSelect={handleDateSelect}
        tasks={tasks}
        hapticFeedback={hapticFeedback}
      />

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
            <h3 className="text-sm font-bold text-[#1C1C1E]">{getCardTitle()}</h3>
            <p className="text-xs text-[#999999] mt-0.5">{currentDate}</p>
          </div>

          {/* Список задач с прокруткой */}
          <div className="flex-1 space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-yellow-400 scrollbar-track-yellow-100">
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
                layoutScroll
              >
                {todayTasks.map((task) => (
                  <TodayTaskItem
                    key={task.id}
                    task={task}
                    isEditing={editingTaskId === task.id}
                    editingText={editingText}
                    setEditingText={setEditingText}
                    onToggle={toggleTask}
                    onStartEdit={handleStartEdit}      // Inline редактирование по двойному клику
                    onEdit={handleOpenEditModal}        // Модальное окно для метаданных
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

        {/* Все задачи отображаются только в карточке выше */}
      </div>

      {/* Секция комнат */}
      <div className="mt-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          Комнаты
        </h2>
        
        {/* Горизонтальный скролл с комнатами */}
        <div className="flex gap-3 overflow-x-auto py-2 scrollbar-hide 
                      -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory touch-pan-x">
          {rooms.map((room) => (
            <RoomCard
              key={room.room_id}
              room={room}
              onClick={() => handleRoomClick(room)}
            />
          ))}
          
          {/* Кнопка создания комнаты */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setIsCreateRoomModalOpen(true);
              hapticFeedback && hapticFeedback('impact', 'light');
            }}
            className="flex-shrink-0 w-[160px] h-[200px] bg-gradient-to-br from-gray-100 to-gray-50 
                       rounded-[24px] p-4 cursor-pointer shadow-lg shadow-gray-500/10 
                       border-2 border-dashed border-gray-300 hover:border-blue-400
                       flex flex-col items-center justify-center gap-3 transition-colors snap-start"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 
                           rounded-full flex items-center justify-center shadow-lg">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-600 text-center">
              Создать<br />комнату
            </span>
          </motion.div>
        </div>
      </div>

      {/* Модальное окно добавления задачи */}
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTask={handleAddTask}
        hapticFeedback={hapticFeedback}
        scheduleSubjects={scheduleSubjects}
        selectedDate={tasksSelectedDate}
      />

      {/* Модальное окно редактирования задачи */}
      <EditTaskModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTask(null);
        }}
        onEditTask={handleEditTask}
        task={editingTask}
        hapticFeedback={hapticFeedback}
        scheduleSubjects={scheduleSubjects}
      />

      {/* Модальное окно создания комнаты */}
      <CreateRoomModal
        isOpen={isCreateRoomModalOpen}
        onClose={() => setIsCreateRoomModalOpen(false)}
        onCreateRoom={handleCreateRoom}
      />

      {/* Модальное окно деталей комнаты */}
      <RoomDetailModal
        isOpen={isRoomDetailModalOpen}
        onClose={() => {
          setIsRoomDetailModalOpen(false);
          setSelectedRoom(null);
        }}
        room={selectedRoom}
        userSettings={userSettings}
        onRoomDeleted={handleRoomDeleted}
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
  onStartEdit,  // Для inline редактирования по двойному клику
  onEdit,       // Для открытия модального окна EditTaskModal
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
      id={task.id}
      dragListener={false}
      dragControls={dragControls}
      className="mb-2"
      style={{ listStyle: 'none' }}
      layout="position"
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
                  if (hapticFeedback) hapticFeedback('impact', 'light');
                  dragControls.start(e);
                  console.log('🚀 Drag controls started');
                }}
                className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 -ml-1 touch-none select-none"
                style={{ touchAction: 'none' }}
              >
                <GripVertical className="w-4 h-4 text-gray-400 hover:text-yellow-500 transition-colors" />
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
                  onDoubleClick={() => {
                    if (!task.completed && onStartEdit) {
                      onStartEdit(task); // Переключаемся в inline режим редактирования
                      hapticFeedback && hapticFeedback('selection');
                    }
                  }}
                  className={`
                    block text-xs leading-tight transition-all duration-200 cursor-pointer
                    ${task.completed 
                      ? 'text-[#999999] line-through' 
                      : 'text-[#1C1C1E] hover:bg-yellow-50 rounded px-1 -mx-1'
                    }
                  `}
                  title={!task.completed ? "Двойной клик для быстрого редактирования текста" : ""}
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
              
              {/* Кнопки действий */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Кнопка редактирования - открывает модальное окно для изменения метаданных */}
                <button
                  onClick={() => {
                    hapticFeedback && hapticFeedback('impact', 'light');
                    // Открываем модальное окно EditTaskModal для редактирования метаданных
                    if (onEdit) {
                      // Если onEdit принимает task, значит это handleOpenEditModal
                      onEdit(task);
                    }
                  }}
                  className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Редактировать метаданные (категория, приоритет, дедлайн)"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                
                {/* Кнопка удаления */}
                <button
                  onClick={() => {
                    hapticFeedback && hapticFeedback('impact', 'medium');
                    onDelete(task.id);
                  }}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Удалить задачу"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Reorder.Item>
  );
};

// Компонент элемента задачи для TaskGroup с drag and drop
const TaskGroupItem = ({ 
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
      key={task.id}
      value={task}
      dragListener={false}
      dragControls={dragControls}
      className="relative"
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
            {/* Drag Handle с правильным использованием dragControls */}
            <div
              onPointerDown={(e) => {
                console.log('👆 TaskGroup drag handle clicked for task:', task.id, task.text);
                e.stopPropagation();
                if (hapticFeedback) hapticFeedback('impact', 'light');
                dragControls.start(e);
                console.log('🚀 TaskGroup drag controls started');
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
            return (
              <TaskGroupItem
                key={task.id}
                task={task}
                isEditing={editingTaskId === task.id}
                editingText={editingText}
                setEditingText={setEditingText}
                onToggle={onToggle}
                onDelete={onDelete}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                getCategoryEmoji={getCategoryEmoji}
                getPriorityColor={getPriorityColor}
                getDeadlineStatus={getDeadlineStatus}
                hapticFeedback={hapticFeedback}
              />
            );
          })}
        </Reorder.Group>
      )}
    </motion.div>
  );
};
