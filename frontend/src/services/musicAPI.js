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
   * Получить прямую ссылку на трек для воспроизведения
   * @param {string} trackId - ID трека в формате "owner_id_song_id"
   * @returns {Promise<{url: string, track_id: string}>}
   */
  getStreamUrl: async (trackId) => {
    const response = await api.get(`/music/stream/${trackId}`);
    return response.data;
  },

  /**
   * Получить мои аудиозаписи
   * @param {number} count - Количество треков
   * @param {number} offset - Смещение для пагинации
   */
  getMyAudio: async (count = 50, offset = 0) => {
    const response = await api.get(`/music/my?count=${count}&offset=${offset}`);
    return response.data;
  },

  /**
   * Получить популярные треки
   * @param {number} count - Количество треков
   * @param {number} offset - Смещение для пагинации
   */
  getPopular: async (count = 30, offset = 0) => {
    const response = await api.get(`/music/popular?count=${count}&offset=${offset}`);
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
   * @param {string} accessKey - Ключ доступа плейлиста
   * @param {number} count - Количество треков
   */
  getPlaylistTracks: async (ownerId, playlistId, accessKey = '', count = 100) => {
    const response = await api.get(`/music/playlist/${ownerId}/${playlistId}?access_key=${accessKey}&count=${count}`);
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
  },

  /**
   * Получить треки артиста
   * @param {string} artistName - Имя артиста
   * @param {number} count - Количество треков
   * @returns {Promise<{artist: string, tracks: Array, count: number}>}
   */
  getArtistTracks: async (artistName, count = 50) => {
    const response = await api.get(`/music/artist/${encodeURIComponent(artistName)}?count=${count}`);
    return response.data;
  },

  // ============ VK Auth API ============

  /**
   * Получить конфигурацию OAuth для авторизации VK
   * @returns {Promise<{auth_url: string, app_id: number, redirect_uri: string, scope: number}>}
   */
  getVKOAuthConfig: async () => {
    const response = await api.get('/music/auth/config');
    return response.data;
  },

  /**
   * Авторизация VK через OAuth токен
   * @param {number} telegramId - ID пользователя Telegram
   * @param {object} data - Данные авторизации
   * @param {string} [data.token_url] - URL с токеном из redirect
   * @param {string} [data.access_token] - Или напрямую access_token
   * @returns {Promise<{success: boolean, message: string, vk_user_id?: number}>}
   */
  vkAuth: async (telegramId, data) => {
    const response = await api.post(`/music/auth/${telegramId}`, data);
    return response.data;
  },

  /**
   * Получить статус авторизации VK пользователя
   * @param {number} telegramId - ID пользователя Telegram
   * @returns {Promise<{is_connected: boolean, vk_user_id?: number, vk_user_info?: object, token_valid?: boolean, audio_access?: boolean}>}
   */
  getVKAuthStatus: async (telegramId) => {
    const response = await api.get(`/music/auth/status/${telegramId}`);
    return response.data;
  },

  /**
   * Отключить VK аккаунт (удалить токен)
   * @param {number} telegramId - ID пользователя Telegram
   * @returns {Promise<{success: boolean, message: string}>}
   */
  vkAuthDisconnect: async (telegramId) => {
    const response = await api.delete(`/music/auth/${telegramId}`);
    return response.data;
  },

  /**
   * Получить аудиозаписи пользователя с его персональным токеном
   * @param {number} telegramId - ID пользователя Telegram
   * @param {number} count - Количество треков
   * @param {number} offset - Смещение для пагинации
   * @returns {Promise<{tracks: Array, count: number, total: number, has_more: boolean}>}
   */
  getMyVKAudio: async (telegramId, count = 50, offset = 0) => {
    const response = await api.get(`/music/my-vk/${telegramId}?count=${count}&offset=${offset}`);
    return response.data;
  }
};

export default musicAPI;
