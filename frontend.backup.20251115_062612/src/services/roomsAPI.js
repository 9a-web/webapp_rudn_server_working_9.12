/**
 * API Service для работы с комнатами (Rooms)
 */

import axios from 'axios';

// Определяем URL backend
const getBackendURL = () => {
  let envBackendUrl = '';
  
  try {
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) {
      envBackendUrl = process.env.REACT_APP_BACKEND_URL;
    } else if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.REACT_APP_BACKEND_URL) {
      envBackendUrl = import.meta.env.REACT_APP_BACKEND_URL;
    }
  } catch (error) {
    console.warn('Could not access environment variables:', error);
  }
  
  if (envBackendUrl && envBackendUrl.trim() !== '') {
    return envBackendUrl;
  }
  
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8001';
  }
  
  return window.location.origin;
};

const API_BASE_URL = getBackendURL();

console.log('🏠 Rooms API initialized with backend URL:', API_BASE_URL);

// Создать комнату
export const createRoom = async (roomData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/rooms`, roomData);
    return response.data;
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
};

// Получить все комнаты пользователя
export const getUserRooms = async (telegramId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/rooms/${telegramId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user rooms:', error);
    throw error;
  }
};

// Получить детали комнаты
export const getRoomDetail = async (roomId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/rooms/detail/${roomId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching room detail:', error);
    throw error;
  }
};

// Сгенерировать ссылку-приглашение
export const generateInviteLink = async (roomId, telegramId) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rooms/${roomId}/invite-link`,
      { telegram_id: telegramId }
    );
    return response.data;
  } catch (error) {
    console.error('Error generating invite link:', error);
    throw error;
  }
};

// Присоединиться к комнате по токену
export const joinRoomByToken = async (inviteToken, joinData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rooms/join/${inviteToken}`,
      joinData
    );
    return response.data;
  } catch (error) {
    console.error('Error joining room:', error);
    throw error;
  }
};

// Создать задачу в комнате
export const createRoomTask = async (roomId, taskData) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rooms/${roomId}/tasks`,
      taskData
    );
    return response.data;
  } catch (error) {
    console.error('Error creating room task:', error);
    throw error;
  }
};

// Получить все задачи комнаты
export const getRoomTasks = async (roomId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/rooms/${roomId}/tasks`);
    return response.data;
  } catch (error) {
    console.error('Error fetching room tasks:', error);
    throw error;
  }
};

// Покинуть комнату
export const leaveRoom = async (roomId, telegramId) => {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/api/rooms/${roomId}/leave`,
      { data: { telegram_id: telegramId } }
    );
    return response.data;
  } catch (error) {
    console.error('Error leaving room:', error);
    throw error;
  }
};

// Удалить комнату
export const deleteRoom = async (roomId, telegramId) => {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/api/rooms/${roomId}`,
      { data: { telegram_id: telegramId } }
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting room:', error);
    throw error;
  }
};

// Обновить комнату (название, описание, цвет)
export const updateRoom = async (roomId, updateData, telegramId) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/rooms/${roomId}`,
      { ...updateData, telegram_id: telegramId }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating room:', error);
    throw error;
  }
};

// Получить историю активности комнаты
export const getRoomActivity = async (roomId, limit = 50) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/rooms/${roomId}/activity`,
      { params: { limit } }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching room activity:', error);
    throw error;
  }
};

// Получить статистику комнаты
export const getRoomStats = async (roomId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/rooms/${roomId}/stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching room stats:', error);
    throw error;
  }
};

// Изменить роль участника
export const updateParticipantRole = async (roomId, telegramId, newRole, changedBy) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/rooms/${roomId}/participant-role`,
      {
        room_id: roomId,
        telegram_id: telegramId,
        new_role: newRole,
        changed_by: changedBy
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating participant role:', error);
    throw error;
  }
};

// Обновить групповую задачу
export const updateGroupTask = async (taskId, updateData) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/group-tasks/${taskId}/update`,
      updateData
    );
    return response.data;
  } catch (error) {
    console.error('Error updating group task:', error);
    throw error;
  }
};

// Удалить групповую задачу
export const deleteGroupTask = async (taskId, telegramId) => {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/api/group-tasks/${taskId}`,
      { data: { telegram_id: telegramId } }
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting group task:', error);
    throw error;
  }
};

// Отметить задачу как выполненную/невыполненную
export const toggleTaskComplete = async (taskId, telegramId, completed) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/group-tasks/${taskId}/complete`,
      {
        task_id: taskId,
        telegram_id: telegramId,
        completed: completed
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error toggling task completion:', error);
    throw error;
  }
};

// Добавить подзадачу
export const addSubtask = async (taskId, title) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/group-tasks/${taskId}/subtasks`,
      { title }
    );
    return response.data;
  } catch (error) {
    console.error('Error adding subtask:', error);
    throw error;
  }
};

// Обновить подзадачу
export const updateSubtask = async (taskId, subtaskId, updateData) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/group-tasks/${taskId}/subtasks/${subtaskId}`,
      { subtask_id: subtaskId, ...updateData }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating subtask:', error);
    throw error;
  }
};

// Удалить подзадачу
export const deleteSubtask = async (taskId, subtaskId) => {
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/api/group-tasks/${taskId}/subtasks/${subtaskId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error deleting subtask:', error);
    throw error;
  }
};

// Изменить порядок задач (drag & drop)
export const reorderRoomTasks = async (roomId, tasks) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/rooms/${roomId}/tasks-reorder`,
      {
        room_id: roomId,
        tasks: tasks
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error reordering tasks:', error);
    throw error;
  }
};

