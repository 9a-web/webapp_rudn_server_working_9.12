import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Palette, CalendarRange, Check, Loader2, AlertCircle, ArrowLeft, Edit3, Trash2 } from 'lucide-react';
import { scheduleAPI } from '../../services/api';

const SUBJECT_COLORS = [
  { id: 'blue', gradient: 'from-blue-400 to-cyan-400', bg: 'bg-blue-500' },
  { id: 'purple', gradient: 'from-purple-400 to-pink-400', bg: 'bg-purple-500' },
  { id: 'green', gradient: 'from-green-400 to-emerald-400', bg: 'bg-green-500' },
  { id: 'orange', gradient: 'from-orange-400 to-amber-400', bg: 'bg-orange-500' },
  { id: 'red', gradient: 'from-red-400 to-rose-400', bg: 'bg-red-500' },
  { id: 'indigo', gradient: 'from-indigo-400 to-violet-400', bg: 'bg-indigo-500' },
];

// Автоматическое назначение цвета по индексу
const getColorByIndex = (index) => {
  return SUBJECT_COLORS[index % SUBJECT_COLORS.length].id;
};

export const CreateSubjectModal = ({ 
  isOpen, 
  onClose, 
  onCreate, 
  onCreateMultiple,
  hapticFeedback,
  userSettings,
  existingSubjects = []
}) => {
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'manual'
  const [step, setStep] = useState('select'); // 'select' | 'confirm' - для вкладки расписания
  
  // Manual tab state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [isLoading, setIsLoading] = useState(false);
  
  // Schedule tab state
  const [scheduleSubjects, setScheduleSubjects] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [selectedSubjects, setSelectedSubjects] = useState(new Set());
  const [creatingFromSchedule, setCreatingFromSchedule] = useState(false);
  
  // Confirmation step state - список предметов для редактирования перед созданием
  const [subjectsToConfirm, setSubjectsToConfirm] = useState([]);
  const [editingSubjectIndex, setEditingSubjectIndex] = useState(null);

  // Загружаем расписание при открытии вкладки
  useEffect(() => {
    if (activeTab === 'schedule' && userSettings && scheduleSubjects.length === 0) {
      loadScheduleSubjects();
    }
  }, [activeTab, userSettings]);

  const loadScheduleSubjects = async () => {
    if (!userSettings?.group_id) {
      setScheduleError('Не выбрана группа в настройках');
      return;
    }
    
    setLoadingSchedule(true);
    setScheduleError(null);
    
    try {
      // Загружаем расписание обеих недель
      const [week1, week2] = await Promise.all([
        scheduleAPI.getSchedule({
          facultet_id: userSettings.facultet_id,
          level_id: userSettings.level_id,
          kurs: userSettings.kurs,
          form_code: userSettings.form_code,
          group_id: userSettings.group_id,
          week_number: 1
        }),
        scheduleAPI.getSchedule({
          facultet_id: userSettings.facultet_id,
          level_id: userSettings.level_id,
          kurs: userSettings.kurs,
          form_code: userSettings.form_code,
          group_id: userSettings.group_id,
          week_number: 2
        })
      ]);
      
      const allEvents = [
        ...(week1?.events || []),
        ...(week2?.events || [])
      ];
      
      // Извлекаем уникальные предметы
      const subjectsMap = new Map();
      allEvents.forEach(event => {
        if (event.discipline && !subjectsMap.has(event.discipline)) {
          // Собираем информацию о преподавателях
          const teachers = new Set();
          allEvents
            .filter(e => e.discipline === event.discipline && e.teacher)
            .forEach(e => teachers.add(e.teacher));
          
          subjectsMap.set(event.discipline, {
            name: event.discipline,
            teachers: Array.from(teachers),
            lessonsCount: allEvents.filter(e => e.discipline === event.discipline).length
          });
        }
      });
      
      setScheduleSubjects(Array.from(subjectsMap.values()));
    } catch (error) {
      console.error('Error loading schedule:', error);
      setScheduleError('Не удалось загрузить расписание');
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Фильтруем предметы, которые уже добавлены
  const availableSubjects = useMemo(() => {
    const existingNames = new Set(existingSubjects.map(s => s.name.toLowerCase()));
    return scheduleSubjects.filter(s => !existingNames.has(s.name.toLowerCase()));
  }, [scheduleSubjects, existingSubjects]);

  const toggleSubjectSelection = (subjectName) => {
    if (hapticFeedback?.selectionChanged) {
      hapticFeedback.selectionChanged();
    }
    
    setSelectedSubjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subjectName)) {
        newSet.delete(subjectName);
      } else {
        newSet.add(subjectName);
      }
      return newSet;
    });
  };

  const selectAllSubjects = () => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('light');
    }
    
    if (selectedSubjects.size === availableSubjects.length) {
      setSelectedSubjects(new Set());
    } else {
      setSelectedSubjects(new Set(availableSubjects.map(s => s.name)));
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setIsLoading(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        color
      });
      setName('');
      setDescription('');
      setColor('blue');
      onClose();
    } catch (error) {
      console.error('Error creating subject:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFromSchedule = async () => {
    if (selectedSubjects.size === 0) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    // Формируем список предметов для подтверждения
    const subjects = availableSubjects
      .filter(s => selectedSubjects.has(s.name))
      .map((s, index) => ({
        name: s.name,
        description: s.teachers.length > 0 ? `Преподаватель: ${s.teachers[0]}` : '',
        color: getColorByIndex(existingSubjects.length + index),
        teachers: s.teachers,
        lessonsCount: s.lessonsCount
      }));
    
    setSubjectsToConfirm(subjects);
    setStep('confirm');
  };

  // Подтверждение и создание предметов
  const handleConfirmCreate = async () => {
    if (subjectsToConfirm.length === 0) return;
    
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('medium');
    }
    
    setCreatingFromSchedule(true);
    
    try {
      const subjectsToCreate = subjectsToConfirm.map(s => ({
        name: s.name,
        description: s.description.trim() || null,
        color: s.color
      }));
      
      if (onCreateMultiple) {
        await onCreateMultiple(subjectsToCreate);
      } else {
        // Fallback: создаём по одному
        for (const subject of subjectsToCreate) {
          await onCreate(subject);
        }
      }
      
      setSelectedSubjects(new Set());
      setSubjectsToConfirm([]);
      setStep('select');
      onClose();
    } catch (error) {
      console.error('Error creating subjects from schedule:', error);
    } finally {
      setCreatingFromSchedule(false);
    }
  };

  // Обновление предмета в списке подтверждения
  const updateSubjectToConfirm = (index, field, value) => {
    setSubjectsToConfirm(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Удаление предмета из списка подтверждения
  const removeSubjectFromConfirm = (index) => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('light');
    }
    setSubjectsToConfirm(prev => prev.filter((_, i) => i !== index));
    if (subjectsToConfirm.length <= 1) {
      setStep('select');
    }
  };

  // Возврат к выбору
  const handleBackToSelect = () => {
    if (hapticFeedback?.impactOccurred) {
      hapticFeedback.impactOccurred('light');
    }
    setStep('select');
    setEditingSubjectIndex(null);
  };

  if (!isOpen) return null;

  const selectedColor = SUBJECT_COLORS.find(c => c.id === color) || SUBJECT_COLORS[0];

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
          className="bg-[#1C1C1E] w-full max-w-lg rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedColor.gradient} flex items-center justify-center`}>
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Добавить предмет</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5 bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                activeTab === 'manual'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-sm font-medium">Вручную</span>
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                activeTab === 'schedule'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <CalendarRange className="w-4 h-4" />
              <span className="text-sm font-medium">Из расписания</span>
            </button>
          </div>

          {/* Manual Tab */}
          {activeTab === 'manual' && (
            <div className="space-y-5">
              {/* Название предмета */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <BookOpen className="w-4 h-4" />
                  Название предмета
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Математический анализ"
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
                  placeholder="Лектор: Иванов И.И."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              {/* Цвет */}
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                  <Palette className="w-4 h-4" />
                  Цвет предмета
                </label>
                <div className="flex gap-3">
                  {SUBJECT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setColor(c.id)}
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} transition-all ${
                        color === c.id 
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1C1C1E] scale-110' 
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Create Button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCreate}
                disabled={!name.trim() || isLoading}
                className={`w-full py-4 rounded-2xl font-semibold text-white transition-all ${
                  name.trim() && !isLoading
                    ? `bg-gradient-to-r ${selectedColor.gradient}`
                    : 'bg-white/10 text-gray-500'
                }`}
              >
                {isLoading ? 'Создание...' : 'Добавить предмет'}
              </motion.button>
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && step === 'select' && (
            <div className="space-y-4">
              {/* Loading */}
              {loadingSchedule && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                  <p className="text-gray-400 text-sm">Загрузка расписания...</p>
                </div>
              )}

              {/* Error */}
              {scheduleError && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-red-300 text-sm">{scheduleError}</p>
                    <button
                      onClick={loadScheduleSubjects}
                      className="text-red-400 text-xs underline mt-1"
                    >
                      Попробовать снова
                    </button>
                  </div>
                </div>
              )}

              {/* Subjects List */}
              {!loadingSchedule && !scheduleError && (
                <>
                  {availableSubjects.length === 0 ? (
                    <div className="text-center py-8">
                      <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">
                        {scheduleSubjects.length === 0 
                          ? 'Предметы в расписании не найдены'
                          : 'Все предметы уже добавлены'}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        Добавьте предмет вручную
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Select All */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          Найдено предметов: {availableSubjects.length}
                        </span>
                        <button
                          onClick={selectAllSubjects}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {selectedSubjects.size === availableSubjects.length ? 'Снять все' : 'Выбрать все'}
                        </button>
                      </div>

                      {/* Subjects List */}
                      <div className="space-y-2 max-h-[350px] overflow-y-auto">
                        {availableSubjects.map((subject, index) => {
                          const isSelected = selectedSubjects.has(subject.name);
                          const subjectColor = SUBJECT_COLORS[index % SUBJECT_COLORS.length];
                          
                          return (
                            <motion.button
                              key={subject.name}
                              onClick={() => toggleSubjectSelection(subject.name)}
                              whileTap={{ scale: 0.98 }}
                              className={`w-full text-left p-3 rounded-xl border transition-all ${
                                isSelected
                                  ? 'bg-blue-500/20 border-blue-500/50'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected
                                    ? 'bg-blue-500'
                                    : 'bg-white/10 border border-white/20'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${subjectColor.gradient}`} />
                                    <span className="text-white font-medium truncate">{subject.name}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span>{subject.lessonsCount} занятий</span>
                                    {subject.teachers.length > 0 && (
                                      <span className="truncate">{subject.teachers[0]}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Continue to Confirm Button */}
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCreateFromSchedule}
                        disabled={selectedSubjects.size === 0}
                        className={`w-full py-4 rounded-2xl font-semibold text-white transition-all ${
                          selectedSubjects.size > 0
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                            : 'bg-white/10 text-gray-500'
                        }`}
                      >
                        Далее ({selectedSubjects.size})
                      </motion.button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Confirmation Step */}
          {activeTab === 'schedule' && step === 'confirm' && (
            <div className="space-y-4">
              {/* Back button and title */}
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={handleBackToSelect}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-400" />
                </button>
                <div>
                  <h3 className="text-white font-medium">Подтверждение</h3>
                  <p className="text-xs text-gray-500">Проверьте и отредактируйте данные</p>
                </div>
              </div>

              {/* Subjects to confirm */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {subjectsToConfirm.map((subject, index) => {
                  const subjectColor = SUBJECT_COLORS.find(c => c.id === subject.color) || SUBJECT_COLORS[0];
                  const isEditing = editingSubjectIndex === index;
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`bg-white/5 rounded-xl p-4 border transition-all ${
                        isEditing ? 'border-blue-500/50' : 'border-white/10'
                      }`}
                    >
                      {/* Subject header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${subjectColor.gradient}`} />
                          <span className="text-white font-medium">{subject.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingSubjectIndex(isEditing ? null : index)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isEditing 
                                ? 'bg-blue-500/20 text-blue-400' 
                                : 'hover:bg-white/10 text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {subjectsToConfirm.length > 1 && (
                            <button
                              onClick={() => removeSubjectFromConfirm(index)}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Description field */}
                      <div className="space-y-2">
                        <label className="text-xs text-gray-500">Преподаватель / Описание</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={subject.description}
                            onChange={(e) => updateSubjectToConfirm(index, 'description', e.target.value)}
                            placeholder="Преподаватель: Иванов И.И."
                            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                            autoFocus
                          />
                        ) : (
                          <p className="text-sm text-gray-400 bg-white/5 rounded-lg px-3 py-2">
                            {subject.description || <span className="text-gray-600 italic">Не указано</span>}
                          </p>
                        )}
                      </div>

                      {/* Color picker (when editing) */}
                      {isEditing && (
                        <div className="mt-3">
                          <label className="text-xs text-gray-500 mb-2 block">Цвет</label>
                          <div className="flex gap-2">
                            {SUBJECT_COLORS.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => updateSubjectToConfirm(index, 'color', c.id)}
                                className={`w-7 h-7 rounded-lg bg-gradient-to-br ${c.gradient} transition-all ${
                                  subject.color === c.id 
                                    ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1C1C1E] scale-110' 
                                    : 'opacity-50 hover:opacity-100'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Info badges */}
                      {!isEditing && subject.lessonsCount > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-600 bg-white/5 px-2 py-0.5 rounded">
                            {subject.lessonsCount} занятий в расписании
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Confirm Button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirmCreate}
                disabled={subjectsToConfirm.length === 0 || creatingFromSchedule}
                className={`w-full py-4 rounded-2xl font-semibold text-white transition-all ${
                  subjectsToConfirm.length > 0 && !creatingFromSchedule
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                    : 'bg-white/10 text-gray-500'
                }`}
              >
                {creatingFromSchedule ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Создание...
                  </span>
                ) : (
                  <>
                    <Check className="w-4 h-4 inline mr-2" />
                    Добавить {subjectsToConfirm.length} {
                      subjectsToConfirm.length === 1 ? 'предмет' :
                      subjectsToConfirm.length >= 2 && subjectsToConfirm.length <= 4 ? 'предмета' : 'предметов'
                    }
                  </>
                )}
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
