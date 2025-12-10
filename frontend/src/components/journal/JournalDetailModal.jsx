import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ArrowLeft, Users, Calendar, BarChart3, Share2, Settings, 
  UserPlus, Plus, Check, Clock, Link2, Crown, Trash2,
  BookOpen, GraduationCap, FlaskConical, FileText, Copy, ExternalLink
} from 'lucide-react';
import {
  getJournalDetail,
  getJournalStudents,
  getJournalSessions,
  getJournalSubjects,
  getPendingMembers,
  generateJournalInviteLink,
  addStudent,
  addStudentsBulk,
  linkStudent,
  deleteStudent,
  createSubject,
  deleteSubject,
  createSession,
  deleteSession,
  getSessionAttendance,
  markAttendance,
  getJournalStats
} from '../../services/journalAPI';
import { AddStudentsModal } from './AddStudentsModal';
import { CreateSessionModal } from './CreateSessionModal';
import { CreateSubjectModal } from './CreateSubjectModal';
import { SubjectDetailModal } from './SubjectDetailModal';
import { AttendanceModal } from './AttendanceModal';
import { LinkStudentModal } from './LinkStudentModal';

import { EditStudentModal } from './EditStudentModal';
import { JournalStatsTab } from './JournalStatsTab';
const COLORS = {
  purple: 'from-purple-400 to-pink-400',
  blue: 'from-blue-400 to-cyan-400',
  green: 'from-green-400 to-emerald-400',
  orange: 'from-orange-400 to-amber-400',
  red: 'from-red-400 to-rose-400',
  indigo: 'from-indigo-400 to-violet-400',
};

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

