/**
 * GroupSelector — пошаговый выбор Факультет → Уровень → Курс → Форма → Группа
 *
 * Используется в:
 *   1. RegisterWizard (Step 3) — variant="glass"  (внутри AuthLayout glass-карточки)
 *   2. ProfileEditScreen — variant="default"      (fullscreen overlay в основном приложении)
 *
 * Дизайн (glass variant):
 *   - Полупрозрачные frosted-glass кнопки (та же форма, новый стиль)
 *   - Inline прогресс-индикатор (не fixed bottom)
 *   - Без собственного фона (наследует от AuthLayout)
 *   - Subtle border, focus-visible ring, accent-tinted hover
 */

import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { scheduleAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

const STEPS = ['faculty', 'level', 'course', 'form', 'group'];

const GroupSelector = ({ onGroupSelected, onCancel, variant = 'default' }) => {
  const isGlass = variant === 'glass';
  const [step, setStep] = useState('faculty');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { t } = useTranslation();

  const [faculties, setFaculties] = useState([]);
  const [levels, setLevels] = useState([]);
  const [courses, setCourses] = useState([]);
  const [forms, setForms] = useState([]);
  const [groups, setGroups] = useState([]);

  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedForm, setSelectedForm] = useState(null);

  const [rudnUnavailable, setRudnUnavailable] = useState(false);

  useEffect(() => { loadFaculties(); }, []);

  const loadFaculties = async () => {
    setLoading(true); setError(null); setRudnUnavailable(false);
    try {
      const data = await scheduleAPI.getFaculties();
      setFaculties(data);
    } catch (err) {
      if (err.message && err.message.includes('rudn.ru')) setRudnUnavailable(true);
      else setError(err.message);
    } finally { setLoading(false); }
  };

  const loadLevels = async (facultyId) => {
    setLoading(true); setError(null);
    try {
      const data = await scheduleAPI.getFilterData({ facultet_id: facultyId });
      setLevels(data.levels || []); setStep('level');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const loadCourses = async (facultyId, levelId) => {
    setLoading(true); setError(null);
    try {
      const data = await scheduleAPI.getFilterData({ facultet_id: facultyId, level_id: levelId });
      setCourses(data.courses || []); setStep('course');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const loadForms = async (facultyId, levelId, courseValue) => {
    setLoading(true); setError(null);
    try {
      const data = await scheduleAPI.getFilterData({ facultet_id: facultyId, level_id: levelId, kurs: courseValue });
      setForms(data.forms || []); setStep('form');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const loadGroups = async (facultyId, levelId, courseValue, formCode) => {
    setLoading(true); setError(null);
    try {
      const data = await scheduleAPI.getFilterData({ facultet_id: facultyId, level_id: levelId, kurs: courseValue, form_code: formCode });
      setGroups(data.groups || []); setStep('group');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleFacultySelect = (faculty) => { setSelectedFaculty(faculty); loadLevels(faculty.id); };
  const handleLevelSelect = (level) => { setSelectedLevel(level); loadCourses(selectedFaculty.id, level.value); };
  const handleCourseSelect = (course) => { setSelectedCourse(course); loadForms(selectedFaculty.id, selectedLevel.value, course.value); };
  const handleFormSelect = (form) => { setSelectedForm(form); loadGroups(selectedFaculty.id, selectedLevel.value, selectedCourse.value, form.value); };

  const handleGroupSelect = (group) => {
    onGroupSelected({
      group_id: group.value,
      group_name: group.label || group.name,
      facultet_id: selectedFaculty.id,
      facultet_name: selectedFaculty.name,
      level_id: selectedLevel.value,
      kurs: selectedCourse.value,
      form_code: selectedForm.value,
    });
  };

  const handleBack = () => {
    if (step === 'level') { setStep('faculty'); setSelectedFaculty(null); }
    else if (step === 'course') { setStep('level'); setSelectedLevel(null); }
    else if (step === 'form') { setStep('course'); setSelectedCourse(null); }
    else if (step === 'group') { setStep('form'); setSelectedForm(null); }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'faculty': return t('groupSelector.selectFaculty');
      case 'level':   return t('groupSelector.selectLevel');
      case 'course':  return t('groupSelector.selectCourse');
      case 'form':    return t('groupSelector.selectForm');
      case 'group':   return t('groupSelector.selectGroup');
      default: return '';
    }
  };

  const getCurrentList = () => {
    switch (step) {
      case 'faculty': return faculties;
      case 'level':   return levels;
      case 'course':  return courses;
      case 'form':    return forms;
      case 'group':   return groups;
      default: return [];
    }
  };

  const handleItemClick = (item) => {
    switch (step) {
      case 'faculty': handleFacultySelect(item); break;
      case 'level':   handleLevelSelect(item);   break;
      case 'course':  handleCourseSelect(item);  break;
      case 'form':    handleFormSelect(item);    break;
      case 'group':   handleGroupSelect(item);   break;
    }
  };

  // ───────────────────────────────────────────────────────────────────
  // GLASS VARIANT (для RegisterWizard внутри AuthLayout)
  // ───────────────────────────────────────────────────────────────────
  if (isGlass) {
    const stepIdx = STEPS.indexOf(step);
    const breadcrumb = [
      selectedFaculty?.name,
      selectedLevel && (selectedLevel.label || selectedLevel.name),
      selectedCourse && (selectedCourse.label || selectedCourse.name),
      selectedForm && (selectedForm.label || selectedForm.name),
    ].filter(Boolean);

    return (
      <div className="space-y-3">
        {/* Header: back + title */}
        <div className="flex items-center justify-between">
          {step !== 'faculty' ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
            >
              ← {t('groupSelector.back')}
            </button>
          ) : <span />}
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/45">
            Шаг {stepIdx + 1} из {STEPS.length}
          </span>
        </div>

        <h2 className="text-[15px] font-semibold text-white/90">{getStepTitle()}</h2>

        {/* Progress (inline, не fixed) */}
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${
                i < stepIdx
                  ? 'bg-indigo-300/70'
                  : i === stepIdx
                    ? 'bg-gradient-to-r from-indigo-300 to-fuchsia-300'
                    : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Breadcrumb (текущий выбор) */}
        {breadcrumb.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/65 backdrop-blur-md">
            {breadcrumb.join(' · ')}
          </div>
        )}

        {/* RUDN unavailable */}
        {rudnUnavailable && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-400/40 bg-amber-500/[0.10] p-3 text-center text-xs text-amber-100 backdrop-blur-md"
          >
            <div className="mb-1 text-2xl">⚠️</div>
            <p className="font-semibold">Технические проблемы на стороне rudn.ru</p>
            <p className="mt-1 text-[11px] text-amber-200/75">
              Расписание и выбор группы временно недоступны. Попробуйте позже.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-400/40 bg-red-500/[0.12] p-3 text-xs text-red-200 backdrop-blur-md">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto rounded px-1 text-red-300 underline-offset-2 hover:underline"
            >
              ×
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-300/85" />
          </div>
        ) : (
          <div className="-mr-1 max-h-[44vh] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
            {getCurrentList().length === 0 ? (
              <div className="py-10 text-center text-sm text-white/45">
                {t('groupSelector.noOptions')}
              </div>
            ) : (
              getCurrentList().map((item, index) => (
                <button
                  key={item.id || item.value || index}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                  className="group relative flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-left text-sm text-white transition-all duration-200 hover:border-indigo-300/40 hover:bg-white/[0.10] hover:shadow-[0_4px_18px_-4px_rgba(129,140,248,0.35)] active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backdropFilter: 'blur(12px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(150%)',
                    boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.12)',
                  }}
                >
                  {/* Top inner highlight */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-3 top-0 h-px"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium leading-snug">
                      {item.name || item.label || item.value}
                    </p>
                    {item.disabled && (
                      <p className="mt-0.5 text-[11px] text-white/45">
                        {t('groupSelector.unavailable')}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    className="h-4 w-4 flex-shrink-0 text-white/35 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-200"
                  />
                </button>
              ))
            )}
          </div>
        )}

        {/* Cancel (для faculty step) */}
        {onCancel && step === 'faculty' && !loading && (
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-white/50 underline-offset-4 transition-colors hover:text-white/85 hover:underline"
            >
              {t('groupSelector.cancel')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // DEFAULT VARIANT (legacy, для ProfileEditScreen — fullscreen overlay)
  // ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {step !== 'faculty' && (
            <button onClick={handleBack} className="text-white/70 hover:text-white transition-colors">
              ← {t('groupSelector.back')}
            </button>
          )}
          {onCancel && step === 'faculty' && (
            <button onClick={onCancel} className="text-white/70 hover:text-white transition-colors ml-auto">
              {t('groupSelector.cancel')}
            </button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white">{getStepTitle()}</h1>
      </div>

      {rudnUnavailable && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)',
          borderRadius: '16px', padding: '24px 20px', marginBottom: '16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>⚠️</div>
          <p style={{ color: '#FACC15', fontSize: '15px', fontWeight: 600, marginBottom: '6px', lineHeight: '1.4' }}>
            Технические проблемы на стороне rudn.ru
          </p>
          <p style={{ color: 'rgba(250, 204, 21, 0.55)', fontSize: '12px', lineHeight: '1.5' }}>
            Расписание и выбор группы временно недоступны. Попробуйте позже.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
          <p className="text-red-300 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 text-xs mt-2 underline">Закрыть</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/20 border-t-indigo-300/85"></div>
        </div>
      ) : (
        <div className="space-y-2.5 pb-32">
          {getCurrentList().length === 0 ? (
            <div className="text-center py-12 text-white/50">{t('groupSelector.noOptions')}</div>
          ) : (
            getCurrentList().map((item, index) => (
              <button
                key={item.id || item.value || index}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                className="group relative flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-4 text-left transition-all duration-200 hover:border-indigo-300/40 hover:bg-white/[0.10] hover:shadow-[0_4px_18px_-4px_rgba(129,140,248,0.35)] active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backdropFilter: 'blur(14px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(14px) saturate(160%)',
                  boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.12)',
                }}
              >
                {/* Top inner highlight */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-3 top-0 h-px"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium leading-snug text-white">
                    {item.name || item.label || item.value}
                  </p>
                  {item.disabled && (
                    <p className="mt-0.5 text-[11px] text-white/50">
                      {t('groupSelector.unavailable')}
                    </p>
                  )}
                </div>
                <ChevronRight
                  className="h-4 w-4 flex-shrink-0 text-white/35 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-200"
                />
              </button>
            ))
          )}
        </div>
      )}

      <div
        className="fixed bottom-0 left-0 right-0 p-4 border-t border-white/10"
        style={{
          backgroundColor: 'rgba(28, 28, 30, 0.85)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        }}
      >
        <div className="flex justify-center space-x-2">
          {STEPS.map((s, index) => (
            <div
              key={s}
              className={`h-1.5 flex-1 max-w-12 rounded-full transition-all ${
                s === step ? 'bg-white' : index < STEPS.indexOf(step) ? 'bg-white/50' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
        {selectedFaculty && (
          <div className="mt-3 text-center text-xs text-white/50">
            {selectedFaculty.name}
            {selectedLevel && ` • ${selectedLevel.label || selectedLevel.name}`}
            {selectedCourse && ` • ${selectedCourse.label || selectedCourse.name}`}
            {selectedForm && ` • ${selectedForm.label || selectedForm.name}`}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupSelector;
