import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ArrowLeft, Users, Calendar, BarChart3, Share2, Settings, 
  UserPlus, Plus, Check, Clock, Link2, Crown, Trash2,
  BookOpen, GraduationCap, FlaskConical, FileText, Copy, ExternalLink,
  TrendingUp, Inbox, Send
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
  addStudentsFromFriends,
  linkStudent,
  deleteStudent,
  createSubject,
  deleteSubject,
  createSession,
  deleteSession,
  getSessionAttendance,
  markAttendance,
  getJournalStats,
  getJournalApplications
} from '../../services/journalAPI';
import { AddStudentsModal } from './AddStudentsModal';
import { CreateSessionModal } from './CreateSessionModal';
import { CreateSubjectModal } from './CreateSubjectModal';
import { SubjectDetailModal } from './SubjectDetailModal';
import { AttendanceModal } from './AttendanceModal';
import { LinkStudentModal } from './LinkStudentModal';
import JournalApplicationsModal from './JournalApplicationsModal';
import { ShareStudentLinkModal } from './ShareStudentLinkModal';

import { EditStudentModal } from './EditStudentModal';
import { JournalStatsTab } from './JournalStatsTab';
import { MyAttendanceStats } from './MyAttendanceStats';
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
  userSettings,
  webApp // Telegram WebApp instance для отправки ссылок
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
  const [showApplications, setShowApplications] = useState(false); // Модал заявок
  const [showShareStudentLink, setShowShareStudentLink] = useState(false); // Модал отправки ссылки студенту
  const [applicationsCount, setApplicationsCount] = useState(0); // Количество заявок
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

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
      
      // Загружаем количество заявок (только для владельца)
      if (journalData?.owner_id === telegramId) {
        try {
          const appsData = await getJournalApplications(journalId, telegramId);
          setApplicationsCount(appsData?.total || 0);
        } catch (e) {
          console.error('Error loading applications count:', e);
        }
      }
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

  // Set initial tab based on permissions
  useEffect(() => {
    if (journal) {
      const isOwner = journal.is_owner;
      const canViewStats = journal.can_view_stats;
      const isLinked = journal.is_linked;
      
      if (isOwner) {
        // Owner defaults to students tab
        setActiveTab('students');
      } else if (isLinked) {
        // Linked student sees their own stats first
        setActiveTab('my-stats');
      } else if (canViewStats) {
        // Stats viewer sees general stats
        setActiveTab('stats');
      }
    }
  }, [journal]);

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

  const handleCopyLink = async () => {
    if (!inviteLink) {
      console.error('No invite link to copy');
      return;
    }
    
    try {
      // Пробуем скопировать
      await navigator.clipboard.writeText(inviteLink);
      
      if (hapticFeedback?.notificationOccurred) {
        hapticFeedback.notificationOccurred('success');
      }
      
      // Показываем что скопировано
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      
    } catch (error) {
      console.error('Error copying link:', error);
      // Fallback: создаём временный input для копирования
      try {
        const textArea = document.createElement('textarea');
        textArea.value = inviteLink;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (hapticFeedback?.notificationOccurred) {
          hapticFeedback.notificationOccurred('success');
        }
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
      }
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

  const handleAddStudentsFromFriends = async (friends) => {
    try {
      await addStudentsFromFriends(journalId, friends);
      loadData();
    } catch (error) {
      console.error('Error adding students from friends:', error);
      throw error;
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
  const canViewStats = journal?.can_view_stats; // Может ли пользователь видеть общую статистику
  const isLinked = journal?.is_linked; // Привязан ли как студент
  const unlinkedStudents = students.filter(s => !s.is_linked);

  // Определяем какие табы показывать
  const getTabs = () => {
    const tabs = [];
    
    // Owner видит все табы
    if (isOwner) {
      tabs.push({ id: 'students', label: 'Студенты', icon: Users });
      tabs.push({ id: 'sessions', label: 'Занятия', icon: Calendar });
      tabs.push({ id: 'stats', label: 'Статистика', icon: BarChart3 });
    } else {
      // Не-owner
      // Если привязан - показываем "Моя статистика"
      if (isLinked) {
        tabs.push({ id: 'my-stats', label: 'Моя статистика', icon: TrendingUp });
      }
      // Если может видеть общую статистику (stats_viewer)
      if (canViewStats) {
        tabs.push({ id: 'stats', label: 'Общая статистика', icon: BarChart3 });
      }
    }
    
    return tabs;
  };
  
  const availableTabs = getTabs();

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
              {/* Tabs - show if there are tabs to show */}
              {availableTabs.length > 0 && (
                <div className="flex gap-2 p-4 bg-[#0D0D0D] sticky top-[140px] z-10">
                  {availableTabs.map((tab) => {
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
                      <div className="flex items-center gap-2">
                        {/* Кнопка заявок (только для владельца) */}
                        {isOwner && (
                          <button
                            onClick={() => setShowApplications(true)}
                            className="relative flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-sm hover:bg-orange-500/30 transition-colors"
                          >
                            <Inbox className="w-4 h-4" />
                            Заявки
                            {applicationsCount > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                                {applicationsCount}
                              </span>
                            )}
                          </button>
                        )}
                        <div className="relative">
                          {/* Волны пульсации когда нет студентов */}
                          {students.length === 0 && (
                            <>
                              <span 
                                className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-400 to-pink-400"
                                style={{
                                  animation: 'pulse-wave 2s ease-out infinite',
                                }}
                              />
                              <span 
                                className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-400 to-pink-400"
                                style={{
                                  animation: 'pulse-wave 2s ease-out infinite 0.5s',
                                }}
                              />
                              <style>{`
                                @keyframes pulse-wave {
                                  0% {
                                    transform: scale(1);
                                    opacity: 0.4;
                                  }
                                  100% {
                                    transform: scale(1.15);
                                    opacity: 0;
                                  }
                                }
                              `}</style>
                            </>
                          )}
                          <button
                            onClick={() => setShowAddStudents(true)}
                            className={`relative flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${gradient} rounded-lg text-sm text-white`}
                          >
                            <UserPlus className="w-4 h-4" />
                            Добавить
                          </button>
                        </div>
                      </div>
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
                                {/* Средняя оценка студента */}
                                {student.average_grade !== null && student.average_grade !== undefined && (
                                  <span className={`text-sm font-bold px-1.5 py-0.5 rounded ${
                                    student.average_grade >= 4.5 ? 'bg-green-500/20 text-green-400' :
                                    student.average_grade >= 3.5 ? 'bg-lime-500/20 text-lime-400' :
                                    student.average_grade >= 2.5 ? 'bg-yellow-500/20 text-yellow-400' :
                                    student.average_grade >= 1.5 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
                                  }`} title={`Оценок: ${student.grades_count}`}>
                                    {student.average_grade.toFixed(1)}
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

                {/* Stats Tab - visible to owner and stats_viewers */}
                {activeTab === 'stats' && canViewStats && (
                  <JournalStatsTab
                    journalId={journalId}
                    telegramId={telegramId}
                    students={students}
                    subjects={subjects}
                    pendingMembers={pendingMembers}
                    gradient={gradient}
                    isOwner={isOwner}
                    statsViewers={journal?.stats_viewers || []}
                    hapticFeedback={hapticFeedback}
                    onUpdateStatsViewers={async (newViewers) => {
                      try {
                        const { updateJournal } = await import('../../services/journalAPI');
                        await updateJournal(journalId, { stats_viewers: newViewers });
                        loadData(); // Reload to get updated data
                      } catch (error) {
                        console.error('Error updating stats viewers:', error);
                      }
                    }}
                  />
                )}

                {/* My Stats Tab - for linked students */}
                {activeTab === 'my-stats' && isLinked && (
                  <MyAttendanceStats
                    journalId={journalId}
                    telegramId={telegramId}
                    gradient={gradient}
                  />
                )}

                {/* Waiting for link - not linked and not owner */}
                {!isOwner && !isLinked && availableTabs.length === 0 && journal && (
                  <div className="text-center py-10">
                    <Clock className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                    <p className="text-white font-medium">Ожидание привязки</p>
                    <p className="text-gray-400 text-sm mt-1">Староста ещё не привязал вас к имени в журнале</p>
                  </div>
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
                  className={`w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all ${
                    linkCopied 
                      ? 'bg-green-500' 
                      : `bg-gradient-to-r ${gradient}`
                  }`}
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-5 h-5" />
                      Скопировано!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Скопировать ссылку
                    </>
                  )}
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
          onAddFromFriends={handleAddStudentsFromFriends}
          hapticFeedback={hapticFeedback}
          telegramId={telegramId}
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

        {/* Модал заявок на вступление */}
        <JournalApplicationsModal
          isOpen={showApplications}
          onClose={() => setShowApplications(false)}
          journalId={journalId}
          journalName={journal?.name}
          telegramId={telegramId}
          hapticFeedback={hapticFeedback}
          onApplicationProcessed={() => {
            loadData();
            setShowApplications(false);
          }}
        />
      </motion.div>
    </AnimatePresence>
  );
};
