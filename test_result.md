# Test Result

## Задача
Добавить отправку уведомления о новом сообщении от друга — in-app уведомление + Telegram push.

## Что было изменено

### Backend (`models.py`):
- Добавлен `NEW_MESSAGE = "new_message"` в `NotificationType` enum
- Добавлен `social_messages: bool = True` в `ExtendedNotificationSettings`
- Добавлен `social_messages: Optional[bool] = None` в `ExtendedNotificationSettingsUpdate`

### Backend (`server.py`):
- Обновлён `should_send_notification()` — добавлена обработка `NEW_MESSAGE` с проверкой `social_messages`
- Обновлён `create_notification()` — push отправляется при `should_push=True` (без требования `HIGH` priority)
- `send_message()` — заменён raw insert на `create_notification()`
- `forward_message()` — заменён raw insert на `create_notification()`
- `send_schedule_message()` — заменён raw insert на `create_notification()`
- `send_music_message()` — заменён raw insert на `create_notification()`

### Frontend (`NotificationSettingsPanel.jsx`):
- Добавлен переключатель "Сообщения от друзей" (`social_messages`) в настройках уведомлений

## Статус
✅ Все сервисы запущены и работают

## Testing Protocol
- Backend тестируется через `deep_testing_backend_v2`
- Frontend тестируется через `auto_frontend_testing_agent` только с разрешения пользователя

## Incorporate User Feedback
- Всегда спрашивать пользователя перед внесением изменений

## Backend Test Cases

### Message notifications:
1. `POST /api/messages` с `sender_id` и `receiver_id` (friends) → сообщение создано + in-app notification created in `in_app_notifications` collection
2. `GET /api/notifications/{receiver_id}` → should contain notification with type "new_message"
3. Health check: `GET /api/health` → healthy

### Notification settings:
4. `GET /api/notifications/{telegram_id}/settings` → should include `social_messages: true` field
5. `PUT /api/notifications/{telegram_id}/settings` with `{"social_messages": false}` → updates setting

### Note:
- For Telegram push to work, sender and receiver must be real Telegram users who started the bot
- In test env, push will be sent via TEST bot (devrudnbot)
