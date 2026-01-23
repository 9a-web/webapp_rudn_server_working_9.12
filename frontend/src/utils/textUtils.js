/**
 * Утилиты для работы с текстом задач
 */

// Регулярное выражение для поиска YouTube ссылок
const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S*)?/gi;

// Регулярное выражение для поиска VK Video ссылок
const VK_VIDEO_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:vk\.com\/(?:video|clip|video\?z=video)|vkvideo\.ru\/video)(-?\d+_\d+)(?:\S*)?/gi;

/**
 * Извлекает YouTube URL из текста (первый найденный)
 * @param {string} text - Текст для поиска
 * @returns {string|null} - YouTube URL или null
 */
export const extractYouTubeUrl = (text) => {
  if (!text) return null;
  const regex = new RegExp(YOUTUBE_URL_REGEX.source, 'i');
  const match = text.match(regex);
  return match ? match[0] : null;
};

/**
 * Извлекает ВСЕ YouTube URLs из текста
 * @param {string} text - Текст для поиска
 * @returns {string[]} - Массив YouTube URLs
 */
export const extractAllYouTubeUrls = (text) => {
  if (!text) return [];
  const regex = new RegExp(YOUTUBE_URL_REGEX.source, 'gi');
  const matches = text.match(regex);
  return matches ? [...new Set(matches)] : []; // Убираем дубликаты
};

/**
 * Извлекает VK Video URL из текста (первый найденный)
 * @param {string} text - Текст для поиска
 * @returns {string|null} - VK Video URL или null
 */
export const extractVKVideoUrl = (text) => {
  if (!text) return null;
  const regex = new RegExp(VK_VIDEO_URL_REGEX.source, 'i');
  const match = text.match(regex);
  return match ? match[0] : null;
};

/**
 * Извлекает ВСЕ VK Video URLs из текста
 * @param {string} text - Текст для поиска
 * @returns {string[]} - Массив VK Video URLs
 */
export const extractAllVKVideoUrls = (text) => {
  if (!text) return [];
  const regex = new RegExp(VK_VIDEO_URL_REGEX.source, 'gi');
  const matches = text.match(regex);
  return matches ? [...new Set(matches)] : []; // Убираем дубликаты
};

/**
 * Извлекает любую видео ссылку (YouTube или VK) из текста (первую найденную)
 * @param {string} text - Текст для поиска
 * @returns {object|null} - { url: string, type: 'youtube'|'vk' } или null
 */
export const extractVideoUrl = (text) => {
  if (!text) return null;
  
  const youtubeUrl = extractYouTubeUrl(text);
  if (youtubeUrl) {
    return { url: youtubeUrl, type: 'youtube' };
  }
  
  const vkUrl = extractVKVideoUrl(text);
  if (vkUrl) {
    return { url: vkUrl, type: 'vk' };
  }
  
  return null;
};

/**
 * Извлекает ВСЕ видео ссылки из текста (YouTube и VK)
 * @param {string} text - Текст для поиска
 * @returns {Array<{url: string, type: 'youtube'|'vk'}>} - Массив объектов с url и type
 */
export const extractAllVideoUrls = (text) => {
  if (!text) return [];
  
  const results = [];
  
  // Извлекаем все YouTube ссылки
  const youtubeUrls = extractAllYouTubeUrls(text);
  youtubeUrls.forEach(url => {
    results.push({ url, type: 'youtube' });
  });
  
  // Извлекаем все VK ссылки
  const vkUrls = extractAllVKVideoUrls(text);
  vkUrls.forEach(url => {
    results.push({ url, type: 'vk' });
  });
  
  return results;
};

/**
 * Удаляет YouTube URL из текста и очищает лишние пробелы
 * @param {string} text - Исходный текст
 * @returns {string} - Текст без YouTube ссылки
 */
