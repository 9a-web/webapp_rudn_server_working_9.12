# Planner Events API - Документация

## Обзор

Система Planner Events позволяет создавать события с временными рамками, которые **отделены от обычных задач** в списке дел. События всегда имеют `time_start` и `time_end` и привязаны к конкретной дате.

## Ключевая логика разделения

### Задачи vs События

**Задачи** (Tasks):
- Получаются через `GET /api/tasks/{telegram_id}`
- Могут **НЕ иметь** `time_start` и `time_end`
- Используются для списка дел (To-Do)
- Имеют порядок drag & drop (`order`)

**События** (Events):
- Создаются через `POST /api/planner/events`
- **ВСЕГДА** имеют `time_start` И `time_end`
- Получаются через `GET /api/planner/{telegram_id}/{date}`
- Сортируются по времени начала
- Не участвуют в drag & drop (order=0)

### Разделение в базе данных

Все записи хранятся в коллекции `tasks`, но:
- **Задачи**: имеют `time_start=null` ИЛИ `time_end=null`
- **События**: имеют оба поля `time_start` И `time_end`

## API Endpoints

### 1. Создание события

```http
POST /api/planner/events
```

**Request Body:**
```json
{
  "telegram_id": 999888777,
  "text": "Встреча с деканом",
  "time_start": "14:00",        // Обязательно
  "time_end": "15:30",          // Обязательно
  "target_date": "2026-01-05T14:00:00",  // Обязательно
  "category": "учеба",          // Опционально
  "priority": "high",           // Опционально
  "notes": "Кабинет 305",       // Опционально
  "subject": "Администрация"    // Опционально
}
```

**Response:** `TaskResponse`

**Валидация:**
- 400 error если отсутствует `time_start` или `time_end`
- 400 error если отсутствует `target_date`

### 2. Получение событий на дату

```http
GET /api/planner/{telegram_id}/{date}
```

**Параметры:**
- `telegram_id` - ID пользователя
- `date` - Дата в формате `YYYY-MM-DD` (например: `2026-01-05`)

**Response:** `PlannerDayResponse`
```json
{
  "date": "2026-01-05",
  "events": [
    {
      "id": "uuid",
      "text": "Утренняя пробежка",
      "time_start": "08:00",
      "time_end": "09:00",
      "target_date": "2026-01-05T08:00:00",
      ...
    },
    {
      "id": "uuid",
      "text": "Встреча с деканом",
      "time_start": "14:00",
      "time_end": "15:30",
      ...
    }
  ],
  "total_count": 2
}
```

**Особенности:**
- События отсортированы по `time_start`
- События без времени идут в конец списка

### 3. Получение задач (БЕЗ событий)

```http
GET /api/tasks/{telegram_id}
```

**Response:** `List[TaskResponse]`

**Логика исключения:**
```python
query = {
    "telegram_id": telegram_id,
    "$or": [
        {"time_start": {"$exists": False}},
        {"time_start": None},
        {"time_end": {"$exists": False}},
        {"time_end": None}
    ]
}
```

Возвращает только записи, у которых **хотя бы одно** из полей времени отсутствует.

## Frontend Integration

### API методы (services/api.js)

```javascript
// Создать событие
const event = await tasksAPI.createEvent(
  telegramId,     // number
  text,           // string
  timeStart,      // string "HH:MM"
  timeEnd,        // string "HH:MM"
  targetDate,     // string ISO date
  {               // optional data
    category: 'учеба',
    priority: 'high',
    notes: 'Дополнительная информация'
  }
);

// Получить события на дату
const plannerData = await tasksAPI.getDayEvents(
  telegramId,     // number
  date            // string "YYYY-MM-DD"
);
// Returns: { date, events[], total_count }
```

## Модели данных

### TaskCreate (для событий)

```python
class TaskCreate(BaseModel):
    telegram_id: int
    text: str
    time_start: str              # Обязательно для событий
    time_end: str                # Обязательно для событий
    target_date: datetime        # Обязательно для событий
    category: Optional[str] = None
    priority: Optional[str] = 'medium'
    deadline: Optional[datetime] = None
    subject: Optional[str] = None
    notes: Optional[str] = None
    origin: str = "user"
```

### PlannerDayResponse

```python
class PlannerDayResponse(BaseModel):
    date: str                    # YYYY-MM-DD
    events: List[TaskResponse]   # События отсортированные по времени
    total_count: int
```

## Тестирование

Используйте файл `/app/test_planner_events.py` для проверки функциональности:

```bash
python3 /app/test_planner_events.py
```

**Проверяемые сценарии:**
1. ✅ Валидация событий без времени (должен вернуть 400)
2. ✅ Создание события с полными данными
3. ✅ События исключены из GET /api/tasks
4. ✅ События возвращаются через GET /api/planner
5. ✅ Множественные события сортируются по времени

## Примеры использования

### Пример 1: Создание события учебной пары

```python
event_data = {
    "telegram_id": 999888777,
    "text": "Математический анализ",
    "time_start": "10:00",
    "time_end": "11:30",
    "target_date": "2026-01-10T10:00:00",
    "category": "учеба",
    "subject": "Математика",
    "teacher": "Иванов И.И.",
    "auditory": "305"
}

response = await api.post('/api/planner/events', json=event_data)
```

### Пример 2: Получение расписания на день

```python
response = await api.get('/api/planner/999888777/2026-01-10')
planner_data = response.json()

print(f"Событий на {planner_data['date']}: {planner_data['total_count']}")
for event in planner_data['events']:
    print(f"{event['time_start']} - {event['text']}")
```

### Пример 3: Проверка что событие НЕ в задачах

```python
# Создаем событие
event = await create_event(...)

# Проверяем список задач
tasks = await api.get('/api/tasks/999888777')

# Событие НЕ должно быть в списке задач
assert event['id'] not in [task['id'] for task in tasks.json()]
```

## Важные замечания

1. **Дублирование endpoint'ов**: Убедитесь что существует только ОДИН endpoint с путем `/planner/{telegram_id}/{date}`. Старая версия (возвращающая `List[TaskResponse]`) была удалена.

2. **Формат времени**: `time_start` и `time_end` должны быть в формате `"HH:MM"` (например: `"14:30"`)

3. **Формат даты**: `target_date` должна быть ISO datetime string (например: `"2026-01-05T14:00:00"`)

4. **MongoDB Query**: Разделение осуществляется на уровне запроса MongoDB, а не в коде Python

5. **Origin поле**: События имеют `origin="user"` по умолчанию. Пары из расписания могут иметь `origin="schedule"`

## История изменений

### 2026-01-04 - Исправление дублирования endpoint'ов
- **Проблема**: Два endpoint'а с путем `/planner/{telegram_id}/{date}` (строки 1182 и 1676)
- **Решение**: Удален старый endpoint (строка 1182), оставлен новый с `PlannerDayResponse`
- **Результат**: Все тесты прошли успешно ✅

### ENV=test конфигурация
- Backend URL: Настроен в `/app/frontend/.env` как `VITE_BACKEND_URL`
- Для тестовой среды используется внешний URL из supervisor config

## См. также

- `/app/test_result.md` - История тестирования
- `/app/AI_CONTEXT.md` - Общий контекст проекта
- `/app/backend/server.py` - Реализация API endpoints
- `/app/backend/models.py` - Модели данных
