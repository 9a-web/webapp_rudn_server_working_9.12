import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Palette, Users, FileText } from 'lucide-react';

const JOURNAL_COLORS = [
  { id: 'purple', gradient: 'from-purple-400 to-pink-400', label: 'Фиолетовый' },
  { id: 'blue', gradient: 'from-blue-400 to-cyan-400', label: 'Синий' },
  { id: 'green', gradient: 'from-green-400 to-emerald-400', label: 'Зелёный' },
  { id: 'orange', gradient: 'from-orange-400 to-amber-400', label: 'Оранжевый' },
  { id: 'red', gradient: 'from-red-400 to-rose-400', label: 'Красный' },
  { id: 'indigo', gradient: 'from-indigo-400 to-violet-400', label: 'Индиго' },
];

export const EditJournalModal = ({
  isOpen,
  onClose,
  journal,
  onSave,
  hapticFeedback,
}) => {
  const [name, setName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('purple');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (journal) {
      setName(journal.name || '');
      setGroupName(journal.group_name || '');
      setDescription(journal.description || '');
      setColor(journal.color || 'purple');
      setHasChanges(false);
    }
  }, [journal]);

  // Отслеживаем изменения
  useEffect(() => {
    if (!journal) return;
    const changed =
      name !== (journal.name || '') ||
      groupName !== (journal.group_name || '') ||
      description !== (journal.description || '') ||
      color !== (journal.color || 'purple');
    setHasChanges(changed);
  }, [name, groupName, description, color, journal]);

  const handleSave = async () => {
    if (!name.trim() || !hasChanges) return;

    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        group_name: groupName.trim(),
        description: description.trim() || null,
        color,
      });
      onClose();
    } catch (error) {
      console.error('Error saving journal:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !journal) return null;

  const selectedColor = JOURNAL_COLORS.find(c => c.id === color) || JOURNAL_COLORS[0];

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
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedColor.gradient} flex items-center justify-center`}>
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Редактировать журнал</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Название */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <BookOpen className="w-4 h-4" />
                Название журнала
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название журнала"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            {/* Группа */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <Users className="w-4 h-4" />
                Группа
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="ИВТ-101"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            {/* Описание */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <FileText className="w-4 h-4" />
                Описание
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Краткое описание журнала (опционально)"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
              />
            </div>

            {/* Цвет */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                <Palette className="w-4 h-4" />
                Цвет журнала
              </label>
              <div className="flex gap-3">
                {JOURNAL_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setColor(c.id);
                      if (hapticFeedback?.selectionChanged) hapticFeedback.selectionChanged();
                    }}
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} transition-all ${
                      color === c.id
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1C1C1E] scale-110'
                        : 'opacity-50 hover:opacity-100'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Кнопка сохранения */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={!name.trim() || !hasChanges || isSaving}
              className={`w-full py-4 rounded-2xl font-semibold text-white transition-all ${
                name.trim() && hasChanges && !isSaving
                  ? `bg-gradient-to-r ${selectedColor.gradient}`
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
