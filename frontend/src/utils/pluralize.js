/**
 * Склонение слов в русском языке
 * @param {number} count - Число
 * @param {string} one - Форма для 1 (минута)
 * @param {string} few - Форма для 2-4 (минуты)
 * @param {string} many - Форма для 5+ (минут)
 * @returns {string} Правильная форма слова
 */
export const pluralize = (count, one, few, many) => {
  const absCount = Math.abs(count);
  const lastDigit = absCount % 10;
  const lastTwoDigits = absCount % 100;

  // Исключения для 11-14
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return many;
  }

  // Правила склонения
  if (lastDigit === 1) {
    return one;
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return few;
  }

  return many;
};

/**
 * Склонение слова "минута"
 * @param {number} minutes - Количество минут
 * @returns {string} Правильная форма слова
 */
export const pluralizeMinutes = (minutes) => {
  return pluralize(minutes, 'минута', 'минуты', 'минут');
};

/**
 * Склонение слова "час"
 * @param {number} hours - Количество часов
 * @returns {string} Правильная форма слова
 */
export const pluralizeHours = (hours) => {
  return pluralize(hours, 'час', 'часа', 'часов');
};

/**
 * Склонение слова "день"
 * @param {number} days - Количество дней
 * @returns {string} Правильная форма слова
 */
export const pluralizeDays = (days) => {
  return pluralize(days, 'день', 'дня', 'дней');
};
