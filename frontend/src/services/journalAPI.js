/**
 * API Service для работы с журналом посещений (Attendance Journal)
 */

import axios from 'axios';

// Определяем URL backend
const getBackendURL = () => {
  let envBackendUrl = '';
  
  try {
    if (typeof process !== 'undefined' && process.env && import.meta.env.VITE_BACKEND_URL) {
      envBackendUrl = import.meta.env.VITE_BACKEND_URL;
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

console.log('📓 Journal API initialized with backend URL:', API_BASE_URL);

// ===== Журналы =====

// Создать журнал
export const createJournal = async (journalData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/journals`, journalData);
    return response.data;
  } catch (error) {
    console.error('Error creating journal:', error);
    throw error;
  }
};

// Получить все журналы пользователя
export const getUserJournals = async (telegramId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/journals/${telegramId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user journals:', error);
    throw error;
  }
};

// Получить детали журнала
export const getJournalDetail = async (journalId, telegramId = 0) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/journals/detail/${journalId}?telegram_id=${telegramId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching journal detail:', error);
    throw error;
  }
};

// Обновить журнал
export const updateJournal = async (journalId, data) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/api/journals/${journalId}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating journal:', error);
    throw error;
  }
};

// Удалить журнал
export const deleteJournal = async (journalId, telegramId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/api/journals/${journalId}?telegram_id=${telegramId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting journal:', error);
    throw error;
  }
};

// Сгенерировать ссылку-приглашение
export const generateJournalInviteLink = async (journalId) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/journals/${journalId}/invite-link`);
    return response.data;
  } catch (error) {
    console.error('Error generating invite link:', error);
    throw error;
  }
};

// Присоединиться к журналу по приглашению
export const joinJournal = async (inviteToken, userData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/journals/join/${inviteToken}`, userData);
    return response.data;
  } catch (error) {
    console.error('Error joining journal:', error);
    throw error;
  }
};

// ===== Студенты =====

// Добавить студента
export const addStudent = async (journalId, fullName) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/journals/${journalId}/students`, { full_name: fullName });
    return response.data;
  } catch (error) {
    console.error('Error adding student:', error);
    throw error;
  }
};

// Массовое добавление студентов
export const addStudentsBulk = async (journalId, names) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/journals/${journalId}/students/bulk`, { names });
    return response.data;
  } catch (error) {
    console.error('Error adding students bulk:', error);
    throw error;
  }
};

// Получить список студентов
export const getJournalStudents = async (journalId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/journals/${journalId}/students`);
    return response.data;
  } catch (error) {
    console.error('Error fetching students:', error);
    throw error;
  }
};

// Обновить студента
export const updateStudent = async (journalId, studentId, data) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/api/journals/${journalId}/students/${studentId}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
};

// Удалить студента
export const deleteStudent = async (journalId, studentId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/api/journals/${journalId}/students/${studentId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
};

// Привязать студента к Telegram
export const linkStudent = async (journalId, studentId, linkData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/journals/${journalId}/students/${studentId}/link`, linkData);
    return response.data;
  } catch (error) {
    console.error('Error linking student:', error);
    throw error;
  }
};

// Получить ожидающих привязки
export const getPendingMembers = async (journalId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/journals/${journalId}/pending-members`);
    return response.data;
  } catch (error) {
    console.error('Error fetching pending members:', error);
    throw error;
  }
};

// ===== Занятия =====

// Создать занятие
export const createSession = async (journalId, sessionData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/journals/${journalId}/sessions`, sessionData);
    return response.data;
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
};

// Получить список занятий
export const getJournalSessions = async (journalId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/journals/${journalId}/sessions`);
    return response.data;
  } catch (error) {
    console.error('Error fetching sessions:', error);
    throw error;
  }
};

// Обновить занятие
export const updateSession = async (sessionId, data) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/api/journals/sessions/${sessionId}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating session:', error);
    throw error;
  }
};

// Удалить занятие
export const deleteSession = async (sessionId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/api/journals/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
};

// ===== Посещаемость =====

// Массовая отметка посещаемости
export const markAttendance = async (sessionId, records, telegramId) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/journals/sessions/${sessionId}/attendance`, {
      records,
      telegram_id: telegramId
    });
    return response.data;
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
};

// Получить посещаемость на занятии
export const getSessionAttendance = async (sessionId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/journals/sessions/${sessionId}/attendance`);
    return response.data;
  } catch (error) {
    console.error('Error fetching attendance:', error);
    throw error;
  }
};

// Получить мою посещаемость
export const getMyAttendance = async (journalId, telegramId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/journals/${journalId}/my-attendance/${telegramId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching my attendance:', error);
    throw error;
  }
};

// Получить статистику журнала
export const getJournalStats = async (journalId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/journals/${journalId}/stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching journal stats:', error);
    throw error;
  }
};


export const updateStudent = async (journalId, studentId, data) => {
  const response = await api.put(`/journals/${journalId}/students/${studentId}`, data);
  return response.data;
};

export const unlinkStudent = async (journalId, studentId) => {
    const response = await api.post(`/journals/${journalId}/students/${studentId}/unlink`);
    return response.data;
};
