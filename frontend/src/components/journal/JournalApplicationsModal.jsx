/**
 * JournalApplicationsModal - Модальное окно для просмотра и обработки заявок на вступление в журнал
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Users, Check, XCircle, ExternalLink, User,
  Clock, Search, ChevronRight, Link2
} from 'lucide-react';
import { getJournalApplications, processJournalApplication, getJournalStudents } from '../../services/journalAPI';

const JournalApplicationsModal = ({ 
  isOpen, 
  onClose, 
  journalId,
  journalName,
  telegramId,
  hapticFeedback,
  onApplicationProcessed
}) => {
  const [applications, setApplications] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');

  // Загрузка заявок и студентов
  const loadData = useCallback(async () => {
    if (!journalId || !telegramId) return;
    
    setLoading(true);
    try {
      const [appsData, studentsData] = await Promise.all([
        getJournalApplications(journalId, telegramId),
        getJournalStudents(journalId)
      ]);
      
      setApplications(appsData.applications || []);
      // Фильтруем только непривязанных студентов
      setStudents((studentsData || []).filter(s => !s.is_linked));
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  }, [journalId, telegramId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setSelectedApplication(null);
      setSelectedStudentId(null);
      setSearchStudent('');
    }
  }, [isOpen, loadData]);

  // Фильтрация студентов по поиску
  const filteredStudents = students.filter(s => {
    if (!searchStudent.trim()) return true;
    return s.full_name.toLowerCase().includes(searchStudent.toLowerCase());
  });

  // Выбор заявки для обработки
  const handleSelectApplication = (app) => {
    setSelectedApplication(app);
    setSelectedStudentId(null);
    setSearchStudent('');
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('light');
    }
  };

  // Одобрение заявки
  const handleApprove = async () => {
    if (!selectedApplication || !selectedStudentId) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setProcessing(true);
    try {
      await processJournalApplication(
        selectedApplication.id,
        'approve',
        selectedStudentId,
        telegramId
      );
      
      if (hapticFeedback?.notificationOccurred) {
        hapticFeedback.notificationOccurred('success');
      }
      
      // Обновляем данные
      await loadData();
      setSelectedApplication(null);
      setSelectedStudentId(null);
      
      if (onApplicationProcessed) {
        onApplicationProcessed();
      }
    } catch (error) {
      console.error('Error approving application:', error);
      if (hapticFeedback?.notificationOccurred) {
        hapticFeedback.notificationOccurred('error');
      }
    } finally {
      setProcessing(false);
    }
  };

  // Отклонение заявки
  const handleReject = async () => {
    if (!selectedApplication) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setProcessing(true);
    try {
      await processJournalApplication(
        selectedApplication.id,
        'reject',
        null,
        telegramId
      );
      
      // Обновляем данные
      await loadData();
      setSelectedApplication(null);
      
      if (onApplicationProcessed) {
        onApplicationProcessed();
      }
    } catch (error) {
      console.error('Error rejecting application:', error);
      if (hapticFeedback?.notificationOccurred) {
        hapticFeedback.notificationOccurred('error');
      }
    } finally {
      setProcessing(false);
    }
  };

  // Открыть профиль в Telegram
  const openTelegramProfile = (app) => {
    if (app.username) {
      window.open(`https://t.me/${app.username}`, '_blank');
    } else {
      window.open(app.telegram_link, '_blank');
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
          className="bg-[#1C1C1E] w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Заявки на вступление</h2>
                <p className="text-xs text-gray-400">{journalName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">Нет новых заявок</p>
                <p className="text-gray-500 text-sm mt-1">Когда кто-то перейдёт по ссылке журнала, здесь появится заявка</p>
              </div>
            ) : !selectedApplication ? (
              /* Список заявок */
              <div className="space-y-3">
                {applications.map((app) => (
                  <motion.button
                    key={app.id}
                    onClick={() => handleSelectApplication(app)}
                    whileTap={{ scale: 0.98 }}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {(app.first_name?.[0] || app.username?.[0] || '?').toUpperCase()}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">
                          {app.full_name}
                        </div>
                        {app.username && (
                          <div className="text-sm text-blue-400 truncate">
                            @{app.username}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(app.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      
                      <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              /* Детальный просмотр заявки */
              <div className="space-y-4">
                {/* Кнопка назад */}
                <button
                  onClick={() => {
                    setSelectedApplication(null);
                    setSelectedStudentId(null);
                  }}
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  ← Назад к списку
                </button>
                
                {/* Карточка заявителя */}
                <div className="p-4 bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {(selectedApplication.first_name?.[0] || selectedApplication.username?.[0] || '?').toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-lg truncate">
                        {selectedApplication.full_name}
                      </div>
                      {selectedApplication.username && (
                        <button 
                          onClick={() => openTelegramProfile(selectedApplication)}
                          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                        >
                          @{selectedApplication.username}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        ID: {selectedApplication.telegram_id}
                      </div>
                    </div>
                    
                    {/* Кнопка открытия профиля */}
                    <button
                      onClick={() => openTelegramProfile(selectedApplication)}
                      className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-colors"
                      title="Открыть профиль в Telegram"
                    >
                      <Link2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Выбор студента */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-300">
                    Выберите студента для привязки:
                  </h3>
                  
                  {/* Поиск */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchStudent}
                      onChange={(e) => setSearchStudent(e.target.value)}
                      placeholder="Поиск студента..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 text-sm"
                    />
                  </div>
                  
                  {/* Список студентов */}
                  <div className="max-h-[200px] overflow-y-auto space-y-2">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <motion.button
                          key={student.id}
                          onClick={() => setSelectedStudentId(student.id)}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                            selectedStudentId === student.id
                              ? 'bg-orange-500/20 border-2 border-orange-500/50'
                              : 'bg-white/5 border border-transparent hover:bg-white/10'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-white">
                            {student.order + 1}
                          </div>
                          <span className="text-white flex-1">{student.full_name}</span>
                          {selectedStudentId === student.id && (
                            <Check className="w-5 h-5 text-orange-400" />
                          )}
                        </motion.button>
                      ))
                    ) : students.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">
                        Все студенты уже привязаны
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-400 text-sm">
                        Студент не найден
                      </div>
                    )}
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleReject}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-medium hover:bg-red-500/30 transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    Отклонить
                  </motion.button>
                  
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleApprove}
                    disabled={!selectedStudentId || processing}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
                      selectedStudentId && !processing
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {processing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                    Одобрить
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default JournalApplicationsModal;
