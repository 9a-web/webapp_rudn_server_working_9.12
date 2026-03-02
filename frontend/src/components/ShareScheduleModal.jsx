import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check, X, Send, Smartphone } from 'lucide-react';
import { botAPI, achievementsAPI } from '../services/api';
import { groupScheduleItems } from '../utils/scheduleUtils';
import { fetchBotInfo as fetchBotInfoUtil } from '../utils/botInfo';

/**
 * Компонент для шаринга обычного расписания
 * UI и функционал идентичен модалке "Поделиться окнами" из SharedScheduleView
 */
export const ShareScheduleModal = ({ 
  isOpen, 
  onClose, 
  schedule, 
  selectedDate,
  groupName,
  hapticFeedback,
  telegramId
}) => {
  const [copied, setCopied] = useState(false);
  const [botUsername, setBotUsername] = useState('bot');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSendingToBot, setIsSendingToBot] = useState(false);
  const [imageSentToBot, setImageSentToBot] = useState(false);

  // Получаем информацию о боте при монтировании
  useEffect(() => {
    fetchBotInfoUtil().then(info => {
      if (info.username) setBotUsername(info.username);
    });
  }, []);

  if (!isOpen) return null;

  // Форматирование даты
  const formatDate = (date) => {
    return date.toLocaleDateString('ru-RU', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  const dayName = selectedDate.toLocaleDateString('ru-RU', { weekday: 'long' });
  const formattedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const todaySchedule = groupScheduleItems(schedule.filter(item => item.day === formattedDayName));

  // Генерация текста расписания
  const generateScheduleText = () => {
    const dateStr = formatDate(selectedDate);

    if (todaySchedule.length === 0) {
      return `📅 Расписание на ${dateStr}\n${groupName ? `Группа: ${groupName}\n` : ''}\n✨ Пар нет! Свободный день! 🎉`;
    }

    let text = `📅 Расписание на ${dateStr}\n`;
    if (groupName) {
      text += `👥 Группа: ${groupName}\n`;
    }
    text += `\n`;

    todaySchedule.forEach((classItem, index) => {
      text += `${index + 1}. ${classItem.discipline}\n`;
      text += `   ⏰ ${classItem.time}\n`;
      
      if (classItem.subItems) {
        classItem.subItems.forEach((subItem) => {
          if (subItem.auditory) {
            text += `   📍 ${subItem.auditory}\n`;
          }
          if (subItem.teacher) {
            text += `   👨‍🏫 ${subItem.teacher}\n`;
          }
        });
      }
      
      text += `\n`;
    });

    text += `📱 RUDN Schedule – Telegram WebApp`;
    
    return text;
  };

  // ─── Canvas генерация изображения (как в SharedScheduleView) ───
  const generateCanvas = async () => {
    try {
      // roundRect polyfill для старых WebView
      if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
          const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
          this.moveTo(x + r, y);
          this.arcTo(x + w, y, x + w, y + h, r);
          this.arcTo(x + w, y + h, x, y + h, r);
          this.arcTo(x, y + h, x, y, r);
          this.arcTo(x, y, x + w, y, r);
          this.closePath();
        };
      }

      const dpr = 2;
      const W = 420 * dpr;
      const PAD = 20 * dpr;
      const FBASE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      const dateStr = selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

      // ── Определяем диапазон часов ──
      let hasEvents = false;
      let firstMin = null, lastMin = null;

      const parseTime = (str) => {
        if (!str) return null;
        const parts = str.trim().split(':');
        if (parts.length !== 2) return null;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
      };

      todaySchedule.forEach(item => {
        const [s, e] = (item.time || '').split(' - ').map(t => t?.trim());
        const sM = parseTime(s), eM = parseTime(e);
        if (sM !== null) { firstMin = firstMin === null ? sM : Math.min(firstMin, sM); hasEvents = true; }
        if (eM !== null) { lastMin = lastMin === null ? eM : Math.max(lastMin, eM); hasEvents = true; }
      });

      let startH, endH;
      if (!hasEvents || firstMin === null || lastMin === null) {
        startH = 8; endH = 18;
      } else {
        startH = Math.floor(firstMin / 60);
        endH = Math.ceil(lastMin / 60);
        if (startH >= endH) endH = startH + 1;
      }

      const pxPerMin = 1.2 * dpr;
      const TLW = 48 * dpr; // ширина колонки со временем
      const tlPadTop = 14 * dpr;
      const tlPadBot = 14 * dpr;
      const offsetMin = startH * 60;
      const toY = (min) => tlPadTop + (min - offsetMin) * pxPerMin;
      const timelineH = toY(endH * 60) + tlPadBot;

      // ── Высота: header + timeline + empty + footer ──
      const headerH = 70 * dpr;
      const footerH = 36 * dpr;
      const emptyBannerH = !hasEvents ? 80 * dpr : 0;
      const rawH = headerH + timelineH + emptyBannerH + footerH + PAD * 2;
      const H = Math.max(rawH, 400 * dpr);

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
      ctx.fillText('Расписание', W / 2, PAD + 22 * dpr);
      ctx.fillStyle = '#888888';
      ctx.font = `${13 * dpr}px ${FBASE}`;
      const subtitle = groupName 
        ? `${formattedDayName}, ${dateStr} · ${groupName}`
        : `${formattedDayName}, ${dateStr}`;
      ctx.fillText(subtitle, W / 2, PAD + 42 * dpr);

      // ── Timeline контейнер ──
      const tlX = PAD;
      const tlY = headerH + PAD;
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

      // ── События (пары) ──
      const evX = tlX + TLW + 4 * dpr;
      const evW = tlW - TLW - 8 * dpr;
      const eventColor = '#6366f1'; // indigo цвет для карточек

      ctx.textAlign = 'left';

      // Собираем все пары в плоский список с реальным временем
      const flatEvents = [];
      todaySchedule.forEach(classItem => {
        const [sStr, eStr] = (classItem.time || '').split(' - ').map(s => s?.trim());
        const sMin = parseTime(sStr), eMin = parseTime(eStr);
        if (sMin === null || eMin === null || eMin <= sMin) return;
        
        // Собираем аудиторию и преподавателя из subItems
        let auditory = '';
        let teacher = '';
        if (classItem.subItems && classItem.subItems.length > 0) {
          auditory = classItem.subItems[0].auditory || '';
          teacher = classItem.subItems[0].teacher || '';
        }

        flatEvents.push({
          discipline: classItem.discipline || '',
          time: classItem.time,
          sStr, eStr, sMin, eMin,
          auditory,
          teacher,
          lessonType: classItem.lessonType || '',
        });
      });

      // Вычисление перекрытий (простой алгоритм)
      const computeOverlapLayout = (events) => {
        const sorted = [...events].sort((a, b) => a.sMin - b.sMin);
        const result = [];
        const active = [];

        sorted.forEach(ev => {
          // Убираем завершившиеся
          while (active.length > 0 && active[0].eMin <= ev.sMin) {
            active.shift();
          }
          active.push(ev);
          active.sort((a, b) => a.sMin - b.sMin);
          
          const subCol = active.indexOf(ev);
          const subColTotal = active.length;
          
          result.push({ event: ev, subCol, subColTotal: Math.max(subColTotal, 1) });
        });

        // Второй проход — выравниваем subColTotal для перекрывающихся групп
        for (let i = 0; i < result.length; i++) {
          let maxCols = result[i].subColTotal;
          for (let j = 0; j < result.length; j++) {
            if (i === j) continue;
            const a = result[i].event, b = result[j].event;
            if (a.sMin < b.eMin && a.eMin > b.sMin) {
              maxCols = Math.max(maxCols, result[j].subColTotal);
            }
          }
          result[i].subColTotal = maxCols;
        }

        return result;
      };

      const layout = computeOverlapLayout(flatEvents);

      layout.forEach(item => {
        const event = item.event;
        const scTotal = item.subColTotal || 1;
        const scIdx = item.subCol || 0;

        const subColW = evW / scTotal;
        const cx = evX + subColW * scIdx;
        const cw = subColW - (scTotal > 1 ? 2 * dpr : 0);

        const ey = tlY + toY(event.sMin);
        const eh = Math.max(toY(event.eMin) - toY(event.sMin), 34 * dpr);
        const cardR = 10 * dpr;

        // Фон события
        ctx.fillStyle = eventColor + '18';
        ctx.beginPath();
        ctx.roundRect(cx, ey, cw, eh, cardR);
        ctx.fill();

        // Левая полоска
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cx, ey, cw, eh, cardR);
        ctx.clip();
        ctx.fillStyle = eventColor;
        ctx.fillRect(cx, ey, 3.5 * dpr, eh);
        ctx.restore();

        // Тип пары (маленький лейбл)
        if (event.lessonType) {
          ctx.fillStyle = eventColor;
          ctx.font = `500 ${9 * dpr}px ${FBASE}`;
          ctx.fillText(event.lessonType, cx + 10 * dpr, ey + 14 * dpr);
        }

        // Название дисциплины (с переносом строк)
        ctx.fillStyle = '#1c1c1c';
        ctx.font = `600 ${11 * dpr}px ${FBASE}`;
        const maxTW = cw - 16 * dpr;
        const maxTextY = ey + eh - 18 * dpr;
        const discipline = event.discipline;
        const words = discipline.split(' ');
        let line = '', ly = ey + (event.lessonType ? 28 : 18) * dpr;
        let truncated = false;
        for (const word of words) {
          if (truncated) break;
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
        if (line && ly <= maxTextY) {
          ctx.fillText(line, cx + 10 * dpr, ly);
        }

        // Время и аудитория
        ctx.fillStyle = '#999';
        ctx.font = `${9 * dpr}px ${FBASE}`;
        const timeText = `${event.sStr} – ${event.eStr}${event.auditory ? ` · ${event.auditory}` : ''}`;
        let timeLine = timeText;
        if (ctx.measureText(timeLine).width > maxTW) {
          while (ctx.measureText(timeLine + '…').width > maxTW && timeLine.length > 5) {
            timeLine = timeLine.slice(0, -1);
          }
          timeLine += '…';
        }
        ctx.fillText(timeLine, cx + 10 * dpr, ly + 14 * dpr);
      });

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
        ctx.fillText(`Нет пар на ${formattedDayName.toLowerCase()}`, W / 2, bannerY + 24 * dpr);
      }

      // ── Футер ──
      ctx.textAlign = 'center';
      ctx.fillStyle = '#bbbbbb';
      ctx.font = `${10 * dpr}px ${FBASE}`;
      ctx.fillText(`@${botUsername || 'bot'} · RUDN Schedule`, W / 2, H - 12 * dpr);

      return canvas;
    } catch (err) {
      console.error('Ошибка генерации изображения:', err);
      return null;
    }
  };

  // ─── Копирование текста ───
  const handleCopyText = async () => {
    const text = generateScheduleText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      hapticFeedback?.('success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      hapticFeedback?.('success');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // ─── Отправить в Telegram ───
  const handleTelegramShare = async () => {
    hapticFeedback?.('impact', 'medium');

    // Трекинг достижения
    if (telegramId) {
      try {
        await achievementsAPI.trackAction(telegramId, 'share_schedule', {
          source: 'share_modal',
          date: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to track share_schedule action:', error);
      }
    }

    const text = encodeURIComponent(generateScheduleText());
    const botUrl = encodeURIComponent(`https://t.me/${botUsername}`);
    const shareUrl = `https://t.me/share/url?url=${botUrl}&text=${text}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  // ─── Генерация HTML caption для Telegram ───
  const generateHtmlCaption = () => {
    const dateStr = selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const dayLower = formattedDayName.toLowerCase();

    let caption = `<tg-emoji emoji-id="5197350061012436657">📅</tg-emoji> <b>Расписание на ${dayLower}, ${dateStr}</b>\n`;
    if (groupName) {
      caption += `<tg-emoji emoji-id="5451821087979498800">👥</tg-emoji>  <b>Группа:</b> ${groupName}\n`;
    }

    if (todaySchedule.length === 0) {
      caption += `\n✨ Пар нет! Свободный день! 🎉`;
    } else {
      todaySchedule.forEach((classItem, index) => {
        caption += `\n${index + 1}. <b>${classItem.discipline}</b>\n`;
        caption += `   <tg-emoji emoji-id="5300922106433789293">⏰</tg-emoji> ${classItem.time}\n`;

        if (classItem.subItems) {
          classItem.subItems.forEach((subItem) => {
            if (subItem.auditory) {
              caption += `   <tg-emoji emoji-id="5391032818111363540">📍</tg-emoji> ${subItem.auditory}\n`;
            }
            if (subItem.teacher) {
              caption += `   <tg-emoji emoji-id="5373039692574893940">👨‍🏫</tg-emoji> ${subItem.teacher}\n`;
            }
          });
        }
      });
    }

    caption += `\n<tg-emoji emoji-id="5407025283456835913">📱</tg-emoji> <i>RUDN Schedule – Telegram WebApp</i>`;
    return caption;
  };

  // ─── Прислать в ЛС бота ───
  const handleSendToBot = async () => {
    if (!telegramId) return;
    setIsSendingToBot(true);
    setImageSentToBot(false);
    try {
      const canvas = await generateCanvas();
      if (!canvas) return;

      const base64 = canvas.toDataURL('image/png');
      const caption = generateHtmlCaption();
      const dateStr = selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      const dayLower = formattedDayName.toLowerCase();

      // Короткий заголовок для фото (если полный caption не влезет)
      const shortCaption = `<tg-emoji emoji-id="5197350061012436657">📅</tg-emoji> <b>Расписание на ${dayLower}, ${dateStr}</b>${groupName ? `\n<tg-emoji emoji-id="5451821087979498800">👥</tg-emoji>  <b>Группа:</b> ${groupName}` : ''}`;

      // Чистый текст для inline-кнопки «Поделиться»
      const shareText = generateScheduleText();

      await botAPI.sendScheduleImage(telegramId, base64, caption, { shareText, shortCaption });
      hapticFeedback?.('success');
      setImageSentToBot(true);
      setTimeout(() => setImageSentToBot(false), 3000);
    } catch (err) {
      console.error('Ошибка отправки в бот:', err);
      hapticFeedback?.('error');
    } finally {
      setIsSendingToBot(false);
    }
  };

  // ─── Сохранить в галерею ───
  const handleSaveToGallery = async () => {
    setIsGeneratingImage(true);
    try {
      // Трекинг достижения
      if (telegramId) {
        try {
          await achievementsAPI.trackAction(telegramId, 'share_schedule', {
            source: 'share_modal_image',
            date: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to track share action:', error);
        }
      }

      const canvas = await generateCanvas();
      if (!canvas) return;

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;

      const dateStr = selectedDate.toLocaleDateString('ru-RU', { 
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).replace(/\./g, '-');
      const fileName = `raspisanie-${dateStr}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // Web Share API — на мобильных позволяет сохранить в галерею
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Расписание RUDN',
            text: `Расписание на ${formatDate(selectedDate)}`
          });
          hapticFeedback?.('success');
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // Fallback: обычное скачивание
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = fileName;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      hapticFeedback?.('success');
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      hapticFeedback?.('error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-end justify-center"
          onClick={onClose}
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
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Share2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Поделиться расписанием</h3>
                <p className="text-xs text-gray-500">
                  📅 {formatDate(selectedDate)}{groupName ? ` · ${groupName}` : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Текст для копирования */}
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-200 mb-4">
              <span className="flex-1 text-xs text-gray-500 truncate font-mono">
                {todaySchedule.length > 0 
                  ? `${todaySchedule.length} пар · ${formattedDayName}`
                  : `Нет пар · ${formattedDayName}`
                }
              </span>
              <button
                onClick={handleCopyText}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex-shrink-0 ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {copied ? (
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

            {/* Отправить в Telegram */}
            <button
              onClick={handleTelegramShare}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-[#2AABEE] hover:bg-[#1e9bd6] active:scale-[0.98] transition-all text-white font-semibold text-sm shadow-lg shadow-blue-400/20 mb-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
              </svg>
              Отправить в Telegram
            </button>

            {/* Прислать в ЛС бота */}
            <button
              onClick={handleSendToBot}
              disabled={isSendingToBot}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 active:scale-[0.98] transition-all text-white font-semibold text-sm shadow-lg shadow-purple-400/20 disabled:opacity-60 mb-3"
            >
              {isSendingToBot ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Отправка...
                </>
              ) : imageSentToBot ? (
                <>
                  <Check className="w-5 h-5" />
                  Отправлено в ЛС!
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Прислать в ЛС бота
                </>
              )}
            </button>

            {/* Сохранить в галерею */}
            <button
              onClick={handleSaveToGallery}
              disabled={isGeneratingImage}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] transition-all text-white font-semibold text-sm shadow-lg shadow-emerald-400/20 disabled:opacity-60"
            >
              {isGeneratingImage ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <Smartphone className="w-5 h-5" />
                  Сохранить в галерею
                </>
              )}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
