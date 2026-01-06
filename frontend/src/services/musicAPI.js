/**
 * Music API Service для работы с VK Music
 */
import api from './api';

export const musicAPI = {
  /**
   * Поиск треков по запросу
   * @param {string} query - Поисковый запрос
   * @param {number} count - Количество результатов
   */
  search: async (query, count = 20) => {
    const response = await api.get(`/music/search?q=${encodeURIComponent(query)}&count=${count}`);
    return response.data;
  },

  /**
   * Получить мои аудиозаписи
   * @param {number} count - Количество треков
   */
  getMyAudio: async (count = 50) => {
    const response = await api.get(`/music/my?count=${count}`);
    return response.data;
  },

  /**
   * Получить популярные треки
   * @param {number} count - Количество треков
   */
  getPopular: async (count = 30) => {
    const response = await api.get(`/music/popular?count=${count}`);
    return response.data;
  },

  /**
   * Получить плейлисты
   */
  getPlaylists: async () => {
    const response = await api.get('/music/playlists');
    return response.data;
  },

  /**
   * Получить треки плейлиста
   * @param {number} ownerId - ID владельца плейлиста
   * @param {number} playlistId - ID плейлиста
   * @param {number} count - Количество треков
   */
  getPlaylistTracks: async (ownerId, playlistId, count = 100) => {
    const response = await api.get(`/music/playlist/${ownerId}/${playlistId}?count=${count}`);
    return response.data;
  },

  /**
   * Получить избранные треки пользователя
   * @param {number} telegramId - ID пользователя Telegram
   */
  getFavorites: async (telegramId) => {
    const response = await api.get(`/music/favorites/${telegramId}`);
    return response.data;
  },

  /**
   * Добавить трек в избранное
   * @param {number} telegramId - ID пользователя Telegram
   * @param {object} track - Данные трека
   */
  addFavorite: async (telegramId, track) => {
    const response = await api.post(`/music/favorites/${telegramId}`, track);
    return response.data;
  },

  /**
   * Удалить трек из избранного
   * @param {number} telegramId - ID пользователя Telegram
   * @param {string} trackId - ID трека
   */
  removeFavorite: async (telegramId, trackId) => {
    const response = await api.delete(`/music/favorites/${telegramId}/${trackId}`);
    return response.data;
  }
};

export default musicAPI;
