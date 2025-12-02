import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, UserPlus, ListPlus } from 'lucide-react';

export const AddStudentsModal = ({ isOpen, onClose, onAddSingle, onAddBulk, hapticFeedback }) => {
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [singleName, setSingleName] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddSingle = async () => {
    if (!singleName.trim()) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsLoading(true);
    try {
      await onAddSingle(singleName.trim());
      setSingleName('');
    } catch (error) {
      console.error('Error adding student:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBulk = async () => {
    const names = bulkNames.split('\n').map(n => n.trim()).filter(n => n);
    if (names.length === 0) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsLoading(true);
    try {
      await onAddBulk(names);
      setBulkNames('');
      onClose();
    } catch (error) {
      console.error('Error adding students:', error);
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Добавить студентов</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setMode('single')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
                mode === 'single'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span className="text-sm font-medium">По одному</span>
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
                mode === 'bulk'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10'
              }`}
            >
              <ListPlus className="w-4 h-4" />
              <span className="text-sm font-medium">Списком</span>
            </button>
          </div>

          {/* Single Mode */}
          {mode === 'single' && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">ФИО студента</label>
              <input
                type="text"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
              />
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleAddSingle}
                disabled={!singleName.trim() || isLoading}
                className={`w-full mt-4 py-3.5 rounded-xl font-semibold transition-all ${
                  singleName.trim() && !isLoading
                    ? 'bg-gradient-to-r from-blue-400 to-cyan-400 text-white'
                    : 'bg-white/10 text-gray-500'
                }`}
              >
                {isLoading ? 'Добавление...' : 'Добавить'}
              </motion.button>
            </div>
          )}

          {/* Bulk Mode */}
          {mode === 'bulk' && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Список студентов (каждый с новой строки)</label>
              <textarea
                value={bulkNames}
                onChange={(e) => setBulkNames(e.target.value)}
                placeholder="Иванов Иван Иванович\nПетров Пётр Петрович\nСидорова Мария Сергеевна"
                rows={8}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                {bulkNames.split('\n').filter(n => n.trim()).length} студентов
              </p>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleAddBulk}
                disabled={!bulkNames.trim() || isLoading}
                className={`w-full mt-4 py-3.5 rounded-xl font-semibold transition-all ${
                  bulkNames.trim() && !isLoading
                    ? 'bg-gradient-to-r from-blue-400 to-cyan-400 text-white'
                    : 'bg-white/10 text-gray-500'
                }`}
              >
                {isLoading ? 'Добавление...' : 'Добавить всех'}
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
