import React, { useState, useEffect } from 'react';
import { motion, Reorder, useDragControls } from 'framer-motion';
import { ClipboardList, Check, Plus, Edit2, Trash2, X, Flag, Calendar, AlertCircle, Filter, Zap, Bell, Star, Clock, ChevronDown, GripVertical, Users, TrendingUp, Link2, ListChecks } from 'lucide-react';
import { tasksAPI, scheduleAPI, achievementsAPI, plannerAPI } from '../services/api';
import { groupTasksAPI } from '../services/groupTasksAPI';
import { useTelegram } from '../contexts/TelegramContext';
import { AddTaskModal } from './AddTaskModal';
import { EditTaskModal } from './EditTaskModal';
import { PrepareForLectureModal } from './PrepareForLectureModal';
import { CreateEventModal } from './CreateEventModal';
import { PlannerEventCard } from './PlannerEventCard';
import { PlannerTimeline } from './PlannerTimeline';
import { WeekDateSelector } from './WeekDateSelector';
import { tasksCompleteConfetti } from '../utils/confetti';
import { GroupTaskCard } from './GroupTaskCard';
import { CreateGroupTaskModal } from './CreateGroupTaskModal';
import { GroupTaskDetailModal } from './GroupTaskDetailModal';
import RoomCard from './RoomCard';
import CreateRoomModal from './CreateRoomModal';
import RoomDetailModal from './RoomDetailModal';
import * as roomsAPI from '../services/roomsAPI';
import { ProductivityStats } from './ProductivityStats';
import SyncPreviewModal from './SyncPreviewModal';

import { getWeekNumberForDate } from '../utils/dateUtils';
// 🔧 FEATURE FLAG: Показать/скрыть функцию комнат
// Измените на false, чтобы скрыть комнаты
const SHOW_ROOMS_FEATURE = true;

