import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Users, Plus, X, Clock, UserPlus, Coffee, Trash2, AlertCircle, Share2, Copy, Check, Download, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sharedScheduleAPI } from '../services/api';
import { friendsAPI } from '../services/friendsAPI';
import { useTranslation } from 'react-i18next';

const DAYS_ORDER = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const DAYS_ACCUSATIVE = {
  'Понедельник': 'понедельник',
  'Вторник': 'вторник',
  'Среда': 'среду',
  'Четверг': 'четверг',
  'Пятница': 'пятницу',
  'Суббота': 'субботу',
};

// ─── Timeline constants ───
const TIMELINE_START_HOUR = 0;
const TIMELINE_END_HOUR = 23;
const TIMELINE_START_MIN = TIMELINE_START_HOUR * 60;
const TIMELINE_END_MIN = TIMELINE_END_HOUR * 60;
const TIMELINE_TOTAL_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN; // 1380 min
const PX_PER_MIN = 0.85; // ~1173px total height (compact enough for 23h)
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

// ─── Helper: minutes → "H:MM" ───
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
  
  if (startMin === null || endMin === null || endMin <= startMin) return null;
  
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
      className="absolute rounded-xl"
      style={{
        top: `${top}px`,
        minHeight: `${displayHeight}px`,
        left: `calc(${leftPct}% + ${EVENT_GAP / 2}px)`,
        width: `calc(${colWidthPct}% - ${EVENT_GAP}px)`,
        backgroundColor: color + '14',
        borderLeft: `3.5px solid ${color}`,
        zIndex: 10,
      }}
    >
      <div className="h-full px-2 py-1.5 flex flex-col justify-center">
        {isCompact ? (
          <div className="flex items-start gap-1">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: color }} />
            <span className="text-[10px] font-semibold text-[#1c1c1c] leading-tight break-words" style={{ wordBreak: 'break-word' }}>
              {event.discipline}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[9px] font-medium" style={{ color: color }}>
                {isOwner ? 'Вы' : participantName}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-[#1c1c1c] leading-tight mb-0.5 break-words" style={{ wordBreak: 'break-word' }}>
              {event.discipline}
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-[#999] flex-wrap">
              <span>{startStr} – {endStr}</span>
              {event.auditory && (
                <>
                  <span>·</span>
                  <span className="break-words" style={{ wordBreak: 'break-word' }}>{event.auditory}</span>
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
        className="absolute text-[9px] font-bold text-white bg-red-500 px-1 py-0.5 rounded"
        style={{ 
          left: '2px', 
          top: '-8px',
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
export const SharedScheduleView = ({ telegramId, selectedDate, weekNumber = 1, onClose, hapticFeedback, onFriendPickerChange, onShareModalChange, externalShareTrigger }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false); // БАГ-ФИХ: loading для действий
  const [sharedData, setSharedData] = useState(null);
  const [friends, setFriends] = useState([]);
  const [showFriendPicker, setShowFriendPickerRaw] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModalRaw] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const timelineRef = useRef(null);

  const setShowFriendPicker = useCallback((value) => {
    setShowFriendPickerRaw(value);
    onFriendPickerChange?.(value);
  }, [onFriendPickerChange]);

  const setShowShareModal = useCallback((value) => {
    setShowShareModalRaw(value);
    onShareModalChange?.(value);
  }, [onShareModalChange]);

  // ─── Ссылка на добавление в друзья (friend_{telegram_id}) ───
  const [friendInviteLink, setFriendInviteLink] = useState('');

  useEffect(() => {
    if (telegramId) {
      const backendUrl = import.meta.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || '';
      fetch(`${backendUrl}/api/profile/${telegramId}/qr`)
        .then(r => r.json())
        .then(data => setFriendInviteLink(data?.qr_data || ''))
        .catch(() => {});
    }
  }, [telegramId]);

  const handleInviteFriends = useCallback(() => {
    if (!friendInviteLink) return;
    const text = encodeURIComponent('Добавляй меня в друзья в RUDN Go! 📱\nТам можно удобно смотреть расписание и отслеживать окна между нашими парами 🔥');
    const url = encodeURIComponent(friendInviteLink);
    const shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  }, [friendInviteLink]);

  // ─── БАГ-ФИХ: правильный маппинг дня из selectedDate (воскресенье → нет данных) ───
  const selectedDay = useMemo(() => {
    const date = selectedDate ? new Date(selectedDate) : new Date();
    const dayIdx = date.getDay(); // 0=вс, 1=пн, ..., 6=сб
    
    // БАГ-ФИХ: воскресенье (0) → null (нет расписания), не подменяем субботой
    if (dayIdx === 0) return null;
    
    const mappedIdx = dayIdx - 1; // 1→0=пн, 2→1=вт, ..., 6→5=сб
    return DAYS_ORDER[Math.min(mappedIdx, 5)];
  }, [selectedDate]);

  // ─── Генерация изображения: state (callback ниже, после зависимостей) ───
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // ─── Data loading ───
  const loadSharedSchedule = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setErrorMsg(null);
      // БАГ-ФИХ: передаём текущую неделю
      const data = await sharedScheduleAPI.get(telegramId, weekNumber);
      setSharedData(data);
    } catch (err) {
      console.error('Error loading shared schedule:', err);
      if (!silent) setErrorMsg('Не удалось загрузить расписание');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [telegramId, weekNumber]);

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

  // БАГ-ФИХ: перезагружаем при смене недели
  useEffect(() => {
    if (sharedData?.exists) {
      loadSharedSchedule(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekNumber]);

  // Polling отключён — у каждого своя копия, не синхронизируем в реальном времени

  // ─── При открытии friend picker — всегда обновляем список друзей ───
  useEffect(() => {
    if (showFriendPicker) {
      loadFriends();
    }
  }, [showFriendPicker, loadFriends]);

  // ─── Auto-scroll to current time ТОЛЬКО при первом открытии ───
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (!loading && timelineRef.current && !hasScrolledRef.current && sharedData?.exists) {
      hasScrolledRef.current = true;
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      if (currentMin >= TIMELINE_START_MIN && currentMin <= TIMELINE_END_MIN) {
        // Учитываем смещение видимого диапазона
        const scrollTo = minToPx(currentMin) - visOffset - 100;
        timelineRef.current.scrollTop = Math.max(0, scrollTo);
      }
    }
  }, [loading, sharedData?.exists, visOffset]);

  const handleCreateShared = async () => {
    try {
      setLoading(true);
      hapticFeedback?.('success');
      const result = await sharedScheduleAPI.create(telegramId, []);
      if (result && result.id) {
        // Загружаем полные данные с расписаниями
        await loadSharedSchedule();
      } else {
        await loadSharedSchedule();
      }
    } catch (err) {
      console.error('Error creating shared schedule:', err);
      setErrorMsg('Не удалось создать расписание');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (friendId) => {
    if (!sharedData?.id) return;
    try {
      setActionLoading(true); // БАГ-ФИХ: показываем загрузку
      hapticFeedback?.('success');
      await sharedScheduleAPI.addParticipant(sharedData.id, friendId);
      setShowFriendPicker(false);
      // Мгновенно обновляем данные
      await loadSharedSchedule();
    } catch (err) {
      console.error('Error adding participant:', err);
      setErrorMsg('Не удалось добавить участника');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (!sharedData?.id) return;
    try {
      setActionLoading(true);
      hapticFeedback?.('warning');
      await sharedScheduleAPI.removeParticipant(sharedData.id, participantId);
      await loadSharedSchedule();
    } catch (err) {
      setErrorMsg('Не удалось удалить участника');
    } finally {
      setActionLoading(false);
    }
  };

  // Поделиться ссылкой на совместное расписание
  const handleShare = async () => {
    if (!sharedData?.id) return;
    try {
      setActionLoading(true);
      hapticFeedback?.('impact', 'light');
      const data = await sharedScheduleAPI.getInviteLink(sharedData.id);
      if (data?.invite_link) {
        setInviteLink(data.invite_link);
        setShowShareModal(true);
        setLinkCopied(false);
      }
    } catch (err) {
      setErrorMsg('Не удалось создать ссылку');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Открытие шаринга по внешнему триггеру (из родительской кнопки) ───
  useEffect(() => {
    if (externalShareTrigger) {
      handleShare();
    }
  }, [externalShareTrigger]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      hapticFeedback?.('success');
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // fallback для среды без clipboard API
      const el = document.createElement('textarea');
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setLinkCopied(true);
      hapticFeedback?.('success');
      setTimeout(() => setLinkCopied(false), 2500);
    }
  };

  const handleTelegramShare = () => {
    const text = encodeURIComponent('Сверим расписание? Открой, чтобы увидеть наши свободные окна 📅');
    const url = encodeURIComponent(inviteLink);
    const shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  // Кнопка «Добавить своё расписание» (устарела — оставляем как заглушку)
  const handleAddMySchedule = async () => {};

  // БАГ-ФИХ: функция удаления всего расписания
  const handleDeleteSchedule = async () => {
    if (!sharedData?.id) return;
    try {
      setActionLoading(true);
      hapticFeedback?.('warning');
      await sharedScheduleAPI.delete(sharedData.id);
      setSharedData(null);
      setShowDeleteConfirm(false);
      hapticFeedback?.('success');
    } catch (err) {
      console.error('Error deleting schedule:', err);
      setErrorMsg('Не удалось удалить расписание');
    } finally {
      setActionLoading(false);
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

  // ─── Hour grid lines (только видимый диапазон) ───
  const hourLines = useMemo(() => {
    const lines = [];
    for (let h = visStartH; h <= visEndH; h++) {
      lines.push({
        hour: h,
        label: `${h}:00`,
        top: minToPx(h * 60) - visOffset,
        isMain: h % 2 === 0,
      });
    }
    return lines;
  }, [visStartH, visEndH, visOffset]);

  // ─── Диапазон для экспорта изображения (только от первой до последней пары + 1ч отступ) ───

  // ─── Check if today ───
  const isToday = useMemo(() => {
    if (!selectedDay) return false;
    const now = new Date();
    const todayDayIdx = now.getDay();
    if (todayDayIdx === 0) return false; // воскресенье — нет расписания
    const todayMapped = todayDayIdx - 1;
    return selectedDay === DAYS_ORDER[Math.min(todayMapped, 5)];
  }, [selectedDay]);

  // ─── Dynamic visible timeline range (restrict to class hours ± 1h) ───
  const { visStartH, visEndH } = useMemo(() => {
    let minH = 9, maxH = 17; // defaults: 8:00-18:00
    Object.values(daySchedules).forEach(events => {
      events.forEach(e => {
        const [s, en] = (e.time || '').split(' - ').map(t => t?.trim());
        const sM = parseTime(s), eM = parseTime(en);
        if (sM !== null) minH = Math.min(minH, Math.floor(sM / 60));
        if (eM !== null) maxH = Math.max(maxH, Math.ceil(eM / 60));
      });
    });
    return {
      visStartH: Math.max(0, Math.min(8, minH - 1)),
      visEndH: Math.min(23, Math.max(18, maxH + 1)),
    };
  }, [daySchedules]);

  const visOffset = minToPx(visStartH * 60);
  const visHeight = minToPx(visEndH * 60) - visOffset + 20;

  // ─── Split free windows: before / within / after visible range ───
  const { beforeSummary, afterSummary, visibleFreeWindows } = useMemo(() => {
    const visStartMin = visStartH * 60;
    const visEndMin = visEndH * 60;
    let bStart = null, bEnd = null;
    let aStart = null, aEnd = null;
    const visible = [];

    dayFreeWindows.forEach(fw => {
      const fwS = parseTime(fw.start);
      let fwE = parseTime(fw.end);
      if (fw.end === '24:00') fwE = 1440;
      if (fwS === null || fwE === null) return;

      // Part before visible range
      if (fwS < visStartMin) {
        const effEnd = Math.min(fwE, visStartMin);
        if (bStart === null || fwS < bStart) bStart = fwS;
        if (bEnd === null || effEnd > bEnd) bEnd = effEnd;
      }
      // Part after visible range
      if (fwE > visEndMin) {
        const effStart = Math.max(fwS, visEndMin);
        if (aStart === null || effStart < aStart) aStart = effStart;
        if (aEnd === null || fwE > aEnd) aEnd = fwE;
      }
      // Part within visible range → clip to bounds
      const clippedS = Math.max(fwS, visStartMin);
      const clippedE = Math.min(fwE, visEndMin);
      if (clippedE > clippedS) {
        const dur = clippedE - clippedS;
        visible.push({
          ...fw,
          start: formatTime(clippedS),
          end: clippedE >= 1440 ? '24:00' : formatTime(clippedE),
          duration_minutes: dur,
          _startMin: clippedS,
          _endMin: clippedE,
        });
      }
    });

    const fmtDur = (d) => {
      const hrs = Math.floor(d / 60), mins = d % 60;
      return hrs > 0 ? `${hrs}ч${mins > 0 ? ` ${mins}м` : ''}` : `${mins}м`;
    };
    const fmtT = (m) => m >= 1440 ? '24:00' : formatTime(m);

    return {
      beforeSummary: bStart !== null && bEnd !== null && bEnd > bStart ? {
        start: fmtT(bStart), end: fmtT(bEnd), duration: bEnd - bStart, durationText: fmtDur(bEnd - bStart),
      } : null,
      afterSummary: aStart !== null && aEnd !== null && aEnd > aStart ? {
        start: fmtT(aStart), end: fmtT(aEnd), duration: aEnd - aStart, durationText: fmtDur(aEnd - aStart),
      } : null,
      visibleFreeWindows: visible,
    };
  }, [dayFreeWindows, visStartH, visEndH]);

  // ─── Проверяем является ли текущий пользователь владельцем документа ───
  // (нужно только для кнопки удаления — у каждого своё расписание)
  const isOwner = sharedData?.owner_id === telegramId || sharedData?.owner_id === String(telegramId);

  // ─── Генерация изображения расписания (Canvas API) ───
  const handleGenerateImage = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      // roundRect polyfill для старых WebView
      if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
          const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
          if (w < 2 * r) { const rr = w / 2; this.moveTo(x + rr, y); this.arcTo(x + w, y, x + w, y + h, rr); this.arcTo(x + w, y + h, x, y + h, rr); this.arcTo(x, y + h, x, y, rr); this.arcTo(x, y, x + w, y, rr); }
          else if (h < 2 * r) { const rr = h / 2; this.moveTo(x + rr, y); this.lineTo(x + w - rr, y); this.arcTo(x + w, y, x + w, y + h, rr); this.lineTo(x + w, y + h - rr); this.arcTo(x + w, y + h, x, y + h, rr); this.lineTo(x + rr, y + h); this.arcTo(x, y + h, x, y, rr); this.lineTo(x, y + rr); this.arcTo(x, y, x + w, y, rr); }
          else { this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); }
          this.closePath();
        };
      }

      const dpr = 2;
      const W = 420 * dpr;
      const PAD = 20 * dpr;
      const TLW = TIME_LABEL_WIDTH * dpr;
      const FBASE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      // Стабильная ссылка на участников (не через getParticipant)
      const participantMap = {};
      (sharedData?.participants || []).forEach(p => {
        participantMap[String(p.telegram_id)] = p;
      });

      // Форматируем дату для заголовка
      const dateObj = selectedDate ? new Date(selectedDate) : new Date();
      const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

      // ── Определяем диапазон часов ──
      let hasEvents = false;
      let minH = 23, maxH = 0;
      Object.values(daySchedules).forEach(events => {
        events.forEach(e => {
          const [s, en] = (e.time || '').split(' - ').map(t => t?.trim());
          const sM = parseTime(s), eM = parseTime(en);
          if (sM !== null) { minH = Math.min(minH, Math.floor(sM / 60)); hasEvents = true; }
          if (eM !== null) { maxH = Math.max(maxH, Math.ceil(eM / 60)); hasEvents = true; }
        });
      });

      // ── Защита от пустого расписания: startH всегда < endH ──
      let startH, endH;
      if (!hasEvents || minH > maxH) {
        startH = 8;
        endH = 18;
      } else {
        startH = Math.max(0, minH - 1);
        endH = Math.min(23, maxH + 1);
      }

      const pxPerMin = PX_PER_MIN * dpr;
      const offsetMin = startH * 60;
      const toY = (min) => (min - offsetMin) * pxPerMin;
      const timelineH = toY(endH * 60) + 10 * dpr;

      // ── Разделяем свободные окна на before/within/after ──
      const imgVisStartMin = startH * 60;
      const imgVisEndMin = endH * 60;
      let imgBefore = null, imgAfter = null;
      const imgVisibleFW = [];

      dayFreeWindows.forEach(fw => {
        const fwS = parseTime(fw.start);
        let fwE = parseTime(fw.end);
        if (fw.end === '24:00') fwE = 1440;
        if (fwS === null || fwE === null) return;

        if (fwS < imgVisStartMin) {
          const effEnd = Math.min(fwE, imgVisStartMin);
          if (!imgBefore || fwS < parseTime(imgBefore.start)) imgBefore = { start: fw.start, end: formatTime(effEnd), duration: effEnd - fwS };
          else imgBefore.duration = Math.max(imgBefore.duration, effEnd - fwS);
        }
        if (fwE > imgVisEndMin) {
          const effStart = Math.max(fwS, imgVisEndMin);
          const effEnd = fwE;
          if (!imgAfter || effStart < parseTime(imgAfter.start)) imgAfter = { start: formatTime(effStart), end: fwE >= 1440 ? '24:00' : formatTime(effEnd), duration: effEnd - effStart };
          else imgAfter.duration = Math.max(imgAfter.duration, effEnd - effStart);
        }
        const clS = Math.max(fwS, imgVisStartMin), clE = Math.min(fwE, imgVisEndMin);
        if (clE > clS) imgVisibleFW.push({ ...fw, start: formatTime(clS), end: formatTime(clE), duration_minutes: clE - clS, _sMin: clS, _eMin: clE });
      });

      const fmtDurImg = (d) => { const h = Math.floor(d / 60), m = d % 60; return h > 0 ? `${h}ч${m > 0 ? ` ${m}м` : ''}` : `${m}м`; };
      const indicatorH = 36 * dpr;
      const beforeH = imgBefore ? indicatorH : 0;
      const afterH = imgAfter ? indicatorH : 0;

      // ── Высота: header + before + timeline + after + empty + footer ──
      const headerH = 90 * dpr;
      const footerH = 30 * dpr;
      const emptyBannerH = !hasEvents ? 60 * dpr : 0;
      const H = headerH + beforeH + timelineH + afterH + emptyBannerH + footerH + PAD * 2;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // ── Фон ──
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // ── Заголовок ──
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1c1c1c';
      ctx.font = `bold ${18 * dpr}px ${FBASE}`;
      ctx.fillText('Совместное расписание', W / 2, PAD + 22 * dpr);
      ctx.fillStyle = '#888888';
      ctx.font = `${13 * dpr}px ${FBASE}`;
      ctx.fillText(`${selectedDay || ''}, ${dateStr} \u2022 Неделя ${weekNumber}`, W / 2, PAD + 42 * dpr);

      // ── Пилюли участников (все, не только active) ──
      const allParts = (sharedData?.participants || []);
      ctx.font = `600 ${10 * dpr}px ${FBASE}`;

      // Ограничиваем ширину: если не влезают — показываем первых N + «+X»
      const maxPillWidth = W - PAD * 2;
      const pillGap = 8 * dpr;
      let pillItems = [];
      let totalPW = 0;
      let overflowCount = 0;

      for (let i = 0; i < allParts.length; i++) {
        const p = allParts[i];
        const name = String(p.telegram_id) === String(telegramId) ? 'Вы' : (p.first_name || '?');
        const tw = ctx.measureText(name).width + 28 * dpr;
        const projected = totalPW + tw + pillGap;
        // Оставляем место для «+N» если ещё есть участники
        const overflowLabelW = 36 * dpr;
        if (projected > maxPillWidth && i < allParts.length - 1) {
          overflowCount = allParts.length - i;
          break;
        }
        totalPW += tw + pillGap;
        pillItems.push({ name, tw, color: p.color });
      }
      if (overflowCount > 0) {
        const label = `+${overflowCount}`;
        const ow = ctx.measureText(label).width + 20 * dpr;
        totalPW += ow;
        pillItems.push({ name: label, tw: ow, color: '#888888', isOverflow: true });
      }

      let px = (W - totalPW) / 2;
      pillItems.forEach(({ name, tw, color, isOverflow }) => {
        ctx.fillStyle = (isOverflow ? '#f0f0f0' : color + '22');
        ctx.beginPath();
        ctx.roundRect(px, PAD + 52 * dpr, tw, 20 * dpr, 10 * dpr);
        ctx.fill();
        if (!isOverflow) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(px + 10 * dpr, PAD + 62 * dpr, 3.5 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = isOverflow ? '#666' : color;
        ctx.textAlign = 'left';
        ctx.fillText(name, px + (isOverflow ? 10 : 18) * dpr, PAD + 66 * dpr);
        px += tw + pillGap;
      });

      // ── Before indicator (свободное время до видимого диапазона) ──
      if (imgBefore) {
        const biY = headerH + PAD;
        const biW = W - PAD * 2;
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 1.5 * dpr;
        ctx.fillStyle = '#ecfdf520';
        ctx.beginPath();
        ctx.roundRect(PAD, biY, biW, indicatorH - 4 * dpr, 10 * dpr);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#059669';
        ctx.font = `500 ${10 * dpr}px ${FBASE}`;
        ctx.textAlign = 'center';
        ctx.fillText(`☕ Свободны ${fmtDurImg(imgBefore.duration)} (${imgBefore.start} – ${imgBefore.end})`, W / 2, biY + indicatorH / 2);
      }

      // ── Timeline контейнер ──
      const tlX = PAD;
      const tlY = headerH + PAD + beforeH;
      const tlW = W - PAD * 2;

      ctx.fillStyle = '#fafafa';
      ctx.beginPath();
      ctx.roundRect(tlX, tlY, tlW, timelineH, 12 * dpr);
      ctx.fill();
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = dpr;
      ctx.stroke();

      // ── Часовая сетка ──
      for (let h = startH; h <= endH; h++) {
        const y = tlY + toY(h * 60);
        ctx.strokeStyle = (h % 2 === 0) ? '#e8e8e8' : '#f2f2f2';
        ctx.lineWidth = dpr;
        ctx.beginPath();
        ctx.moveTo(tlX + TLW, y);
        ctx.lineTo(tlX + tlW - 4 * dpr, y);
        ctx.stroke();
        ctx.fillStyle = (h % 2 === 0) ? '#999' : '#ccc';
        ctx.font = `500 ${10 * dpr}px ${FBASE}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${h}:00`, tlX + TLW - 6 * dpr, y + 4 * dpr);
      }

      const evX = tlX + TLW + 4 * dpr;
      const evW = tlW - TLW - 8 * dpr;
      const cols = totalColumns;

      // ── Свободные окна (только видимый диапазон) ──
      imgVisibleFW.forEach(fw => {
        const fwS = fw._sMin, fwE = fw._eMin;
        if (fwS == null || fwE == null) return;
        const y1 = tlY + toY(fwS), y2 = tlY + toY(fwE);
        if (y2 < tlY || y1 > tlY + timelineH) return;
        const fh = Math.max(y2 - y1, 20 * dpr);
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.roundRect(evX, y1, evW, fh, 10 * dpr);
        ctx.stroke();
        ctx.setLineDash([]);
        const dur = fw.duration_minutes;
        const hrs = Math.floor(dur / 60), mins = dur % 60;
        const durTxt = hrs > 0 ? `${hrs}ч${mins > 0 ? ` ${mins}м` : ''}` : `${mins}м`;
        ctx.fillStyle = '#059669';
        ctx.font = `500 ${10 * dpr}px ${FBASE}`;
        ctx.textAlign = 'center';
        ctx.fillText(`\u2615 Свободны ${durTxt} (${fw.start} \u2013 ${fw.end})`, evX + evW / 2, y1 + fh / 2 + 4 * dpr);
      });

      // ── События (пары) ──
      ctx.textAlign = 'left';
      activeParticipantIds.forEach((pId, colIdx) => {
        const participant = participantMap[String(pId)];
        const events = daySchedules[pId] || [];
        if (!participant) return;
        const colW = evW / cols;
        const cx = evX + colW * colIdx + 2 * dpr;
        const cw = colW - 4 * dpr;

        events.forEach(event => {
          const [sStr, eStr] = (event.time || '').split(' - ').map(s => s?.trim());
          const sMin = parseTime(sStr), eMin = parseTime(eStr);
          if (sMin === null || eMin === null || eMin <= sMin) return;
          const ey = tlY + toY(sMin);
          const eh = Math.max(toY(eMin) - toY(sMin), 34 * dpr);

          // Фон события
          ctx.fillStyle = participant.color + '18';
          ctx.beginPath();
          ctx.roundRect(cx, ey, cw, eh, 10 * dpr);
          ctx.fill();

          // Левая полоска
          ctx.fillStyle = participant.color;
          ctx.fillRect(cx, ey + 4 * dpr, 3.5 * dpr, eh - 8 * dpr);

          // Имя участника
          const pName = String(participant.telegram_id) === String(telegramId) ? 'Вы' : participant.first_name;
          ctx.fillStyle = participant.color;
          ctx.font = `500 ${9 * dpr}px ${FBASE}`;
          ctx.fillText(pName, cx + 10 * dpr, ey + 14 * dpr);

          // Название дисциплины (с переносом и ограничением высоты)
          ctx.fillStyle = '#1c1c1c';
          ctx.font = `600 ${11 * dpr}px ${FBASE}`;
          const maxTW = cw - 16 * dpr;
          const maxTextY = ey + eh - 18 * dpr; // не выходим за блок (оставляем место для времени)
          const discipline = event.discipline || '';
          // Разбиваем длинные слова если одно слово не влезает
          const words = discipline.split(' ');
          let line = '', ly = ey + 28 * dpr;
          let truncated = false;
          for (const word of words) {
            if (truncated) break;
            // Если одно слово шире maxTW — обрезаем его
            let w = word;
            if (ctx.measureText(w).width > maxTW) {
              while (ctx.measureText(w + '…').width > maxTW && w.length > 1) {
                w = w.slice(0, -1);
              }
              w += '…';
            }
            const test = line ? `${line} ${w}` : w;
            if (ctx.measureText(test).width > maxTW && line) {
              if (ly + 14 * dpr > maxTextY) { truncated = true; line = line + '…'; break; }
              ctx.fillText(line, cx + 10 * dpr, ly);
              ly += 14 * dpr;
              line = w;
            } else {
              line = test;
            }
          }
          if (line) {
            if (ly > maxTextY) { /* skip if already past limit */ }
            else ctx.fillText(line, cx + 10 * dpr, ly);
          }

          // Время и аудитория
          ctx.fillStyle = '#999';
          ctx.font = `${9 * dpr}px ${FBASE}`;
          const timeText = `${sStr} \u2013 ${eStr}${event.auditory ? ` \u00B7 ${event.auditory}` : ''}`;
          // Обрезаем если не влезает
          let timeLine = timeText;
          if (ctx.measureText(timeLine).width > maxTW) {
            while (ctx.measureText(timeLine + '…').width > maxTW && timeLine.length > 5) {
              timeLine = timeLine.slice(0, -1);
            }
            timeLine += '…';
          }
          ctx.fillText(timeLine, cx + 10 * dpr, ly + 14 * dpr);
        });
      });

      // ── After indicator (свободное время после видимого диапазона) ──
      if (imgAfter) {
        const aiY = tlY + timelineH + 4 * dpr;
        const aiW = W - PAD * 2;
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 1.5 * dpr;
        ctx.fillStyle = '#ecfdf520';
        ctx.beginPath();
        ctx.roundRect(PAD, aiY, aiW, indicatorH - 4 * dpr, 10 * dpr);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#059669';
        ctx.font = `500 ${10 * dpr}px ${FBASE}`;
        ctx.textAlign = 'center';
        ctx.fillText(`☕ Свободны ${fmtDurImg(imgAfter.duration)} (${imgAfter.start} – ${imgAfter.end})`, W / 2, aiY + indicatorH / 2);
      }

      // ── Баннер «Нет пар» если пустой день ──
      if (!hasEvents) {
        const bannerY = tlY + timelineH / 2 - 20 * dpr;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(W / 2 - 100 * dpr, bannerY, 200 * dpr, 40 * dpr, 12 * dpr);
        ctx.fill();
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = dpr;
        ctx.stroke();
        ctx.fillStyle = '#888';
        ctx.font = `500 ${13 * dpr}px ${FBASE}`;
        ctx.textAlign = 'center';
        ctx.fillText(`Нет пар на ${DAYS_ACCUSATIVE[selectedDay] || 'этот день'}`, W / 2, bannerY + 24 * dpr);
      }

      // ── Футер ──
      ctx.textAlign = 'center';
      ctx.fillStyle = '#bbbbbb';
      ctx.font = `${10 * dpr}px ${FBASE}`;
      ctx.fillText('RUDN GO \u2022 Совместное расписание', W / 2, H - 10 * dpr);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = `расписание_${selectedDay || 'день'}.png`;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');

      hapticFeedback?.('success');
    } catch (err) {
      console.error('Ошибка генерации изображения:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  }, [selectedDay, selectedDate, weekNumber, hapticFeedback, daySchedules, dayFreeWindows, activeParticipantIds, totalColumns, telegramId, sharedData]);

  // ─── LOADING ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ─── Уведомление об ошибке ───
  const ErrorBanner = errorMsg ? (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mx-4 mb-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2"
    >
      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
      <span className="text-sm text-red-600">{errorMsg}</span>
      <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-600">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  ) : null;

  // ─── CREATE SCREEN ───
  if (!sharedData?.exists) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-8"
      >
        <AnimatePresence>{ErrorBanner}</AnimatePresence>
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Users className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-[#1c1c1c] mb-2">
            Сверить расписание
          </h3>
          <p className="text-[#888] text-sm mb-6">
            Сравните расписания с друзьями и найдите время для встречи
          </p>
          <button
            onClick={handleCreateShared}
            disabled={actionLoading}
            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl font-medium transition-all duration-200 shadow-lg shadow-indigo-500/20"
          >
            <Users className="w-4 h-4 inline mr-2" />
            Сверить с друзьями
          </button>
        </div>
      </motion.div>
    );
  }

  // ─── Воскресенье — нет расписания ───
  if (selectedDay === null) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-1">
        {/* Participants bar */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2.5 px-3">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium text-[#1c1c1c]">Участники</span>
            {isOwner && (
              <button
                onClick={() => setShowFriendPicker(true)}
                disabled={actionLoading}
                className="ml-auto flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 transition-colors font-medium disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить
              </button>
            )}
            <button
              onClick={handleShare}
              disabled={actionLoading}
              className={`flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 transition-colors font-medium px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 ${isOwner ? '' : 'ml-auto'}`}
            >
              <Share2 className="w-3.5 h-3.5" />
              Поделиться
            </button>
            {isOwner && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={actionLoading}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                title="Удалить расписание"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 px-3">
            {sharedData.participants?.map((p, idx) => {
              const isMe = String(p.telegram_id) === String(telegramId);
              const isParticipantOwner = String(p.telegram_id) === String(sharedData.owner_id);
              const canRemove = (!isParticipantOwner && isMe) || (isOwner && !isMe);
              return (
                <div
                  key={p.telegram_id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
                  style={{ borderColor: p.color + '40', backgroundColor: p.color + '12' }}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-[#1c1c1c] font-medium text-xs">
                    {isMe ? 'Вы' : p.first_name}
                  </span>
                  {canRemove && (
                    <button
                      onClick={() => handleRemoveParticipant(p.telegram_id)}
                      disabled={actionLoading}
                      className="text-[#ccc] hover:text-red-400 transition-colors -mr-1 disabled:opacity-30"
                      title={isMe ? 'Покинуть расписание' : 'Удалить участника'}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-center py-12 mx-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Clock className="w-7 h-7 text-gray-400" />
          </div>
          <div className="text-[#666] text-sm font-medium mb-1">В воскресенье занятий нет</div>
          <div className="text-[#bbb] text-xs">Выберите рабочий день недели</div>
        </div>
      </motion.div>
    );
  }

  // ─── Check if has any events ───
  const hasAnyEvents = Object.values(daySchedules).some(events => events.length > 0);
  const displayHeight = visHeight; // сжатый видимый диапазон вместо полных суток

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-1"
    >
      {/* Ошибка */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-3 mb-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-600">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Participants bar ─── */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2.5 px-3">
          <Users className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-[#1c1c1c]">Участники</span>

          {/* Кнопка "Добавить" — у всех */}
          <button
            onClick={() => setShowFriendPicker(true)}
            disabled={actionLoading || (sharedData.participants?.length || 0) >= 8}
            className="ml-auto flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            title={(sharedData.participants?.length || 0) >= 8 ? 'Максимум 8 участников' : 'Добавить'}
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </button>

          {/* Кнопка удалить расписание — у всех (личное расписание) */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={actionLoading}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
            title="Удалить расписание"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Список участников */}
        <div className="flex flex-wrap gap-2 px-3">
          {sharedData.participants?.map((p, idx) => {
            const isMe = String(p.telegram_id) === String(telegramId);
            // Можно удалить любого КРОМЕ себя (себя нельзя — удали расписание целиком)
            const canRemove = !isMe;

            return (
              <motion.div
                key={p.telegram_id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
                style={{ borderColor: p.color + '40', backgroundColor: p.color + '12' }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-[#1c1c1c] font-medium text-xs">
                  {isMe ? 'Вы' : p.first_name}
                </span>
                {canRemove && (
                  <button
                    onClick={() => handleRemoveParticipant(p.telegram_id)}
                    disabled={actionLoading}
                    className="text-[#ccc] hover:text-red-400 transition-colors -mr-1 disabled:opacity-30"
                    title="Убрать из расписания"
                  >
                    {actionLoading ? (
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Подсказка при 1 участнике */}
        {(sharedData.participants?.length || 0) < 2 && (
          <div className="mx-3 mt-2 p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center gap-2">
            <UserPlus className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="text-xs text-indigo-500">
              {isOwner
                ? 'Добавьте друга, чтобы увидеть общие свободные окна'
                : 'Поделитесь ссылкой, чтобы добавить других'}
            </span>
          </div>
        )}

      </div>

      {/* ─── Legend ─── */}
      {(hasAnyEvents || isToday) && (
        <div className="flex items-center gap-3 px-4 mb-3">
          {dayFreeWindows.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-dashed border-emerald-300 bg-emerald-50" />
              <span className="text-[10px] text-[#999]">
                {(sharedData.participants?.length || 0) >= 2 ? 'Свободны все' : 'Свободное время'}
              </span>
            </div>
          )}
          {isToday && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-red-500 rounded" />
              <span className="text-[10px] text-[#999]">Сейчас</span>
            </div>
          )}
        </div>
      )}

      {/* ─── TIMELINE (всегда отображается) ─── */}
      <div
        ref={timelineRef}
        className="relative overflow-y-auto overflow-x-hidden mx-2 rounded-2xl scrollbar-hide"
        style={{
          maxHeight: 'calc(100vh - 360px)',
          backgroundColor: '#fafafa',
          border: '1px solid #f0f0f0',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* ─── Before indicator: свободное время ДО видимого диапазона ─── */}
        {beforeSummary && (
          <div className="relative mx-2 mt-2 mb-1 px-3 py-2.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 flex items-center gap-2 justify-center">
            <Coffee className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-medium text-emerald-700">
              Свободны {beforeSummary.durationText}
            </span>
            <span className="text-[10px] text-emerald-600/70">
              {beforeSummary.start} – {beforeSummary.end}
            </span>
          </div>
        )}

        {/* ─── Column headers (participant names) ─── */}
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

        {/* ─── Clipped timeline area ─── */}
        <div className="relative overflow-hidden" style={{ height: `${displayHeight}px`, minHeight: '200px' }}>
          <div className="relative" style={{ height: `${TIMELINE_HEIGHT + 20}px`, transform: `translateY(-${visOffset}px)` }}>

          {/* ─── Hour grid lines ─── */}
          {hourLines.map(({ hour, label, top, isMain }) => (
            <div key={hour} className="absolute w-full" style={{ top: `${top + visOffset}px` }}>
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
              {hour < visEndH && (
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
            {/* ─── Free windows (только видимый диапазон) ─── */}
            {visibleFreeWindows.map((fw, idx) => {
              const fwStartMin = fw._startMin;
              const fwEndMin = fw._endMin;
              if (fwStartMin == null || fwEndMin == null) return null;
              const fwTop = minToPx(fwStartMin);
              const fwHeight = durationToPx(fwEndMin - fwStartMin);
              const duration = fw.duration_minutes;
              const hours = Math.floor(duration / 60);
              const mins = duration % 60;
              const durationText = hours > 0
                ? `${hours}ч${mins > 0 ? ` ${mins}м` : ''}`
                : `${mins}м`;
              const isSmall = fwHeight < 40;
              
              return (
                <motion.div
                  key={`fw-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 + idx * 0.05 }}
                  className="absolute left-0 right-0 rounded-xl overflow-hidden"
                  style={{
                    top: `${fwTop}px`,
                    height: `${Math.max(fwHeight, 24)}px`,
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

          {/* ─── Подсказка "нет пар" поверх таймлайна ─── */}
          {!hasAnyEvents && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center px-4 py-3 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-200/60 shadow-sm">
                <div className="text-[#888] text-sm font-medium">
                  Нет пар на {DAYS_ACCUSATIVE[selectedDay] || 'этот день'}
                </div>
              </div>
            </div>
          )}

          </div>
        </div>

        {/* ─── After indicator: свободное время ПОСЛЕ видимого диапазона ─── */}
        {afterSummary && (
          <div className="relative mx-2 mt-1 mb-2 px-3 py-2.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 flex items-center gap-2 justify-center">
            <Coffee className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-medium text-emerald-700">
              Свободны {afterSummary.durationText}
            </span>
            <span className="text-[10px] text-emerald-600/70">
              {afterSummary.start} – {afterSummary.end}
            </span>
          </div>
        )}
      </div>

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
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg rounded-t-3xl p-6 max-h-[65vh] overflow-y-auto"
              style={{
                backgroundColor: '#ffffff', /* БАГ-ФИХ: светлый фон вместо тёмного */
                borderTop: '1px solid #e5e7eb',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Добавить друга</h3>
                <button
                  onClick={() => setShowFriendPicker(false)}
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full" />
                </div>
              ) : availableFriends.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
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
                      disabled={actionLoading}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                        {friend.first_name?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {friend.first_name} {friend.last_name || ''}
                        </div>
                        {friend.username && (
                          <div className="text-xs text-gray-400 truncate">@{friend.username}</div>
                        )}
                      </div>
                      <UserPlus className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* ─── Кнопка «Добавить друзей» — всегда видна ─── */}
              <button
                onClick={handleInviteFriends}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
              >
                <Share2 className="w-4 h-4" />
                Добавить друзей
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Delete Confirmation Modal ─── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-5">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Удалить расписание?</h3>
                <p className="text-sm text-gray-500">
                  Все участники будут удалены из совместного расписания
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-2xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDeleteSchedule}
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-2xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    'Удалить'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Share Modal ─── */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            onClick={() => setShowShareModal(false)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Share2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Поделиться расписанием</h3>
                  <p className="text-xs text-gray-500">Друг откроет ссылку и автоматически присоединится</p>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Link box */}
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-200 mb-4">
                <span className="flex-1 text-xs text-gray-500 truncate font-mono">{inviteLink}</span>
                <button
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex-shrink-0 ${
                    linkCopied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Копировать
                    </>
                  )}
                </button>
              </div>

              {/* Telegram share button */}
              <button
                onClick={handleTelegramShare}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-[#2AABEE] hover:bg-[#1e9bd6] active:scale-[0.98] transition-all text-white font-semibold text-sm shadow-lg shadow-blue-400/20 mb-3"
              >
                {/* Telegram icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
                </svg>
                Отправить в Telegram
              </button>

              {/* Сохранить изображение */}
              <button
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 active:scale-[0.98] transition-all text-white font-semibold text-sm shadow-lg shadow-purple-400/20 disabled:opacity-60"
              >
                {isGeneratingImage ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Image className="w-5 h-5" />
                    Сохранить изображение
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default SharedScheduleView;
