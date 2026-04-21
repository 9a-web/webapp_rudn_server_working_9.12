# 🎓 Аккаунт преподавателя — Техническая документация

**Версия:** 1.0  
**Дата:** 2025-07-17  
**Статус:** 📋 Проектирование

---

## 📋 Содержание

1. [Обзор функциональности](#1-обзор-функциональности)
2. [Регистрация преподавателя](#2-регистрация-преподавателя)
3. [Парсинг расписания преподавателя](#3-парсинг-расписания-преподавателя)
4. [Система доступа к журналам](#4-система-доступа-к-журналам)
5. [Модели данных](#5-модели-данных)
6. [API Endpoints](#6-api-endpoints)
7. [Frontend компоненты](#7-frontend-компоненты)
8. [Кэширование и производительность](#8-кэширование-и-производительность)
9. [Edge-кейсы и обработка ошибок](#9-edge-кейсы-и-обработка-ошибок)
10. [Миграция и обратная совместимость](#10-миграция-и-обратная-совместимость)
11. [Порядок реализации](#11-порядок-реализации)

---

## 1. Обзор функциональности

### 1.1 Проблема

Сейчас приложение рассчитано только на студентов. Преподаватели РУДН не имеют:
- Возможности просматривать **своё** расписание (API РУДН не поддерживает поиск по преподавателю)
- Доступа к журналам посещений тех групп, которые они ведут
- Персонализированного интерфейса под задачи преподавателя

### 1.2 Решение

Добавить роль **«Преподаватель»** с двумя ключевыми возможностями:

1. **Расписание преподавателя** — собирается автоматически из расписаний групп, которые он ведёт
2. **Доступ к журналам** — преподаватель видит и редактирует только свои предметы в журналах

### 1.3 Принцип работы расписания

Публичный API РУДН (`/api/v1/education/schedule`) не поддерживает поиск по преподавателю. Однако каждое занятие в расписании группы содержит ФИО преподавателя:

```
09:00 - 10:20 | Математический анализ | Лекция | Иванов Иван Иванович | ОРД-214
```

**Алгоритм:** Преподаватель при регистрации указывает ФИО и группы → приложение парсит расписания этих групп → фильтрует занятия по ФИО → собирает персональное расписание преподавателя.

---

## 2. Регистрация преподавателя

### 2.1 Точка входа — WelcomeScreen

На экране приветствия (`WelcomeScreen.jsx`) под основной кнопкой «Начать» добавляется текстовая ссылка:

```
┌─────────────────────────────┐
│                             │
│     🎓 РУДН Расписание     │
│                             │
│    [ Начать (студент) ]     │
│                             │
│    Я преподаватель →        │
│                             │
└─────────────────────────────┘
```

При нажатии «Я преподаватель» открывается отдельный флоу регистрации.

### 2.2 Шаги регистрации преподавателя

```
Шаг 1: Ввод ФИО
├── Поле: "Введите ваше ФИО (как в расписании РУДН)"
├── Пример: "Кулябов Дмитрий Сергеевич"
├── Валидация: минимум 2 слова, только кириллица + пробелы + дефис
└── Подсказка: "ФИО должно совпадать с написанием в расписании на rudn.ru"

Шаг 2: Выбор факультета
├── Используется существующий GroupSelector (первый шаг)
├── Список факультетов из GET /api/faculties
├── Можно выбрать несколько факультетов (если ведёт на разных)
└── Обязательный шаг

Шаг 3: Указание групп (опционально, но рекомендуется)
├── Вариант A: "Указать группы вручную"
│   ├── Преподаватель выбирает конкретные группы через GroupSelector
│   ├── Быстро: парсить нужно только 3-15 групп
│   └── Точно: нет ложных совпадений по ФИО
│
├── Вариант B: "Найти автоматически по факультету"
│   ├── Backend парсит все группы выбранного факультета (~50-150)
│   ├── Ищет совпадения по ФИО во всех расписаниях
│   ├── Показывает найденные группы для подтверждения
│   └── Дольше (1-3 мин), но удобнее
│
└── В обоих случаях результат: список group_id, привязанных к преподавателю

Шаг 4: Подтверждение
├── Показать найденное расписание для проверки
├── Кнопка "Всё верно, сохранить"
└── POST /api/user-settings → сохранение с role: "teacher"
```

### 2.3 Упрощённая схема данных при регистрации

```python
{
    "telegram_id": 123456789,
    "role": "teacher",
    "first_name": "Дмитрий",
    "last_name": "Кулябов",
    "teacher_full_name": "Кулябов Дмитрий Сергеевич",  # ФИО как в расписании
    "teacher_faculty_ids": ["abdcf766-..."],             # Факультеты
    "teacher_groups": [                                   # Привязанные группы
        {
            "group_id": "9f7a56ea-...",
            "group_name": "НБИбд-01-25",
            "faculty_id": "abdcf766-...",
            "level_id": "16d26142-...",
            "kurs": "1",
            "form_code": "д"
        }
    ]
}
```

---

## 3. Парсинг расписания преподавателя

### 3.1 Алгоритм сборки расписания

```
Входные данные:
  - teacher_full_name: "Кулябов Дмитрий Сергеевич"
  - teacher_groups: [{group_id, faculty_id, level_id, kurs, form_code}, ...]

Алгоритм:
  1. Для каждой группы из teacher_groups:
     a. Проверить кэш schedule_cache (есть ли свежее расписание)
     b. Если кэш устарел → GET /api/v1/education/schedule (парсер РУДН)
     c. Распарсить HTML → список занятий [{day, time, discipline, teacher, ...}]
  
  2. Фильтрация по ФИО преподавателя:
     a. Для каждого занятия: lesson.teacher.strip() == teacher_full_name.strip()
     b. Нечёткое сравнение (опционально): Левенштейн ≤ 3 или contains
  
  3. Агрегация:
     a. Объединить все занятия из всех групп
     b. Добавить к каждому занятию group_name
     c. Сортировать по (day_order, time)
     d. Убрать дубликаты (лекция для нескольких групп = 1 запись с пометкой)
  
  4. Кэширование:
     a. Сохранить собранное расписание в teacher_schedule_cache
     b. TTL: 24 часа (или до следующего запроса refresh)

Выход:
  - Расписание преподавателя по дням недели
  - Каждое занятие содержит: day, time, discipline, lessonType, groups[], auditory
```

### 3.2 Формат собранного расписания

```python
{
    "teacher_id": 123456789,
    "teacher_name": "Кулябов Дмитрий Сергеевич",
    "week": 1,
    "updated_at": "2025-07-17T12:00:00",
    "schedule": [
        {
            "day": "Понедельник",
            "day_index": 0,
            "lessons": [
                {
                    "time": "09:00 - 10:20",
                    "discipline": "Архитектура компьютеров и операционные системы",
                    "lesson_type": "Лекция",
                    "auditory": "ДОТ-000",
                    "groups": [
                        {"group_id": "...", "group_name": "НБИбд-01-25"},
                        {"group_id": "...", "group_name": "НБИбд-02-25"}
                    ]
                },
                {
                    "time": "12:00 - 13:20",
                    "discipline": "Операционные системы",
                    "lesson_type": "Лабораторная работа",
                    "auditory": "ОРД-297",
                    "groups": [
                        {"group_id": "...", "group_name": "НКАбд-01-25"}
                    ]
                }
            ]
        },
        ...
    ],
    "stats": {
        "total_lessons_per_week": 18,
        "total_groups": 5,
        "total_subjects": 3,
        "busiest_day": "Понедельник",
        "free_days": ["Воскресенье"]
    }
}
```

### 3.3 Сравнение ФИО — правила матчинга

ФИО на сайте РУДН может записываться по-разному. Необходима нормализация:

```python
def normalize_teacher_name(name: str) -> str:
    """Нормализует ФИО для сравнения"""
    # Убрать лишние пробелы
    name = " ".join(name.strip().split())
    # Привести к нижнему регистру для сравнения
    return name.lower()

def match_teacher(lesson_teacher: str, search_name: str) -> bool:
    """Проверяет совпадение ФИО"""
    lt = normalize_teacher_name(lesson_teacher)
    sn = normalize_teacher_name(search_name)
    
    # Точное совпадение
    if lt == sn:
        return True
    
    # Одно содержит другое (для случаев сокращений)
    if sn in lt or lt in sn:
        return True
    
    # Совпадение фамилии + первой буквы имени
    # "Кулябов Д.С." == "Кулябов Дмитрий Сергеевич"
    parts_lesson = lt.split()
    parts_search = sn.split()
    if parts_lesson and parts_search:
        if parts_lesson[0] == parts_search[0]:  # Фамилия совпадает
            return True  # Считаем совпадением (можно ужесточить)
    
    return False
```

### 3.4 Автопоиск по факультету (Вариант B)

Если преподаватель не указал группы вручную, backend выполняет поиск:

```
1. Получить все доступные комбинации (level, kurs, form) для факультета
2. Для каждой комбинации получить список групп
3. Для каждой группы получить расписание
4. Искать ФИО преподавателя в каждом занятии
5. Собрать список групп, где найден преподаватель
6. Вернуть пользователю для подтверждения

Ограничения:
- Параллельные запросы: не более 5 одновременно (чтобы не нагружать РУДН)
- Задержка между запросами: 200-500 мс
- Таймаут на весь поиск: 3 минуты
- Прогресс: отправлять % выполнения через polling
```

**API для автопоиска:**

```python
# Запуск поиска (асинхронный)
POST /api/teacher/auto-search
Body: {
    "telegram_id": 123456789,
    "teacher_name": "Кулябов Дмитрий Сергеевич",
    "faculty_ids": ["abdcf766-..."]
}
Response: { "search_id": "uuid", "estimated_time_sec": 120 }

# Проверка статуса поиска
GET /api/teacher/auto-search/{search_id}/status
Response: {
    "status": "in_progress",  # "in_progress" | "completed" | "failed"
    "progress": 45,            # процент
    "groups_checked": 48,
    "groups_total": 107,
    "found_groups": [
        {"group_id": "...", "group_name": "НБИбд-01-25", "lessons_count": 3}
    ]
}
```

---

## 4. Система доступа к журналам

### 4.1 Концепция

Преподаватель получает доступ к журналу через **приглашение от старосты** (владельца журнала). Доступ привязывается к конкретному **предмету** в журнале.

### 4.2 Уровни доступа

```
┌─────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Действие        │ owner        │ edit         │ grade        │ view         │
│                 │ (староста)   │ (полный)     │ (оценки)     │ (просмотр)   │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Просмотр списка │      ✅      │      ✅      │      ✅      │      ✅      │
│ студентов       │              │              │              │              │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Просмотр        │      ✅      │      ✅      │      ✅      │      ✅      │
│ статистики      │              │              │              │              │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Выставление     │      ✅      │      ✅      │      ✅      │      ❌      │
│ оценок          │              │              │              │              │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Отметка         │      ✅      │      ✅      │      ❌      │      ❌      │
│ посещаемости    │              │              │              │              │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Создание        │      ✅      │      ✅      │      ❌      │      ❌      │
│ занятий         │              │              │              │              │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Редактирование  │      ✅      │      ❌      │      ❌      │      ❌      │
│ журнала         │              │              │              │              │
├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ Удаление        │      ✅      │      ❌      │      ❌      │      ❌      │
│ журнала         │              │              │              │              │
└─────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### 4.3 Приглашение преподавателя в журнал

**Флоу (со стороны старосты):**
```
1. Староста открывает журнал → предмет → "⚙️ Настройки предмета"
2. Нажимает "Пригласить преподавателя"
3. Выбирает уровень доступа: "Оценки" | "Полный доступ" | "Только просмотр"
4. Генерируется инвайт-ссылка / QR-код
5. Староста отправляет ссылку преподавателю

Ссылка формата:
  t.me/rudn_mosbot?start=jteach_{invite_code}
  или внутри WebApp: /journal/invite/{invite_code}
```

**Флоу (со стороны преподавателя):**
```
1. Преподаватель переходит по ссылке → открывается WebApp
2. Показывается информация: "Журнал: ИВТ-101, Предмет: Математика"
3. Кнопка "Принять приглашение"
4. Предмет появляется в списке журналов преподавателя
```

### 4.4 Что видит преподаватель в журнале

```
┌──────────────────────────────────────┐
│ 📓 Мои предметы                      │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ 📐 Математический анализ         │ │
│ │ Группа: НБИбд-01-25             │ │
│ │ Студентов: 24  |  Занятий: 12   │ │
│ │ Средний балл: 4.2               │ │
│ │ Посещаемость: 87%               │ │
│ │                      [Открыть →]│ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ 💻 Операционные системы          │ │
│ │ Группа: НКАбд-02-25             │ │
│ │ Студентов: 18  |  Занятий: 8    │ │
│ │ Средний балл: 3.8               │ │
│ │ Посещаемость: 72%               │ │
│ │                      [Открыть →]│ │
│ └──────────────────────────────────┘ │
│                                      │
│ Всего предметов: 2                   │
└──────────────────────────────────────┘
```

Преподаватель **не видит** другие предметы в журнале, настройки журнала, не может удалить журнал или добавить/удалить студентов.

---

## 5. Модели данных

### 5.1 Изменения в UserSettings

```python
class UserSettings(BaseModel):
    # ... существующие поля ...
    
    # === НОВЫЕ ПОЛЯ ===
    role: str = "student"                    # "student" | "teacher"
    
    # Данные преподавателя (только если role == "teacher")
    teacher_full_name: Optional[str] = None  # ФИО как в расписании РУДН
    teacher_faculty_ids: List[str] = []      # ID факультетов
    teacher_groups: List[dict] = []          # Привязанные группы
    # Формат teacher_groups:
    # [{
    #     "group_id": str,
    #     "group_name": str,
    #     "faculty_id": str,
    #     "level_id": str,
    #     "kurs": str,
    #     "form_code": str
    # }]
```

### 5.2 Новая коллекция: `journal_teacher_access`

```python
# MongoDB коллекция: journal_teacher_access
{
    "id": str (UUID),
    "journal_id": str,                   # ID журнала
    "subject_id": str,                   # ID предмета (или null для всего журнала)
    "teacher_telegram_id": int,          # Telegram ID преподавателя
    "access_level": str,                 # "view" | "grade" | "edit"
    "invite_code": str,                  # Код приглашения (одноразовый)
    "invited_by": int,                   # Кто пригласил (owner telegram_id)
    "status": str,                       # "pending" | "active" | "revoked"
    "created_at": datetime,
    "accepted_at": Optional[datetime],
    "revoked_at": Optional[datetime]
}

# Индексы:
# - (journal_id, subject_id, teacher_telegram_id) — уникальный
# - (teacher_telegram_id, status) — для получения списка предметов препода
# - (invite_code) — уникальный, для принятия приглашения
```

### 5.3 Новая коллекция: `teacher_schedule_cache`

```python
# MongoDB коллекция: teacher_schedule_cache
{
    "teacher_telegram_id": int,          # Telegram ID преподавателя
    "week": int,                         # Номер недели (1 или 2)
    "schedule": [...],                   # Собранное расписание (формат из п. 3.2)
    "stats": {...},                      # Статистика
    "groups_parsed": List[str],          # Какие группы были спарсены
    "created_at": datetime,
    "expires_at": datetime               # TTL: created_at + 24h
}

# Индексы:
# - (teacher_telegram_id, week) — уникальный
# - (expires_at) — TTL индекс для автоудаления
```

### 5.4 Новая коллекция: `teacher_search_tasks`

```python
# MongoDB коллекция: teacher_search_tasks (для автопоиска групп)
{
    "search_id": str (UUID),
    "teacher_telegram_id": int,
    "teacher_name": str,
    "faculty_ids": List[str],
    "status": str,                       # "pending" | "in_progress" | "completed" | "failed"
    "progress": int,                     # 0-100
    "groups_total": int,
    "groups_checked": int,
    "found_groups": List[dict],          # Найденные группы
    "error": Optional[str],
    "created_at": datetime,
    "completed_at": Optional[datetime]
}
```

---

## 6. API Endpoints

### 6.1 Регистрация и профиль преподавателя

```python
# Регистрация преподавателя
POST /api/teacher/register
Body: {
    "telegram_id": int,
    "teacher_full_name": str,            # ФИО
    "faculty_ids": List[str],            # Факультеты
    "groups": List[{                     # Опционально, если Вариант A
        "group_id": str,
        "group_name": str,
        "faculty_id": str,
        "level_id": str,
        "kurs": str,
        "form_code": str
    }]
}
Response: {
    "success": true,
    "user_settings": UserSettingsResponse
}

# Обновить данные преподавателя
PUT /api/teacher/{telegram_id}
Body: {
    "teacher_full_name": str?,
    "faculty_ids": List[str]?,
    "groups": List[dict]?
}

# Добавить группу к преподавателю
POST /api/teacher/{telegram_id}/groups
Body: {
    "group_id": str,
    "group_name": str,
    "faculty_id": str,
    "level_id": str,
    "kurs": str,
    "form_code": str
}

# Удалить группу у преподавателя
DELETE /api/teacher/{telegram_id}/groups/{group_id}
```

### 6.2 Расписание преподавателя

```python
# Получить расписание преподавателя
GET /api/teacher/schedule/{telegram_id}?week=1
Response: {
    "teacher_name": str,
    "week": int,
    "schedule": [...],                   # По дням
    "stats": {...},
    "cached": bool,                      # Из кэша или свежее
    "updated_at": datetime
}

# Принудительно обновить расписание
POST /api/teacher/schedule/{telegram_id}/refresh
Response: {
    "success": true,
    "schedule": [...],
    "groups_parsed": int
}
```

### 6.3 Автопоиск групп

```python
# Запустить автопоиск групп по факультету
POST /api/teacher/auto-search
Body: {
    "telegram_id": int,
    "teacher_name": str,
    "faculty_ids": List[str]
}
Response: { "search_id": str, "estimated_time_sec": int }

# Статус автопоиска
GET /api/teacher/auto-search/{search_id}/status
Response: {
    "status": str,
    "progress": int,
    "groups_checked": int,
    "groups_total": int,
    "found_groups": List[{
        "group_id": str,
        "group_name": str,
        "lessons_count": int,
        "subjects": List[str]
    }]
}

# Подтвердить найденные группы
POST /api/teacher/auto-search/{search_id}/confirm
Body: {
    "selected_group_ids": List[str]      # Какие группы выбрал препод
}
```

### 6.4 Доступ к журналам

```python
# Сгенерировать приглашение для преподавателя
POST /api/journals/{journal_id}/subjects/{subject_id}/invite-teacher
Body: {
    "telegram_id": int,                  # Кто приглашает (owner)
    "access_level": str                  # "view" | "grade" | "edit"
}
Response: {
    "invite_code": str,
    "invite_link": str,                  # t.me/rudn_mosbot?start=jteach_{code}
    "expires_at": datetime               # 7 дней
}

# Принять приглашение
POST /api/journals/join-teacher/{invite_code}
Body: {
    "telegram_id": int                   # Преподаватель
}
Response: {
    "success": true,
    "journal_name": str,
    "subject_name": str,
    "access_level": str
}

# Список предметов преподавателя (все журналы)
GET /api/teacher/{telegram_id}/subjects
Response: {
    "subjects": [{
        "journal_id": str,
        "journal_name": str,
        "group_name": str,
        "subject_id": str,
        "subject_name": str,
        "access_level": str,
        "total_students": int,
        "total_sessions": int,
        "average_grade": float?,
        "attendance_percent": float?
    }]
}

# Отозвать доступ преподавателя
DELETE /api/journals/{journal_id}/subjects/{subject_id}/teachers/{teacher_telegram_id}
Body: { "telegram_id": int }             # Кто отзывает (owner)

# Список преподавателей предмета (для старосты)
GET /api/journals/{journal_id}/subjects/{subject_id}/teachers
Response: {
    "teachers": [{
        "telegram_id": int,
        "name": str,
        "access_level": str,
        "accepted_at": datetime
    }]
}
```

### 6.5 Итого новых endpoints: **14**

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/teacher/register` | Регистрация |
| PUT | `/api/teacher/{id}` | Обновить данные |
| POST | `/api/teacher/{id}/groups` | Добавить группу |
| DELETE | `/api/teacher/{id}/groups/{gid}` | Удалить группу |
| GET | `/api/teacher/schedule/{id}` | Расписание |
| POST | `/api/teacher/schedule/{id}/refresh` | Обновить расписание |
| POST | `/api/teacher/auto-search` | Запустить автопоиск |
| GET | `/api/teacher/auto-search/{sid}/status` | Статус автопоиска |
| POST | `/api/teacher/auto-search/{sid}/confirm` | Подтвердить результат |
| POST | `/api/journals/{jid}/subjects/{sid}/invite-teacher` | Пригласить препода |
| POST | `/api/journals/join-teacher/{code}` | Принять приглашение |
| GET | `/api/teacher/{id}/subjects` | Предметы препода |
| DELETE | `/api/journals/{jid}/subjects/{sid}/teachers/{tid}` | Отозвать доступ |
| GET | `/api/journals/{jid}/subjects/{sid}/teachers` | Список преподов предмета |

---

## 7. Frontend компоненты

### 7.1 Новые компоненты

```
/components/
├── TeacherRegistration.jsx        # Экран регистрации преподавателя
│   ├── Шаг 1: Ввод ФИО
│   ├── Шаг 2: Выбор факультета (GroupSelector)
│   ├── Шаг 3: Выбор групп / автопоиск
│   └── Шаг 4: Подтверждение расписания
│
├── TeacherScheduleView.jsx        # Расписание преподавателя
│   ├── Вид по дням (как LiveScheduleSection)
│   ├── Группы вместо преподавателя в карточке
│   └── Кнопка "Обновить расписание"
│
├── TeacherSubjectsList.jsx        # Список предметов препода (журналы)
│   ├── Карточки предметов
│   ├── Краткая статистика
│   └── Переход в журнал
│
├── InviteTeacherModal.jsx         # Модал приглашения препода (для старосты)
│   ├── Выбор уровня доступа
│   ├── Генерация ссылки / QR
│   └── Копирование / отправка
│
├── TeacherAutoSearchModal.jsx     # Модал автопоиска групп
│   ├── Прогресс-бар
│   ├── Найденные группы (чекбоксы)
│   └── Кнопка подтверждения
│
└── SubjectTeachersModal.jsx       # Список преподов предмета (для старосты)
    ├── Список с уровнями доступа
    └── Кнопка "Отозвать доступ"
```

### 7.2 Модификации существующих компонентов

```
WelcomeScreen.jsx
├── + Ссылка "Я преподаватель" под кнопкой "Начать"
└── + Навигация к TeacherRegistration

App.jsx
├── + Проверка role === "teacher" при загрузке
├── + Переключение главного экрана: расписание студента ↔ расписание препода
└── + Роутинг для новых компонентов

BottomNavigation.jsx
├── + Вкладка "Предметы" вместо "Задачи" (для teacher)
└── + Скрытие неактуальных вкладок

JournalDetailModal.jsx
├── + Проверка access_level при открытии
├── + Скрытие кнопок редактирования если нет прав
└── + Фильтрация предметов по teacher_access

SubjectDetailModal.jsx
├── + Кнопка "Пригласить преподавателя" (только для owner)
└── + Иконка/бейдж привязанного преподавателя

AttendanceModal.jsx
├── + Проверка прав на отметку посещаемости
└── + Проверка прав на выставление оценок (grade vs edit)

Header.jsx
├── + Отображение роли "Преподаватель" в профиле
└── + Бейдж роли
```

### 7.3 Навигация для преподавателя

```
Нижняя панель (BottomNavigation) для role === "teacher":

┌─────────┬──────────┬──────────┬──────────┐
│ 📅      │ 📓       │ 👥       │ 👤       │
│Расписан.│Предметы  │ Друзья   │ Профиль  │
└─────────┴──────────┴──────────┴──────────┘

- "Расписание" → TeacherScheduleView (расписание препода)
- "Предметы" → TeacherSubjectsList (журналы, куда есть доступ)
- "Друзья" → FriendsSection (без изменений)
- "Профиль" → ProfileModal (+ настройки препода)
```

---

## 8. Кэширование и производительность

### 8.1 Стратегия кэширования

```
Уровень 1: schedule_cache (существующий)
├── Кэш расписания групп (уже есть в проекте)
├── TTL: 6 часов
└── Используется и студентами, и для сборки расписания препода

Уровень 2: teacher_schedule_cache (новый)
├── Собранное расписание преподавателя
├── TTL: 24 часа
├── Инвалидируется при:
│   ├── Ручном refresh
│   ├── Изменении списка групп преподавателя
│   └── Истечении TTL
└── Автообновление: фоновая задача в 06:00 (scheduler)
```

### 8.2 Оценка нагрузки

```
Сценарий: 50 преподавателей, каждый ведёт 5 групп в среднем

Запросов к API РУДН в сутки:
  - 50 преподов × 5 групп × 2 недели = 500 запросов
  - Но schedule_cache общий → группы переиспользуются
  - Реально: ~200-300 уникальных запросов к РУДН в сутки
  - Это ~12-18 запросов в час — абсолютно безопасно

Хранение в MongoDB:
  - teacher_schedule_cache: ~50 документов × ~5 KB = ~250 KB
  - teacher_search_tasks: временные, автоудаление через 1 час
  - journal_teacher_access: ~200 документов × ~500 B = ~100 KB
```

---

## 9. Edge-кейсы и обработка ошибок

### 9.1 ФИО не найдено в расписании

```
Причины:
  a) Опечатка в ФИО → показать подсказку "Проверьте написание как на rudn.ru"
  b) Преподаватель не ведёт в этом семестре → "Занятия не найдены"
  c) Расписание ещё не опубликовано → "Расписание публикуется за 2 недели до начала"

UI: показать сообщение + кнопку "Указать группы вручную"
```

### 9.2 Однофамильцы

```
Проблема: Два преподавателя "Иванов И.И." на одном факультете

Решение:
  1. При автопоиске показать ВСЕ найденные занятия
  2. Преподаватель вручную отмечает свои (чекбоксы)
  3. Для ручного режима (Вариант A) — проблемы нет
```

### 9.3 Преподаватель ведёт на нескольких факультетах

```
Поддерживается: teacher_faculty_ids — массив
При автопоиске обходятся все указанные факультеты
```

### 9.4 Изменение расписания в середине семестра

```
Решение: кнопка "Обновить расписание" + автообновление кэша каждые 24 часа
При обновлении: спарсить группы заново → пересобрать расписание
```

### 9.5 Преподаватель хочет стать студентом (или наоборот)

```
В ProfileSettingsModal добавить:
  "Переключить роль" → подтверждение → обновление role
  
При переключении:
  - student → teacher: открывается TeacherRegistration
  - teacher → student: открывается GroupSelector
  - Данные другой роли сохраняются (не удаляются)
```

---

## 10. Миграция и обратная совместимость

### 10.1 Изменения в БД

```python
# Миграция: добавить поле role ко всем существующим пользователям
db.user_settings.update_many(
    {"role": {"$exists": False}},
    {"$set": {"role": "student"}}
)

# Новые коллекции (создаются автоматически при первом обращении):
# - journal_teacher_access
# - teacher_schedule_cache
# - teacher_search_tasks

# Новые индексы:
db.journal_teacher_access.create_index(
    [("journal_id", 1), ("subject_id", 1), ("teacher_telegram_id", 1)],
    unique=True
)
db.journal_teacher_access.create_index([("teacher_telegram_id", 1), ("status", 1)])
db.journal_teacher_access.create_index("invite_code", unique=True)
db.teacher_schedule_cache.create_index(
    [("teacher_telegram_id", 1), ("week", 1)],
    unique=True
)
db.teacher_schedule_cache.create_index("expires_at", expireAfterSeconds=0)
```

### 10.2 Обратная совместимость

- Все существующие пользователи автоматически получают `role: "student"`
- Существующие API endpoints не затрагиваются
- Журналы работают как раньше — teacher_access добавляется поверх `stats_viewers`
- Frontend проверяет `role` и адаптирует UI

---

## 11. Порядок реализации

### Фаза 1: Основа (Backend)
**Оценка: 2-3 часа**

```
□ Добавить поле role в UserSettings (models.py)
□ Миграция: role = "student" для существующих
□ Создать коллекцию journal_teacher_access + индексы
□ Создать коллекцию teacher_schedule_cache + TTL
□ POST /api/teacher/register
□ GET /api/teacher/schedule/{id}
□ POST /api/teacher/schedule/{id}/refresh
□ Логика match_teacher() для фильтрации по ФИО
□ Тестирование backend endpoints
```

### Фаза 2: Регистрация (Frontend)
**Оценка: 2-3 часа**

```
□ Компонент TeacherRegistration.jsx (4 шага)
□ Кнопка "Я преподаватель" на WelcomeScreen
□ Навигация в App.jsx (роутинг по role)
□ Компонент TeacherScheduleView.jsx (расписание)
□ Адаптация BottomNavigation для teacher
□ Тестирование флоу регистрации
```

### Фаза 3: Автопоиск групп
**Оценка: 1-2 часа**

```
□ POST /api/teacher/auto-search (асинхронный)
□ GET /api/teacher/auto-search/{id}/status (polling)
□ POST /api/teacher/auto-search/{id}/confirm
□ Компонент TeacherAutoSearchModal.jsx
□ Фоновая задача парсинга в asyncio
```

### Фаза 4: Доступ к журналам
**Оценка: 2-3 часа**

```
□ POST /api/journals/{jid}/subjects/{sid}/invite-teacher
□ POST /api/journals/join-teacher/{code}
□ GET /api/teacher/{id}/subjects
□ Компонент InviteTeacherModal.jsx
□ Компонент TeacherSubjectsList.jsx
□ Модификация JournalDetailModal (проверка прав)
□ Модификация AttendanceModal (проверка прав)
```

### Фаза 5: Полировка
**Оценка: 1-2 часа**

```
□ Кэширование расписания преподавателя
□ Автообновление в scheduler_v2.py
□ Переключение роли student ↔ teacher
□ Обработка edge-кейсов
□ i18n (переводы)
□ Финальное тестирование
```

**Общая оценка: 8-13 часов разработки**

---

## Приложение A: Связь с существующим кодом

| Что менять | Файл | Описание |
|------------|------|----------|
| Модель UserSettings | `backend/models.py` | + role, teacher_* поля |
| Новые endpoints | `backend/server.py` | + 14 endpoints |
| Парсер расписания | `backend/rudn_parser.py` | Переиспользуется как есть |
| Кэш | `backend/cache.py` | Возможно расширение |
| Планировщик | `backend/scheduler_v2.py` | + задача обновления кэша |
| WelcomeScreen | `frontend/.../WelcomeScreen.jsx` | + кнопка "Я преподаватель" |
| App | `frontend/.../App.jsx` | + роутинг по role |
| BottomNav | `frontend/.../BottomNavigation.jsx` | + вкладки для teacher |
| JournalDetail | `frontend/.../journal/JournalDetailModal.jsx` | + проверка прав |
| AttendanceModal | `frontend/.../journal/AttendanceModal.jsx` | + проверка прав |
| SubjectDetail | `frontend/.../journal/SubjectDetailModal.jsx` | + кнопка "Пригласить" |

---

**Конец документации**
