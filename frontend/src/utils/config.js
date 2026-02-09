/**
 * Конфигурация приложения — единая точка определения Backend URL
 * 
 * Логика:
 * - VITE_ENV=production → https://rudn-schedule.ru
 * - VITE_ENV=test → REACT_APP_BACKEND_URL из .env (preview URL)
 * - localhost → http://localhost:8001
 * - fallback → window.location.origin
 */

export const getBackendURL = () => {
  // Определяем окружение
  let env = 'test';
  try {
    env = import.meta.env.VITE_ENV || 'test';
  } catch (e) {
    // fallback
  }

  // Продакшн — всегда rudn-schedule.ru
  if (env === 'production') {
    return 'https://rudn-schedule.ru';
  }

  // Тест — используем REACT_APP_BACKEND_URL из .env
  let envBackendUrl = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envBackendUrl = import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || '';
    }
    if (!envBackendUrl && typeof process !== 'undefined' && process.env) {
      envBackendUrl = process.env.REACT_APP_BACKEND_URL || '';
    }
  } catch (e) {
    // env not available
  }

  if (envBackendUrl && envBackendUrl.trim() !== '') {
    return envBackendUrl;
  }

  // localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8001';
  }

  // fallback — текущий домен
  return window.location.origin;
};

export const getEnv = () => {
  try {
    return import.meta.env.VITE_ENV || 'test';
  } catch (e) {
    return 'test';
  }
};
