import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, XCircle, Clock, HelpCircle, Users, Star, Pencil } from 'lucide-react';
import { getSessionAttendance, markAttendance } from '../../services/journalAPI';

const STATUSES = [
  { id: 'present', label: 'Присут.', icon: Check, color: 'bg-green-500', textColor: 'text-green-400' },
  { id: 'absent', label: 'Отсутств.', icon: XCircle, color: 'bg-red-500', textColor: 'text-red-400' },
  { id: 'late', label: 'Опоздал', icon: Clock, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
  { id: 'excused', label: 'Уважит.', icon: HelpCircle, color: 'bg-gray-500', textColor: 'text-gray-400' },
];

// Цвета для оценок согласно спецификации
const GRADE_COLORS = {
  5: { bg: 'bg-green-500', text: 'text-green-400', bgLight: 'bg-green-500/20' },
  4: { bg: 'bg-lime-500', text: 'text-lime-400', bgLight: 'bg-lime-500/20' },
  3: { bg: 'bg-yellow-500', text: 'text-yellow-400', bgLight: 'bg-yellow-500/20' },
  2: { bg: 'bg-orange-500', text: 'text-orange-400', bgLight: 'bg-orange-500/20' },
  1: { bg: 'bg-red-500', text: 'text-red-400', bgLight: 'bg-red-500/20' },
};

// Цвета для произвольных оценок
const getGradeColors = (grade) => {
  if (GRADE_COLORS[grade]) return GRADE_COLORS[grade];
  // fallback для произвольных значений
  if (grade >= 5) return { bg: 'bg-green-500', text: 'text-green-400', bgLight: 'bg-green-500/20' };
  if (grade >= 4) return { bg: 'bg-lime-500', text: 'text-lime-400', bgLight: 'bg-lime-500/20' };
  if (grade >= 3) return { bg: 'bg-yellow-500', text: 'text-yellow-400', bgLight: 'bg-yellow-500/20' };
  if (grade >= 2) return { bg: 'bg-orange-500', text: 'text-orange-400', bgLight: 'bg-orange-500/20' };
  return { bg: 'bg-red-500', text: 'text-red-400', bgLight: 'bg-red-500/20' };
};

export const AttendanceModal = ({ 
  isOpen, 
  onClose, 
  sessionId, 
  journalId, 
  telegramId, 
  hapticFeedback 
}) => {
  const [attendance, setAttendance] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [changes, setChanges] = useState({});
  const [customGradeInput, setCustomGradeInput] = useState({}); // { studentId: '10' }
  const [editingGradeStudent, setEditingGradeStudent] = useState(null);
  const customInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && sessionId) {
      loadAttendance();
    }
  }, [isOpen, sessionId]);

  const loadAttendance = async () => {
    setIsLoading(true);
    try {
      const data = await getSessionAttendance(sessionId);
      setAttendance(data);
      setChanges({});
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (studentId, newStatus) => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('light');
    }
    
    setChanges(prev => ({
      ...prev,
      [studentId]: { 
        ...prev[studentId],
        status: newStatus 
      }
    }));
    
    setAttendance(prev => prev.map(a => 
      a.student_id === studentId ? { ...a, status: newStatus } : a
    ));
  };

  const handleGradeChange = (studentId, newGrade) => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('light');
    }
    
    // Получаем текущую оценку студента
    const currentStudent = attendance.find(a => a.student_id === studentId);
    const currentGrade = currentStudent?.grade;
    
    // Если нажали на ту же оценку - убираем её
    const finalGrade = currentGrade === newGrade ? null : newGrade;
    
    setChanges(prev => ({
      ...prev,
      [studentId]: { 
        ...prev[studentId],
        grade: finalGrade 
      }
    }));
    
    setAttendance(prev => prev.map(a => 
      a.student_id === studentId ? { ...a, grade: finalGrade } : a
    ));
  };

  const handleSave = async () => {
    const changedRecords = Object.entries(changes).map(([studentId, data]) => {
      const student = attendance.find(a => a.student_id === studentId);
      return {
        student_id: studentId,
        status: data.status !== undefined ? data.status : student?.status || 'unmarked',
        grade: data.grade !== undefined ? data.grade : student?.grade
      };
    });
    
    if (changedRecords.length === 0) {
      onClose();
      return;
    }
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsSaving(true);
    try {
      await markAttendance(sessionId, changedRecords, telegramId);
      onClose();
    } catch (error) {
      console.error('Error saving attendance:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAll = (status) => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    const newChanges = {};
    attendance.forEach(a => {
      newChanges[a.student_id] = { 
        ...changes[a.student_id],
        status 
      };
    });
    setChanges(newChanges);
    setAttendance(prev => prev.map(a => ({ ...a, status })));
  };

  if (!isOpen) return null;

  const presentCount = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const totalCount = attendance.length;
  
  // Подсчёт количества выставленных оценок
  const gradesCount = attendance.filter(a => a.grade !== null && a.grade !== undefined).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] overflow-hidden"
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="absolute inset-0 bg-[#0D0D0D] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#0D0D0D] border-b border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
                <h2 className="text-xl font-bold text-white">Отметка посещаемости</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">
                    {presentCount}/{totalCount}
                  </span>
                </div>
                {gradesCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400">
                      {gradesCount}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleMarkAll('present')}
                className="flex-1 py-2 px-3 bg-green-500/20 text-green-400 rounded-xl text-sm font-medium hover:bg-green-500/30 transition-colors"
              >
                Все присутствуют
              </button>
              <button
                onClick={() => handleMarkAll('absent')}
                className="flex-1 py-2 px-3 bg-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                Все отсутствуют
              </button>
            </div>
          </div>

          {/* Attendance List */}
          <div className="p-4 pb-24">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {attendance.map((student, index) => (
                  <motion.div
                    key={student.student_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="bg-white/5 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-5">{index + 1}.</span>
                        <span className="text-white font-medium">{student.full_name}</span>
                        {!student.is_linked && (
                          <span className="text-xs text-yellow-500 bg-yellow-500/20 px-2 py-0.5 rounded-full">
                            не привязан
                          </span>
                        )}
                      </div>
                      {/* Показываем текущую оценку */}
                      {student.grade && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${GRADE_COLORS[student.grade].bgLight}`}>
                          <Star className={`w-3 h-3 ${GRADE_COLORS[student.grade].text}`} />
                          <span className={`text-sm font-bold ${GRADE_COLORS[student.grade].text}`}>
                            {student.grade}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Status Buttons */}
                    <div className="flex gap-2 mb-3">
                      {STATUSES.map((status) => {
                        const Icon = status.icon;
                        const isSelected = student.status === status.id;
                        
                        return (
                          <button
                            key={status.id}
                            onClick={() => handleStatusChange(student.student_id, status.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                              isSelected
                                ? `${status.color} text-white`
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{status.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Grade Buttons */}
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 mr-2">
                        <Star className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-500">Оценка:</span>
                      </div>
                      {[5, 4, 3, 2, 1].map((grade) => {
                        const isSelected = student.grade === grade;
                        const colors = GRADE_COLORS[grade];
                        
                        return (
                          <button
                            key={grade}
                            onClick={() => handleGradeChange(student.student_id, grade)}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                              isSelected
                                ? `${colors.bg} text-white shadow-lg scale-105`
                                : `bg-white/5 ${colors.text} hover:${colors.bgLight}`
                            }`}
                          >
                            {grade}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0D0D0D] to-transparent">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl font-semibold text-white"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
