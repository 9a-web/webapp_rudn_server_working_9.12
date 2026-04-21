/**
 * Цветовые схемы для комнат
 * Каждая схема содержит градиенты для карточки, кнопок и акцентов
 */

export const ROOM_COLORS = [
  {
    id: 'blue',
    name: 'Синий',
    emoji: '💙',
    cardGradient: 'from-blue-50 to-indigo-50',
    buttonGradient: 'from-blue-500 to-indigo-600',
    accentColor: '#4F46E5',
    shadowColor: 'shadow-blue-500/20',
    hoverShadow: 'hover:shadow-blue-500/30',
    borderColor: 'border-blue-200'
  },
  {
    id: 'green',
    name: 'Зелёный',
    emoji: '💚',
    cardGradient: 'from-green-50 to-emerald-50',
    buttonGradient: 'from-green-500 to-emerald-600',
    accentColor: '#10B981',
    shadowColor: 'shadow-green-500/20',
    hoverShadow: 'hover:shadow-green-500/30',
    borderColor: 'border-green-200'
  },
  {
    id: 'purple',
    name: 'Фиолетовый',
    emoji: '💜',
    cardGradient: 'from-purple-50 to-violet-50',
    buttonGradient: 'from-purple-500 to-violet-600',
    accentColor: '#8B5CF6',
    shadowColor: 'shadow-purple-500/20',
    hoverShadow: 'hover:shadow-purple-500/30',
    borderColor: 'border-purple-200'
  },
  {
    id: 'pink',
    name: 'Розовый',
    emoji: '💗',
    cardGradient: 'from-pink-50 to-rose-50',
    buttonGradient: 'from-pink-500 to-rose-600',
    accentColor: '#EC4899',
    shadowColor: 'shadow-pink-500/20',
    hoverShadow: 'hover:shadow-pink-500/30',
    borderColor: 'border-pink-200'
  },
  {
    id: 'orange',
    name: 'Оранжевый',
    emoji: '🧡',
    cardGradient: 'from-orange-50 to-amber-50',
    buttonGradient: 'from-orange-500 to-amber-600',
    accentColor: '#F59E0B',
    shadowColor: 'shadow-orange-500/20',
    hoverShadow: 'hover:shadow-orange-500/30',
    borderColor: 'border-orange-200'
  },
  {
    id: 'red',
    name: 'Красный',
    emoji: '❤️',
    cardGradient: 'from-red-50 to-pink-50',
    buttonGradient: 'from-red-500 to-pink-600',
    accentColor: '#EF4444',
    shadowColor: 'shadow-red-500/20',
    hoverShadow: 'hover:shadow-red-500/30',
    borderColor: 'border-red-200'
  },
  {
    id: 'cyan',
    name: 'Голубой',
    emoji: '🩵',
    cardGradient: 'from-cyan-50 to-sky-50',
    buttonGradient: 'from-cyan-500 to-sky-600',
    accentColor: '#06B6D4',
    shadowColor: 'shadow-cyan-500/20',
    hoverShadow: 'hover:shadow-cyan-500/30',
    borderColor: 'border-cyan-200'
  },
  {
    id: 'teal',
    name: 'Бирюзовый',
    emoji: '🩵',
    cardGradient: 'from-teal-50 to-cyan-50',
    buttonGradient: 'from-teal-500 to-cyan-600',
    accentColor: '#14B8A6',
    shadowColor: 'shadow-teal-500/20',
    hoverShadow: 'hover:shadow-teal-500/30',
    borderColor: 'border-teal-200'
  }
];

/**
 * Получить цветовую схему по ID
 */
export const getRoomColor = (colorId) => {
  return ROOM_COLORS.find(c => c.id === colorId) || ROOM_COLORS[0]; // default: blue
};

/**
 * Получить случайный цвет
 */
export const getRandomRoomColor = () => {
  return ROOM_COLORS[Math.floor(Math.random() * ROOM_COLORS.length)];
};
