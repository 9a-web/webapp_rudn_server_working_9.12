import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Users, Plus, X, Clock, UserPlus, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sharedScheduleAPI } from '../services/api';
import { friendsAPI } from '../services/friendsAPI';
import { useTranslation } from 'react-i18next';

const DAYS_ORDER = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

// ─── Timeline constants ───
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 21;
const TIMELINE_START_MIN = TIMELINE_START_HOUR * 60;
const TIMELINE_END_MIN = TIMELINE_END_HOUR * 60;
const TIMELINE_TOTAL_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN; // 780 min
const PX_PER_MIN = 1.3; // ~1014px total height
const TIMELINE_HEIGHT = TIMELINE_TOTAL_MIN * PX_PER_MIN;
const TIME_LABEL_WIDTH = 44;
const EVENT_GAP = 3; // gap between side-by-side events

// ─── Helper: parse "HH:MM" → minutes from midnight ───
const parseTime = (timeStr) => {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

// ─── Helper: minutes → "HH:MM" ───
const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

// ─── Helper: minutes → px offset from top ───
const minToPx = (minutes) => {
  return Math.max(0, (minutes - TIMELINE_START_MIN) * PX_PER_MIN);
};

// ─── Helper: duration minutes → px height ───
const durationToPx = (durationMin) => {
  return Math.max(0, durationMin * PX_PER_MIN);
};

// ───────────────────────────────────────────
// TimelineEvent — одна пара на таймлайне
// ───────────────────────────────────────────
const TimelineEvent = ({ event, color, participantName, columnIndex, totalColumns, isOwner }) => {
  const [startStr, endStr] = (event.time || '').split(' - ').map(s => s?.trim());
  const startMin = parseTime(startStr);
  const endMin = parseTime(endStr);
  
  if (startMin === null || endMin === null) return null;
  
  const top = minToPx(startMin);
  const height = durationToPx(endMin - startMin);
  const minHeight = 38;
  const displayHeight = Math.max(height, minHeight);
  const isCompact = height < 60;

  // Позиционирование: процент от ширины контейнера событий
  const colWidthPct = 100 / totalColumns;
  const leftPct = colWidthPct * columnIndex;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: columnIndex * 0.06 }}
      className="absolute rounded-xl overflow-hidden"
      style={{
        top: `${top}px`,
        height: `${displayHeight}px`,
        left: `calc(${leftPct}% + ${EVENT_GAP / 2}px)`,
        width: `calc(${colWidthPct}% - ${EVENT_GAP}px)`,
        backgroundColor: color + '14',
        borderLeft: `3.5px solid ${color}`,
        zIndex: 10,
      }}
    >
      <div className="h-full px-2.5 py-1.5 flex flex-col justify-center">
        {isCompact ? (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[11px] font-semibold text-[#1c1c1c] truncate leading-tight">
              {event.discipline}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[10px] font-medium truncate" style={{ color: color }}>
                {isOwner ? 'Вы' : participantName}
              </span>
            </div>
            <div className="text-[12px] font-semibold text-[#1c1c1c] leading-tight line-clamp-2 mb-0.5">
              {event.discipline}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#999]">
              <span>{startStr} – {endStr}</span>
              {event.auditory && (
                <>
                  <span>·</span>
                  <span className="truncate">{event.auditory}</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

// ───────────────────────────────────────────
// CurrentTimeLine — красная линия текущего времени
// ───────────────────────────────────────────
const CurrentTimeLine = () => {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
  const currentMin = now.getHours() * 60 + now.getMinutes();
  
  if (currentMin < TIMELINE_START_MIN || currentMin > TIMELINE_END_MIN) return null;
  
  const top = minToPx(currentMin);
  
  return (
    <div 
      className="absolute z-30 pointer-events-none"
      style={{ top: `${top}px`, left: '0', right: '0' }}
    >
      {/* Time label */}
      <div 
        className="absolute text-[10px] font-bold text-red-500 bg-red-500 text-white px-1 py-0.5 rounded"
        style={{ 
          left: '0', 
          top: '-8px',
          fontSize: '9px',
          lineHeight: '1',
        }}
      >
        {formatTime(currentMin)}
      </div>
      
      {/* Line */}
      <div className="absolute h-[1.5px] bg-red-500" style={{ left: `${TIME_LABEL_WIDTH - 4}px`, right: '0' }}>
        {/* Pulsing dot */}
        <div className="absolute -top-[3.5px] -left-[4px] w-[8px] h-[8px] rounded-full bg-red-500">
          <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
        </div>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────
// MAIN: SharedScheduleView
// ───────────────────────────────────────────
export const SharedScheduleView = ({ telegramId, selectedDate, onClose, hapticFeedback, onFriendPickerChange }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [sharedData, setSharedData] = useState(null);
  const [friends, setFriends] = useState([]);
  const [showFriendPicker, setShowFriendPickerRaw] = useState(false);
  const timelineRef = useRef(null);

  const setShowFriendPicker = useCallback((value) => {
    setShowFriendPickerRaw(value);
    onFriendPickerChange?.(value);
  }, [onFriendPickerChange]);

  // ─── День из selectedDate ───
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

  // ─── Data loading ───
  const loadSharedSchedule = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await sharedScheduleAPI.get(telegramId);
      setSharedData(data);
    } catch (err) {
      console.error('Error loading shared schedule:', err);
    } finally {
      if (!silent) setLoading(false);
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

  // ─── Polling: обновляем друзей и расписание каждые 15с ───
  useEffect(() => {
    if (!sharedData?.exists) return;
    
    const interval = setInterval(() => {
      loadFriends();
      loadSharedSchedule();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [sharedData?.exists, loadFriends, loadSharedSchedule]);

  // ─── При открытии friend picker — всегда обновляем список друзей ───
  useEffect(() => {
    if (showFriendPicker) {
      loadFriends();
    }
  }, [showFriendPicker, loadFriends]);

  // ─── Auto-scroll to current time on mount ───
  useEffect(() => {
    if (!loading && timelineRef.current) {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      if (currentMin >= TIMELINE_START_MIN && currentMin <= TIMELINE_END_MIN) {
        const scrollTo = minToPx(currentMin) - 100;
        timelineRef.current.scrollTop = Math.max(0, scrollTo);
      }
    }
  }, [loading, sharedData]);

  const handleCreateShared = async () => {
    try {
      setLoading(true);
      hapticFeedback?.('success');
      const result = await sharedScheduleAPI.create(telegramId, []);
      if (result && result.id) {
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

  // ─── Filter schedules for selected day ───
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

  // ─── Free windows for selected day ───
  const dayFreeWindows = useMemo(() => {
    if (!sharedData?.free_windows || !selectedDay) return [];
    return sharedData.free_windows.filter(w =>
      w.day?.toLowerCase() === selectedDay.toLowerCase()
    );
  }, [sharedData, selectedDay]);

  // ─── Friends available to add ───
  const availableFriends = useMemo(() => {
    if (!friends.length || !sharedData?.participants) return friends;
    const participantIds = new Set(sharedData.participants.map(p => p.telegram_id));
    return friends.filter(f => !participantIds.has(f.telegram_id));
  }, [friends, sharedData]);

  const getParticipant = (pId) => {
    return sharedData?.participants?.find(p => String(p.telegram_id) === String(pId));
  };

  // ─── Determine column count (how many participants have events) ───
  const activeParticipantIds = useMemo(() => {
    return Object.entries(daySchedules)
      .filter(([, events]) => events.length > 0)
      .map(([pId]) => pId);
  }, [daySchedules]);

  const totalColumns = Math.max(1, activeParticipantIds.length);

  // ─── Compute actual time range ───
  const { actualStartHour, actualEndHour } = useMemo(() => {
    let minHour = TIMELINE_END_HOUR;
    let maxHour = TIMELINE_START_HOUR;
    
    Object.values(daySchedules).forEach(events => {
      events.forEach(e => {
        const [startStr, endStr] = (e.time || '').split(' - ').map(s => s?.trim());
        const startMin = parseTime(startStr);
        const endMin = parseTime(endStr);
        if (startMin !== null) minHour = Math.min(minHour, Math.floor(startMin / 60));
        if (endMin !== null) maxHour = Math.max(maxHour, Math.ceil(endMin / 60));
      });
    });
    
    return {
      actualStartHour: Math.max(TIMELINE_START_HOUR, minHour - 1),
      actualEndHour: Math.min(TIMELINE_END_HOUR, maxHour + 1)
    };
  }, [daySchedules]);

  // ─── Hour grid lines ───
  const hourLines = useMemo(() => {
    const lines = [];
    for (let h = actualStartHour; h <= actualEndHour; h++) {
      lines.push({
        hour: h,
        label: `${h}:00`,
        top: minToPx(h * 60),
        isMain: h % 2 === 0,
      });
    }
    return lines;
  }, [actualStartHour, actualEndHour]);

  // ─── Check if today ───
  const isToday = useMemo(() => {
    const now = new Date();
    const todayDayIdx = now.getDay();
    const todayMapped = todayDayIdx === 0 ? 5 : todayDayIdx - 1;
    return selectedDay === DAYS_ORDER[Math.min(todayMapped, 5)];
  }, [selectedDay]);

  // ─── LOADING ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ─── CREATE SCREEN ───
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
          <h3 className="text-xl font-bold text-[#1c1c1c] mb-2">
            Совместное расписание
          </h3>
          <p className="text-[#888] text-sm mb-6">
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

  // ─── Check if has any events ───
  const hasAnyEvents = Object.values(daySchedules).some(events => events.length > 0);
  const displayHeight = hasAnyEvents
    ? minToPx(actualEndHour * 60) + 20
    : 200;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-1"
    >
      {/* ─── Participants bar ─── */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2.5 px-3">
          <Users className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-[#1c1c1c]">Участники</span>
          <button
            onClick={() => setShowFriendPicker(true)}
            className="ml-auto flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </button>
        </div>

        <div className="flex flex-wrap gap-2 px-3">
          {sharedData.participants?.map((p, idx) => (
            <motion.div
              key={p.telegram_id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.04 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
              style={{
                borderColor: p.color + '40',
                backgroundColor: p.color + '12',
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-[#1c1c1c] font-medium text-xs">
                {p.telegram_id === telegramId ? 'Вы' : p.first_name}
              </span>
              {p.telegram_id !== telegramId && (
                <button
                  onClick={() => handleRemoveParticipant(p.telegram_id)}
                  className="text-[#ccc] hover:text-red-400 transition-colors -mr-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* ─── Legend ─── */}
      {hasAnyEvents && dayFreeWindows.length > 0 && (
        <div className="flex items-center gap-3 px-4 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border border-dashed border-emerald-300 bg-emerald-50" />
            <span className="text-[10px] text-[#999]">Свободны оба</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-red-500 rounded" />
            <span className="text-[10px] text-[#999]">Сейчас</span>
          </div>
        </div>
      )}

      {/* ─── TIMELINE ─── */}
      {hasAnyEvents ? (
        <div
          ref={timelineRef}
          className="relative overflow-y-auto overflow-x-hidden mx-2 rounded-2xl"
          style={{
            maxHeight: 'calc(100vh - 340px)',
            backgroundColor: '#fafafa',
            border: '1px solid #f0f0f0',
          }}
        >
          <div className="relative" style={{ height: `${displayHeight}px`, minHeight: '200px' }}>
            
            {/* ─── Hour grid lines ─── */}
            {hourLines.map(({ hour, label, top, isMain }) => (
              <div key={hour} className="absolute w-full" style={{ top: `${top}px` }}>
                {/* Time label */}
                <div
                  className="absolute text-[10px] font-medium select-none"
                  style={{
                    left: '6px',
                    top: '-7px',
                    color: isMain ? '#999' : '#ccc',
                    width: `${TIME_LABEL_WIDTH - 10}px`,
                    textAlign: 'right',
                  }}
                >
                  {label}
                </div>
                
                {/* Grid line */}
                <div
                  className="absolute h-[1px]"
                  style={{
                    left: `${TIME_LABEL_WIDTH}px`,
                    right: '4px',
                    backgroundColor: isMain ? '#e8e8e8' : '#f2f2f2',
                  }}
                />
                
                {/* Half-hour line */}
                {hour < actualEndHour && (
                  <div
                    className="absolute h-[1px]"
                    style={{
                      top: `${30 * PX_PER_MIN}px`,
                      left: `${TIME_LABEL_WIDTH}px`,
                      right: '4px',
                      backgroundColor: '#f5f5f5',
                    }}
                  />
                )}
              </div>
            ))}

            {/* ─── Column headers (participant names at top) ─── */}
            {totalColumns > 1 && (
              <div
                className="sticky top-0 z-20 flex backdrop-blur-sm"
                style={{
                  paddingLeft: `${TIME_LABEL_WIDTH + 4}px`,
                  paddingRight: '4px',
                  backgroundColor: 'rgba(250, 250, 250, 0.9)',
                  borderBottom: '1px solid #eee',
                }}
              >
                {activeParticipantIds.map((pId, idx) => {
                  const participant = getParticipant(pId);
                  if (!participant) return null;
                  return (
                    <div
                      key={pId}
                      className="flex items-center justify-center gap-1.5 py-2 text-center"
                      style={{ width: `${100 / totalColumns}%` }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: participant.color }}
                      />
                      <span className="text-[10px] font-semibold" style={{ color: participant.color }}>
                        {participant.telegram_id === telegramId ? 'Вы' : participant.first_name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── Events container (positioned after time labels) ─── */}
            <div
              className="absolute"
              style={{
                top: 0,
                bottom: 0,
                left: `${TIME_LABEL_WIDTH + 4}px`,
                right: '4px',
              }}
            >
              {/* ─── Free windows ─── */}
              {dayFreeWindows.map((fw, idx) => {
                const fwStartMin = parseTime(fw.start);
                const fwEndMin = parseTime(fw.end);
                if (fwStartMin === null || fwEndMin === null) return null;
                const fwTop = minToPx(fwStartMin);
                const fwHeight = durationToPx(fwEndMin - fwStartMin);
                const duration = fw.duration_minutes;
                const hours = Math.floor(duration / 60);
                const mins = duration % 60;
                const durationText = hours > 0
                  ? `${hours}ч${mins > 0 ? ` ${mins}м` : ''}`
                  : `${mins}м`;
                const isSmall = fwHeight < 50;
                
                return (
                  <motion.div
                    key={`fw-${idx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 + idx * 0.05 }}
                    className="absolute left-0 right-0 rounded-xl overflow-hidden"
                    style={{
                      top: `${fwTop}px`,
                      height: `${fwHeight}px`,
                      zIndex: 5,
                    }}
                  >
                    <div 
                      className="absolute inset-0 opacity-[0.07]"
                      style={{
                        background: `repeating-linear-gradient(-45deg, #10b981, #10b981 4px, transparent 4px, transparent 12px)`
                      }}
                    />
                    <div className="relative h-full flex items-center justify-center gap-2 px-3">
                      {!isSmall && <Coffee className="w-3.5 h-3.5 text-emerald-600" />}
                      <div className={`font-medium text-emerald-700 ${isSmall ? 'text-[10px]' : 'text-xs'}`}>
                        {isSmall ? durationText : `Свободны ${durationText}`}
                      </div>
                      {!isSmall && (
                        <div className="text-[10px] text-emerald-600/70">
                          {fw.start} – {fw.end}
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 rounded-xl border border-dashed border-emerald-300" />
                  </motion.div>
                );
              })}

              {/* ─── Events ─── */}
              {activeParticipantIds.map((pId, colIdx) => {
                const participant = getParticipant(pId);
                const events = daySchedules[pId] || [];
                if (!participant) return null;

                return events.map((event, eIdx) => (
                  <TimelineEvent
                    key={`${pId}-${eIdx}`}
                    event={event}
                    color={participant.color}
                    participantName={participant.first_name}
                    columnIndex={colIdx}
                    totalColumns={totalColumns}
                    isOwner={participant.telegram_id === telegramId}
                  />
                ));
              })}
            </div>

            {/* ─── Current time indicator ─── */}
            {isToday && <CurrentTimeLine />}
          </div>
        </div>
      ) : (
        /* ─── Empty state ─── */
        <div className="text-center py-12 mx-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Clock className="w-7 h-7 text-gray-400" />
          </div>
          <div className="text-[#666] text-sm font-medium mb-1">
            {sharedData.participants?.length < 2
              ? 'Добавьте друзей для сравнения'
              : 'Нет пар в этот день'}
          </div>
          <div className="text-[#bbb] text-xs">
            {sharedData.participants?.length < 2
              ? 'Нажмите "Добавить" выше'
              : 'Выберите другой день недели'}
          </div>
        </div>
      )}

      {/* ─── Friend Picker Modal ─── */}
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
                borderTop: '1px solid rgba(255,255,255,0.1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Добавить друга</h3>
                <button
                  onClick={() => setShowFriendPicker(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {availableFriends.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {friends.length === 0
                    ? 'У вас пока нет друзей'
                    : 'Все друзья уже добавлены'}
                </div>
              ) : (
                <div className="space-y-2">
                  {availableFriends.map((friend) => (
                    <button
                      key={friend.telegram_id}
                      onClick={() => handleAddFriend(friend.telegram_id)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/10 hover:bg-white/15 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-medium">
                        {friend.first_name?.[0] || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">
                          {friend.first_name} {friend.last_name || ''}
                        </div>
                        {friend.username && (
                          <div className="text-xs text-gray-400">@{friend.username}</div>
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
