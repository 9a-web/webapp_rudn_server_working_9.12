/**
 * NotificationPermissionPrompt — M3 fix (2026-07)
 *
 * Показывает кастомный UX-диалог ДО вызова Notification.requestPermission().
 * Браузер показывает permission prompt только из user-gesture, поэтому
 * мы переносим решение на кнопку «Включить» внутри нашего диалога.
 *
 * Почему это важно:
 *  - Если показать нативный prompt сразу при загрузке, пользователь обычно
 *    дисмиссит → permission = 'default' (или 'denied' после игнора).
 *  - Восстановить permission можно только из настроек браузера — большинство
 *    пользователей этого не сделает.
 *  - Кастомный диалог объясняет ЗАЧЕМ, и юзер понимает что разрешает.
 *
 * Использование:
 *   <NotificationPermissionPrompt
 *      open={modalOpen}
 *      onClose={() => setModalOpen(false)}
 *      onPermissionGranted={() => initWebPush({ autoPrompt: false })}
 *   />
 */
import React, { useState } from 'react';
import { Bell, X, BookOpen, Clock, Star } from 'lucide-react';
import { requestWebPushPermission } from '../../utils/webpush';

export default function NotificationPermissionPrompt({
  open,
  onClose,
  onPermissionGranted = null,
  onPermissionDenied = null,
}) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleEnable = async () => {
    setLoading(true);
    try {
      const r = await requestWebPushPermission();
      if (r.permission === 'granted') {
        if (onPermissionGranted) {
          try { await onPermissionGranted(); } catch (_) {}
        }
      } else if (r.permission === 'denied') {
        if (onPermissionDenied) {
          try { onPermissionDenied(); } catch (_) {}
        }
      }
    } finally {
      setLoading(false);
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2.5">
              <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Включить уведомления?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Мы хотим присылать вам:
        </p>

        <ul className="space-y-2.5 mb-5">
          <li className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            <BookOpen className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
            <span>Расписание на завтра и изменения в нём</span>
          </li>
          <li className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
            <span>Напоминания о начале пары за 15 минут</span>
          </li>
          <li className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            <Star className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
            <span>Оценки, дедлайны и важные объявления</span>
          </li>
        </ul>

        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-5 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2">
          Вы можете отключить уведомления в любой момент в настройках.
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
          >
            Не сейчас
          </button>
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading}
            className="flex-1 rounded-xl bg-blue-500 hover:bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {loading ? '…' : 'Включить'}
          </button>
        </div>
      </div>
    </div>
  );
}