export const JournalDetailModal = ({ 
  isOpen, 
  onClose, 
  journalId, 
  telegramId, 
  hapticFeedback,
  onJournalUpdated,
  userSettings
}) => {
  const [journal, setJournal] = useState(null);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('students');
  const [isLoading, setIsLoading] = useState(true);
  const [copiedStudentId, setCopiedStudentId] = useState(null); // ID студента, чья ссылка скопирована
  const [showStatsAccessModal, setShowStatsAccessModal] = useState(false); // Модал управления доступом к статистике
  
  // Modals
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [showSubjectDetail, setShowSubjectDetail] = useState(null); // subject_id
  const [showAttendance, setShowAttendance] = useState(null); // session_id
  const [showLinkStudent, setShowLinkStudent] = useState(null); // student to link
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(null); // student to edit
  const [inviteLink, setInviteLink] = useState('');

  const loadData = useCallback(async () => {
    if (!journalId) return;
    
    setIsLoading(true);
    try {
      const [journalData, studentsData, sessionsData, subjectsData, pendingData] = await Promise.all([
        getJournalDetail(journalId, telegramId),
        getJournalStudents(journalId),
        getJournalSessions(journalId),
        getJournalSubjects(journalId),
        getPendingMembers(journalId)
      ]);
      
      setJournal(journalData);
      setStudents(studentsData);
      setSessions(sessionsData);
      setSubjects(subjectsData);
      setPendingMembers(pendingData);
    } catch (error) {
      console.error('Error loading journal data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [journalId, telegramId]);

  useEffect(() => {
    if (isOpen && journalId) {
      loadData();
    }
  }, [isOpen, journalId, loadData]);

  const handleGenerateInviteLink = async () => {
    try {
      const result = await generateJournalInviteLink(journalId);
      // Используем webapp ссылку для прямого открытия приложения
      setInviteLink(result.invite_link_webapp || result.invite_link);
      setShowInviteLink(true);
    } catch (error) {
      console.error('Error generating invite link:', error);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    if (hapticFeedback?.notificationOccurred) {
      hapticFeedback.notificationOccurred('success');
    }
  };

  // Копирование персональной ссылки студента
  const handleCopyStudentLink = async (student) => {
    // Используем webapp ссылку для прямого открытия приложения
    const linkToCopy = student.invite_link_webapp || student.invite_link;
    if (!linkToCopy) return;
    
    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopiedStudentId(student.id);
      if (hapticFeedback?.notificationOccurred) {
        hapticFeedback.notificationOccurred('success');
      }
      
      // Сбрасываем индикатор через 2 секунды
      setTimeout(() => {
        setCopiedStudentId(null);
      }, 2000);
    } catch (error) {
      console.error('Error copying student link:', error);
    }
  };

  const handleAddSingleStudent = async (fullName) => {
    try {
      await addStudent(journalId, fullName);
      loadData();
    } catch (error) {
      console.error('Error adding student:', error);
    }
  };

  const handleAddBulkStudents = async (names) => {
    try {
      await addStudentsBulk(journalId, names);
      loadData();
    } catch (error) {
      console.error('Error adding students:', error);
    }
  };

  const handleUpdateStudent = async (studentId, data) => {
    try {
      const { updateStudent } = await import('../../services/journalAPI');
      await updateStudent(journalId, studentId, data);
      loadData();
    } catch (error) {
      console.error('Error updating student:', error);
    }
  };
  
  const handleUnlinkStudent = async (studentId) => {
      try {
        const { unlinkStudent } = await import('../../services/journalAPI');
        await unlinkStudent(journalId, studentId);
        loadData();
      } catch (error) {
        console.error('Error unlinking student:', error);
      }
  };

  const handleDeleteStudent = async (studentId) => {
    // Confirmation is handled inside EditStudentModal now for this flow, 
    // but we keep this generic handler
    try {
      await deleteStudent(journalId, studentId);
      loadData();
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  };

  const handleCreateSubject = async (subjectData) => {
    try {
      await createSubject(journalId, { ...subjectData, telegram_id: telegramId });
      loadData();
    } catch (error) {
      console.error('Error creating subject:', error);
    }
  };

  const handleDeleteSubject = async (subjectId) => {
    if (!window.confirm('Удалить предмет и все его занятия?')) return;
    
    try {
      await deleteSubject(subjectId);
      loadData();
    } catch (error) {
      console.error('Error deleting subject:', error);
    }
  };

  const handleCreateSession = async (sessionData) => {
    try {
      await createSession(journalId, { ...sessionData, telegram_id: telegramId });
      loadData();
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Удалить занятие и все записи посещаемости?')) return;
    
    try {
      await deleteSession(sessionId);
      loadData();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const handleLinkStudent = async (studentId, memberData) => {
    try {
      await linkStudent(journalId, studentId, memberData);
      loadData();
      setShowLinkStudent(null);
    } catch (error) {
      console.error('Error linking student:', error);
    }
  };

  if (!isOpen) return null;

  const gradient = journal ? COLORS[journal.color] || COLORS.purple : COLORS.purple;
  const isOwner = journal?.is_owner;
  const canViewStats = journal?.can_view_stats; // Новое поле - может ли пользователь видеть статистику
  const unlinkedStudents = students.filter(s => !s.is_linked);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-hidden"
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
              {isOwner && (
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateInviteLink}
                    className="p-2 rounded-full bg-black/20 backdrop-blur-sm"
                  >
                    <Share2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              )}
            </div>
            
            {journal && (
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">{journal.name}</h1>
                  {isOwner && <Crown className="w-5 h-5 text-yellow-300" />}
                </div>
                <p className="text-white/70 mt-1">{journal.group_name}</p>
                {journal.description && (
                  <p className="text-white/50 text-sm mt-1">{journal.description}</p>
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Tabs - show for owner OR if user can view stats */}
              {(isOwner || canViewStats) && (
                <div className="flex gap-2 p-4 bg-[#0D0D0D] sticky top-[140px] z-10">
                  {[
                    // Owner sees all tabs
                    ...(isOwner ? [
                      { id: 'students', label: 'Студенты', icon: Users },
                      { id: 'sessions', label: 'Занятия', icon: Calendar },
                    ] : []),
                    // Stats tab for owner and stats_viewers
                    ...(canViewStats ? [{ id: 'stats', label: 'Статистика', icon: BarChart3 }] : []),
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${
                          activeTab === tab.id
                            ? `bg-gradient-to-br ${gradient} text-white`
                            : 'bg-white/5 text-gray-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Content */}
              <div className="p-4 pb-24">
                {/* Students Tab */}
                {activeTab === 'students' && isOwner && (
                  <div>
                    {/* Pending Members */}
                    {pendingMembers.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-medium text-yellow-500 mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Ожидают привязки ({pendingMembers.length})
                        </h3>
                        <div className="space-y-2">
                          {pendingMembers.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3"
                            >
                              <div>
                                <p className="text-white font-medium">
                                  {member.first_name || member.username || `ID: ${member.telegram_id}`}
                                </p>
                                {member.username && (
                                  <p className="text-xs text-gray-400">@{member.username}</p>
                                )}
                              </div>
                              <button
                                onClick={() => setShowLinkStudent(member)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                Привязать
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Students List */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Список студентов</h3>
                      <button
                        onClick={() => setShowAddStudents(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${gradient} rounded-lg text-sm text-white`}
                      >
                        <UserPlus className="w-4 h-4" />
                        Добавить
                      </button>
                    </div>

                    {students.length === 0 ? (
                      <div className="text-center py-10">
                        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">Список пуст</p>
                        <p className="text-gray-500 text-sm mt-1">Добавьте студентов в журнал</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {[...students]
                          .sort((a, b) => {
                            // Сортировка по фамилии (первое слово в full_name)
                            const getLastName = (name) => {
                              if (!name) return '';
                              return name.trim().split(' ')[0].toLowerCase();
                            };
                            return getLastName(a.full_name).localeCompare(getLastName(b.full_name), 'ru');
                          })
                          .map((student, index) => (
                          <motion.div
                            key={student.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="bg-white/5 rounded-xl p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-xs text-gray-500 w-6 flex-shrink-0">{index + 1}.</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium truncate">{student.full_name}</p>
                                  {student.is_linked ? (
                                    <p className="text-xs text-green-400 flex items-center gap-1">
                                      <Check className="w-3 h-3" />
                                      {student.first_name || student.username}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-500">Не привязан</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {student.attendance_percent !== null && (
                                  <span className={`text-sm font-medium ${
                                    student.attendance_percent >= 80 ? 'text-green-400' :
                                    student.attendance_percent >= 50 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {student.attendance_percent}%
                                  </span>
                                )}
                                {/* Кнопка копирования персональной ссылки */}
                                {(student.invite_link_webapp || student.invite_link) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyStudentLink(student);
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      copiedStudentId === student.id
                                        ? 'bg-green-500/20 text-green-400'
                                        : student.is_linked
                                          ? 'hover:bg-white/10 text-gray-500 hover:text-gray-400'
                                          : 'hover:bg-white/10 text-blue-400 hover:text-blue-300'
                                    }`}
                                    title={student.is_linked ? "Ссылка (место занято)" : "Скопировать ссылку"}
                                  >
                                    {copiedStudentId === student.id ? (
                                      <Check className="w-4 h-4" />
                                    ) : (
                                      <Link2 className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => setShowEditStudent(student)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Subjects Tab (instead of Sessions) */}
                {activeTab === 'sessions' && isOwner && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Предметы</h3>
                      <button
                        onClick={() => setShowCreateSubject(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${gradient} rounded-lg text-sm text-white`}
                      >
                        <Plus className="w-4 h-4" />
                        Добавить
                      </button>
                    </div>

                    {subjects.length === 0 ? (
                      <div className="text-center py-10">
                        <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">Нет предметов</p>
                        <p className="text-gray-500 text-sm mt-1">Добавьте первый предмет для ведения посещаемости</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {subjects.map((subject) => {
                          const subjectGradient = COLORS[subject.color] || COLORS.blue;
                          
                          return (
                            <motion.div
                              key={subject.subject_id}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setShowSubjectDetail(subject.subject_id)}
                              className="bg-white/5 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${subjectGradient} flex items-center justify-center flex-shrink-0`}>
                                    <BookOpen className="w-6 h-6 text-white" />
                                  </div>
                                  <div>
                                    <p className="text-white font-medium text-lg">{subject.name}</p>
                                    {subject.description && (
                                      <p className="text-sm text-gray-400 mt-0.5">{subject.description}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                      {subject.sessions_count} {subject.sessions_count === 1 ? 'занятие' : 
                                        subject.sessions_count >= 2 && subject.sessions_count <= 4 ? 'занятия' : 'занятий'}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSubject(subject.subject_id);
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

                {/* Stats Tab */}
                {activeTab === 'stats' && isOwner && (
                  <JournalStatsTab
                    journalId={journalId}
                    students={students}
                    subjects={subjects}
                    pendingMembers={pendingMembers}
                    gradient={gradient}
                  />
                )}

                {/* Non-owner view - My Attendance */}
                {!isOwner && journal && (
                  <MyAttendanceView journal={journal} telegramId={telegramId} />
                )}
              </div>
            </>
          )}

          {/* Invite Link Modal */}
          {showInviteLink && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowInviteLink(false)}>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#1C1C1E] rounded-2xl p-6 w-full max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <Link2 className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Ссылка-приглашение</h3>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Отправьте эту ссылку студентам, чтобы они могли присоединиться к журналу.
                </p>
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <p className="text-sm text-white break-all">{inviteLink}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCopyLink}
                  className={`w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${gradient}`}
                >
                  Скопировать ссылку
                </motion.button>
              </motion.div>
            </div>
          )}
        </motion.div>

        {/* Modals */}
        <AddStudentsModal
          isOpen={showAddStudents}
          onClose={() => setShowAddStudents(false)}
          onAddSingle={handleAddSingleStudent}
          onAddBulk={handleAddBulkStudents}
          hapticFeedback={hapticFeedback}
        />

        <CreateSessionModal
          isOpen={showCreateSession}
          onClose={() => setShowCreateSession(false)}
          onCreate={handleCreateSession}
          hapticFeedback={hapticFeedback}
        />

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

        {showLinkStudent && (
          <LinkStudentModal
            isOpen={!!showLinkStudent}
            onClose={() => setShowLinkStudent(null)}
            member={showLinkStudent}
            unlinkedStudents={unlinkedStudents}
            onLink={handleLinkStudent}
            hapticFeedback={hapticFeedback}
          />
        )}
        
        {showEditStudent && (
          <EditStudentModal
            isOpen={!!showEditStudent}
            onClose={() => setShowEditStudent(null)}
            student={showEditStudent}
            onUpdate={handleUpdateStudent}
            onDelete={handleDeleteStudent}
            onUnlink={handleUnlinkStudent}
            hapticFeedback={hapticFeedback}
          />
        )}

        <CreateSubjectModal
          isOpen={showCreateSubject}
          onClose={() => setShowCreateSubject(false)}
          onCreate={handleCreateSubject}
          onCreateMultiple={async (subjectsData) => {
            for (const subjectData of subjectsData) {
              await handleCreateSubject(subjectData);
            }
          }}
          hapticFeedback={hapticFeedback}
          userSettings={userSettings}
          existingSubjects={subjects}
        />

        {showSubjectDetail && (
          <SubjectDetailModal
            isOpen={!!showSubjectDetail}
            onClose={() => {
              setShowSubjectDetail(null);
              loadData();
            }}
            subjectId={showSubjectDetail}
            journalId={journalId}
            telegramId={telegramId}
            hapticFeedback={hapticFeedback}
            onSubjectUpdated={loadData}
            userSettings={userSettings}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

// My Attendance View for non-owners
const MyAttendanceView = ({ journal, telegramId }) => {
  const [attendance, setAttendance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAttendance = async () => {
      try {
        const { getMyAttendance } = await import('../../services/journalAPI');
        const data = await getMyAttendance(journal.journal_id, telegramId);
        setAttendance(data);
      } catch (error) {
        console.error('Error loading attendance:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAttendance();
  }, [journal.journal_id, telegramId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!attendance) {
    return (
      <div className="text-center py-10">
        <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
        <p className="text-white font-medium">Ожидание привязки</p>
        <p className="text-gray-400 text-sm mt-1">Староста ещё не привязал вас к имени в журнале</p>
      </div>
    );
  }

  const gradient = COLORS[journal.color] || COLORS.purple;

  return (
    <div>
      {/* Stats */}
      <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 mb-6`}>
        <p className="text-white/70 text-sm">Моя посещаемость</p>
        <p className="text-4xl font-bold text-white mt-1">{attendance.attendance_percent}%</p>
        <div className="flex gap-4 mt-3">
          <div>
            <p className="text-white font-semibold">{attendance.present_count}</p>
            <p className="text-white/60 text-xs">присутствий</p>
          </div>
          <div>
            <p className="text-white font-semibold">{attendance.absent_count}</p>
            <p className="text-white/60 text-xs">пропусков</p>
          </div>
          <div>
            <p className="text-white font-semibold">{attendance.total_sessions}</p>
            <p className="text-white/60 text-xs">занятий</p>
          </div>
        </div>
      </div>

      {/* Records */}
      <h3 className="text-lg font-semibold text-white mb-3">История посещений</h3>
      <div className="space-y-2">
        {attendance.records.map((record) => {
          const statusColors = {
            present: 'bg-green-500',
            absent: 'bg-red-500',
            excused: 'bg-gray-500',
            late: 'bg-yellow-500',
            unmarked: 'bg-gray-700'
          };
          const statusLabels = {
            present: 'Присутствовал',
            absent: 'Отсутствовал',
            excused: 'Уважительная',
            late: 'Опоздал',
            unmarked: 'Не отмечен'
          };
          
          return (
            <div
              key={record.session_id}
              className="flex items-center justify-between bg-white/5 rounded-xl p-3"
            >
              <div>
                <p className="text-white font-medium">{record.title}</p>
                <p className="text-sm text-gray-400">
                  {new Date(record.date).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long'
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${statusColors[record.status]}`} />
                <span className="text-sm text-gray-300">{statusLabels[record.status]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
