/**
 * Утилиты для работы с текстом задач
 */

// Регулярное выражение для поиска YouTube ссылок
const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S*)?/gi;

/**
 * Извлекает YouTube URL из текста
 * @param {string} text - Текст для поиска
 * @returns {string|null} - YouTube URL или null
 */
export const extractYouTubeUrl = (text) => {
  if (!text) return null;
  const match = text.match(YOUTUBE_URL_REGEX);
  return match ? match[0] : null;
};

/**
 * Удаляет YouTube URL из текста и очищает лишние пробелы
 * @param {string} text - Исходный текст
 * @returns {string} - Текст без YouTube ссылки
 */
export const removeYouTubeUrl = (text) => {
  if (!text) return '';
  return text
    .replace(YOUTUBE_URL_REGEX, '')
    .replace(/\s+/g, ' ')  // Убираем множественные пробелы
    .trim();
};

/**
 * Разделяет текст задачи на текстовую часть и YouTube информацию
 * @param {string} text - Полный текст задачи
 * @param {object} youtubeData - Данные YouTube из задачи { youtube_url, youtube_title, etc }
 * @returns {object} - { displayText: string, hasYouTube: boolean }
 */
export const parseTaskText = (text, youtubeData = {}) => {
  const { youtube_url, youtube_title } = youtubeData;
  
  // Если есть YouTube данные, убираем URL из текста
  if (youtube_url && youtube_title) {
    const cleanText = removeYouTubeUrl(text);
    return {
      displayText: cleanText,
      hasYouTube: true,
      hasTextContent: cleanText.length > 0
    };
  }
  
  return {
    displayText: text,
    hasYouTube: false,
    hasTextContent: text && text.length > 0
  };
};

export default {
  extractYouTubeUrl,
  removeYouTubeUrl,
  parseTaskText
};
