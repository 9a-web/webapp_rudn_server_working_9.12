/**
 * Компонент выбора группы
 * Пошаговый процесс: Факультет -> Уровень -> Курс -> Форма -> Группа
 */

import React, { useState, useEffect } from 'react';
import { scheduleAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const GroupSelector = ({ onGroupSelected, onCancel }) => {
  const [step, setStep] = useState('faculty'); // faculty, level, course, form, group
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { t } = useTranslation();

  // Данные выбора
  const [faculties, setFaculties] = useState([]);
  const [levels, setLevels] = useState([]);
  const [courses, setCourses] = useState([]);
  const [forms, setForms] = useState([]);
  const [groups, setGroups] = useState([]);

  // Выбранные значения
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedForm, setSelectedForm] = useState(null);

  // Загрузка факультетов при монтировании
  useEffect(() => {
    loadFaculties();
  }, []);

  const loadFaculties = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await scheduleAPI.getFaculties();
      setFaculties(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLevels = async (facultyId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await scheduleAPI.getFilterData({ facultet_id: facultyId });
      setLevels(data.levels || []);
      setStep('level');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async (facultyId, levelId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await scheduleAPI.getFilterData({
        facultet_id: facultyId,
        level_id: levelId,
      });
      setCourses(data.courses || []);
      setStep('course');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadForms = async (facultyId, levelId, courseValue) => {
    setLoading(true);
    setError(null);
    try {
      const data = await scheduleAPI.getFilterData({
        facultet_id: facultyId,
        level_id: levelId,
        kurs: courseValue,
      });
      setForms(data.forms || []);
      setStep('form');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async (facultyId, levelId, courseValue, formCode) => {
    setLoading(true);
    setError(null);
    try {
      const data = await scheduleAPI.getFilterData({
        facultet_id: facultyId,
        level_id: levelId,
        kurs: courseValue,
        form_code: formCode,
      });
      setGroups(data.groups || []);
      setStep('group');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFacultySelect = (faculty) => {
    setSelectedFaculty(faculty);
    loadLevels(faculty.id);
  };

  const handleLevelSelect = (level) => {
    setSelectedLevel(level);
    loadCourses(selectedFaculty.id, level.value);
  };

  const handleCourseSelect = (course) => {
    setSelectedCourse(course);
    loadForms(selectedFaculty.id, selectedLevel.value, course.value);
  };

  const handleFormSelect = (form) => {
    setSelectedForm(form);
    loadGroups(selectedFaculty.id, selectedLevel.value, selectedCourse.value, form.value);
  };

  const handleGroupSelect = (group) => {
    // Формируем полные данные о выборе
    const groupData = {
      group_id: group.value,
      group_name: group.label || group.name,
      facultet_id: selectedFaculty.id,
      facultet_name: selectedFaculty.name,
      level_id: selectedLevel.value,
      kurs: selectedCourse.value,
      form_code: selectedForm.value,
    };
    onGroupSelected(groupData);
  };

  const handleBack = () => {
    if (step === 'level') {
      setStep('faculty');
      setSelectedFaculty(null);
    } else if (step === 'course') {
      setStep('level');
      setSelectedLevel(null);
    } else if (step === 'form') {
      setStep('course');
      setSelectedCourse(null);
    } else if (step === 'group') {
      setStep('form');
      setSelectedForm(null);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'faculty':
        return t('groupSelector.selectFaculty');
      case 'level':
        return t('groupSelector.selectLevel');
      case 'course':
        return t('groupSelector.selectCourse');
      case 'form':
        return t('groupSelector.selectForm');
      case 'group':
        return t('groupSelector.selectGroup');
      default:
        return '';
    }
  };

  const getCurrentList = () => {
    switch (step) {
      case 'faculty':
        return faculties;
      case 'level':
        return levels;
      case 'course':
        return courses;
      case 'form':
        return forms;
      case 'group':
        return groups;
      default:
        return [];
    }
  };

  const handleItemClick = (item) => {
    switch (step) {
      case 'faculty':
        handleFacultySelect(item);
        break;
      case 'level':
        handleLevelSelect(item);
        break;
      case 'course':
        handleCourseSelect(item);
        break;
      case 'form':
        handleFormSelect(item);
        break;
      case 'group':
        handleGroupSelect(item);
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {step !== 'faculty' && (
            <button
              onClick={handleBack}
              className="text-white/70 hover:text-white transition-colors"
            >
              ← {t('groupSelector.back')}
            </button>
          )}
          {onCancel && step === 'faculty' && (
            <button
              onClick={onCancel}
              className="text-white/70 hover:text-white transition-colors ml-auto"
            >
              {t('groupSelector.cancel')}
            </button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white">{getStepTitle()}</h1>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
          <p className="text-red-300 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 text-xs mt-2 underline"
          >
            Закрыть
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      ) : (
        /* List of items */
        <div className="space-y-2">
          {getCurrentList().length === 0 ? (
            <div className="text-center py-12 text-white/50">
              {t('groupSelector.noOptions')}
            </div>
          ) : (
            getCurrentList().map((item, index) => (
              <button
                key={item.id || item.value || index}
                onClick={() => handleItemClick(item)}
                className="w-full rounded-2xl p-4 text-left transition-all transform hover:scale-[1.02] active:scale-[0.98] border border-white/10"
                style={{
                  backgroundColor: 'rgba(52, 52, 52, 0.6)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)'
                }}
                disabled={item.disabled}
              >
                <p className="text-white font-medium">
                  {item.name || item.label || item.value}
                </p>
                {item.disabled && (
                  <p className="text-white/50 text-sm mt-1">{t('groupSelector.unavailable')}</p>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* Progress indicator */}
      <div 
        className="fixed bottom-0 left-0 right-0 p-4 border-t border-white/10"
        style={{
          backgroundColor: 'rgba(28, 28, 30, 0.85)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)'
        }}
      >
        <div className="flex justify-center space-x-2">
          {['faculty', 'level', 'course', 'form', 'group'].map((s, index) => (
            <div
              key={s}
              className={`h-1.5 flex-1 max-w-12 rounded-full transition-all ${
                s === step
                  ? 'bg-white'
                  : index < ['faculty', 'level', 'course', 'form', 'group'].indexOf(step)
                  ? 'bg-white/50'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>
        {selectedFaculty && (
          <div className="mt-3 text-center text-xs text-white/50">
            {selectedFaculty.name}
            {selectedLevel && ` • ${selectedLevel.label || selectedLevel.name}`}
            {selectedCourse && ` • ${selectedCourse.label || selectedCourse.name} курс`}
            {selectedForm && ` • ${selectedForm.label || selectedForm.name}`}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupSelector;
