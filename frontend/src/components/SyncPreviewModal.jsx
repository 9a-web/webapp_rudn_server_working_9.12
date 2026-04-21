import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Check, Clock, MapPin, User, BookOpen, 
  CheckSquare, Square, Edit2, Save, RotateCcw,
  Calendar, RefreshCw, AlertCircle
} from 'lucide-react';

/**
 * Модальное окно для предварительного просмотра и редактирования пар
 * перед синхронизацией в планировщик
 */

const SyncPreviewModal = ({
  isOpen,
  onClose,
  previewData,
  onSync,
  isLoading,
  isSyncing,
  hapticFeedback
}) => {
  // Локальное состояние для редактирования
  const [events, setEvents] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editedEvent, setEditedEvent] = useState(null);

  // Синхронизируем previewData с локальным состоянием
  useEffect(() => {
    if (previewData?.events) {
      setEvents(previewData.events.map(event => ({
        ...event,
        selected: event.selected !== false && !event.already_synced
      })));
    }
  }, [previewData]);

  // Переключение выбора пары
  const toggleSelect = (eventId) => {
    hapticFeedback && hapticFeedback('selection');
    setEvents(prev => prev.map(event => 
      event.id === eventId && !event.already_synced
        ? { ...event, selected: !event.selected }
        : event
    ));
  };

  // Выбрать/снять все
  const toggleSelectAll = () => {
    hapticFeedback && hapticFeedback('impact', 'light');
    const allSelected = events.filter(e => !e.already_synced).every(e => e.selected);
    setEvents(prev => prev.map(event => 
      event.already_synced 
        ? event 
        : { ...event, selected: !allSelected }
    ));
  };

  // Начать редактирование
  const startEdit = (event) => {
    hapticFeedback && hapticFeedback('selection');
    setEditingId(event.id);
    setEditedEvent({ ...event });
  };

  // Сохранить редактирование
  const saveEdit = () => {
    if (!editedEvent) return;
    hapticFeedback && hapticFeedback('impact', 'medium');
    setEvents(prev => prev.map(event => 
      event.id === editingId ? { ...editedEvent } : event
    ));
    setEditingId(null);
    setEditedEvent(null);
  };

  // Отменить редактирование
  const cancelEdit = () => {
    hapticFeedback && hapticFeedback('selection');
    setEditingId(null);
    setEditedEvent(null);
  };

  // Синхронизировать выбранные
  const handleSync = () => {
    const selectedEvents = events
      .filter(e => e.selected && !e.already_synced)
      .map(e => ({
        id: e.id,
        discipline: e.discipline,
        time_start: e.time_start,
        time_end: e.time_end,
        teacher: e.teacher,
        auditory: e.auditory,
        lessonType: e.lessonType
      }));
    
    if (selectedEvents.length === 0) {
      try {
        if (window.Telegram?.WebApp?.isVersionAtLeast?.('6.2')) {
          window.Telegram.WebApp.showAlert('Выберите хотя бы одну пару для синхронизации');
        } else {
          alert('Выберите хотя бы одну пару для синхронизации');
        }
      } catch (e) { alert('Выберите хотя бы одну пару для синхронизации'); }
      return;
    }
    
    hapticFeedback && hapticFeedback('impact', 'heavy');
    onSync(selectedEvents);
  };

  // Получить цвет типа занятия
  const getLessonTypeColor = (type) => {
    switch(type?.toLowerCase()) {
      case 'лекция': return 'bg-blue-100 text-blue-700';
      case 'практика': return 'bg-green-100 text-green-700';
      case 'лабораторная': return 'bg-purple-100 text-purple-700';
      case 'семинар': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Количество выбранных
  const selectedCount = events.filter(e => e.selected && !e.already_synced).length;
  const availableCount = events.filter(e => !e.already_synced).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Заголовок */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Синхронизация пар</h2>
                <p className="text-sm text-gray-500">
                  {previewData?.day_name}, {previewData?.date}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Контент */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                <p className="text-gray-500">Загрузка расписания...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">На этот день нет пар</p>
                <p className="text-sm text-gray-400 mt-1">
                  Выберите другую дату или проверьте расписание
                </p>
              </div>
            ) : (
              <>
                {/* Кнопка выбрать все */}
                {availableCount > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {selectedCount === availableCount ? 'Снять выбор' : 'Выбрать все'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {selectedCount} из {availableCount}
                    </span>
                  </button>
                )}

                {/* Список пар */}
                {events.map((event) => (
                  <motion.div
                    key={event.id}
                    layout
                    className={`
                      p-4 rounded-xl border-2 transition-all
                      ${event.already_synced 
                        ? 'bg-gray-50 border-gray-200 opacity-60' 
                        : event.selected 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'bg-white border-gray-200'
                      }
                    `}
                  >
                    {editingId === event.id ? (
                      // Режим редактирования
                      <div className="space-y-3">
                        {/* Название предмета */}
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            Название
                          </label>
                          <input
                            type="text"
                            value={editedEvent?.discipline || ''}
                            onChange={(e) => setEditedEvent({
                              ...editedEvent,
                              discipline: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {/* Время */}
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">
                              Начало
                            </label>
                            <input
                              type="time"
                              value={editedEvent?.time_start || ''}
                              onChange={(e) => setEditedEvent({
                                ...editedEvent,
                                time_start: e.target.value
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs font-medium text-gray-500 mb-1 block">
                              Конец
                            </label>
                            <input
                              type="time"
                              value={editedEvent?.time_end || ''}
                              onChange={(e) => setEditedEvent({
                                ...editedEvent,
                                time_end: e.target.value
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        {/* Аудитория */}
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            Аудитория
                          </label>
                          <input
                            type="text"
                            value={editedEvent?.auditory || ''}
                            onChange={(e) => setEditedEvent({
                              ...editedEvent,
                              auditory: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Не указана"
                          />
                        </div>

                        {/* Преподаватель */}
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            Преподаватель
                          </label>
                          <input
                            type="text"
                            value={editedEvent?.teacher || ''}
                            onChange={(e) => setEditedEvent({
                              ...editedEvent,
                              teacher: e.target.value
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Не указан"
                          />
                        </div>

                        {/* Кнопки сохранения/отмены */}
                        <div className="flex gap-2">
                          <button
                            onClick={cancelEdit}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Отмена
                          </button>
                          <button
                            onClick={saveEdit}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                          >
                            <Save className="w-4 h-4" />
                            Сохранить
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Режим просмотра
                      <div className="flex items-start gap-3">
                        {/* Чекбокс */}
                        <button
                          onClick={() => toggleSelect(event.id)}
                          disabled={event.already_synced}
                          className="mt-1 flex-shrink-0"
                        >
                          {event.already_synced ? (
                            <div className="w-5 h-5 rounded bg-gray-300 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          ) : event.selected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        {/* Информация о паре */}
                        <div className="flex-1 min-w-0">
                          {/* Название и тип */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className={`font-medium ${event.already_synced ? 'text-gray-500' : 'text-gray-900'}`}>
                              {event.discipline}
                            </h3>
                            {event.lessonType && (
                              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${getLessonTypeColor(event.lessonType)}`}>
                                {event.lessonType}
                              </span>
                            )}
                          </div>

                          {/* Детали */}
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span>{event.time_start} – {event.time_end}</span>
                            </div>
                            
                            {event.auditory && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span>{event.auditory}</span>
                              </div>
                            )}
                            
                            {event.teacher && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="truncate">{event.teacher}</span>
                              </div>
                            )}
                          </div>

                          {/* Статус синхронизации */}
                          {event.already_synced && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                              <Check className="w-3.5 h-3.5" />
                              <span>Уже добавлено</span>
                            </div>
                          )}
                        </div>

                        {/* Кнопка редактирования */}
                        {!event.already_synced && (
                          <button
                            onClick={() => startEdit(event)}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                          >
                            <Edit2 className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </>
            )}
          </div>

          {/* Футер с кнопкой синхронизации */}
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleSync}
              disabled={isSyncing || selectedCount === 0 || isLoading}
              className={`
                w-full py-3 px-4 rounded-xl font-medium text-white
                flex items-center justify-center gap-2
                transition-all
                ${isSyncing || selectedCount === 0 || isLoading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 active:scale-[0.98]'
                }
              `}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Синхронизация...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>
                    {selectedCount > 0 
                      ? `Добавить ${selectedCount} ${selectedCount === 1 ? 'пару' : selectedCount < 5 ? 'пары' : 'пар'}`
                      : 'Выберите пары'
                    }
                  </span>
                </>
              )}
            </button>

            {previewData?.already_synced_count > 0 && (
              <p className="text-xs text-center text-gray-500 mt-2">
                {previewData.already_synced_count} {
                  previewData.already_synced_count === 1 ? 'пара уже добавлена' : 
                  previewData.already_synced_count < 5 ? 'пары уже добавлены' : 'пар уже добавлено'
                }
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SyncPreviewModal;
