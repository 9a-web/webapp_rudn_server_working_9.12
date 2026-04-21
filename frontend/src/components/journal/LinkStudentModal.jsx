import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, User, Check } from 'lucide-react';

export const LinkStudentModal = ({ 
  isOpen, 
  onClose, 
  member, 
  unlinkedStudents, 
  onLink, 
  hapticFeedback 
}) => {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLink = async () => {
    if (!selectedStudent) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsLoading(true);
    try {
      await onLink(selectedStudent.id, {
        telegram_id: member.telegram_id,
        username: member.username,
        first_name: member.first_name
      });
      setSelectedStudent(null);
    } catch (error) {
      console.error('Error linking student:', error);
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
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Привязать участника</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Member Info */}
          <div className="bg-white/5 rounded-xl p-4 mb-5">
            <p className="text-sm text-gray-400 mb-1">Участник Telegram</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">
                  {member.first_name || member.username || `ID: ${member.telegram_id}`}
                </p>
                {member.username && (
                  <p className="text-sm text-gray-400">@{member.username}</p>
                )}
              </div>
            </div>
          </div>

          {/* Select Student */}
          <div>
            <p className="text-sm text-gray-400 mb-3">Выберите ФИО из списка</p>
            
            {unlinkedStudents.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400">Нет непривязанных студентов</p>
                <p className="text-gray-500 text-sm mt-1">Сначала добавьте студентов в журнал</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {unlinkedStudents.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      selectedStudent?.id === student.id
                        ? 'bg-yellow-500/20 border border-yellow-500/30'
                        : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <span className="text-white">{student.full_name}</span>
                    {selectedStudent?.id === student.id && (
                      <Check className="w-5 h-5 text-yellow-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Link Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleLink}
            disabled={!selectedStudent || isLoading}
            className={`w-full mt-6 py-4 rounded-2xl font-semibold text-white transition-all ${
              selectedStudent && !isLoading
                ? 'bg-gradient-to-r from-yellow-400 to-orange-400'
                : 'bg-white/10 text-gray-500'
            }`}
          >
            {isLoading ? 'Привязка...' : 'Привязать'}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
