import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Plus, X, Clock, ChevronDown, ChevronUp, UserPlus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sharedScheduleAPI } from '../services/api';
import { friendsAPI } from '../services/friendsAPI';
import { useTranslation } from 'react-i18next';

const DAYS_ORDER = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const SharedScheduleView = ({ telegramId, selectedDate, onClose, hapticFeedback, onFriendPickerChange }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [sharedData, setSharedData] = useState(null);
  const [friends, setFriends] = useState([]);
  const [showFriendPicker, setShowFriendPickerRaw] = useState(false);

  // Обёртка: уведомляем родителя для скрытия нижнего меню
  const setShowFriendPicker = useCallback((value) => {
    setShowFriendPickerRaw(value);
    onFriendPickerChange?.(value);
  }, [onFriendPickerChange]);
  const [expandedWindow, setExpandedWindow] = useState(null);

  // Определяем день из selectedDate родителя
  const selectedDay = useMemo(() => {
    if (!selectedDate) {
      const now = new Date();
      const dayIdx = now.getDay();
      const mappedIdx = dayIdx === 0 ? 5 : dayIdx - 1;
      return DAYS_ORDER[Math.min(mappedIdx, 5)];
    }
    const date = new Date(selectedDate);
    const dayIdx = date.getDay();
    const mappedIdx = dayIdx === 0 ? 5 : dayIdx - 1;
    return DAYS_ORDER[Math.min(mappedIdx, 5)];
  }, [selectedDate]);

  const loadSharedSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sharedScheduleAPI.get(telegramId);
      setSharedData(data);
    } catch (err) {
      console.error('Error loading shared schedule:', err);
    } finally {
      setLoading(false);
    }
  }, [telegramId]);

  const loadFriends = useCallback(async () => {
    try {
      const data = await friendsAPI.getFriends(telegramId);
      setFriends(data?.friends || []);
    } catch (err) {
      console.error('Error loading friends:', err);
    }
  }, [telegramId]);

  useEffect(() => {
    loadSharedSchedule();
    loadFriends();
  }, [loadSharedSchedule, loadFriends]);

  const handleCreateShared = async () => {
    try {
      setLoading(true);
      hapticFeedback?.('success');
      const result = await sharedScheduleAPI.create(telegramId, []);
      if (result && result.id) {
        // Используем ответ create напрямую, добавляя exists
        setSharedData({
          exists: true,
          id: result.id,
          owner_id: result.owner_id,
          participants: result.participants || [],
          schedules: result.schedules || {},
          free_windows: result.free_windows || [],
          created_at: result.created_at,
        });
      } else {
        // Fallback: загружаем через GET
        await loadSharedSchedule();
      }
    } catch (err) {
      console.error('Error creating shared schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (friendId) => {
    if (!sharedData?.id) return;
    try {
      hapticFeedback?.('success');
      await sharedScheduleAPI.addParticipant(sharedData.id, friendId);
      setShowFriendPicker(false);
      await loadSharedSchedule();
    } catch (err) {
      console.error('Error adding participant:', err);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (!sharedData?.id) return;
    try {
      hapticFeedback?.('warning');
      await sharedScheduleAPI.removeParticipant(sharedData.id, participantId);
      await loadSharedSchedule();
    } catch (err) {
      console.error('Error removing participant:', err);
    }
  };

  // Фильтруем расписание по выбранному дню
  const daySchedules = useMemo(() => {
    if (!sharedData?.schedules || !selectedDay) return {};
    
    const result = {};
    for (const [pId, events] of Object.entries(sharedData.schedules)) {
      result[pId] = (events || []).filter(e => 
        e.day?.toLowerCase() === selectedDay.toLowerCase()
      ).sort((a, b) => {
        const timeA = a.time?.split(' - ')[0] || '';
        const timeB = b.time?.split(' - ')[0] || '';
        return timeA.localeCompare(timeB);
      });
    }
    return result;
  }, [sharedData, selectedDay]);

  // Свободные окна для выбранного дня
  const dayFreeWindows = useMemo(() => {
    if (!sharedData?.free_windows || !selectedDay) return [];
    return sharedData.free_windows.filter(w => 
      w.day?.toLowerCase() === selectedDay.toLowerCase()
    );
  }, [sharedData, selectedDay]);

  // Доступные друзья для добавления
  const availableFriends = useMemo(() => {
    if (!friends.length || !sharedData?.participants) return friends;
    const participantIds = new Set(sharedData.participants.map(p => p.telegram_id));
    return friends.filter(f => !participantIds.has(f.telegram_id));
  }, [friends, sharedData]);

  // Получаем участника по ID
  const getParticipant = (pId) => {
    return sharedData?.participants?.find(p => String(p.telegram_id) === String(pId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Если нет совместного расписания — предлагаем создать
  if (!sharedData?.exists) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-8"
      >
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Users className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            Совместное расписание
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            Найдите общие свободные окна с друзьями для встреч и совместной учёбы
          </p>
          <button
            onClick={handleCreateShared}
            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-medium transition-all duration-200 shadow-lg shadow-indigo-500/20"
          >
            <Users className="w-4 h-4 inline mr-2" />
            Создать совместное расписание
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-1"
    >
      {/* Участники */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3 px-3">
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-foreground">Участники</span>
          <button
            onClick={() => setShowFriendPicker(true)}
            className="ml-auto flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2 px-3">
          {sharedData.participants?.map((p, idx) => (
            <motion.div
              key={p.telegram_id}
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
              style={{ 
                borderColor: p.color + '40',
                backgroundColor: p.color + '15'
              }}
            >
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: p.color }}
              />
              <span className="text-foreground font-medium text-xs">{p.first_name}</span>
              {p.telegram_id !== telegramId && (
                <button
                  onClick={() => handleRemoveParticipant(p.telegram_id)}
                  className="text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Расписание */}
      <div className="space-y-2 px-3">
        {/* Свободные окна */}
        {dayFreeWindows.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Общие свободные окна
            </div>
            {dayFreeWindows.map((window, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-2xl mb-2 border border-green-400/20"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)' }}
              >
                <div className="w-10 h-10 rounded-xl bg-green-400/15 flex items-center justify-center">
                  <span className="text-green-400 text-lg">🟢</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-green-400">
                    {window.start} — {window.end}
                  </div>
                  <div className="text-xs text-green-400/60">
                    {Math.round(window.duration_minutes / 60)} ч {window.duration_minutes % 60 > 0 ? `${window.duration_minutes % 60} мин` : ''}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Расписание участников */}
        {Object.entries(daySchedules).map(([pId, events]) => {
          const participant = getParticipant(pId);
          if (!participant || events.length === 0) return null;
          
          return (
            <div key={pId} className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: participant.color }}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {participant.first_name}
                </span>
                <span className="text-xs text-muted-foreground/50">
                  ({events.length} пар)
                </span>
              </div>
              
              {events.map((event, eIdx) => (
                <motion.div
                  key={eIdx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: eIdx * 0.03 }}
                  className="flex items-start gap-3 p-2.5 rounded-xl mb-1.5"
                  style={{ 
                    backgroundColor: participant.color + '08',
                    borderLeft: `3px solid ${participant.color}40`
                  }}
                >
                  <div className="text-xs text-muted-foreground min-w-[80px] pt-0.5">
                    {event.time?.split(' - ')[0] || ''}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-foreground font-medium leading-tight">
                      {event.discipline}
                    </div>
                    {event.auditory && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {event.auditory}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          );
        })}

        {/* Если нет данных */}
        {Object.values(daySchedules).every(events => events.length === 0) && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {sharedData.participants?.length < 2 
              ? 'Добавьте друзей для сравнения расписаний'
              : 'Нет пар в этот день'}
          </div>
        )}
      </div>

      {/* Friend Picker Modal */}
      <AnimatePresence>
        {showFriendPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            onClick={() => setShowFriendPicker(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg rounded-t-3xl p-6 max-h-[60vh] overflow-y-auto"
              style={{
                backgroundColor: 'var(--tg-theme-bg-color, #1a1a2e)',
                borderTop: '1px solid rgba(255,255,255,0.1)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Добавить друга</h3>
                <button 
                  onClick={() => setShowFriendPicker(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {availableFriends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {friends.length === 0 
                    ? 'У вас пока нет друзей'
                    : 'Все друзья уже добавлены'}
                </div>
              ) : (
                <div className="space-y-2">
                  {availableFriends.map(friend => (
                    <button
                      key={friend.telegram_id}
                      onClick={() => handleAddFriend(friend.telegram_id)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-medium">
                        {friend.first_name?.[0] || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {friend.first_name} {friend.last_name || ''}
                        </div>
                        {friend.username && (
                          <div className="text-xs text-muted-foreground">@{friend.username}</div>
                        )}
                      </div>
                      <UserPlus className="w-4 h-4 text-indigo-400" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SharedScheduleView;
