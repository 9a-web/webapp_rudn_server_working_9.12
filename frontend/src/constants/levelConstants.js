/**
 * Общие константы системы уровней.
 * Единственный источник правды — дублирование запрещено.
 */

export const TIER_CONFIG = {
  base: {
    name: 'Base',
    color: '#4D85FF',
    gradient: 'linear-gradient(135deg, #4D85FF, #6EA0FF)',
    emoji: '🔵',
    glow: 'rgba(77, 133, 255, 0.35)',
  },
  medium: {
    name: 'Medium',
    color: '#FFA04D',
    gradient: 'linear-gradient(135deg, #FFA04D, #FFB976)',
    emoji: '🟠',
    glow: 'rgba(255, 160, 77, 0.35)',
  },
  rare: {
    name: 'Rare',
    color: '#B84DFF',
    gradient: 'linear-gradient(135deg, #B84DFF, #D47FFF)',
    emoji: '🟣',
    glow: 'rgba(184, 77, 255, 0.35)',
  },
  premium: {
    name: 'Premium',
    color: '#FF4EEA',
    gradient: 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)',
    emoji: '✨',
    glow: 'rgba(255, 78, 234, 0.4)',
  },
};

export const TIER_RANGES = [
  { min: 1,  max: 4,  tier: 'base' },
  { min: 5,  max: 9,  tier: 'medium' },
  { min: 10, max: 19, tier: 'rare' },
  { min: 20, max: 99, tier: 'premium' },
];

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
