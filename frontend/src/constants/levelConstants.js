/**
 * Общие константы системы уровней v3.0.
 * Единственный источник правды — дублирование запрещено.
 *
 * v3.0:
 * - Добавлен тир Legend
 * - Система звёзд (1-5 ⭐) внутри тиров
 * - Русские и английские названия тиров
 * - Конфиг для roadmap и анимаций
 */

export const TIER_CONFIG = {
  base: {
    name: 'Base',
    nameRu: 'Базовый',
    color: '#4D85FF',
    gradient: 'linear-gradient(135deg, #4D85FF, #6EA0FF)',
    emoji: '🔵',
    glow: 'rgba(77, 133, 255, 0.35)',
    icon: '🛡️',
  },
  medium: {
    name: 'Medium',
    nameRu: 'Средний',
    color: '#FFA04D',
    gradient: 'linear-gradient(135deg, #FFA04D, #FFB976)',
    emoji: '🟠',
    glow: 'rgba(255, 160, 77, 0.35)',
    icon: '⚔️',
  },
  rare: {
    name: 'Rare',
    nameRu: 'Редкий',
    color: '#B84DFF',
    gradient: 'linear-gradient(135deg, #B84DFF, #D47FFF)',
    emoji: '🟣',
    glow: 'rgba(184, 77, 255, 0.35)',
    icon: '👑',
  },
  premium: {
    name: 'Premium',
    nameRu: 'Премиум',
    color: '#FF4EEA',
    gradient: 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)',
    emoji: '✨',
    glow: 'rgba(255, 78, 234, 0.4)',
    icon: '💎',
  },
  legend: {
    name: 'Legend',
    nameRu: 'Легенда',
    color: '#FFD700',
    gradient: 'linear-gradient(135deg, #FFD700, #FF6B00, #FF0080, #7B2FFF)',
    emoji: '🏆',
    glow: 'rgba(255, 215, 0, 0.5)',
    icon: '🌟',
  },
};

export const TIER_RANGES = [
  { min: 1,  max: 4,  tier: 'base' },
  { min: 5,  max: 9,  tier: 'medium' },
  { min: 10, max: 19, tier: 'rare' },
  { min: 20, max: 29, tier: 'premium' },
  { min: 30, max: 99, tier: 'legend' },
];

/** Порядок тиров для roadmap и сравнения */
export const TIER_ORDER = ['base', 'medium', 'rare', 'premium', 'legend'];

/**
 * Генерация звёзд (⭐) для отображения.
 * @param {number} count — количество звёзд (1-5)
 * @returns {string}
 */
export function renderStars(count) {
  return '★'.repeat(Math.min(Math.max(count || 1, 1), 5));
}

/**
 * Получить конфиг тира по названию.
 * @param {string} tier
 * @returns {object}
 */
export function getTierConfig(tier) {
  return TIER_CONFIG[(tier || 'base').toLowerCase()] || TIER_CONFIG.base;
}

/**
 * Получить цвет тира.
 * @param {string} tier
 * @returns {string}
 */
export function getTierColor(tier) {
  return getTierConfig(tier).color;
}

/**
 * Получить название тира.
 * @param {string} tier
 * @returns {string}
 */
export function getTierName(tier) {
  return getTierConfig(tier).name;
}

/**
 * Получить русское название тира.
 * @param {string} tier
 * @returns {string}
 */
export function getTierNameRu(tier) {
  return getTierConfig(tier).nameRu || getTierConfig(tier).name;
}

/**
 * Индекс тира в порядке прогрессии (0 = base, 4 = legend).
 * @param {string} tier
 * @returns {number}
 */
export function getTierIndex(tier) {
  const idx = TIER_ORDER.indexOf((tier || 'base').toLowerCase());
  return idx >= 0 ? idx : 0;
}
