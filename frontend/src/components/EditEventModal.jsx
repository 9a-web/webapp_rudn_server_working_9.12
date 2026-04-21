import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Calendar, Trash2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, backdropVariants } from '../utils/animations';

export const EditEventModal = ({ 
  isOpen, 
  onClose, 
  onUpdateEvent,
  onDeleteEvent,
  onCopyEvent,
  hapticFeedback,
  event, // Событие для редактирования
}) => {
  const [eventText, setEventText] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [category, setCategory] = useState('personal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [timeError, setTimeError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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
  
  // Заполняем поля при открытии
  useEffect(() => {
    if (isOpen && event) {
      setEventText(event.text || '');
      setTimeStart(event.time_start || '');
      setTimeEnd(event.time_end || '');
      setCategory(event.category || 'personal');
      setNotes(event.notes || '');
      setTimeError('');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, event]);
  
  // Категории событий
  const categories = [
    { id: 'study', label: 'Учеба', emoji: '📚', color: 'from-blue-400 to-blue-500' },
    { id: 'personal', label: 'Личное', emoji: '🏠', color: 'from-green-400 to-green-500' },
    { id: 'sport', label: 'Спорт', emoji: '🏃', color: 'from-red-400 to-red-500' },
    { id: 'work', label: 'Работа', emoji: '💼', color: 'from-purple-400 to-purple-500' },
    { id: 'meeting', label: 'Встреча', emoji: '👥', color: 'from-orange-400 to-orange-500' },
  ];
  
  // Валидация времени
  const validateTime = (start, end) => {
    if (!start || !end) return true;
    
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    if (endMinutes <= startMinutes) {
      setTimeError('Время окончания должно быть позже времени начала');
      return false;
    }
    
    setTimeError('');
    return true;
  };
  
  const handleTimeStartChange = (value) => {
    setTimeStart(value);
    if (timeEnd) {
      validateTime(value, timeEnd);
    }
  };
  
  const handleTimeEndChange = (value) => {
    setTimeEnd(value);
    if (timeStart) {
      validateTime(timeStart, value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!eventText.trim()) {
      alert('Введите название события');
      return;
    }
    
    if (!timeStart || !timeEnd) {
      alert('Укажите время начала и окончания');
      return;
    }
    
    if (!validateTime(timeStart, timeEnd)) {
      return;
    }
    
    try {
      setSaving(true);
      hapticFeedback && hapticFeedback('impact', 'medium');
      
      const updateData = {
        text: eventText.trim(),
        time_start: timeStart,
        time_end: timeEnd,
        category: category,
        notes: notes || null,
      };
      
      await onUpdateEvent(event.id, updateData);
      onClose();
    } catch (error) {
      console.error('Error updating event:', error);
      alert(`Ошибка при обновлении события: ${error?.message || 'Неизвестная ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      hapticFeedback && hapticFeedback('impact', 'heavy');
      
      await onDeleteEvent(event.id);
      onClose();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert(`Ошибка при удалении: ${error?.message || 'Неизвестная ошибка'}`);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCopy = () => {
    hapticFeedback && hapticFeedback('impact', 'light');
    onCopyEvent && onCopyEvent(event);
  };

  const handleClose = () => {
    if (saving || deleting) return;
    hapticFeedback && hapticFeedback('impact', 'light');
    setDragY(0);
    setShowDeleteConfirm(false);
    onClose();
  };
  
  const handleDragEnd = (event, info) => {
    if (info.offset.y > 100) {
      handleClose();
    } else {
      setDragY(0);
    }
  };

  // Проверка - можно ли редактировать (пары из расписания нельзя)
  const isScheduleEvent = event?.origin === 'schedule';

  if (!isOpen || !event) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-end sm:items-center sm:justify-center"
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        onClick={handleClose}
      >
        <motion.div
          ref={modalRef}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-t-[2rem] sm:rounded-[2rem] w-full sm:w-[500px] sm:max-h-[90vh] overflow-hidden shadow-2xl border border-slate-700/50"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={(e) => e.stopPropagation()}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={handleDragEnd}
          onDrag={(e, info) => setDragY(info.offset.y)}
          style={{ y: dragY > 0 ? dragY : 0 }}
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-slate-600/50 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 pb-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isScheduleEvent 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                  : 'bg-gradient-to-br from-purple-500 to-pink-500'
              }`}>
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {isScheduleEvent ? 'Просмотр пары' : 'Редактирование'}
                </h2>
                <p className="text-sm text-slate-400">
                  {isScheduleEvent ? 'Пара из расписания' : 'Измените данные события'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              disabled={saving || deleting}
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Confirm Delete Dialog */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
              >
                <p className="text-red-400 text-sm mb-3">
                  Вы уверены, что хотите удалить это событие?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium"
                    disabled={deleting}
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Удалить
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto">
            {/* Название события */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Название события
              </label>
              <input
                type="text"
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                placeholder="Встреча, тренировка, занятие..."
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                disabled={saving || isScheduleEvent}
              />
            </div>

            {/* Время */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Время
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Начало</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="time"
                      value={timeStart}
                      onChange={(e) => handleTimeStartChange(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      disabled={saving || isScheduleEvent}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Окончание</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="time"
                      value={timeEnd}
                      onChange={(e) => handleTimeEndChange(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      disabled={saving || isScheduleEvent}
                    />
                  </div>
                </div>
              </div>
              {timeError && (
                <p className="text-red-400 text-sm mt-2">{timeError}</p>
              )}
            </div>

            {/* Дополнительная информация для пар из расписания */}
            {isScheduleEvent && (
              <div className="mb-5 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2">
                {event.teacher && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">Преподаватель:</span>
                    <span className="text-white">{event.teacher}</span>
                  </div>
                )}
                {event.auditory && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">Аудитория:</span>
                    <span className="text-white">{event.auditory}</span>
                  </div>
                )}
                {event.lessonType && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">Тип занятия:</span>
                    <span className="text-white">{event.lessonType}</span>
                  </div>
                )}
              </div>
            )}

            {/* Категория - только для пользовательских событий */}
            {!isScheduleEvent && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Категория
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategory(cat.id);
                        hapticFeedback && hapticFeedback('impact', 'light');
                      }}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        category === cat.id
                          ? `bg-gradient-to-r ${cat.color} border-white/50 shadow-lg scale-105`
                          : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'
                      }`}
                      disabled={saving}
                    >
                      <div className="text-2xl mb-1">{cat.emoji}</div>
                      <div className={`text-xs font-medium ${
                        category === cat.id ? 'text-white' : 'text-slate-400'
                      }`}>
                        {cat.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Заметки */}
            {!isScheduleEvent && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Заметки
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Дополнительная информация..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  disabled={saving}
                />
              </div>
            )}

            {/* Кнопки действий */}
            <div className="space-y-3">
              {/* Кнопка сохранения - только для пользовательских событий */}
              {!isScheduleEvent && (
                <button
                  type="submit"
                  disabled={saving || !eventText.trim() || !timeStart || !timeEnd || !!timeError}
                  className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-5 h-5" />
                      Сохранить изменения
                    </>
                  )}
                </button>
              )}

              {/* Кнопки копирования и удаления */}
              <div className="flex gap-3">
                {onCopyEvent && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={saving || deleting}
                    className="flex-1 py-3 bg-slate-700 text-white font-medium rounded-xl hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Копировать
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving || deleting || showDeleteConfirm}
                  className="flex-1 py-3 bg-red-500/20 text-red-400 font-medium rounded-xl hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditEventModal;
