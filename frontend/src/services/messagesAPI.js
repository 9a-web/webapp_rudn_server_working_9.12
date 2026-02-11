/**
 * API Service для работы с системой сообщений между друзьями
 * Поддерживает: текст, реакции, reply, edit, pin, forward, schedule, music, typing, search, tasks
 */

import axios from 'axios';
import { getBackendURL } from '../utils/config';

const API_BASE = `${getBackendURL()}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const handleError = (error) => {
  if (error.response) {
    const detail = error.response.data.detail;
    if (Array.isArray(detail)) throw new Error(detail.map(err => err.msg).join('; '));
    throw new Error(detail || 'Ошибка сервера');
  } else if (error.request) {
    throw new Error('Ошибка сети');
  }
  throw new Error(error.message);
};

export const messagesAPI = {
  // === Диалоги ===
  createOrGetConversation: async (user1Id, user2Id) => {
    try {
      const r = await api.post('/messages/conversations', { user1_id: user1Id, user2_id: user2Id });
      return r.data;
    } catch (e) { handleError(e); }
  },

  getConversations: async (telegramId) => {
    try {
      const r = await api.get(`/messages/conversations/${telegramId}`);
      return r.data;
    } catch (e) { handleError(e); }
  },

  // === Сообщения ===
  getMessages: async (conversationId, telegramId, limit = 50, offset = 0, before = '') => {
    try {
      const params = new URLSearchParams({ limit, telegram_id: telegramId });
      if (before) params.append('before', before);
      const r = await api.get(`/messages/${conversationId}/messages?${params}`);
      return r.data;
    } catch (e) { handleError(e); }
  },

  sendMessage: async (senderId, receiverId, text, replyToId = null, messageType = 'text', metadata = null) => {
    try {
      const r = await api.post('/messages/send', {
        sender_id: senderId, receiver_id: receiverId, text,
        reply_to_id: replyToId, message_type: messageType, metadata,
      });
      return r.data;
    } catch (e) { handleError(e); }
  },

  // === Действия с сообщениями ===
  editMessage: async (messageId, telegramId, text) => {
    try {
      const r = await api.put(`/messages/${messageId}/edit`, { telegram_id: telegramId, text });
      return r.data;
    } catch (e) { handleError(e); }
  },

  toggleReaction: async (messageId, telegramId, emoji) => {
    try {
      const r = await api.post(`/messages/${messageId}/reactions`, { telegram_id: telegramId, emoji });
      return r.data;
    } catch (e) { handleError(e); }
  },

  pinMessage: async (messageId, telegramId, isPinned = true) => {
    try {
      const r = await api.put(`/messages/${messageId}/pin`, { telegram_id: telegramId, is_pinned: isPinned });
      return r.data;
    } catch (e) { handleError(e); }
  },

  getPinnedMessage: async (conversationId) => {
    try {
      const r = await api.get(`/messages/${conversationId}/pinned`);
      return r.data;
    } catch (e) { handleError(e); }
  },

  forwardMessage: async (senderId, receiverId, originalMessageId) => {
    try {
      const r = await api.post('/messages/forward', {
        sender_id: senderId, receiver_id: receiverId, original_message_id: originalMessageId,
      });
      return r.data;
    } catch (e) { handleError(e); }
  },

  deleteMessage: async (messageId, telegramId) => {
    try {
      const r = await api.delete(`/messages/${messageId}`, { data: { telegram_id: telegramId } });
      return r.data;
    } catch (e) { handleError(e); }
  },

  markAsRead: async (conversationId, telegramId) => {
    try {
      const r = await api.put(`/messages/${conversationId}/read`, { telegram_id: telegramId });
      return r.data;
    } catch (e) { handleError(e); }
  },

  getUnreadCount: async (telegramId) => {
    try {
      const r = await api.get(`/messages/unread/${telegramId}`);
      return r.data;
    } catch (e) { handleError(e); }
  },

  // === Специальные сообщения ===
  sendSchedule: async (senderId, receiverId, date = null) => {
    try {
      const r = await api.post('/messages/send-schedule', { sender_id: senderId, receiver_id: receiverId, date });
      return r.data;
    } catch (e) { handleError(e); }
  },

  sendMusic: async (senderId, receiverId, trackData) => {
    try {
      const r = await api.post('/messages/send-music', {
        sender_id: senderId, receiver_id: receiverId, ...trackData,
      });
      return r.data;
    } catch (e) { handleError(e); }
  },

  createTaskFromMessage: async (telegramId, messageId, title = null) => {
    try {
      const r = await api.post('/messages/create-task', { telegram_id: telegramId, message_id: messageId, title });
      return r.data;
    } catch (e) { handleError(e); }
  },

  // === Typing ===
  setTyping: async (conversationId, telegramId) => {
    try {
      await api.post(`/messages/${conversationId}/typing`, { telegram_id: telegramId });
    } catch (e) { /* silent */ }
  },

  getTyping: async (conversationId, telegramId) => {
    try {
      const r = await api.get(`/messages/${conversationId}/typing?telegram_id=${telegramId}`);
      return r.data;
    } catch (e) { return { typing_users: [] }; }
  },

  // === Поиск ===
  searchMessages: async (conversationId, query, telegramId, limit = 30) => {
    try {
      const params = new URLSearchParams({ q: query, telegram_id: telegramId, limit });
      const r = await api.get(`/messages/${conversationId}/search?${params}`);
      return r.data;
    } catch (e) { handleError(e); }
  },
};

export default messagesAPI;
