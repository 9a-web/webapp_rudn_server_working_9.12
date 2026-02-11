/**
 * API Service для работы с системой сообщений между друзьями
 */

import axios from 'axios';
import { getBackendURL } from '../utils/config';

const API_BASE = `${getBackendURL()}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const handleError = (error) => {
  if (error.response) {
    const detail = error.response.data.detail;
    if (Array.isArray(detail)) {
      throw new Error(detail.map(err => err.msg).join('; '));
    }
    throw new Error(detail || 'Ошибка сервера');
  } else if (error.request) {
    throw new Error('Ошибка сети');
  }
  throw new Error(error.message);
};

export const messagesAPI = {
  // Создать или получить диалог
  createOrGetConversation: async (user1Id, user2Id) => {
    try {
      const response = await api.post('/messages/conversations', {
        user1_id: user1Id,
        user2_id: user2Id,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Получить все диалоги пользователя
  getConversations: async (telegramId) => {
    try {
      const response = await api.get(`/messages/conversations/${telegramId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Получить сообщения диалога
  getMessages: async (conversationId, telegramId, limit = 50, offset = 0) => {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        telegram_id: telegramId.toString(),
      });
      const response = await api.get(`/messages/${conversationId}/messages?${params}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Отправить сообщение
  sendMessage: async (senderId, receiverId, text) => {
    try {
      const response = await api.post('/messages/send', {
        sender_id: senderId,
        receiver_id: receiverId,
        text,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Пометить сообщения как прочитанные
  markAsRead: async (conversationId, telegramId) => {
    try {
      const response = await api.put(`/messages/${conversationId}/read`, {
        telegram_id: telegramId,
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Удалить сообщение
  deleteMessage: async (messageId, telegramId) => {
    try {
      const response = await api.delete(`/messages/${messageId}`, {
        data: { telegram_id: telegramId },
      });
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },

  // Получить количество непрочитанных
  getUnreadCount: async (telegramId) => {
    try {
      const response = await api.get(`/messages/unread/${telegramId}`);
      return response.data;
    } catch (error) {
      handleError(error);
    }
  },
};

export default messagesAPI;