export const removeYouTubeUrl = (text) => {
  if (!text) return '';
  const regex = new RegExp(YOUTUBE_URL_REGEX.source, 'gi');
  return text
    .replace(regex, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Удаляет VK Video URL из текста и очищает лишние пробелы
 * @param {string} text - Исходный текст
 * @returns {string} - Текст без VK Video ссылки
 */
export const removeVKVideoUrl = (text) => {
  if (!text) return '';
  const regex = new RegExp(VK_VIDEO_URL_REGEX.source, 'gi');
  return text
    .replace(regex, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Удаляет любую видео ссылку (YouTube или VK) из текста
 * @param {string} text - Исходный текст
 * @returns {string} - Текст без видео ссылки
 */
export const removeVideoUrl = (text) => {
  if (!text) return '';
  let result = removeYouTubeUrl(text);
  result = removeVKVideoUrl(result);
  return result;
};

/**
 * Разбивает текст на части: до ссылки, ссылка, после ссылки (YouTube)
 * @param {string} text - Полный текст
 * @returns {object} - { before: string, url: string|null, after: string }
 */
export const splitTextByYouTubeUrl = (text) => {
  if (!text) return { before: '', url: null, after: '' };
  
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S*)?/i;
  const match = text.match(regex);
  
  if (!match) {
    return { before: text, url: null, after: '' };
  }
  
  const url = match[0];
  const index = text.indexOf(url);
  
  return {
    before: text.slice(0, index),
    url: url,
    after: text.slice(index + url.length)
  };
};

/**
 * Разбивает текст на части: до ссылки, ссылка, после ссылки (VK Video)
 * @param {string} text - Полный текст
 * @returns {object} - { before: string, url: string|null, after: string }
 */
export const splitTextByVKVideoUrl = (text) => {
  if (!text) return { before: '', url: null, after: '' };
  
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:vk\.com\/(?:video|clip|video\?z=video)|vkvideo\.ru\/video)(-?\d+_\d+)(?:\S*)?/i;
  const match = text.match(regex);
  
  if (!match) {
    return { before: text, url: null, after: '' };
  }
  
  const url = match[0];
  const index = text.indexOf(url);
  
  return {
    before: text.slice(0, index),
    url: url,
    after: text.slice(index + url.length)
  };
};

/**
 * Разбивает текст на части для любой видео ссылки (YouTube или VK)
 * @param {string} text - Полный текст
 * @returns {object} - { before: string, url: string|null, after: string, type: 'youtube'|'vk'|null }
 */
export const splitTextByVideoUrl = (text) => {
  if (!text) return { before: '', url: null, after: '', type: null };
  
  // Сначала проверяем YouTube
  const ytSplit = splitTextByYouTubeUrl(text);
  if (ytSplit.url) {
    return { ...ytSplit, type: 'youtube' };
  }
  
  // Затем VK
  const vkSplit = splitTextByVKVideoUrl(text);
  if (vkSplit.url) {
    return { ...vkSplit, type: 'vk' };
  }
  
  return { before: text, url: null, after: '', type: null };
};

/**
 * Разбивает текст на сегменты с учетом ВСЕХ видео ссылок
 * Возвращает массив сегментов: текстовые части и видео ссылки в порядке их появления
 * @param {string} text - Полный текст
 * @returns {Array<{type: 'text'|'youtube'|'vk', content: string}>} - Массив сегментов
 */
export const splitTextByAllVideoUrls = (text) => {
  if (!text) return [];
  
  // Комбинированное regex для поиска всех видео ссылок
  const combinedRegex = /(?:https?:\/\/)?(?:www\.)?(?:(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S*)?|(?:vk\.com\/(?:video|clip|video\?z=video)|vkvideo\.ru\/video)(-?\d+_\d+)(?:\S*)?)/gi;
  
  const segments = [];
  let lastIndex = 0;
  let match;
  
  while ((match = combinedRegex.exec(text)) !== null) {
    // Добавляем текст перед ссылкой (если есть)
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        segments.push({ type: 'text', content: textBefore });
      }
    }
    
    // Определяем тип ссылки
    const url = match[0];
    const isYouTube = /youtube|youtu\.be/i.test(url);
    
    segments.push({
      type: isYouTube ? 'youtube' : 'vk',
      content: url
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Добавляем оставшийся текст (если есть)
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText.trim()) {
      segments.push({ type: 'text', content: remainingText });
    }
  }
  
  return segments;
};

/**
 * Разделяет текст задачи на текстовую часть и видео информацию
 * @param {string} text - Полный текст задачи
 * @param {object} videoData - Данные видео из задачи
 * @returns {object} - { displayText: string, hasVideo: boolean, videoType: string|null }
 */
export const parseTaskText = (text, videoData = {}) => {
  const { youtube_url, youtube_title, vk_video_url, vk_video_title } = videoData;
  
  let cleanText = text || '';
  let hasVideo = false;
  let videoType = null;
  
  // Если есть YouTube данные, убираем URL из текста
  if (youtube_url && youtube_title) {
    cleanText = removeYouTubeUrl(cleanText);
    hasVideo = true;
    videoType = 'youtube';
  }
  
  // Если есть VK данные, убираем URL из текста
  if (vk_video_url && vk_video_title) {
    cleanText = removeVKVideoUrl(cleanText);
    hasVideo = true;
    videoType = videoType ? 'both' : 'vk';
  }
  
  return {
    displayText: cleanText,
    hasYouTube: !!(youtube_url && youtube_title),
    hasVKVideo: !!(vk_video_url && vk_video_title),
    hasVideo,
    videoType,
    hasTextContent: cleanText.length > 0
  };
};

export default {
  extractYouTubeUrl,
  extractVKVideoUrl,
  extractVideoUrl,
  removeYouTubeUrl,
  removeVKVideoUrl,
  removeVideoUrl,
  splitTextByYouTubeUrl,
  splitTextByVKVideoUrl,
  splitTextByVideoUrl,
  parseTaskText
};
