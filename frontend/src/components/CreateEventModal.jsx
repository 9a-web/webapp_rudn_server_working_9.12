import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Calendar, Sparkles, FileText, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const glassBackdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
};

const glassModal = {
  hidden: { opacity: 0, y: 60, scale: 0.97 },
  visible: { 
    opacity: 1, y: 0, scale: 1, 
    transition: { type: 'spring', damping: 28, stiffness: 320, mass: 0.8 } 
  },
};

export const CreateEventModal = ({ 
  isOpen, 
  onClose, 
  onCreateEvent, 
  hapticFeedback,
  selectedDate,
  defaultTimeStart,
  defaultTimeEnd,
}) => {
  const [eventText, setEventText] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [category, setCategory] = useState('personal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [timeError, setTimeError] = useState('');
  const [focusedField, setFocusedField] = useState(null);
  
  const modalRef = useRef(null);
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 350);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);
  
  useEffect(() => {
    if (isOpen) {
      setEventText('');
      setTimeStart(defaultTimeStart || '');
      setTimeEnd(defaultTimeEnd || '');
      setCategory('personal');
      setNotes('');
      setTimeError('');
      setFocusedField(null);
    }
  }, [isOpen, defaultTimeStart, defaultTimeEnd]);
  
  const categories = [
    { id: 'study',    label: 'Учёба',   emoji: '📚', gradient: 'from-blue-500/80 to-cyan-400/80',    ring: 'ring-blue-400/50',   bg: 'bg-blue-500/10' },
    { id: 'personal', label: 'Личное',   emoji: '🏠', gradient: 'from-emerald-500/80 to-teal-400/80', ring: 'ring-emerald-400/50', bg: 'bg-emerald-500/10' },
    { id: 'sport',    label: 'Спорт',    emoji: '🏃', gradient: 'from-rose-500/80 to-orange-400/80',  ring: 'ring-rose-400/50',    bg: 'bg-rose-500/10' },
    { id: 'work',     label: 'Работа',   emoji: '💼', gradient: 'from-violet-500/80 to-purple-400/80', ring: 'ring-violet-400/50', bg: 'bg-violet-500/10' },
    { id: 'meeting',  label: 'Встреча',  emoji: '👥', gradient: 'from-amber-500/80 to-yellow-400/80', ring: 'ring-amber-400/50',   bg: 'bg-amber-500/10' },
  ];
  
  const validateTime = (start, end) => {
    if (!start || !end) return true;
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    if (eH * 60 + eM <= sH * 60 + sM) {
      setTimeError('Время окончания должно быть позже начала');
      return false;
    }
    setTimeError('');
    return true;
  };
  
  const handleTimeStartChange = (v) => { setTimeStart(v); timeEnd && validateTime(v, timeEnd); };
  const handleTimeEndChange = (v) => { setTimeEnd(v); timeStart && validateTime(timeStart, v); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!eventText.trim()) return;
    if (!timeStart || !timeEnd) return;
    if (!validateTime(timeStart, timeEnd)) return;
    
    try {
      setSaving(true);
      hapticFeedback && hapticFeedback('impact', 'medium');
      
      let targetDateISO = null;
      if (selectedDate) {
        const d = new Date(selectedDate);
        targetDateISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T00:00:00`;
      }
      
      await onCreateEvent({
        text: eventText.trim(),
        time_start: timeStart,
        time_end: timeEnd,
        category,
        target_date: targetDateISO,
        notes: notes || null,
        origin: 'user',
        is_fixed: false,
      });
      
      setEventText(''); setTimeStart(''); setTimeEnd('');
      setCategory('personal'); setNotes(''); setTimeError('');
      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    hapticFeedback && hapticFeedback('impact', 'light');
    setEventText(''); setTimeStart(''); setTimeEnd('');
    setCategory('personal'); setNotes(''); setTimeError('');
    setDragY(0); onClose();
  };
  
  const handleDragEnd = (_, info) => {
    if (info.offset.y > 100) handleClose();
    else setDragY(0);
  };

  if (!isOpen) return null;

  const activeCat = categories.find(c => c.id === category);
  const isValid = eventText.trim() && timeStart && timeEnd && !timeError;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[10000] flex items-end sm:items-center sm:justify-center"
        variants={glassBackdrop}
        initial="hidden"
        animate="visible"
        exit="hidden"
        onClick={handleClose}
      >
        {/* Animated background */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
        
        {/* Decorative orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />

        {/* Modal */}
        <motion.div
          ref={modalRef}
          className="relative w-full sm:w-[480px] sm:max-h-[88vh] overflow-hidden
                     rounded-t-[28px] sm:rounded-[24px]
                     border border-white/[0.12]
                     shadow-[0_8px_64px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]"
          style={{
            background: 'linear-gradient(135deg, rgba(30,30,50,0.85) 0%, rgba(20,20,40,0.92) 50%, rgba(30,25,50,0.88) 100%)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            y: dragY > 0 ? dragY : 0,
          }}
          variants={glassModal}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={(e) => e.stopPropagation()}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={handleDragEnd}
          onDrag={(_, info) => setDragY(info.offset.y)}
        >
          {/* Top glass shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="px-6 pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-[rgba(30,30,50,0.9)]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white/95 tracking-tight">Новое событие</h2>
                  <p className="text-xs text-white/40 mt-0.5">Добавьте в планировщик</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={saving}
                className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.06] 
                           transition-all duration-200 active:scale-90"
              >
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
          </div>

          {/* Separator */}
          <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 pt-5 pb-6 max-h-[65vh] overflow-y-auto space-y-5
                                                    scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            
            {/* Event name */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider mb-2.5">
                <Calendar className="w-3.5 h-3.5" /> Название
              </label>
              <div className={`relative rounded-2xl transition-all duration-300
                    ${focusedField === 'name' 
                      ? 'ring-2 ring-purple-500/40 shadow-[0_0_20px_rgba(139,92,246,0.15)]' 
                      : ''}`}>
                <input
                  ref={inputRef}
                  type="text"
                  value={eventText}
                  onChange={(e) => setEventText(e.target.value)}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Встреча, тренировка, занятие..."
                  disabled={saving}
                  className="w-full px-4 py-3.5 
                             bg-white/[0.05] border border-white/[0.08] rounded-2xl
                             text-white/90 text-[15px] placeholder-white/25
                             focus:outline-none focus:bg-white/[0.07] focus:border-white/[0.15]
                             transition-all duration-300 disabled:opacity-40"
                />
              </div>
            </div>

            {/* Time */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider mb-2.5">
                <Clock className="w-3.5 h-3.5" /> Время
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Начало', value: timeStart, onChange: handleTimeStartChange, field: 'start' },
                  { label: 'Конец', value: timeEnd, onChange: handleTimeEndChange, field: 'end' },
                ].map(({ label, value, onChange, field }) => (
                  <div key={field}>
                    <div className="text-[11px] text-white/30 mb-1.5 ml-1">{label}</div>
                    <div className={`relative rounded-2xl transition-all duration-300
                          ${focusedField === field 
                            ? 'ring-2 ring-purple-500/40 shadow-[0_0_20px_rgba(139,92,246,0.15)]' 
                            : ''}`}>
                      <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                      <input
                        type="time"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onFocus={() => setFocusedField(field)}
                        onBlur={() => setFocusedField(null)}
                        disabled={saving}
                        className="w-full pl-10 pr-3 py-3.5 
                                   bg-white/[0.05] border border-white/[0.08] rounded-2xl
                                   text-white/90 text-[15px]
                                   focus:outline-none focus:bg-white/[0.07] focus:border-white/[0.15]
                                   transition-all duration-300 disabled:opacity-40
                                   [color-scheme:dark]"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <AnimatePresence>
                {timeError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    className="text-rose-400/90 text-xs mt-2 ml-1 flex items-center gap-1"
                  >
                    <span className="inline-block w-1 h-1 rounded-full bg-rose-400" />
                    {timeError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Category */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                <FileText className="w-3.5 h-3.5" /> Категория
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const isActive = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategory(cat.id);
                        hapticFeedback && hapticFeedback('impact', 'light');
                      }}
                      disabled={saving}
                      className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl 
                                  border overflow-hidden
                                  transition-[background,border-color,box-shadow,transform] duration-200 ease-out
                                  active:scale-[0.95]
                                  ${isActive 
                                    ? `border-white/20 shadow-[0_0_16px_rgba(139,92,246,0.2)] ring-1 ${cat.ring}` 
                                    : 'border-white/[0.06] hover:border-white/[0.12]'
                                  }`}
                      style={{
                        background: isActive
                          ? `linear-gradient(135deg, ${cat.id === 'study' ? 'rgba(59,130,246,0.18)' : cat.id === 'personal' ? 'rgba(16,185,129,0.18)' : cat.id === 'sport' ? 'rgba(244,63,94,0.18)' : cat.id === 'work' ? 'rgba(139,92,246,0.18)' : 'rgba(245,158,11,0.18)'} 0%, rgba(255,255,255,0.04) 100%)`
                          : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <span className="relative text-lg leading-none">{cat.emoji}</span>
                      <span className={`relative text-xs font-medium
                                        transition-colors duration-200
                                        ${isActive ? 'text-white/90' : 'text-white/40'}`}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider mb-2.5">
                <FileText className="w-3.5 h-3.5" /> Заметки
                <span className="text-white/20 font-normal normal-case tracking-normal ml-1">— опционально</span>
              </label>
              <div className={`relative rounded-2xl transition-all duration-300
                    ${focusedField === 'notes' 
                      ? 'ring-2 ring-purple-500/40 shadow-[0_0_20px_rgba(139,92,246,0.15)]' 
                      : ''}`}>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onFocus={() => setFocusedField('notes')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Дополнительная информация..."
                  rows={2}
                  disabled={saving}
                  className="w-full px-4 py-3.5 
                             bg-white/[0.05] border border-white/[0.08] rounded-2xl
                             text-white/90 text-[15px] placeholder-white/25
                             focus:outline-none focus:bg-white/[0.07] focus:border-white/[0.15]
                             transition-all duration-300 resize-none disabled:opacity-40"
                />
              </div>
            </div>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={saving || !isValid}
              whileTap={{ scale: 0.97 }}
              className={`relative w-full py-4 rounded-2xl font-semibold text-[15px]
                          overflow-hidden transition-all duration-300
                          flex items-center justify-center gap-2.5
                          ${isValid && !saving
                            ? 'text-white shadow-[0_4px_24px_rgba(139,92,246,0.3)] hover:shadow-[0_8px_32px_rgba(139,92,246,0.4)]' 
                            : 'text-white/30 cursor-not-allowed'
                          }`}
              style={{
                background: isValid && !saving
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.9) 0%, rgba(219,39,119,0.8) 100%)'
                  : 'rgba(255,255,255,0.04)',
                border: '1px solid',
                borderColor: isValid && !saving ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
              }}
            >
              {/* Button shine */}
              {isValid && !saving && (
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              )}
              
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Создание...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4.5 h-4.5" />
                  <span>Создать событие</span>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </>
              )}
            </motion.button>
          </form>

          {/* Bottom glass shine */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreateEventModal;
