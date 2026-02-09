import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ArrowLeft, Calendar, Plus, Trash2, Check,
  BookOpen, GraduationCap, FlaskConical, FileText, CalendarRange,
  Edit3, Palette
} from 'lucide-react';
import { getSubjectDetail, createSession, deleteSession, updateSubject, updateSession } from '../../services/journalAPI';
import { AttendanceModal } from './AttendanceModal';
import { CreateSessionModal } from './CreateSessionModal';
import { EditSessionModal } from './EditSessionModal';

const SESSION_ICONS = {
  lecture: BookOpen,
  seminar: GraduationCap,
  lab: FlaskConical,
  exam: FileText,
};

const SESSION_COLORS = {
  lecture: 'from-blue-400 to-cyan-400',
  seminar: 'from-green-400 to-emerald-400',
  lab: 'from-purple-400 to-pink-400',
  exam: 'from-red-400 to-orange-400',
};

const SUBJECT_COLORS = {
  blue: 'from-blue-400 to-cyan-400',
  purple: 'from-purple-400 to-pink-400',
  green: 'from-green-400 to-emerald-400',
  orange: 'from-orange-400 to-amber-400',
  red: 'from-red-400 to-rose-400',
  indigo: 'from-indigo-400 to-violet-400',
};

export const SubjectDetailModal = ({ 
  isOpen, 
  onClose, 
  subjectId,
  journalId,
  telegramId, 
  hapticFeedback,
  onSubjectUpdated,
  userSettings
}) => {
  const [subject, setSubject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showAttendance, setShowAttendance] = useState(null);
  const [showEditSession, setShowEditSession] = useState(null); // session to edit
  
  // Inline editing state for subject
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('blue');
  const [isSavingSubject, setIsSavingSubject] = useState(false);

  const loadData = useCallback(async () => {
    if (!subjectId) return;
    
    setIsLoading(true);
    try {
      const data = await getSubjectDetail(subjectId);
      setSubject(data);
    } catch (error) {
      console.error('Error loading subject:', error);
    } finally {
      setIsLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    if (isOpen && subjectId) {
      loadData();
    }
  }, [isOpen, subjectId, loadData]);

  const handleCreateSession = async (sessionData) => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    try {
      await createSession(journalId, {
        subject_id: subjectId,
        date: sessionData.date,
        title: sessionData.title,
        description: sessionData.description,
        type: sessionData.type,
        telegram_id: telegramId
      });
      loadData();
      if (onSubjectUpdated) onSubjectUpdated();
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  };

  const handleCreateFromSchedule = (result) => {
    if (hapticFeedback?.notificationOccurred) {
      hapticFeedback.notificationOccurred('success');
    }
    console.log(`Created ${result.created_count} sessions from schedule`);
    loadData();
    if (onSubjectUpdated) onSubjectUpdated();
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Удалить занятие и все записи посещаемости?')) return;
    
    try {
      await deleteSession(sessionId);
      loadData();
      if (onSubjectUpdated) onSubjectUpdated();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  // --- Subject editing ---
  const startEditingSubject = () => {
    if (hapticFeedback?.impactOccurred) hapticFeedback.impactOccurred('light');
    setEditName(subject?.name || '');
    setEditDescription(subject?.description || '');
    setEditColor(subject?.color || 'blue');
    setIsEditingSubject(true);
  };

  const cancelEditingSubject = () => {
    setIsEditingSubject(false);
  };

  const handleSaveSubject = async () => {
    if (!editName.trim()) return;
    if (hapticFeedback?.impactOccurred) hapticFeedback.impactOccurred('medium');
    
    setIsSavingSubject(true);
    try {
      await updateSubject(subjectId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        color: editColor,
      });
      setIsEditingSubject(false);
      loadData();
      if (onSubjectUpdated) onSubjectUpdated();
    } catch (error) {
      console.error('Error updating subject:', error);
    } finally {
      setIsSavingSubject(false);
    }
  };

  // --- Session editing ---
  const handleSaveSession = async (sessionId, data) => {
    try {
      await updateSession(sessionId, data);
      loadData();
      if (onSubjectUpdated) onSubjectUpdated();
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  };

  if (!isOpen) return null;

  const gradient = subject ? SUBJECT_COLORS[subject.color] || SUBJECT_COLORS.blue : SUBJECT_COLORS.blue;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] overflow-hidden"
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="absolute inset-0 bg-[#0D0D0D] overflow-y-auto"
        >
          {/* Header */}
          <div className={`sticky top-0 z-10 bg-gradient-to-br ${gradient} p-4 pb-6`}>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-black/20 backdrop-blur-sm"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            </div>
            
            {subject && (
              <div>
                <h1 className="text-2xl font-bold text-white">{subject.name}</h1>
                {subject.description && (
                  <p className="text-white/70 mt-1">{subject.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-white/60 text-sm">
                  <span>{subject.sessions?.length || 0} занятий</span>
                  <span>{subject.total_students || 0} студентов</span>
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-4 pb-24">
              {/* Add Session Button */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Занятия</h3>
                <button
                  onClick={() => setShowAddSession(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${gradient} rounded-lg text-sm text-white`}
                >
                  <Plus className="w-4 h-4" />
                  Добавить
                </button>
              </div>

              {/* Hint about schedule import */}
              {userSettings?.group_id && (!subject?.sessions || subject.sessions.length === 0) && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="flex items-start gap-2">
                    <CalendarRange className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-300">Импорт из расписания</p>
                      <p className="text-xs text-blue-400/70 mt-0.5">
                        Нажмите «Добавить» и выберите вкладку «Из расписания» для автоматического создания занятий
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sessions List */}
              {(!subject?.sessions || subject.sessions.length === 0) ? (
                <div className="text-center py-10">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Нет занятий</p>
                  <p className="text-gray-500 text-sm mt-1">Добавьте первое занятие</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subject.sessions.map((session) => {
                    const SessionIcon = SESSION_ICONS[session.type] || BookOpen;
                    const sessionGradient = SESSION_COLORS[session.type] || SESSION_COLORS.lecture;
                    
                    return (
                      <motion.div
                        key={session.session_id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowAttendance(session.session_id)}
                        className="bg-white/5 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${sessionGradient} flex items-center justify-center flex-shrink-0`}>
                              <SessionIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{session.title}</p>
                              <p className="text-sm text-gray-400 mt-0.5">
                                {new Date(session.date).toLocaleDateString('ru-RU', {
                                  day: 'numeric',
                                  month: 'long'
                                })}
                              </p>
                              {session.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{session.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${
                              session.attendance_filled === session.total_students
                                ? 'text-green-400'
                                : 'text-yellow-400'
                            }`}>
                              {session.present_count}/{session.total_students}
                            </p>
                            <p className="text-xs text-gray-500">присутствуют</p>
                            {/* Средняя оценка за сессию */}
                            {session.average_grade !== null && session.average_grade !== undefined && (
                              <p className={`text-xs mt-1 font-semibold ${
                                session.average_grade >= 4.5 ? 'text-green-400' :
                                session.average_grade >= 3.5 ? 'text-lime-400' :
                                session.average_grade >= 2.5 ? 'text-yellow-400' : 'text-orange-400'
                              }`}>
                                ⭐ {session.average_grade.toFixed(1)} ({session.grades_count})
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden mr-3">
                            <div
                              className={`h-full bg-gradient-to-r ${sessionGradient} rounded-full`}
                              style={{ width: `${(session.present_count / Math.max(1, session.total_students)) * 100}%` }}
                            />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.session_id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Create Session Modal */}
          <CreateSessionModal
            isOpen={showAddSession}
            onClose={() => setShowAddSession(false)}
            onCreate={handleCreateSession}
            onCreateFromSchedule={handleCreateFromSchedule}
            hapticFeedback={hapticFeedback}
            journalId={journalId}
            subjectId={subjectId}
            subjectName={subject?.name}
            userSettings={userSettings}
            telegramId={telegramId}
          />

          {/* Attendance Modal */}
          {showAttendance && (
            <AttendanceModal
              isOpen={!!showAttendance}
              onClose={() => {
                setShowAttendance(null);
                loadData();
              }}
              sessionId={showAttendance}
              journalId={journalId}
              telegramId={telegramId}
              hapticFeedback={hapticFeedback}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
