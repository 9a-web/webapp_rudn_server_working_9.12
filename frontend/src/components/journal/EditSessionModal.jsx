import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, BookOpen, GraduationCap, FlaskConical, FileText } from 'lucide-react';

const SESSION_TYPES = [
  { id: 'lecture', label: 'Лекция', icon: BookOpen, gradient: 'from-blue-400 to-cyan-400' },
  { id: 'seminar', label: 'Семинар', icon: GraduationCap, gradient: 'from-green-400 to-emerald-400' },
  { id: 'lab', label: 'Лабораторная', icon: FlaskConical, gradient: 'from-purple-400 to-pink-400' },
  { id: 'exam', label: 'Экзамен', icon: FileText, gradient: 'from-red-400 to-orange-400' },
];

export const EditSessionModal = ({
  isOpen,
  onClose,
  session,
  onSave,
  hapticFeedback,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('lecture');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (session) {
      setTitle(session.title || '');
      // Форматируем дату для input[type=date]
      const d = session.date ? new Date(session.date) : new Date();
      const formatted = d.toISOString().split('T')[0];
      setDate(formatted);
      setType(session.type || 'lecture');
      setDescription(session.description || '');
      setHasChanges(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const origDate = session.date ? new Date(session.date).toISOString().split('T')[0] : '';
    const changed =
      title !== (session.title || '') ||
      date !== origDate ||
      type !== (session.type || 'lecture') ||
      description !== (session.description || '');
    setHasChanges(changed);
  }, [title, date, type, description, session]);

  const handleSave = async () => {
    if (!title.trim() || !date || !hasChanges) return;

    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }

    setIsSaving(true);
    try {
      await onSave(session.session_id, {
        title: title.trim(),
        date,
        type,
        description: description.trim() || null,
      });
      onClose();
    } catch (error) {
      console.error('Error saving session:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !session) return null;

  const selectedType = SESSION_TYPES.find(t => t.id === type) || SESSION_TYPES[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[#1C1C1E] w-full max-w-lg rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedType.gradient} flex items-center justify-center`}>
                <selectedType.icon className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Редактировать занятие</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Тип занятия */}
            <div>
              <label className="text-sm text-gray-400 mb-3 block">Тип занятия</label>
              <div className="grid grid-cols-2 gap-2">
                {SESSION_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = type === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setType(t.id);
                        if (hapticFeedback?.selectionChanged) hapticFeedback.selectionChanged();
                      }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? `bg-gradient-to-r ${t.gradient} border-transparent text-white`
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Название */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <BookOpen className="w-4 h-4" />
                Название
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Название занятия"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            {/* Дата */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <Calendar className="w-4 h-4" />
                Дата
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors [color-scheme:dark]"
              />
            </div>

            {/* Описание */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Описание (опционально)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Тема занятия, аудитория..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            {/* Кнопка сохранения */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={!title.trim() || !date || !hasChanges || isSaving}
              className={`w-full py-4 rounded-2xl font-semibold text-white transition-all ${
                title.trim() && date && hasChanges && !isSaving
                  ? `bg-gradient-to-r ${selectedType.gradient}`
                  : 'bg-white/10 text-gray-500'
              }`}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
