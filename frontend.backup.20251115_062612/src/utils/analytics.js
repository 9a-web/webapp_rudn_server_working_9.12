/**
 * Утилиты для расчета учебной аналитики
 */

/**
 * Рассчитывает статистику по расписанию
 * @param {Array} schedule - Массив занятий
 * @returns {Object} Статистика
 */
export const calculateScheduleStats = (schedule) => {
  if (!schedule || schedule.length === 0) {
    return {
      totalClasses: 0,
      totalHours: 0,
      averageClassesPerDay: 0,
      busyDays: 0,
    };
  }

  // Подсчет уникальных пар (группируем по ДНЮ + ВРЕМЕНИ)
  // Одно и то же время в разные дни = разные пары
  const uniqueTimeSlots = new Set();
  schedule.forEach(classItem => {
    if (classItem.time && classItem.day) {
      // Создаём уникальный ключ: день + время
      uniqueTimeSlots.add(`${classItem.day}|${classItem.time}`);
    }
  });
  
  const totalClasses = uniqueTimeSlots.size;

  // Подсчет общего количества часов (каждая пара = 1.5 часа)
  const totalHours = totalClasses * 1.5;

  // Группировка по дням с подсчетом уникальных временных слотов В КАЖДОМ ДНЕ
  const classesByDay = schedule.reduce((acc, classItem) => {
    const day = classItem.day || 'unknown';
    if (!acc[day]) {
      acc[day] = {
        items: [],
        uniqueTimes: new Set()
      };
    }
    acc[day].items.push(classItem);
    if (classItem.time) {
      // Теперь правильно считаем уникальные времена внутри каждого дня
      acc[day].uniqueTimes.add(classItem.time);
    }
    return acc;
  }, {});

  // Преобразуем в массивы для обратной совместимости
  const classesByDayArray = {};
  Object.keys(classesByDay).forEach(day => {
    // Создаем массив с количеством элементов = количество уникальных временных слотов в этом дне
    classesByDayArray[day] = Array.from(classesByDay[day].uniqueTimes).map(time => {
      // Берем первый предмет с этим временем для отображения
      return classesByDay[day].items.find(item => item.time === time);
    });
  });

  // Количество дней с занятиями
  const busyDays = Object.keys(classesByDayArray).length;

  // Среднее количество пар в день
  const averageClassesPerDay = busyDays > 0 ? (totalClasses / busyDays).toFixed(1) : 0;

  return {
    totalClasses,
    totalHours,
    averageClassesPerDay: parseFloat(averageClassesPerDay),
    busyDays,
    classesByDay: classesByDayArray,
  };
};

/**
 * Находит самый загруженный день
 * @param {Object} classesByDay - Занятия сгруппированные по дням
 * @returns {Object} Информация о самом загруженном дне
 */
export const findBusiestDay = (classesByDay) => {
  if (!classesByDay || Object.keys(classesByDay).length === 0) {
    return null;
  }

  let maxClasses = 0;
  let busiestDay = null;

  Object.entries(classesByDay).forEach(([day, classes]) => {
    if (classes.length > maxClasses) {
      maxClasses = classes.length;
      busiestDay = day;
    }
  });

  return {
    day: busiestDay,
    classCount: maxClasses,
  };
};

/**
 * Находит самый свободный день (с занятиями)
 * @param {Object} classesByDay - Занятия сгруппированные по дням
 * @returns {Object} Информация о самом свободном дне
 */
export const findLightestDay = (classesByDay) => {
  if (!classesByDay || Object.keys(classesByDay).length === 0) {
    return null;
  }

  let minClasses = Infinity;
  let lightestDay = null;

  Object.entries(classesByDay).forEach(([day, classes]) => {
    if (classes.length < minClasses) {
      minClasses = classes.length;
      lightestDay = day;
    }
  });

  return {
    day: lightestDay,
    classCount: minClasses,
  };
};

/**
 * Рассчитывает загруженность по дням недели (для графика)
 * @param {Object} classesByDay - Занятия сгруппированные по дням
 * @returns {Array} Данные для графика
 */
export const getWeekLoadChart = (classesByDay) => {
  const daysOrder = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
  const shortDays = {
    'Понедельник': 'Пн',
    'Вторник': 'Вт',
    'Среда': 'Ср',
    'Четверг': 'Чт',
    'Пятница': 'Пт',
    'Суббота': 'Сб',
    'Воскресенье': 'Вс'
  };
  
  return daysOrder.map(day => ({
    day: day,
    shortDay: shortDays[day],
    classes: classesByDay[day]?.length || 0,
    hours: (classesByDay[day]?.length || 0) * 1.5,
  }));
};

/**
 * Рассчитывает статистику по типам занятий
 * @param {Array} schedule - Массив занятий
 * @returns {Object} Статистика по типам
 */
export const getClassTypeStats = (schedule) => {
  if (!schedule || schedule.length === 0) {
    return {};
  }

  // Сначала получаем уникальные пары (день + время)
  const uniqueClasses = new Map();
  schedule.forEach(classItem => {
    if (classItem.time && classItem.day) {
      const uniqueKey = `${classItem.day}|${classItem.time}`;
      // Сохраняем только первое вхождение каждой уникальной пары
      if (!uniqueClasses.has(uniqueKey)) {
        uniqueClasses.set(uniqueKey, classItem);
      }
    }
  });

  // Теперь считаем типы по уникальным парам
  const typeStats = {};
  uniqueClasses.forEach((classItem) => {
    const type = classItem.lessonType || classItem.type || 'Не указано';
    if (!typeStats[type]) {
      typeStats[type] = 0;
    }
    typeStats[type]++;
  });

  return typeStats;
};

/**
 * Рассчитывает процент занятости дня
 * @param {number} classCount - Количество пар в день
 * @returns {number} Процент (0-100)
 */
export const calculateDayBusyPercentage = (classCount) => {
  // Максимум 8 пар в день (условно)
  const maxClassesPerDay = 8;
  return Math.min(100, Math.round((classCount / maxClassesPerDay) * 100));
};

/**
 * Форматирует время в читаемый формат
 * @param {number} hours - Количество часов
 * @returns {string} Форматированное время
 */
export const formatHours = (hours) => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} мин`;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours} ч`;
  }
  return `${wholeHours} ч ${minutes} мин`;
};
