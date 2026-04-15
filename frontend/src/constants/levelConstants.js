/**
 * Общие константы системы уровней v4.0.
 * Единственный источник правды.
 *
 * v4.0 — Психология-ориентированный дизайн:
 * - Тир Legend
 * - Система звёзд (1-5) внутри тиров
 * - Русские названия тиров
 * - Конфиг для roadmap, анимаций
 * - Без эмодзи — всё через иконки
 */

export const TIER_CONFIG = {
  base: {
    name: 'Base',
    nameRu: 'Базовый',
    color: '#4D85FF',
    colorSecondary: '#6EA0FF',
    gradient: 'linear-gradient(135deg, #4D85FF, #6EA0FF)',
    glow: 'rgba(77, 133, 255, 0.35)',
    bgTint: 'rgba(77, 133, 255, 0.08)',
    borderTint: 'rgba(77, 133, 255, 0.20)',
  },
  medium: {
    name: 'Medium',
    nameRu: 'Средний',
    color: '#FFA04D',
    colorSecondary: '#FFB976',
    gradient: 'linear-gradient(135deg, #FFA04D, #FFB976)',
    glow: 'rgba(255, 160, 77, 0.35)',
    bgTint: 'rgba(255, 160, 77, 0.08)',
    borderTint: 'rgba(255, 160, 77, 0.20)',
  },
  rare: {
    name: 'Rare',
    nameRu: 'Редкий',
    color: '#B84DFF',
    colorSecondary: '#D47FFF',
    gradient: 'linear-gradient(135deg, #B84DFF, #D47FFF)',
    glow: 'rgba(184, 77, 255, 0.35)',
    bgTint: 'rgba(184, 77, 255, 0.08)',
    borderTint: 'rgba(184, 77, 255, 0.20)',
  },
  premium: {
    name: 'Premium',
    nameRu: 'Премиум',
    color: '#FF4EEA',
    colorSecondary: '#FFCE2E',
    gradient: 'linear-gradient(90deg, #FF4EEA, #FFCE2E, #FF8717)',
    glow: 'rgba(255, 78, 234, 0.4)',
    bgTint: 'rgba(255, 78, 234, 0.08)',
    borderTint: 'rgba(255, 78, 234, 0.20)',
  },
  legend: {
    name: 'Legend',
    nameRu: 'Легенда',
    color: '#FFD700',
    colorSecondary: '#FF6B00',
    gradient: 'linear-gradient(135deg, #FFD700, #FF6B00, #FF0080, #7B2FFF)',
    glow: 'rgba(255, 215, 0, 0.5)',
    bgTint: 'rgba(255, 215, 0, 0.08)',
    borderTint: 'rgba(255, 215, 0, 0.25)',
  },
};

export const TIER_RANGES = [
  { min: 1,  max: 4,  tier: 'base' },
  { min: 5,  max: 9,  tier: 'medium' },
  { min: 10, max: 19, tier: 'rare' },
  { min: 20, max: 29, tier: 'premium' },
  { min: 30, max: 99, tier: 'legend' },
];

export const TIER_ORDER = ['base', 'medium', 'rare', 'premium', 'legend'];

export function renderStars(count) {
  return '★'.repeat(Math.min(Math.max(count || 1, 1), 5));
}

export function getTierConfig(tier) {
  return TIER_CONFIG[(tier || 'base').toLowerCase()] || TIER_CONFIG.base;
}

export function getTierColor(tier) {
  return getTierConfig(tier).color;
}

export function getTierName(tier) {
  return getTierConfig(tier).name;
}

export function getTierNameRu(tier) {
  return getTierConfig(tier).nameRu || getTierConfig(tier).name;
}

export function getTierIndex(tier) {
  const idx = TIER_ORDER.indexOf((tier || 'base').toLowerCase());
  return idx >= 0 ? idx : 0;
}