export const TasksSection = ({ userSettings, selectedDate, weekNumber, onModalStateChange, pendingRoomId, onPendingRoomHandled }) => {
  const { user, hapticFeedback } = useTelegram();
  
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState('');
  
  // Состояния для inline добавления подзадач
  const [addingSubtaskForTaskId, setAddingSubtaskForTaskId] = useState(null);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [savingSubtask, setSavingSubtask] = useState(false);
  
  const [scheduleSubjects, setScheduleSubjects] = useState([]);
  const [scheduleEvents, setScheduleEvents] = useState([]); // Все события расписания для поиска ближайших пар
  const [scheduleData, setScheduleData] = useState({ 1: [], 2: [] }); // Расписание по неделям (1 и 2)
  
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
  const [quickTaskTemplate, setQuickTaskTemplate] = useState(null); // Данные из быстрого шаблона для предзаполнения
  
  // Модальное окно "Подготовиться к лекции"
  const [isPrepareForLectureModalOpen, setIsPrepareForLectureModalOpen] = useState(false);
  
  // Комнаты (Rooms)
  const [rooms, setRooms] = useState([]);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isRoomDetailModalOpen, setIsRoomDetailModalOpen] = useState(false);
  
  // Статистика продуктивности
  const [productivityStats, setProductivityStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);

  // Переключатель вида (Список дел / Распорядок дня)
  const [activeView, setActiveView] = useState('todo');
  
  // Планировщик (Planner)
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [plannerEvents, setPlannerEvents] = useState([]); // События планировщика (пары + пользовательские)
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [syncingSchedule, setSyncingSchedule] = useState(false);
  
  // Модальное окно предварительного просмотра синхронизации
  const [isSyncPreviewOpen, setIsSyncPreviewOpen] = useState(false);
  const [syncPreviewData, setSyncPreviewData] = useState(null);
  const [syncPreviewLoading, setSyncPreviewLoading] = useState(false);
  
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
      loadProductivityStats();
    }
  }, [user, userSettings, weekNumber]);

  // Уведомляем родительский компонент об изменении состояния модальных окон
  useEffect(() => {
    if (onModalStateChange) {
      const roomModals = SHOW_ROOMS_FEATURE ? (isCreateRoomModalOpen || isRoomDetailModalOpen) : false;
      onModalStateChange(isAddModalOpen || isEditModalOpen || isPrepareForLectureModalOpen || isCreateEventModalOpen || isSyncPreviewOpen || roomModals);
    }
  }, [isAddModalOpen, isEditModalOpen, isPrepareForLectureModalOpen, isCreateEventModalOpen, isSyncPreviewOpen, isCreateRoomModalOpen, isRoomDetailModalOpen, onModalStateChange]);

  // Загрузка комнат при монтировании
  useEffect(() => {
    if (SHOW_ROOMS_FEATURE && userSettings?.telegram_id) {
      loadRooms();
    }
  }, [userSettings]);

  // 🚪 Обработка pendingRoomId - автоматическое открытие комнаты после присоединения по ссылке
  useEffect(() => {
    if (pendingRoomId && rooms.length > 0) {
      console.log('🚪 Ищем комнату для автоматического открытия:', pendingRoomId);
      const room = rooms.find(r => r.room_id === pendingRoomId);
      if (room) {
        console.log('🚪 Открываем комнату:', room.name);
        setSelectedRoom(room);
        setIsRoomDetailModalOpen(true);
        // Сбрасываем pendingRoomId после обработки
        if (onPendingRoomHandled) {
          onPendingRoomHandled();
        }
      } else {
        console.log('🚪 Комната не найдена в списке, перезагружаем комнаты...');
        // Если комната не найдена, перезагружаем список комнат
        loadRooms().then(() => {
          // Попробуем снова после перезагрузки
        });
      }
    }
  }, [pendingRoomId, rooms]);

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

  const loadProductivityStats = async () => {
    try {
      setStatsLoading(true);
      const stats = await tasksAPI.getProductivityStats(user.id);
      setProductivityStats(stats);
    } catch (error) {
      console.error('Error loading productivity stats:', error);
    } finally {
      setStatsLoading(false);
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

  // ============ Функции для планировщика ============

  /**
   * Загрузить события планировщика для выбранной даты
   */
  const loadPlannerEvents = async (date) => {
    if (!user?.id) return;
    
    try {
      setPlannerLoading(true);
      const dateString = formatDateToYYYYMMDD(date);
      const response = await plannerAPI.getDayEvents(user.id, dateString);
      setPlannerEvents(response.events || []);
    } catch (error) {
      console.error('Error loading planner events:', error);
    } finally {
      setPlannerLoading(false);
    }
  };

  /**
   * Открыть модальное окно для предварительного просмотра пар перед синхронизацией
   */
  const handleSyncSchedule = async () => {
    if (!user?.id) return;
    
    try {
      setSyncPreviewLoading(true);
      setIsSyncPreviewOpen(true);
      hapticFeedback && hapticFeedback('impact', 'medium');
      
      // Определяем номер недели для выбранной даты
      const weekNum = getWeekNumberForDate(tasksSelectedDate);
      const parity = (weekNum % 2) === 0 ? 2 : 1;
      
      const dateString = formatDateToYYYYMMDD(tasksSelectedDate);
      
      // Получаем preview вместо синхронизации
      const response = await plannerAPI.getPreview(user.id, dateString, parity);
      
      if (response.success) {
        setSyncPreviewData(response);
      }
    } catch (error) {
      console.error('Error loading sync preview:', error);
      hapticFeedback && hapticFeedback('notification', 'error');
      
      const errorMessage = error?.message || 'Не удалось загрузить расписание';
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(errorMessage);
      } else {
        alert(errorMessage);
      }
      setIsSyncPreviewOpen(false);
    } finally {
      setSyncPreviewLoading(false);
    }
  };

  /**
   * Синхронизировать выбранные пары из модального окна
   */
  const handleSyncSelectedEvents = async (selectedEvents) => {
    if (!user?.id || selectedEvents.length === 0) return;
    
    try {
      setSyncingSchedule(true);
      hapticFeedback && hapticFeedback('impact', 'heavy');
      
      const dateString = formatDateToYYYYMMDD(tasksSelectedDate);
      
      const response = await plannerAPI.syncSelected(user.id, dateString, selectedEvents);
      
      if (response.success) {
        // Закрываем модальное окно
        setIsSyncPreviewOpen(false);
        setSyncPreviewData(null);
        
        // Перезагружаем события после синхронизации
        await loadPlannerEvents(tasksSelectedDate);
        await loadTasks();
        
        const message = response.synced_count > 0 
          ? `Добавлено ${response.synced_count} ${response.synced_count === 1 ? 'пара' : response.synced_count < 5 ? 'пары' : 'пар'}`
          : 'Все выбранные пары уже были добавлены';
        
        hapticFeedback && hapticFeedback('notification', 'success');
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert(message);
        } else {
          alert(message);
        }
      }
    } catch (error) {
      console.error('Error syncing selected events:', error);
      hapticFeedback && hapticFeedback('notification', 'error');
      
      const errorMessage = error?.message || 'Не удалось синхронизировать пары';
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(errorMessage);
      } else {
        alert(errorMessage);
      }
    } finally {
      setSyncingSchedule(false);
    }
  };

  /**
   * Создать пользовательское событие
   */
  const handleCreateEvent = async (eventData) => {
    if (!user?.id) return;
    
    try {
      const response = await plannerAPI.createEvent(
        user.id,
        eventData.text,
        eventData.time_start,
        eventData.time_end,
        eventData.target_date,
        {
          category: eventData.category,
          notes: eventData.notes,
          is_fixed: eventData.is_fixed,
        }
      );
      
      // Перезагружаем события
      await loadPlannerEvents(tasksSelectedDate);
      await loadTasks();
      
      hapticFeedback && hapticFeedback('notification', 'success');
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  };

  /**
   * Форматировать дату в YYYY-MM-DD
   */
  const formatDateToYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Загружать события планировщика при изменении даты или переключении в режим планировщика
  useEffect(() => {
    if (activeView === 'schedule' && tasksSelectedDate) {
      loadPlannerEvents(tasksSelectedDate);
    }
  }, [activeView, tasksSelectedDate, user]);

  // ============ Конец функций планировщика ============

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

  // Обновление комнаты в списке (после изменений)
  const handleRoomUpdated = (updatedRoom) => {
    setRooms(prev => prev.map(r => r.room_id === updatedRoom.room_id ? updatedRoom : r));
    setSelectedRoom(updatedRoom);
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
      // Загружаем расписание для обеих недель, чтобы получить больше предметов и пар
      const [scheduleWeek1, scheduleWeek2] = await Promise.all([
        scheduleAPI.getSchedule({
          facultet_id: userSettings.facultet_id,
          level_id: userSettings.level_id,
          kurs: userSettings.kurs,
          form_code: userSettings.form_code,
          group_id: userSettings.group_id,
          week_number: 1,
        }),
        scheduleAPI.getSchedule({
          facultet_id: userSettings.facultet_id,
          level_id: userSettings.level_id,
          kurs: userSettings.kurs,
          form_code: userSettings.form_code,
          group_id: userSettings.group_id,
          week_number: 2,
        }),
      ]);
      
      // Объединяем события обеих недель
      const allEvents = [
        ...(scheduleWeek1.events || []),
        ...(scheduleWeek2.events || []),
      ];
      
      // Сохраняем все события для поиска ближайших пар
      setScheduleEvents(allEvents);
      
      // Сохраняем расписание по неделям для отображения в "Распорядке дня"
      setScheduleData({
        1: scheduleWeek1.events || [],
        2: scheduleWeek2.events || []
      });
      
      // Извлекаем уникальные предметы
      const subjects = [...new Set(allEvents.map(e => e.discipline).filter(Boolean))];
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
      
      // 🎯 ТРЕКИНГ СОЗДАНИЯ ЗАДАЧИ для достижения "Первая задача"
      try {
        const result = await achievementsAPI.trackAction(user.id, 'create_task', {
          task_id: newTask.id,
          timestamp: new Date().toISOString()
        });
        
        // Если есть новое достижение, можно показать уведомление
        if (result.new_achievements && result.new_achievements.length > 0) {
          console.log('🎉 Новое достижение за создание задачи!', result.new_achievements[0]);
        }
      } catch (trackError) {
        console.error('Ошибка трекинга создания задачи:', trackError);
        // Не прерываем основной процесс, если трекинг не удался
      }
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
      
      // Обновляем статистику продуктивности при изменении статуса задачи
      loadProductivityStats();
      
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

  // Открыть inline поле для добавления подзадачи
  const handleOpenInlineSubtask = (task) => {
    setAddingSubtaskForTaskId(task.id);
    setNewSubtaskText('');
    hapticFeedback && hapticFeedback('impact', 'light');
  };

  // Закрыть inline поле для добавления подзадачи
  const handleCloseInlineSubtask = () => {
    setAddingSubtaskForTaskId(null);
    setNewSubtaskText('');
  };

  // Добавить подзадачу через inline поле
  const handleAddSubtaskInline = async (taskId) => {
    const trimmedText = newSubtaskText.trim();
    if (!trimmedText || savingSubtask) return;

    try {
      setSavingSubtask(true);
      hapticFeedback && hapticFeedback('impact', 'medium');
      
      const updatedTask = await tasksAPI.addSubtask(taskId, trimmedText);
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
      setNewSubtaskText('');
      // Оставляем поле открытым для возможности добавить ещё подзадачи
      
      hapticFeedback && hapticFeedback('notification', 'success');
    } catch (error) {
      console.error('Error adding subtask:', error);
      hapticFeedback && hapticFeedback('notification', 'error');
    } finally {
      setSavingSubtask(false);
    }
  };

  // Переключить состояние подзадачи (completed)
  const handleToggleSubtask = async (taskId, subtaskId, currentCompleted) => {
    try {
      hapticFeedback && hapticFeedback('impact', 'light');
      
      const updatedTask = await tasksAPI.updateSubtask(taskId, subtaskId, {
        completed: !currentCompleted
      });
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
      
      hapticFeedback && hapticFeedback('notification', 'success');
    } catch (error) {
      console.error('Error toggling subtask:', error);
      hapticFeedback && hapticFeedback('notification', 'error');
    }
  };

  // Шаблоны быстрых задач
  const quickActionTemplates = [
    { 
      text: 'Подготовиться к лекции', 
      category: 'study', 
      priority: 'medium',
      icon: '📖',
      specialModal: 'prepareForLecture' // Специальное модальное окно
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

  // Создание задачи из шаблона - открываем модальное окно с предзаполненными данными
  const handleQuickAction = (template) => {
    hapticFeedback && hapticFeedback('impact', 'medium');
    
    // Закрываем панель быстрых действий
    setShowQuickActions(false);
    
    // Проверяем, нужно ли открыть специальное модальное окно
    if (template.specialModal === 'prepareForLecture') {
      // Открываем специальное модальное окно для "Подготовиться к лекции"
      setIsPrepareForLectureModalOpen(true);
      return;
    }
    
    // Для остальных шаблонов - стандартное поведение
    // Сохраняем данные шаблона для предзаполнения модального окна
    setQuickTaskTemplate(template);
    
    // Открываем стандартное модальное окно
    setIsAddModalOpen(true);
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

  // Получение событий расписания для выбранной даты
  const getScheduleForSelectedDate = () => {
    if (!tasksSelectedDate) return [];
    
    // Определяем день недели (название)
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const currentDayName = dayNames[tasksSelectedDate.getDay()];
    
    // Определяем номер недели (1 или 2)
    const weekNum = getWeekNumberForDate(tasksSelectedDate);
    const parity = (weekNum % 2) === 0 ? 2 : 1;
    
    // Получаем события для нужной недели
    const weekEvents = scheduleData[parity] || [];
    
    // Фильтруем по дню недели
    // Примечание: в API дни обычно с большой буквы, например "Понедельник"
    const dayEvents = weekEvents.filter(event => event.day === currentDayName);
    
    // Сортируем по времени
    return dayEvents.sort((a, b) => {
      const timeA = a.time.split('-')[0].trim();
      const timeB = b.time.split('-')[0].trim();
      return timeA.localeCompare(timeB);
    });
  };

  const scheduleForDate = getScheduleForSelectedDate();

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
            <h2 className="text-2xl font-bold text-[#1C1C1E]">{activeView === 'schedule' ? 'Планировщик' : 'Список дел'}</h2>
            <p className="text-sm text-[#999999]">
              {activeView === 'schedule' 
                ? `${plannerEvents.length} событий · ${plannerEvents.filter(e => e.completed).length} завершено`
                : `${todayTasks.length} задач · ${todayTasks.filter(t => t.completed).length} выполнено`
              }
            </p>
          </div>
        </div>
        
        {/* Кнопки управления - зависят от activeView */}
        <div className="flex items-center gap-2">
          {activeView === 'todo' ? (
            <>
              {/* Кнопки для Списка дел */}
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
              
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  hapticFeedback && hapticFeedback('impact', 'light');
                  setShowStats(!showStats);
                }}
                className={`p-2 rounded-xl transition-colors ${
                  showStats
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="Статистика продуктивности"
              >
                <TrendingUp className="w-5 h-5" />
              </motion.button>
            </>
          ) : (
            <>
              {/* Кнопки для Планировщика */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSyncSchedule}
                disabled={syncingSchedule || !userSettings?.group_id}
                className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                title="Синхронизировать пары"
              >
                {syncingSchedule ? (
                  <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  hapticFeedback && hapticFeedback('impact', 'light');
                  setIsCreateEventModalOpen(true);
                }}
                className="p-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-xl shadow-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                <span className="text-xs font-medium">Событие</span>
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Селектор дней недели */}
      <WeekDateSelector
        selectedDate={tasksSelectedDate}
        onDateSelect={handleDateSelect}
        tasks={tasks}
        hapticFeedback={hapticFeedback}
      />

      {/* Переключатель вида (Список дел / Распорядок дня) */}
      <div className="flex bg-gray-100 p-1 rounded-2xl mb-6 mt-4">
        <button
          onClick={() => {
            setActiveView('todo');
            hapticFeedback && hapticFeedback('selection');
          }}
          className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${
            activeView === 'todo'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Список дел
        </button>
        <button
          onClick={() => {
            setActiveView('schedule');
            hapticFeedback && hapticFeedback('selection');
          }}
          className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${
            activeView === 'schedule'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Планировщик
        </button>
      </div>

      {/* Статистика продуктивности */}
      {showStats && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <ProductivityStats stats={productivityStats} loading={statsLoading} />
        </motion.div>
      )}

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

      {/* Контент в зависимости от выбранного вида */}
      {activeView === 'todo' ? (
        /* Карточка с задачами и группы по дедлайнам */
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
                    onAddSubtask={handleOpenInlineSubtask}  // Открываем inline поле для добавления подзадачи
                    isAddingSubtask={addingSubtaskForTaskId === task.id}
                    newSubtaskText={newSubtaskText}
                    setNewSubtaskText={setNewSubtaskText}
                    onSaveSubtask={handleAddSubtaskInline}
                    onCancelSubtask={handleCloseInlineSubtask}
                    savingSubtask={savingSubtask}
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
      ) : (
        /* Планировщик */
        <div className="space-y-4">
          {/* Timeline-вид планировщика */}
          {plannerLoading ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-2" />
              <p className="text-gray-500 text-sm">Загрузка...</p>
            </div>
          ) : (
            <PlannerTimeline
              events={plannerEvents}
              currentDate={tasksSelectedDate}
              onToggleComplete={async (eventId) => {
                await toggleTask(eventId);
                await loadPlannerEvents(tasksSelectedDate);
              }}
              onDelete={async (eventId) => {
                if (window.confirm('Удалить это событие?')) {
                  await handleDeleteTask(eventId);
                  await loadPlannerEvents(tasksSelectedDate);
                }
              }}
              hapticFeedback={hapticFeedback}
            />
          )}
        </div>
      )}

      {/* Секция комнат (СКРЫТО: измените SHOW_ROOMS_FEATURE на true, чтобы показать) */}
      {activeView === 'todo' && SHOW_ROOMS_FEATURE && (
        <div className="mt-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Комнаты
          </h2>
          
          {/* Горизонтальный скролл с комнатами */}
          <div className="flex gap-3 overflow-x-auto overflow-y-visible py-4 scrollbar-hide 
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
      )}

      {/* Модальное окно добавления задачи */}
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setQuickTaskTemplate(null); // Сбрасываем шаблон при закрытии
        }}
        onAddTask={handleAddTask}
        hapticFeedback={hapticFeedback}
        scheduleSubjects={scheduleSubjects}
        selectedDate={tasksSelectedDate}
        quickTemplate={quickTaskTemplate} // Передаем данные быстрого шаблона
      />

      {/* Специальное модальное окно "Подготовиться к лекции" */}
      <PrepareForLectureModal
        isOpen={isPrepareForLectureModalOpen}
        onClose={() => setIsPrepareForLectureModalOpen(false)}
        onAddTask={handleAddTask}
        hapticFeedback={hapticFeedback}
        scheduleSubjects={scheduleSubjects}
        scheduleEvents={scheduleEvents}
        userSettings={userSettings}
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
        onTaskUpdated={(updatedTask) => {
          // Обновляем задачу в списке после операций с подзадачами
          setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
          // Также обновляем editingTask для синхронизации состояния в модалке
          setEditingTask(updatedTask);
        }}
        task={editingTask}
        hapticFeedback={hapticFeedback}
        scheduleSubjects={scheduleSubjects}
      />

      {/* Модальное окно создания события для планировщика */}
      <CreateEventModal
        isOpen={isCreateEventModalOpen}
        onClose={() => setIsCreateEventModalOpen(false)}
        onCreateEvent={handleCreateEvent}
        hapticFeedback={hapticFeedback}
        selectedDate={tasksSelectedDate}
      />

      {/* Модальное окно предварительного просмотра синхронизации пар */}
      <SyncPreviewModal
        isOpen={isSyncPreviewOpen}
        onClose={() => {
          setIsSyncPreviewOpen(false);
          setSyncPreviewData(null);
        }}
        previewData={syncPreviewData}
        onSync={handleSyncSelectedEvents}
        isLoading={syncPreviewLoading}
        isSyncing={syncingSchedule}
        hapticFeedback={hapticFeedback}
      />

      {/* Модальные окна комнат (СКРЫТО: измените SHOW_ROOMS_FEATURE на true, чтобы показать) */}
      {SHOW_ROOMS_FEATURE && (
        <>
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
            onRoomUpdated={handleRoomUpdated}
          />
        </>
      )}
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
  onAddSubtask, // Для открытия inline поля добавления подзадачи
  isAddingSubtask, // Флаг: показывать ли поле ввода подзадачи
  newSubtaskText,  // Текст новой подзадачи
  setNewSubtaskText, // Сеттер текста подзадачи
  onSaveSubtask, // Сохранить подзадачу
  onCancelSubtask, // Закрыть поле ввода
  savingSubtask, // Флаг: идёт сохранение
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
                
                {/* Прогресс-бар подзадач */}
                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="mt-1.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ListChecks className="w-3 h-3 text-gray-400" />
                      <span className="text-[9px] text-gray-500">
                        {task.subtasks_completed || task.subtasks.filter(s => s.completed).length} / {task.subtasks_total || task.subtasks.length}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${task.subtasks_progress || 
                            Math.round((task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100)}%` 
                        }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className={`h-full rounded-full ${
                          (task.subtasks_progress || Math.round((task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100)) === 100
                            ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                            : 'bg-gradient-to-r from-yellow-400 to-orange-400'
                        }`}
                      />
                    </div>
                  </div>
                )}
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
                
                {/* Кнопка добавления подзадачи */}
                <button
                  onClick={() => {
                    hapticFeedback && hapticFeedback('impact', 'light');
                    // Открываем EditTaskModal для добавления подзадач
                    if (onAddSubtask) {
                      onAddSubtask(task);
                    }
                  }}
                  className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                  title="Добавить подзадачу"
                >
                  <Plus className="w-3.5 h-3.5" />
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
            
            {/* Список существующих подзадач */}
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="space-y-1">
                  {task.subtasks.map((subtask) => (
                    <div 
                      key={subtask.subtask_id}
                      className="flex items-center gap-2 pl-6"
                    >
                      <div className={`
                        w-3 h-3 rounded flex-shrink-0 flex items-center justify-center
                        ${subtask.completed 
                          ? 'bg-green-400' 
                          : 'bg-white border border-gray-300'
                        }
                      `}>
                        {subtask.completed && (
                          <Check className="w-2 h-2 text-white" strokeWidth={3} />
                        )}
                      </div>
                      <span className={`text-xs ${subtask.completed ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Inline поле для добавления подзадачи */}
            {isAddingSubtask && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 pl-6">
                  <div className="w-3 h-3 rounded border border-gray-300 flex-shrink-0" />
                  <input
                    type="text"
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSubtaskText.trim()) {
                        onSaveSubtask(task.id);
                      } else if (e.key === 'Escape') {
                        onCancelSubtask();
                      }
                    }}
                    placeholder="Название подзадачи..."
                    className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 focus:bg-white"
                    autoFocus
                    disabled={savingSubtask}
                  />
                  <button
                    onClick={() => onSaveSubtask(task.id)}
                    disabled={!newSubtaskText.trim() || savingSubtask}
                    className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingSubtask ? (
                      <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    onClick={onCancelSubtask}
                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                    disabled={savingSubtask}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
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
