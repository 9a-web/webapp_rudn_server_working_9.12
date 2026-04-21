/**
 * Subject name translations
 * Maps Russian discipline names to English
 */

export const subjectTranslations = {
  // Languages
  "Русский язык для иностранных студентов": "Russian Language for Foreign Students",
  "Русский язык": "Russian Language",
  "Иностранный язык": "Foreign Language",
  "Английский язык": "English Language",
  "Немецкий язык": "German Language",
  "Французский язык": "French Language",
  "Испанский язык": "Spanish Language",
  "Китайский язык": "Chinese Language",
  
  // Mathematics and Natural Sciences
  "Высшая математика": "Higher Mathematics",
  "Математика": "Mathematics",
  "Математический анализ": "Mathematical Analysis",
  "Линейная алгебра": "Linear Algebra",
  "Аналитическая геометрия": "Analytic Geometry",
  "Дискретная математика": "Discrete Mathematics",
  "Теория вероятностей": "Probability Theory",
  "Математическая статистика": "Mathematical Statistics",
  "Физика": "Physics",
  "Химия": "Chemistry",
  "Биология": "Biology",
  "Экология": "Ecology",
  
  // Computer Science
  "Информатика": "Computer Science",
  "Программирование": "Programming",
  "Основы программирования": "Programming Fundamentals",
  "Алгоритмы и структуры данных": "Algorithms and Data Structures",
  "Базы данных": "Databases",
  "Операционные системы": "Operating Systems",
  "Компьютерные сети": "Computer Networks",
  "Веб-программирование": "Web Programming",
  "Искусственный интеллект": "Artificial Intelligence",
  "Машинное обучение": "Machine Learning",
  
  // Engineering
  "Инженерная графика": "Engineering Graphics",
  "Начертательная геометрия": "Descriptive Geometry",
  "Теоретическая механика": "Theoretical Mechanics",
  "Сопротивление материалов": "Strength of Materials",
  "Электротехника": "Electrical Engineering",
  "Электроника": "Electronics",
  
  // Social Sciences and Humanities
  "История": "History",
  "История России": "History of Russia",
  "Философия": "Philosophy",
  "Культурология": "Cultural Studies",
  "Социология": "Sociology",
  "Психология": "Psychology",
  "Политология": "Political Science",
  "Правоведение": "Jurisprudence",
  "Экономика": "Economics",
  "Микроэкономика": "Microeconomics",
  "Макроэкономика": "Macroeconomics",
  "Менеджмент": "Management",
  "Маркетинг": "Marketing",
  "Финансы": "Finance",
  "Бухгалтерский учет": "Accounting",
  
  // Military and Safety
  "Основы военной подготовки. Безопасность жизнедеятельности": "Military Training Basics. Life Safety",
  "Безопасность жизнедеятельности": "Life Safety",
  "Основы военной подготовки": "Military Training Basics",
  "Гражданская оборона": "Civil Defense",
  
  // Physical Education
  "Физическая культура": "Physical Education",
  "Физическая культура и спорт": "Physical Education and Sports",
  
  // Law
  "Гражданское право": "Civil Law",
  "Уголовное право": "Criminal Law",
  "Конституционное право": "Constitutional Law",
  "Административное право": "Administrative Law",
  "Международное право": "International Law",
  
  // Medicine
  "Анатомия": "Anatomy",
  "Физиология": "Physiology",
  "Биохимия": "Biochemistry",
  "Патология": "Pathology",
  "Фармакология": "Pharmacology",
  
  // Economics and Business
  "Бизнес-планирование": "Business Planning",
  "Предпринимательство": "Entrepreneurship",
  "Управление проектами": "Project Management",
  "Логистика": "Logistics",
  
  // Architecture and Design
  "Архитектура": "Architecture",
  "Градостроительство": "Urban Planning",
  "Дизайн": "Design",
  "Композиция": "Composition",
  
  // Agriculture
  "Агрономия": "Agronomy",
  "Ветеринария": "Veterinary Medicine",
  "Зоотехния": "Animal Science",
  "Агрохимия": "Agricultural Chemistry",
  
  // Philology
  "Литература": "Literature",
  "Русская литература": "Russian Literature",
  "Зарубежная литература": "Foreign Literature",
  "Лингвистика": "Linguistics",
  "Стилистика": "Stylistics",
  "Риторика": "Rhetoric",
  
  // Other common subjects
  "Введение в профессию": "Introduction to the Profession",
  "Методология научных исследований": "Research Methodology",
  "Практика": "Practical Training",
  "Курсовая работа": "Course Work",
  "Дипломная работа": "Thesis Work"
};

/**
 * Translates a discipline name from Russian to English
 * @param {string} disciplineName - Russian discipline name
 * @param {string} language - Current language ('ru' or 'en')
 * @returns {string} - Translated discipline name or original if translation not found
 */
export const translateDiscipline = (disciplineName, language) => {
  if (!disciplineName) return '';
  
  // If language is Russian, return original
  if (language === 'ru') return disciplineName;
  
  // Try exact match first
  if (subjectTranslations[disciplineName]) {
    return subjectTranslations[disciplineName];
  }
  
  // Try partial match (if discipline name contains known subject)
  for (const [russian, english] of Object.entries(subjectTranslations)) {
    if (disciplineName.includes(russian)) {
      // Replace the matched part with English translation
      return disciplineName.replace(russian, english);
    }
  }
  
  // If no translation found, return original with note
  return disciplineName;
};

/**
 * Translates lesson type
 */
export const lessonTypeTranslations = {
  "Лекция": "Lecture",
  "Практика": "Practice",
  "Семинар": "Seminar",
  "Лабораторная работа": "Laboratory Work",
  "Консультация": "Consultation",
  "Зачет": "Credit",
  "Экзамен": "Exam",
  "Курсовая работа": "Course Work",
  "Практические и другие": "Practice and Other",
  "Лекционные": "Lectures"
};

export const translateLessonType = (lessonType, language) => {
  if (!lessonType || language === 'ru') return lessonType;
  return lessonTypeTranslations[lessonType] || lessonType;
};
