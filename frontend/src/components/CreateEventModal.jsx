import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Calendar, Tag, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, backdropVariants } from '../utils/animations';

export const CreateEventModal = ({ 
  isOpen, 
  onClose, 
  onCreateEvent, 
  hapticFeedback,
  selectedDate, // Выбранная дата
  defaultTimeStart, // Предустановленное время начала (для быстрого создания)
  defaultTimeEnd, // Предустановленное время окончания
}) => {
  const [eventText, setEventText] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [category, setCategory] = useState('personal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [timeError, setTimeError] = useState('');
  
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
  
  // Сбрасываем поля при открытии и применяем предустановленное время
  useEffect(() => {
    if (isOpen) {
      setEventText('');
      setTimeStart(defaultTimeStart || '');
      setTimeEnd(defaultTimeEnd || '');
      setCategory('personal');
      setNotes('');
      setTimeError('');
    }
  }, [isOpen, defaultTimeStart, defaultTimeEnd]);
  
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
    if (!start || !end) return true; // Если не заполнены - пока не валидируем
    
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
  
  // Обработка изменения времени начала
  const handleTimeStartChange = (value) => {
    setTimeStart(value);
    if (timeEnd) {
      validateTime(value, timeEnd);
    }
  };
  
  // Обработка изменения времени окончания
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
      
      // Форматируем дату
      let targetDateISO = null;
      if (selectedDate) {
        const targetDate = new Date(selectedDate);
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        targetDateISO = `${year}-${month}-${day}T00:00:00`;
      }
      
      const eventData = {
        text: eventText.trim(),
        time_start: timeStart,
        time_end: timeEnd,
        category: category,
        target_date: targetDateISO,
        notes: notes || null,
        origin: 'user',
        is_fixed: false, // Пользовательские события не жесткие
      };
      
      await onCreateEvent(eventData);
      
      // Очищаем и закрываем
      setEventText('');
      setTimeStart('');
      setTimeEnd('');
      setCategory('personal');
      setNotes('');
      setTimeError('');
      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
      const errorMessage = error?.message || error?.toString() || 'Неизвестная ошибка при создании события';
      alert(`Ошибка при создании события: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    hapticFeedback && hapticFeedback('impact', 'light');
    setEventText('');
    setTimeStart('');
    setTimeEnd('');
    setCategory('personal');
    setNotes('');
    setTimeError('');
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center sm:justify-center"
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Новое событие</h2>
                <p className="text-sm text-slate-400">Создайте событие с временем</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              disabled={saving}
            >
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto">
            {/* Название события */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Название события *
              </label>
              <input
                type="text"
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                placeholder="Встреча, тренировка, занятие..."
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
                disabled={saving}
              />
            </div>

            {/* Время */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Время *
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
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={saving}
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
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
              {timeError && (
                <p className="text-red-400 text-sm mt-2">{timeError}</p>
              )}
            </div>

            {/* Категория */}
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

            {/* Заметки */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Заметки (опционально)
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

            {/* Кнопка создания */}
            <button
              type="submit"
              disabled={saving || !eventText.trim() || !timeStart || !timeEnd || !!timeError}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5" />
                  Создать событие
                </>
              )}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreateEventModal;
