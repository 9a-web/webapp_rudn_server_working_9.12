# Test Result

## Задача
1. Добавить историю статистики онлайна в админ-панель
2. Московское время на всех графиках
3. Хранить ВСЮ статистику ВСЕГДА (без очистки)

## Что было изменено

### Backend (`server.py`):
- Добавлена коллекция `online_stats_history` — сбор онлайн-статистики каждые 60с (online_now, online_1h, online_24h, web, telegram)
- Добавлен API: `GET /api/admin/online-stats-history?hours=N` (1, 6, 24, 168, 720, 0=всё)
- Убрана очистка старых метрик (`server_metrics_history`) — данные хранятся бессрочно
- Убран лимит 168ч в `/api/admin/server-stats-history` — теперь можно запросить всё
- Добавлены периоды 30д и «Всё» в server-stats-history
- Исправлен Moscow timezone в агрегациях: `hourly-activity`, `weekly-activity`, `users-activity`
- Добавлен индекс для `online_stats_history`

### Frontend (`AdminPanel.jsx`):
- Добавлен persistent график "История онлайна" с переключателем периодов (1ч-Всё)
- Добавлен график "Охват — уникальных за 1ч / 24ч"
- Добавлена карточка "Пик онлайна"
- Добавлены периоды 30д и Всё в историю нагрузки сервера
- Все графики используют `timeZone: 'Europe/Moscow'`

### Backend (`models.py`):
- Добавлен `NEW_MESSAGE` в NotificationType (из предыдущей задачи)
- Добавлен `social_messages` в ExtendedNotificationSettings

## Статус
✅ Все сервисы запущены и работают

## Testing Protocol
- Backend тестируется через `deep_testing_backend_v2`
- Frontend тестируется через `auto_frontend_testing_agent` только с разрешения пользователя

## Incorporate User Feedback
- Всегда спрашивать пользователя перед внесением изменений

## Backend Test Cases
1. `GET /api/admin/online-stats-history?hours=1` → metrics array с полями: timestamp, online_now, web_online, telegram_online, peak_online
2. `GET /api/admin/online-stats-history?hours=0` → all-time data
3. `GET /api/admin/server-stats-history?hours=0` → all-time server metrics (no 168h limit)
4. `GET /api/admin/server-stats-history?hours=720` → 30 days data
5. `GET /api/admin/hourly-activity` → hours in Moscow timezone
6. `GET /api/health` → healthy
