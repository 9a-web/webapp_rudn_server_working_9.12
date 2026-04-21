import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileCheck, Palette, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const COLORS = [
  { id: 'purple', gradient: 'from-purple-400 to-pink-400', bg: 'bg-purple-500' },
  { id: 'blue', gradient: 'from-blue-400 to-cyan-400', bg: 'bg-blue-500' },
  { id: 'green', gradient: 'from-green-400 to-emerald-400', bg: 'bg-green-500' },
  { id: 'orange', gradient: 'from-orange-400 to-amber-400', bg: 'bg-orange-500' },
  { id: 'red', gradient: 'from-red-400 to-rose-400', bg: 'bg-red-500' },
  { id: 'indigo', gradient: 'from-indigo-400 to-violet-400', bg: 'bg-indigo-500' },
];

export const CreateJournalModal = ({ isOpen, onClose, onCreate, hapticFeedback, defaultGroupName = '' }) => {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState(defaultGroupName);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('purple');
  const [isLoading, setIsLoading] = useState(false);

  // Обновляем groupName при изменении defaultGroupName или открытии модалки
  useEffect(() => {
    if (isOpen && defaultGroupName) {
      setGroupName(defaultGroupName);
    }
  }, [isOpen, defaultGroupName]);

  const handleCreate = async () => {
    if (!groupName.trim()) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsLoading(true);
    try {
      await onCreate({
        name: groupName.trim(), // Используем название группы как название журнала
        group_name: groupName.trim(),
        description: description.trim() || null,
        color
      });
      setGroupName(defaultGroupName);
      setDescription('');
      setColor('purple');
      onClose();
    } catch (error) {
      console.error('Error creating journal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

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
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${COLORS.find(c => c.id === color)?.gradient || 'from-purple-400 to-pink-400'} flex items-center justify-center`}>
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Создать журнал</h2>
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
            {/* Название группы */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <Users className="w-4 h-4" />
                Название группы
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="ИВТ-201"
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
                placeholder="Семестр 3, 2025"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            {/* Цвет журнала */}
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                <Palette className="w-4 h-4" />
                Цвет журнала
              </label>
              <div className="flex gap-3">
                {COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setColor(c.id)}
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} transition-all ${color === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1C1C1E] scale-110' : 'opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Create Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleCreate}
            disabled={!groupName.trim() || isLoading}
            className={`w-full mt-6 py-4 rounded-2xl font-semibold text-white transition-all ${
              groupName.trim() && !isLoading
                ? `bg-gradient-to-r ${COLORS.find(c => c.id === color)?.gradient || 'from-purple-400 to-pink-400'}`
                : 'bg-white/10 text-gray-500'
            }`}
          >
            {isLoading ? 'Создание...' : 'Создать журнал'}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
