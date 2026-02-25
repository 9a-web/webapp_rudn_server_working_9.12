/**
 * API Service для работы с backend расписания РУДН
 */

import axios from 'axios';
import { getBackendURL } from '../utils/config';

const BACKEND_URL = getBackendURL();
const API_BASE = `${BACKEND_URL}/api`;

console.log('📡 API Base URL:', API_BASE);

// Создаем экземпляр axios с базовыми настройками
const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Обработка ошибок
const handleError = (error) => {
  if (error.response) {
    // Сервер ответил с ошибкой
    console.error('API Error:', error.response.data);
    
    const detail = error.response.data.detail;
    
    // Если detail - это массив ошибок валидации Pydantic
    if (Array.isArray(detail)) {
      const errorMessages = detail.map(err => {
        const field = err.loc ? err.loc.join('.') : 'unknown';
        const message = err.msg || 'validation error';
        return `${field}: ${message}`;
      });
      throw new Error(errorMessages.join('; '));
    }
    
    // Если detail - это строка или объект
    throw new Error(detail || error.response.data.error || 'Ошибка сервера');
  } else if (error.request) {
    // Запрос был отправлен, но ответа нет
    console.error('Network Error:', error.request);
    throw new Error('Ошибка сети. Проверьте подключение к интернету');
  } else {
    // Что-то пошло не так при настройке запроса
    console.error('Error:', error.message);
    throw new Error(error.message);
  }
};

/**
 * API методы для расписания
 */
