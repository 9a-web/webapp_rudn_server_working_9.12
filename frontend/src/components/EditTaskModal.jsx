import React, { useState, useEffect, useRef } from 'react';
import { X, Edit2, Calendar, Flag, Tag, BookOpen, ListChecks, Plus, Check, Trash2, Play, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, backdropVariants } from '../utils/animations';
import { tasksAPI } from '../services/api';
import { YouTubePreview } from './YouTubePreview';
import { parseTaskText, splitTextByVideoUrl } from '../utils/textUtils';

// Компонент inline video badge (YouTube или VK)
const InlineVideoBadge = ({ title, duration, url, type = 'youtube' }) => {
  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
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
  
  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r ${bgColor} text-white rounded text-[11px] font-medium transition-all shadow-sm hover:shadow align-middle mx-0.5`}
      title={title}
    >
      <Play className="w-2.5 h-2.5 flex-shrink-0 fill-white" />
      <span className="truncate max-w-[150px]">{truncateTitle(title)}</span>
      {duration && (
        <span className={`flex-shrink-0 ${secondaryColor} text-[9px]`}>{duration}</span>
      )}
    </button>
  );
};

// Компонент для inline отображения текста с video badge на месте ссылки
const TextWithVideoBadge = ({ 
  text, 
  originalText, // Оригинальный текст с ссылкой (task.text)
  videoUrl, 
  videoTitle, 
  videoDuration,
  videoType = 'youtube', // 'youtube' или 'vk'
  onChange, 
  disabled,
  placeholder 
}) => {
  const textareaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // Если в фокусе - показываем обычный textarea с чистым текстом (без ссылки)
  if (isFocused) {
    return (
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder-gray-400 text-[#1C1C1E] text-sm sm:text-base"
        rows="3"
        autoFocus
        disabled={disabled}
        maxLength={500}
      />
    );
  }
  
  // Рендерим текст с badge на месте ссылки
  const renderTextWithInlineBadge = () => {
    // Если нет видео данных - просто показываем текст
    if (!videoUrl || !videoTitle) {
      return text || <span className="text-gray-400">{placeholder}</span>;
    }
    
    // Разбиваем оригинальный текст на части (до ссылки, ссылка, после ссылки)
    const { before, url, after } = splitTextByVideoUrl(originalText || '');
    
    // Если ссылка не найдена в оригинальном тексте, показываем текст + badge
    if (!url) {
      if (!text || text.trim() === '') {
        return (
          <InlineVideoBadge 
            title={videoTitle} 
            duration={videoDuration} 
            url={videoUrl}
            type={videoType}
          />
        );
      }
      return (
        <>
          <span>{text}</span>
          {' '}
          <InlineVideoBadge 
            title={videoTitle} 
            duration={videoDuration} 
            url={videoUrl}
            type={videoType}
          />
        </>
      );
    }
    
    // Собираем текст с badge на месте ссылки
    return (
      <>
        {before}
        <InlineVideoBadge 
          title={videoTitle} 
          duration={videoDuration} 
          url={videoUrl}
          type={videoType}
        />
        {after}
      </>
    );
  };
  
  return (
    <div
      onClick={() => !disabled && setIsFocused(true)}
      className="w-full min-h-[80px] px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl cursor-text text-[#1C1C1E] text-sm sm:text-base hover:border-gray-300 transition-colors leading-relaxed"
    >
      {renderTextWithInlineBadge()}
    </div>
  );
};

// Отдельный компонент для каждой перетаскиваемой подзадачи (нужен свой useDragControls)
const DraggableSubtaskItem = ({ subtask, onToggle, onDelete, saving }) => {
  const dragControls = useDragControls();
  
  return (
    <Reorder.Item
      value={subtask}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl group select-none"
      whileDrag={{ scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', backgroundColor: '#ffffff', zIndex: 50 }}
    >
      {/* Drag Handle */}
      <div
        className="cursor-grab active:cursor-grabbing flex-shrink-0 p-1 -ml-1 rounded touch-none"
        onPointerDown={(e) => {
          e.preventDefault();
          dragControls.start(e);
        }}
      >
        <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>

      {/* Checkbox */}
      <button
        onClick={() => onToggle(subtask)}
        disabled={saving}
        className={`
          flex-shrink-0 w-5 h-5 rounded-md border-2 
          flex items-center justify-center transition-all
          touch-manipulation active:scale-95
          ${subtask.completed
            ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-500'
            : 'bg-white border-gray-300 hover:border-blue-400'
          }
          disabled:opacity-50
        `}
      >
        {subtask.completed && (
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        )}
      </button>
      
      {/* Название */}
      <span className={`
        flex-1 text-sm
        ${subtask.completed 
          ? 'line-through text-gray-400' 
          : 'text-[#1C1C1E]'
        }
      `}>
        {subtask.title}
      </span>
      
      {/* Кнопка удаления */}
      <button
        onClick={() => onDelete(subtask.subtask_id)}
        disabled={saving}
        className="flex-shrink-0 p-1 rounded-md
                 text-gray-400 hover:text-red-500 hover:bg-red-50
                 transition-colors touch-manipulation active:scale-95
                 opacity-0 group-hover:opacity-100 disabled:opacity-50"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </Reorder.Item>
  );
};

export const EditTaskModal = ({ 
  isOpen, 
  onClose, 
  onEditTask,
  onTaskUpdated, // Callback для обновления задачи в родителе
  task, // Существующая задача для редактирования
  hapticFeedback,
  scheduleSubjects = []
}) => {
  const [taskText, setTaskText] = useState('');
  const [category, setCategory] = useState(null);
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [subject, setSubject] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  
  // Подзадачи
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  
  const modalRef = useRef(null);
  
  // Заполняем поля при открытии модального окна
  useEffect(() => {
    if (isOpen && task) {
      // Если есть видео превью, убираем ссылку из текста для чистоты
      const { displayText } = parseTaskText(task.text || '', {
        youtube_url: task.youtube_url,
        youtube_title: task.youtube_title,
        vk_url: task.vk_url,
        vk_title: task.vk_title
      });
      setTaskText(displayText);
      setCategory(task.category || null);
      setPriority(task.priority || 'medium');
      setSubject(task.subject || '');
      setSubtasks(task.subtasks || []);
      
      // Форматируем дедлайн для datetime-local input
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        const formattedDeadline = deadlineDate.toISOString().slice(0, 16);
        setDeadline(formattedDeadline);
      } else {
        setDeadline('');
      }
    }
  }, [isOpen, task]);
  
  // Обработчики подзадач
  const handleAddSubtask = async () => {
    const trimmedTitle = newSubtaskTitle.trim();
    if (!trimmedTitle || !task) return;
    
    try {
      setAddingSubtask(true);
      hapticFeedback && hapticFeedback('impact', 'light');
      
      const updatedTask = await tasksAPI.addSubtask(task.id, trimmedTitle);
      setSubtasks(updatedTask.subtasks || []);
      setNewSubtaskTitle('');
      
      // Обновляем задачу в родителе
      if (onTaskUpdated) {
        onTaskUpdated(updatedTask);
      }
      
      hapticFeedback && hapticFeedback('notification', 'success');
    } catch (error) {
      console.error('Error adding subtask:', error);
      hapticFeedback && hapticFeedback('notification', 'error');
    } finally {
      setAddingSubtask(false);
    }
  };
  
  const handleToggleSubtask = async (subtask) => {
    if (!task) return;
    
    try {
      hapticFeedback && hapticFeedback('selection');
      
      const updatedTask = await tasksAPI.updateSubtask(task.id, subtask.subtask_id, {
        completed: !subtask.completed
      });
      setSubtasks(updatedTask.subtasks || []);
      
      // Обновляем задачу в родителе
      if (onTaskUpdated) {
        onTaskUpdated(updatedTask);
      }
    } catch (error) {
      console.error('Error toggling subtask:', error);
    }
  };
  
  const handleDeleteSubtask = async (subtaskId) => {
    if (!task) return;
    
    try {
      hapticFeedback && hapticFeedback('impact', 'medium');
      
      const updatedTask = await tasksAPI.deleteSubtask(task.id, subtaskId);
      setSubtasks(updatedTask.subtasks || []);
      
      // Обновляем задачу в родителе
      if (onTaskUpdated) {
        onTaskUpdated(updatedTask);
      }
      
      hapticFeedback && hapticFeedback('notification', 'success');
    } catch (error) {
      console.error('Error deleting subtask:', error);
    }
  };
  
  const handleSubtaskKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtask();
    }
  };

  const handleReorderSubtasks = async (newOrder) => {
    setSubtasks(newOrder);
    try {
      const subtaskIds = newOrder.map(s => s.subtask_id);
      await tasksAPI.reorderSubtasks(task.id, subtaskIds);
    } catch (error) {
      console.error('Error reordering subtasks:', error);
    }
  };
  
  // Вычисление прогресса подзадач
  const subtasksProgress = subtasks.length > 0 
    ? Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)
    : 0;
  
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
    
    if (!taskText.trim() || !task) return;
    
    try {
      setSaving(true);
      hapticFeedback && hapticFeedback('impact', 'medium');
      
      // Создаем объект с обновлениями
      const updates = {
        text: taskText.trim(),
        category: category,
        priority: priority,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        subject: subject || null,
        // Сохраняем YouTube данные
        youtube_url: task.youtube_url || null,
        youtube_title: task.youtube_title || null,
        youtube_duration: task.youtube_duration || null,
        youtube_thumbnail: task.youtube_thumbnail || null,
        // Сохраняем VK Video данные
        vk_video_url: task.vk_video_url || null,
        vk_video_title: task.vk_video_title || null,
        vk_video_duration: task.vk_video_duration || null,
        vk_video_thumbnail: task.vk_video_thumbnail || null,
      };
      
      await onEditTask(task.id, updates);
      
      onClose();
    } catch (error) {
      console.error('Error editing task:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    hapticFeedback && hapticFeedback('impact', 'light');
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

  if (!isOpen || !task) return null;

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
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#1C1C1E]">Редактировать задачу</h2>
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
                {/* Поле с inline video badge на месте ссылки */}
                <TextWithVideoBadge
                  text={taskText}
                  originalText={task.text}
                  videoUrl={task.youtube_url || task.vk_url}
                  videoTitle={task.youtube_title || task.vk_title}
                  videoDuration={task.youtube_duration || task.vk_duration}
                  videoType={task.vk_url ? 'vk' : 'youtube'}
                  onChange={setTaskText}
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
                  className="w-full px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-[#1C1C1E] text-sm sm:text-base disabled:opacity-50"
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
                    className="w-full px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-[#1C1C1E] text-sm sm:text-base disabled:opacity-50"
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

              {/* Подзадачи (чек-лист) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs sm:text-sm font-medium text-[#1C1C1E] flex items-center gap-1.5 sm:gap-2">
                    <ListChecks className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Подзадачи
                  </label>
                  {subtasks.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {subtasks.filter(s => s.completed).length} / {subtasks.length}
                    </span>
                  )}
                </div>
                
                {/* Прогресс-бар */}
                {subtasks.length > 0 && (
                  <div className="mb-3">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${subtasksProgress}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className={`h-full rounded-full ${
                          subtasksProgress === 100
                            ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                            : 'bg-gradient-to-r from-blue-400 to-blue-500'
                        }`}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 text-right">{subtasksProgress}% выполнено</p>
                  </div>
                )}
                
                {/* Список подзадач с drag & drop */}
                {subtasks.length > 0 && (
                  <Reorder.Group
                    axis="y"
                    values={subtasks}
                    onReorder={handleReorderSubtasks}
                    className="space-y-2 mb-3 max-h-48 overflow-y-auto"
                  >
                    {subtasks.map((subtask) => (
                      <DraggableSubtaskItem
                        key={subtask.subtask_id}
                        subtask={subtask}
                        onToggle={handleToggleSubtask}
                        onDelete={handleDeleteSubtask}
                        saving={saving}
                      />
                    ))}
                  </Reorder.Group>
                )}
                
                {/* Поле добавления новой подзадачи */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2
                               bg-gray-50 border border-gray-200 rounded-xl
                               focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100
                               transition-all">
                    <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={handleSubtaskKeyDown}
                      placeholder="Добавить подзадачу..."
                      maxLength={100}
                      disabled={addingSubtask || saving}
                      className="flex-1 bg-transparent text-[#1C1C1E] text-sm
                               placeholder-gray-400 focus:outline-none
                               disabled:opacity-50"
                    />
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim() || addingSubtask || saving}
                    className="p-2.5 rounded-xl
                             bg-gradient-to-r from-blue-400 to-blue-500
                             text-white disabled:opacity-30 disabled:cursor-not-allowed
                             hover:from-blue-500 hover:to-blue-600
                             active:scale-95 transition-all touch-manipulation"
                  >
                    {addingSubtask ? (
                      <motion.div 
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </motion.button>
                </div>
                
                {subtasks.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    Добавьте подзадачи для отслеживания прогресса
                  </p>
                )}
              </div>

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
                    ? 'bg-gradient-to-r from-blue-400 to-blue-500 active:from-blue-500 active:to-blue-600 text-white shadow-lg shadow-blue-500/30'
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
                  'Сохранить изменения'
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
