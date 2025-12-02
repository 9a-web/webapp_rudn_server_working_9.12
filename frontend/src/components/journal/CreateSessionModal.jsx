import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, BookOpen, GraduationCap, FlaskConical, FileText } from 'lucide-react';

const SESSION_TYPES = [
  { id: 'lecture', label: 'Лекция', icon: BookOpen, color: 'from-blue-400 to-cyan-400' },
  { id: 'seminar', label: 'Семинар', icon: GraduationCap, color: 'from-green-400 to-emerald-400' },
  { id: 'lab', label: 'Лабораторная', icon: FlaskConical, color: 'from-purple-400 to-pink-400' },
  { id: 'exam', label: 'Экзамен/Зачёт', icon: FileText, color: 'from-red-400 to-orange-400' },
];

export const CreateSessionModal = ({ isOpen, onClose, onCreate, hapticFeedback }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('lecture');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!date || !title.trim()) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsLoading(true);
    try {
      await onCreate({
        date,
        title: title.trim(),
        description: description.trim() || null,
        type
      });
      setTitle('');
      setDescription('');
      setType('lecture');
      onClose();
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedType = SESSION_TYPES.find(t => t.id === type) || SESSION_TYPES[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
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
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedType.color} flex items-center justify-center`}>
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Добавить занятие</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-5">
            {/* Тип занятия */}
            <div>
              <label className="text-sm text-gray-400 mb-3 block">Тип занятия</label>
              <div className="grid grid-cols-2 gap-2">
                {SESSION_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setType(t.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl transition-all ${
                        type === t.id
                          ? `bg-gradient-to-br ${t.color} text-white`
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Дата */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Дата</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            {/* Название */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Название занятия</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Лекция №5 — Интегралы"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            {/* Описание */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Описание (опционально)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Тема: определённые интегралы"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Create Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCreate}
            disabled={!date || !title.trim() || isLoading}
            className={`w-full mt-6 py-4 rounded-2xl font-semibold text-white transition-all ${
              date && title.trim() && !isLoading
                ? `bg-gradient-to-r ${selectedType.color}`
                : 'bg-white/10 text-gray-500'
            }`}
          >
            {isLoading ? 'Создание...' : 'Добавить занятие'}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
