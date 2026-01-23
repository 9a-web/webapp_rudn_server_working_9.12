import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Calendar, Flag, Tag, BookOpen, ChevronDown, Play, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, backdropVariants } from '../utils/animations';
import { extractVideoUrl, splitTextByVideoUrl } from '../utils/textUtils';
import { scheduleAPI } from '../services/api';

// Inline Video badge для поля ввода (YouTube или VK)
const InlineVideoBadge = ({ title, duration, url, type = 'youtube', onRemove }) => {
  const handleClick = (e) => {
    e.stopPropagation();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };
  
  const truncateTitle = (text, maxLength = 25) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  };
  
  // Разные цвета для YouTube (красный) и VK (синий)
  const bgColor = type === 'vk' 
    ? 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' 
    : 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700';
  const secondaryColor = type === 'vk' ? 'text-blue-200' : 'text-red-200';
  const hoverBg = type === 'vk' ? 'hover:bg-blue-700' : 'hover:bg-red-700';
  
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r ${bgColor} text-white rounded text-[11px] font-medium align-middle mx-0.5 group`}>
      <Play className="w-2.5 h-2.5 flex-shrink-0 fill-white cursor-pointer" onClick={handleClick} />
      <span className="truncate max-w-[150px] cursor-pointer" onClick={handleClick} title={title}>
        {truncateTitle(title)}
      </span>
      {duration && (
        <span className={`flex-shrink-0 ${secondaryColor} text-[9px]`}>{duration}</span>
      )}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className={`ml-0.5 w-3 h-3 flex items-center justify-center ${hoverBg} rounded-full transition-colors`}
          title="Удалить видео"
        >
          <X className="w-2 h-2" />
        </button>
      )}
    </span>
  );
};

// Компонент поля ввода с inline video badge (YouTube или VK)
const TaskInputWithVideo = ({ 
  value, 
  onChange, 
  videoData, 
  onVideoDetected,
  onVideoRemove,
  isLoadingVideo,
  disabled, 
  placeholder 
}) => {
  const textareaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // Обработка изменения текста
  const handleChange = (e) => {
    const newText = e.target.value;
    onChange(newText);
    
    // Проверяем наличие видео ссылки (YouTube или VK)
    const videoUrl = extractVideoUrl(newText);
    if (videoUrl && !videoData) {
      onVideoDetected(videoUrl);
    }
  };
  
  // Если в фокусе или нет видео данных - показываем обычный textarea
  if (isFocused || !videoData) {
    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none placeholder-gray-400 text-[#1C1C1E] text-sm sm:text-base"
          rows="3"
          autoFocus
          disabled={disabled}
          maxLength={500}
        />
        {isLoadingVideo && (
          <div className="absolute right-3 top-3 flex items-center gap-1 text-xs text-gray-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Загрузка видео...</span>
          </div>
        )}
      </div>
    );
  }
  
  // Режим отображения с badge
  const { before, url, after } = splitTextByVideoUrl(value || '');
  
  return (
    <div
      onClick={() => !disabled && setIsFocused(true)}
      className="w-full min-h-[80px] px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl cursor-text text-[#1C1C1E] text-sm sm:text-base hover:border-gray-300 transition-colors leading-relaxed"
    >
      {url ? (
        // Есть ссылка в тексте - вставляем badge на её место
        <>
          {before}
          <InlineVideoBadge 
            title={videoData.title} 
            duration={videoData.duration} 
            url={videoData.url}
            type={videoData.type}
            onRemove={onVideoRemove}
          />
          {after}
        </>
      ) : (
        // Ссылки в тексте нет, показываем только badge
        <InlineVideoBadge 
          title={videoData.title} 
          duration={videoData.duration} 
          url={videoData.url}
          type={videoData.type}
          onRemove={onVideoRemove}
        />
      )}
    </div>
  );
};

export const AddTaskModal = ({ 
  isOpen, 
  onClose, 
  onAddTask, 
  hapticFeedback,
  scheduleSubjects = [], // Список предметов из расписания
  selectedDate, // Выбранная дата из селектора
  quickTemplate = null // Данные быстрого шаблона для предзаполнения
}) => {
  const [taskText, setTaskText] = useState('');
  const [category, setCategory] = useState(null);
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState(''); // По умолчанию пустое значение (нет дедлайна)
  const [subject, setSubject] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  
  // Видео данные (YouTube или VK)
  const [videoData, setVideoData] = useState(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  
  const modalRef = useRef(null);
  
  // Блокируем скролл страницы при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);
  
  // При открытии модального окна дедлайн остается пустым (пользователь сам решает, нужен ли срок)
  useEffect(() => {
    if (isOpen) {
      // Сбрасываем дедлайн при открытии модального окна
      setDeadline('');
      setVideoData(null);
    }
  }, [isOpen]);
  
  // Предзаполнение данных из быстрого шаблона
  useEffect(() => {
    if (isOpen && quickTemplate) {
      // Заполняем поля из шаблона
      setTaskText(quickTemplate.text || '');
      setCategory(quickTemplate.category || null);
      setPriority(quickTemplate.priority || 'medium');
      // Дедлайн и предмет оставляем пустыми - пользователь может заполнить сам
    } else if (isOpen && !quickTemplate) {
      // Если нет шаблона, сбрасываем в значения по умолчанию
      setTaskText('');
      setCategory(null);
      setPriority('medium');
      setVideoData(null);
    }
  }, [isOpen, quickTemplate]);
  
  // Обработка обнаружения видео ссылки (YouTube или VK)
  const handleVideoDetected = useCallback(async (videoInfo) => {
    if (isLoadingVideo || videoData) return;
    
    const { url, type } = videoInfo;
    
    setIsLoadingVideo(true);
    try {
      // Получаем информацию о видео в зависимости от типа
      let response;
      if (type === 'vk') {
        response = await scheduleAPI.getVKVideoInfo(url);
      } else {
        response = await scheduleAPI.getYouTubeInfo(url);
      }
      
      if (response) {
        setVideoData({
          url: response.url || url,
          title: response.title,
          duration: response.duration,
          thumbnail: response.thumbnail,
          video_id: response.video_id,
          type: type // 'youtube' или 'vk'
        });
        hapticFeedback && hapticFeedback('success');
      }
    } catch (error) {
      console.error('Error fetching video info:', error);
      // Если не удалось получить инфо, оставляем как есть
    } finally {
      setIsLoadingVideo(false);
    }
  }, [isLoadingVideo, videoData, hapticFeedback]);
  
  // Удаление видео данных
  const handleVideoRemove = useCallback(() => {
    // Убираем видео ссылку из текста
    const { before, after } = splitTextByVideoUrl(taskText);
    setTaskText((before + after).trim());
    setVideoData(null);
    hapticFeedback && hapticFeedback('impact', 'light');
  }, [taskText, hapticFeedback]);
  
  // Категории задач
  const categories = [
    { id: 'study', label: 'Учеба', emoji: '📚', color: 'from-blue-400 to-blue-500' },
    { id: 'personal', label: 'Личное', emoji: '🏠', color: 'from-green-400 to-green-500' },
    { id: 'sport', label: 'Спорт', emoji: '🏃', color: 'from-red-400 to-red-500' },
    { id: 'project', label: 'Проекты', emoji: '💼', color: 'from-purple-400 to-purple-500' },
  ];
  
  // Приоритеты
  const priorities = [
    { id: 'low', label: 'Низкий', color: 'bg-green-100 text-green-700 border-green-200' },
    { id: 'medium', label: 'Средний', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    { id: 'high', label: 'Высокий', color: 'bg-red-100 text-red-700 border-red-200' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!taskText.trim() && !videoData) return;
    
    try {
      setSaving(true);
      hapticFeedback && hapticFeedback('impact', 'medium');
      
      // Создаем объект задачи с дополнительными полями
      // Для target_date форматируем дату без конвертации в UTC
      let targetDateISO = null;
      if (selectedDate) {
        const targetDate = new Date(selectedDate);
        // Форматируем дату в формате YYYY-MM-DD без времени
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        targetDateISO = `${year}-${month}-${day}T00:00:00`;
      }
      
      const taskData = {
        text: taskText.trim(),
        category: category,
        priority: priority,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        // target_date - дата, к которой привязана задача (всегда устанавливаем, если selectedDate передан)
        target_date: targetDateISO,
        subject: subject || null,
        // YouTube данные
        youtube_url: videoData?.type === 'youtube' ? videoData?.url : null,
        youtube_title: videoData?.type === 'youtube' ? videoData?.title : null,
        youtube_duration: videoData?.type === 'youtube' ? videoData?.duration : null,
        youtube_thumbnail: videoData?.type === 'youtube' ? videoData?.thumbnail : null,
        // VK Video данные
        vk_video_url: videoData?.type === 'vk' ? videoData?.url : null,
        vk_video_title: videoData?.type === 'vk' ? videoData?.title : null,
        vk_video_duration: videoData?.type === 'vk' ? videoData?.duration : null,
        vk_video_thumbnail: videoData?.type === 'vk' ? videoData?.thumbnail : null,
      };
      
      await onAddTask(taskData);
      
      // Очищаем все поля и закрываем модальное окно
      setTaskText('');
      setCategory(null);
      setPriority('medium');
      setDeadline('');
      setSubject('');
      setVideoData(null);
      onClose();
    } catch (error) {
      console.error('Error adding task:', error);
      // Показываем понятное сообщение об ошибке
      const errorMessage = error?.message || error?.toString() || 'Неизвестная ошибка при создании задачи';
      alert(`Ошибка при создании задачи: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return; // Не закрываем во время сохранения
    hapticFeedback && hapticFeedback('impact', 'light');
    setTaskText('');
    setCategory(null);
    setPriority('medium');
    setDeadline('');
    setSubject('');
    setVideoData(null);
    setDragY(0);
    onClose();
  };
  
  // Обработка свайпа вниз для закрытия
  const handleDragEnd = (event, info) => {
    if (info.offset.y > 100) {
      handleClose();
    } else {
      setDragY(0);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center"
        initial="initial"
        animate="animate"
        exit="exit"
        variants={backdropVariants}
        onClick={handleClose}
      >
        <motion.div 
          ref={modalRef}
          className="bg-white w-full max-w-lg shadow-2xl relative z-[10000] overflow-hidden
                     rounded-t-[32px] sm:rounded-3xl
                     max-h-[92vh] sm:max-h-[85vh]
                     flex flex-col"
          initial={{ y: "100%" }}
          animate={{ y: dragY }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={handleDragEnd}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag indicator (для мобильных) */}
          <div className="sm:hidden flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header - фиксированный */}
          <div className="flex-shrink-0 px-4 sm:px-6 pt-3 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#1C1C1E]">Новая задача</h2>
              </div>
              <button
                onClick={handleClose}
                disabled={saving}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Form - прокручиваемый контент */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 px-4 sm:px-6 py-4 sm:py-5">
              {/* Описание задачи */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-[#1C1C1E] mb-2">
                  Описание задачи
                </label>
                <TaskInputWithVideo
                  value={taskText}
                  onChange={setTaskText}
                  videoData={videoData}
                  onVideoDetected={handleVideoDetected}
                  onVideoRemove={handleVideoRemove}
                  isLoadingVideo={isLoadingVideo}
                  disabled={saving}
                  placeholder="Например: Купить продукты, Подготовиться к экзамену..."
                />
                <p className="text-[10px] sm:text-xs text-gray-400 mt-1 text-right">
                  {taskText.length} / 500
                </p>
              </div>

              {/* Категория */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-[#1C1C1E] mb-2 flex items-center gap-1.5 sm:gap-2">
                  <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Категория
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <motion.button
                      key={cat.id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setCategory(category === cat.id ? null : cat.id);
                        hapticFeedback && hapticFeedback('selection');
                      }}
                      disabled={saving}
                      className={`
                        px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl border-2 transition-all text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 justify-center touch-manipulation
                        ${category === cat.id
                          ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-md`
                          : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50'
                        }
                        disabled:opacity-50
                      `}
                    >
                      <span className="text-sm sm:text-base">{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Приоритет */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-[#1C1C1E] mb-2 flex items-center gap-1.5 sm:gap-2">
                  <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Приоритет
                </label>
                <div className="flex gap-1.5 sm:gap-2">
                  {priorities.map((prior) => (
                    <motion.button
                      key={prior.id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setPriority(prior.id);
                        hapticFeedback && hapticFeedback('selection');
                      }}
                      disabled={saving}
                      className={`
                        flex-1 px-2 py-2 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl border-2 transition-all text-xs sm:text-sm font-medium touch-manipulation
                        ${priority === prior.id
                          ? `${prior.color} border-transparent`
                          : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50'
                        }
                        disabled:opacity-50
                      `}
                    >
                      {prior.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Дедлайн */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-[#1C1C1E] mb-2 flex items-center gap-1.5 sm:gap-2">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Дедлайн
                </label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-[#1C1C1E] text-sm sm:text-base disabled:opacity-50"
                />
              </div>

              {/* Привязка к предмету */}
              {scheduleSubjects.length > 0 && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-[#1C1C1E] mb-2 flex items-center gap-1.5 sm:gap-2">
                    <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Предмет из расписания
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={saving}
                    className="w-full px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-[#1C1C1E] text-sm sm:text-base disabled:opacity-50"
                  >
                    <option value="">Без привязки</option>
                    {scheduleSubjects.map((subj, idx) => (
                      <option key={idx} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            </form>
          </div>

          {/* Footer с кнопками - фиксированный */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-white">
            <div className="flex gap-2 sm:gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={handleClose}
                disabled={saving}
                className="flex-1 px-4 py-2.5 sm:px-6 sm:py-3 bg-gray-100 active:bg-gray-200 text-gray-700 rounded-xl sm:rounded-2xl font-medium text-sm sm:text-base transition-colors disabled:opacity-50 touch-manipulation"
              >
                Отмена
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
                disabled={!taskText.trim() || saving}
                className={`
                  flex-1 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl font-medium text-sm sm:text-base transition-all touch-manipulation
                  ${taskText.trim() && !saving
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-400 active:from-yellow-500 active:to-orange-500 text-white shadow-lg shadow-yellow-500/30'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div 
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    Сохранение...
                  </span>
                ) : (
                  'Добавить задачу'
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
