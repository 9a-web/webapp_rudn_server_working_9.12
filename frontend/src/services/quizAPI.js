/**
 * API клиент раздела «Тесты по лекциям» (deepseek-v4-flash через OpenModel).
 *
 * Используется собственный axios-инстанс с request-интерсептором для JWT
 * (по образцу friendsAPI.js — кастомные инстансы не наследуют глобальные
 * интерсепторы AuthContext).
 */
import axios from 'axios';
import { getBackendURL } from '../utils/config';
import { getToken } from '../utils/authStorage';

const API_BASE = `${getBackendURL()}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    try {
      const token = getToken();
      if (token && !config.headers?.Authorization) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (_) { /* localStorage недоступен */ }
    return config;
  },
  (error) => Promise.reject(error),
);

const handleError = (error) => {
  if (error.response) {
    const detail = error.response.data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((e) => e.msg).join('; ')
      : (detail || 'Ошибка сервера');
    const err = new Error(message);
    err.status = error.response.status;
    throw err;
  } else if (error.request) {
    const err = new Error('Ошибка сети. Проверьте подключение.');
    err.isNetworkError = true;
    throw err;
  }
  throw new Error(error.message);
};

export const quizAPI = {
  /**
   * Сгенерировать тест из текста лекции.
   * @param {{text:string, title?:string, num_questions?:number, language?:string}} payload
   */
  generate: async (payload) => {
    try {
      // генерация занимает время (deepseek «думает») — увеличенный таймаут
      const response = await api.post('/quiz/generate', payload, { timeout: 120000 });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  list: async () => {
    try {
      const response = await api.get('/quiz/list');
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  get: async (quizId) => {
    try {
      const response = await api.get(`/quiz/${quizId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  remove: async (quizId) => {
    try {
      const response = await api.delete(`/quiz/${quizId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  submitAttempt: async (quizId, answers) => {
    try {
      const response = await api.post(`/quiz/${quizId}/attempt`, { answers });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

export default quizAPI;
