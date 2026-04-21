/**
 * Утилиты для работы с датами и неделями
 */

/**
 * Получить понедельник текущей недели
 */
export const getCurrentWeekMonday = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Воскресенье = 0, нужно вернуться на -6 дней
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/**
 * Получить воскресенье текущей недели
 */
export const getCurrentWeekSunday = () => {
  const monday = getCurrentWeekMonday();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

/**
 * Получить понедельник следующей недели
 */
export const getNextWeekMonday = () => {
  const currentMonday = getCurrentWeekMonday();
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(currentMonday.getDate() + 7);
  return nextMonday;
};

/**
 * Получить воскресенье следующей недели
 */
export const getNextWeekSunday = () => {
  const nextMonday = getNextWeekMonday();
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  nextSunday.setHours(23, 59, 59, 999);
  return nextSunday;
};

/**
 * Определить, к какой неделе относится дата
 * @param {Date} date - Проверяемая дата
 * @returns {number|null} - 1 для текущей недели, 2 для следующей, null если вне диапазона
 */
export const getWeekNumberForDate = (date) => {
  if (!date) return null;
  
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const currentWeekMonday = getCurrentWeekMonday();
  const currentWeekSunday = getCurrentWeekSunday();
  const nextWeekMonday = getNextWeekMonday();
  const nextWeekSunday = getNextWeekSunday();
  
  // Проверяем текущую неделю
  if (targetDate >= currentWeekMonday && targetDate <= currentWeekSunday) {
    return 1;
  }
  
  // Проверяем следующую неделю
  if (targetDate >= nextWeekMonday && targetDate <= nextWeekSunday) {
    return 2;
  }
  
  // Дата вне диапазона текущей и следующей недели
  return null;
};

/**
 * Проверить, находится ли дата в текущей неделе
 */
export const isDateInCurrentWeek = (date) => {
  return getWeekNumberForDate(date) === 1;
};

/**
 * Проверить, находится ли дата в следующей неделе
 */
export const isDateInNextWeek = (date) => {
  return getWeekNumberForDate(date) === 2;
};

/**
 * Проверить, находится ли дата в диапазоне текущей или следующей недели
 */
export const isDateInWeekRange = (date) => {
  const weekNumber = getWeekNumberForDate(date);
  return weekNumber === 1 || weekNumber === 2;
};

/**
 * Форматировать диапазон дат недели для отображения
 * @param {number} weekNumber - Номер недели (1 или 2)
 * @returns {string} - Строка вида "21 окт - 27 окт"
 */
export const formatWeekRange = (weekNumber) => {
  let monday, sunday;
  
  if (weekNumber === 1) {
    monday = getCurrentWeekMonday();
    sunday = getCurrentWeekSunday();
  } else if (weekNumber === 2) {
    monday = getNextWeekMonday();
    sunday = getNextWeekSunday();
  } else {
    return '';
  }
  
  const monthNames = [
    'янв', 'фев', 'мар', 'апр', 'май', 'июн',
    'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
  ];
  
  const mondayDay = monday.getDate();
  const mondayMonth = monthNames[monday.getMonth()];
  const sundayDay = sunday.getDate();
  const sundayMonth = monthNames[sunday.getMonth()];
  
  if (monday.getMonth() === sunday.getMonth()) {
    return `${mondayDay} - ${sundayDay} ${sundayMonth}`;
  } else {
    return `${mondayDay} ${mondayMonth} - ${sundayDay} ${sundayMonth}`;
  }
};