export const scheduleAPI = {
  /**
   * Получить список факультетов
   */
  getFaculties: async () => {
    try {
      const response = await api.get('/faculties');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить данные фильтров (уровни, курсы, формы, группы)
   * @param {Object} params - Параметры фильтрации
   * @param {string} params.facultet_id - ID факультета
   * @param {string} [params.level_id] - ID уровня
   * @param {string} [params.kurs] - Курс
   * @param {string} [params.form_code] - Форма обучения
   */
  getFilterData: async (params) => {
    try {
      const response = await api.post('/filter-data', params);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить расписание для группы
   * @param {Object} params - Параметры запроса
   * @param {string} params.facultet_id - ID факультета
   * @param {string} params.level_id - ID уровня
   * @param {string} params.kurs - Курс
   * @param {string} params.form_code - Форма обучения
   * @param {string} params.group_id - ID группы
   * @param {number} [params.week_number=1] - Номер недели (1 или 2)
   */
  getSchedule: async (params) => {
    try {
      const response = await api.post('/schedule', params);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить кэшированное расписание
   * @param {string} groupId - ID группы
   * @param {number} weekNumber - Номер недели
   */
  getCachedSchedule: async (groupId, weekNumber) => {
    try {
      const response = await api.get(`/schedule-cached/${groupId}/${weekNumber}`);
      return response.data;
    } catch (error) {
      // Для кэша не бросаем ошибку, просто возвращаем null
      return null;
    }
  },
  
  /**
   * Получить информацию о YouTube видео
   * @param {string} url - URL YouTube видео
   */
  getYouTubeInfo: async (url) => {
    try {
      const response = await api.get('/youtube/info', { params: { url } });
      return response.data;
    } catch (error) {
      console.error('Error fetching YouTube info:', error);
      return null;
    }
  },
  
  /**
   * Получить информацию о VK видео
   * @param {string} url - URL VK видео
   */
  getVKVideoInfo: async (url) => {
    try {
      const response = await api.get('/vkvideo/info', { params: { url } });
      return response.data;
    } catch (error) {
      console.error('Error fetching VK Video info:', error);
      return null;
    }
  },
};

/**
 * API методы для пользовательских настроек
 */
export const userAPI = {
  /**
   * Получить настройки пользователя
   * @param {number} telegramId - Telegram ID пользователя
   */
  getUserSettings: async (telegramId) => {
    try {
      const response = await api.get(`/user-settings/${telegramId}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // Пользователь не найден - это нормально
        return null;
      }
      handleError(error);
    }
  },

  /**
   * Сохранить настройки пользователя
   * @param {Object} settings - Настройки пользователя
   * @param {number} settings.telegram_id - Telegram ID
   * @param {string} [settings.username] - Username
   * @param {string} [settings.first_name] - Имя
   * @param {string} [settings.last_name] - Фамилия
   * @param {string} settings.group_id - ID группы
   * @param {string} settings.group_name - Название группы
   * @param {string} settings.facultet_id - ID факультета
   * @param {string} [settings.facultet_name] - Название факультета
   * @param {string} settings.level_id - ID уровня
   * @param {string} settings.kurs - Курс
   * @param {string} settings.form_code - Форма обучения
   */
  saveUserSettings: async (settings) => {
    try {
      const response = await api.post('/user-settings', settings);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Удалить настройки пользователя
   * @param {number} telegramId - Telegram ID пользователя
   */
  deleteUserSettings: async (telegramId) => {
    try {
      const response = await api.delete(`/user-settings/${telegramId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить настройки уведомлений
   * @param {number} telegramId - Telegram ID пользователя
   */
  getNotificationSettings: async (telegramId) => {
    try {
      const response = await api.get(`/user-settings/${telegramId}/notifications`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Обновить настройки уведомлений
   * @param {number} telegramId - Telegram ID пользователя
   * @param {Object} settings - Настройки уведомлений
   * @param {boolean} settings.notifications_enabled - Включены ли уведомления
   * @param {number} settings.notification_time - За сколько минут уведомлять (5-30)
   */
  updateNotificationSettings: async (telegramId, settings) => {
    try {
      const response = await api.put(`/user-settings/${telegramId}/notifications`, settings);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Отправить тестовое уведомление
   * @param {number} telegramId - Telegram ID пользователя
   */
  sendTestNotification: async (telegramId) => {
    try {
      const response = await api.post('/notifications/test', { telegram_id: telegramId });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

/**
 * API методы для достижений
 */
export const achievementsAPI = {
  /**
   * Получить все достижения
   */
  getAllAchievements: async () => {
    try {
      const response = await api.get('/achievements');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить достижения пользователя
   * @param {number} telegramId - Telegram ID пользователя
   */
  getUserAchievements: async (telegramId) => {
    try {
      const response = await api.get(`/user-achievements/${telegramId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить статистику пользователя
   * @param {number} telegramId - Telegram ID пользователя
   */
  getUserStats: async (telegramId) => {
    try {
      const response = await api.get(`/user-stats/${telegramId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Отследить действие пользователя
   * @param {number} telegramId - Telegram ID пользователя
   * @param {string} actionType - Тип действия (select_group, view_schedule, etc.)
   * @param {Object} metadata - Дополнительные данные
   */
  trackAction: async (telegramId, actionType, metadata = {}) => {
    try {
      const response = await api.post('/track-action', {
        telegram_id: telegramId,
        action_type: actionType,
        metadata,
      });
      return response.data;
    } catch (error) {
      // FIX: Тихо игнорируем ошибки трекинга (аналитика не критична)
      console.debug('Action tracking error:', error.message);
      return null;
    }
  },

  /**
   * Отметить достижения как просмотренные
   * @param {number} telegramId - Telegram ID пользователя
   */
  markAchievementsSeen: async (telegramId) => {
    try {
      const response = await api.post(`/user-achievements/${telegramId}/mark-seen`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

/**
 * API методы для погоды
 */
export const weatherAPI = {
  /**
   * Получить текущую погоду в Москве
   */
  getWeather: async () => {
    try {
      const response = await api.get('/weather');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

/**
 * API методы для информации о боте
 */
export const botAPI = {
  /**
   * Получить информацию о боте (username, id и т.д.)
   */
  getBotInfo: async () => {
    try {
      const response = await api.get('/bot-info');
      return response.data;
    } catch (error) {
      handleError(error);
      // Возвращаем fallback данные если API недоступен
      return {
        username: 'bot',
        first_name: 'RUDN Schedule',
        id: 0
      };
    }
  },

  /**
   * Получить URL фото профиля пользователя (через прокси для обхода CORS)
   * @param {number} telegramId - Telegram ID пользователя
   */
  getUserProfilePhoto: async (telegramId) => {
    try {
      // Используем прокси-эндпоинт для обхода CORS проблем
      const backendUrl = getBackendURL();
      const photoUrl = `${backendUrl}/api/user-profile-photo-proxy/${telegramId}`;
      console.log('Profile photo URL:', photoUrl);
      return photoUrl;
    } catch (error) {
      console.error('Error getting user profile photo:', error);
      return null;
    }
  },
};

/**
 * API методы для списка дел (задач)
 */
export const tasksAPI = {
  /**
   * Получить все задачи пользователя
   * @param {number} telegramId - Telegram ID пользователя
   */
  getUserTasks: async (telegramId) => {
    try {
      const response = await api.get(`/tasks/${telegramId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Создать новую задачу
   * @param {number} telegramId - Telegram ID пользователя
   * @param {string} text - Текст задачи
   * @param {Object} additionalData - Дополнительные поля (category, priority, deadline, subject)
   */
  createTask: async (telegramId, text, additionalData = {}) => {
    try {
      const response = await api.post('/tasks', {
        telegram_id: telegramId,
        text,
        ...additionalData,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Обновить задачу (текст или статус completed)
   * @param {string} taskId - ID задачи
   * @param {Object} updates - Обновления
   * @param {string} updates.text - Новый текст задачи (опционально)
   * @param {boolean} updates.completed - Статус выполнения (опционально)
   */
  updateTask: async (taskId, updates) => {
    try {
      const response = await api.put(`/tasks/${taskId}`, updates);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Удалить задачу
   * @param {string} taskId - ID задачи
   */
  deleteTask: async (taskId) => {
    try {
      const response = await api.delete(`/tasks/${taskId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Обновить порядок задач (batch update после drag & drop)
   * @param {Array} taskOrders - Массив объектов [{id: "task_id", order: 0}, ...]
   */
  reorderTasks: async (taskOrders) => {
    try {
      const response = await api.put('/tasks/reorder', { tasks: taskOrders });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить статистику продуктивности пользователя
   * @param {number} telegramId - Telegram ID пользователя
   */
  getProductivityStats: async (telegramId) => {
    try {
      const response = await api.get(`/tasks/${telegramId}/productivity-stats`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Добавить подзадачу к задаче
   * @param {string} taskId - ID задачи
   * @param {string} title - Название подзадачи
   */
  addSubtask: async (taskId, title) => {
    try {
      const response = await api.post(`/tasks/${taskId}/subtasks`, { title });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Обновить подзадачу
   * @param {string} taskId - ID задачи
   * @param {string} subtaskId - ID подзадачи
   * @param {Object} updates - Обновления (title, completed)
   */
  updateSubtask: async (taskId, subtaskId, updates) => {
    try {
      const response = await api.put(`/tasks/${taskId}/subtasks/${subtaskId}`, updates);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Удалить подзадачу
   * @param {string} taskId - ID задачи
   * @param {string} subtaskId - ID подзадачи
   */
  deleteSubtask: async (taskId, subtaskId) => {
    try {
      const response = await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  reorderSubtasks: async (taskId, subtaskIds) => {
    try {
      const response = await api.put(`/tasks/${taskId}/subtasks-reorder`, { subtask_ids: subtaskIds });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

/**
 * API методы для планировщика (Planner)
 */
export const plannerAPI = {
  /**
   * Синхронизировать расписание в планировщик на конкретную дату
   * @param {number} telegramId - Telegram ID пользователя
   * @param {string} date - Дата в формате YYYY-MM-DD
   * @param {number} weekNumber - Номер недели (1 или 2)
   */
  syncSchedule: async (telegramId, date, weekNumber = 1) => {
    try {
      const response = await api.post('/planner/sync', {
        telegram_id: telegramId,
        date: date,
        week_number: weekNumber,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить предварительный просмотр пар для синхронизации
   * @param {number} telegramId - Telegram ID пользователя
   * @param {string} date - Дата в формате YYYY-MM-DD
   * @param {number} weekNumber - Номер недели (1 или 2)
   */
  getPreview: async (telegramId, date, weekNumber = 1) => {
    try {
      const response = await api.post('/planner/preview', {
        telegram_id: telegramId,
        date: date,
        week_number: weekNumber,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Синхронизировать выбранные пары в планировщик
   * @param {number} telegramId - Telegram ID пользователя
   * @param {string} date - Дата в формате YYYY-MM-DD
   * @param {Array} events - Массив выбранных событий для синхронизации
   */
  syncSelected: async (telegramId, date, events) => {
    try {
      const response = await api.post('/planner/sync-selected', {
        telegram_id: telegramId,
        date: date,
        events: events,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить все события (пары + задачи) на конкретную дату
   * @param {number} telegramId - Telegram ID пользователя
   * @param {string} date - Дата в формате YYYY-MM-DD
   */
  getDayEvents: async (telegramId, date) => {
    try {
      const response = await api.get(`/planner/${telegramId}/${date}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Создать событие в планировщике (НЕ задачу в списке дел)
   * @param {number} telegramId
   * @param {string} text
   * @param {string} timeStart - HH:MM
   * @param {string} timeEnd - HH:MM
   * @param {string} targetDate - ISO date string
   * @param {Object} additionalData - Дополнительные поля
   */
  createEvent: async (telegramId, text, timeStart, timeEnd, targetDate, additionalData = {}) => {
    try {
      const response = await api.post('/planner/events', {
        telegram_id: telegramId,
        text,
        time_start: timeStart,
        time_end: timeEnd,
        target_date: targetDate,
        origin: 'user',
        ...additionalData,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Обновить событие планировщика
   * @param {string} eventId - ID события
   * @param {Object} updateData - Данные для обновления
   */
  updateEvent: async (eventId, updateData) => {
    try {
      const response = await api.put(`/tasks/${eventId}`, updateData);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Удалить событие планировщика
   * @param {string} eventId - ID события
   */
  deleteEvent: async (eventId) => {
    try {
      const response = await api.delete(`/tasks/${eventId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить события для копирования на другую дату
   * @param {number} telegramId - Telegram ID пользователя
   * @param {string} sourceDate - Исходная дата в формате YYYY-MM-DD
   * @param {string} targetDate - Целевая дата в формате YYYY-MM-DD
   */
  copyEventsToDate: async (telegramId, sourceDate, targetDate) => {
    try {
      const response = await api.post('/planner/copy', {
        telegram_id: telegramId,
        source_date: sourceDate,
        target_date: targetDate,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

/**
 * API для отслеживания активности пользователя (для админ панели - онлайн статус)
 */
export const activityAPI = {
  /**
   * Отправить heartbeat - обновить активность пользователя
   * @param {number} telegramId - Telegram ID пользователя
   * @param {string} section - Текущий раздел приложения (schedule, tasks, journal, music, friends)
   */
  trackActivity: async (telegramId, section = null) => {
    try {
      const params = new URLSearchParams({ telegram_id: telegramId });
      if (section) {
        params.append('section', section);
      }
      const response = await api.post(`/admin/track-activity?${params.toString()}`);
      return response.data;
    } catch (error) {
      // Тихо игнорируем ошибки трекинга, чтобы не мешать основному функционалу
      console.debug('Activity tracking error:', error.message);
      return null;
    }
  },
};

/**
 * API для стрик-механики (серия посещений)
 */
export const streakAPI = {
  /**
   * Записать визит пользователя
   * @param {number} telegramId
   */
  recordVisit: async (telegramId) => {
    try {
      const response = await api.post(`/users/${telegramId}/visit`);
      return response.data;
    } catch (error) {
      console.debug('Streak visit error:', error.message);
      return null;
    }
  },

  /**
   * Забрать награду за стрик
   * @param {number} telegramId
   */
  claimReward: async (telegramId) => {
    try {
      const response = await api.post(`/users/${telegramId}/streak-claim`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

/**
 * API для совместного расписания
 */
export const sharedScheduleAPI = {
  /**
   * Создать совместное расписание
   */
  create: async (ownerId, participantIds = []) => {
    try {
      const response = await api.post('/shared-schedule', {
        owner_id: ownerId,
        participant_ids: participantIds,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Получить совместное расписание
   */
  get: async (telegramId) => {
    try {
      const response = await api.get(`/shared-schedule/${telegramId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Добавить участника
   */
  addParticipant: async (scheduleId, participantId) => {
    try {
      const response = await api.post(`/shared-schedule/${scheduleId}/add-participant`, {
        participant_id: participantId,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Удалить участника
   */
  removeParticipant: async (scheduleId, participantId) => {
    try {
      const response = await api.delete(`/shared-schedule/${scheduleId}/remove-participant/${participantId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Удалить совместное расписание
   */
  delete: async (scheduleId) => {
    try {
      const response = await api.delete(`/shared-schedule/${scheduleId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

/**
 * API для администратора: уведомления из TG постов
 */
export const adminNotificationsAPI = {
  /**
   * Парсить Telegram пост
   */
  parseTelegramPost: async (telegramUrl) => {
    try {
      const response = await api.post('/admin/notifications/parse-telegram', {
        telegram_url: telegramUrl,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * Отправить уведомление из поста
   */
  sendFromPost: async ({ title, description, imageUrl, recipients = 'all', recipientIds = [] }) => {
    try {
      const response = await api.post('/admin/notifications/send-from-post', {
        title,
        description,
        image_url: imageUrl,
        recipients,
        recipient_ids: recipientIds,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

export { getBackendURL } from '../utils/config';
export default api;
