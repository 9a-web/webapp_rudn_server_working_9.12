# Исправление логики создания задач - target_date и deadline

## Проблема
В разделе "Список дел" при создании задачи на другую дату (особенно прошедшую) появлялась надпись "Просрочено", даже если задача просто привязана к прошедшей дате без реального срока выполнения.

## Решение

### 1. Разделение понятий `target_date` и `deadline`

- **`target_date`** - дата, к которой привязана задача (для какого дня задача планируется)
- **`deadline`** - реальный срок выполнения задачи (может быть просрочен)

### 2. Изменения в AddTaskModal.jsx

**Новая логика установки deadline:**
```javascript
// Устанавливаем deadline ТОЛЬКО если выбранная дата в будущем
if (selected > now) {
  const deadlineDate = new Date(selectedDate);
  deadlineDate.setHours(23, 59, 0, 0);
  setDeadline(formattedDeadline);
} else {
  // Для прошедших дат и сегодня - оставляем пустым
  setDeadline('');
}
```

**Всегда устанавливаем target_date:**
```javascript
const taskData = {
  text: taskText.trim(),
  category: category,
  priority: priority,
  deadline: deadline ? new Date(deadline).toISOString() : null,
  target_date: selectedDate ? new Date(selectedDate).toISOString() : null,  // ✅ Новое
  subject: subject || null,
};
```

### 3. Изменения в TasksSection.jsx

**Обновлена функция getTasksForSelectedDate():**

Новая логика фильтрации задач с приоритетами:

1. **ПРИОРИТЕТ 1:** Задачи с `target_date` - показываем на соответствующую дату
2. **ПРИОРИТЕТ 2:** Задачи с `deadline` но без `target_date` - показываем на дату deadline
3. **ПРИОРИТЕТ 3:** Задачи без `target_date` и без `deadline` - показываем ТОЛЬКО на сегодня

```javascript
filteredTasks.forEach(task => {
  // ПРИОРИТЕТ 1: target_date
  if (task.target_date) {
    const targetDate = new Date(task.target_date);
    targetDate.setHours(0, 0, 0, 0);
    
    if (targetDate.getTime() === selectedDateStart.getTime()) {
      allTasks.push(task);
    }
    return;
  }
  
  // ПРИОРИТЕТ 2: deadline
  if (task.deadline) {
    const deadline = new Date(task.deadline);
    deadline.setHours(0, 0, 0, 0);
    
    if (deadline.getTime() === selectedDateStart.getTime()) {
      allTasks.push(task);
    }
    return;
  }
  
  // ПРИОРИТЕТ 3: без дат - только на сегодня
  if (selectedDateStart.getTime() === todayStart.getTime()) {
    allTasks.push(task);
  }
});
```

**Обновлена передача target_date в API:**
```javascript
const newTask = await tasksAPI.createTask(user.id, requestData.text, {
  category: requestData.category,
  priority: requestData.priority,
  deadline: requestData.deadline,
  target_date: requestData.target_date,  // ✅ Новое
  subject: requestData.subject,
});
```

**Обновлена проверка завершенности задач:**
```javascript
const tasksForDate = updatedTasks.filter(t => {
  // Проверяем target_date (приоритет)
  if (t.target_date) {
    const targetDateStr = new Date(t.target_date).toISOString().split('T')[0];
    if (targetDateStr === selectedDateStr) return true;
  }
  // Проверяем deadline
  if (t.deadline) {
    const taskDeadlineDate = new Date(t.deadline).toISOString().split('T')[0];
    if (taskDeadlineDate === selectedDateStr) return true;
  }
  // Задачи без target_date и deadline только на сегодня
  if (!t.target_date && !t.deadline) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedDateStr === todayStr) return true;
  }
  return false;
});
```

## Результат

### ✅ Задача на прошедшую дату
- Создается с `target_date` = выбранная дата
- `deadline` остается пустым
- Показывается на выбранную дату
- **НЕ показывается статус "Просрочено"**

### ✅ Задача на будущую дату
- Создается с `target_date` = выбранная дата
- `deadline` автоматически устанавливается на 23:59 выбранной даты
- Показывается на выбранную дату
- Показывается статус дедлайна ("Сегодня", "Завтра", конкретная дата)

### ✅ Задача на сегодня
- Создается с `target_date` = сегодня
- `deadline` остается пустым (так как не в будущем)
- Показывается на сегодня
- **НЕ показывается статус "Просрочено"**

## Backend

Модель уже поддерживала поле `target_date`:
```python
class Task(BaseModel):
    deadline: Optional[datetime] = None  # Дедлайн задачи (для реальных сроков)
    target_date: Optional[datetime] = None  # Целевая дата задачи (день, к которому привязана задача)
```

## Файлы изменены
- `/app/frontend/src/components/AddTaskModal.jsx` - логика установки deadline и target_date
- `/app/frontend/src/components/TasksSection.jsx` - фильтрация задач по target_date, передача в API

## Дата реализации
2025-01-XX

## Критическое исправление - Timezone Issue

### Проблема с временными зонами
После первой реализации обнаружена критическая проблема: при использовании `new Date().toISOString()` происходила конвертация локального времени в UTC, что приводило к смещению даты на один день назад.

**Пример:**
- Пользователь выбрал дату: 2 ноября 2025 (local time, timezone +03:00)
- После `toISOString()`: 2025-11-01T21:00:00.000Z (минус 3 часа!)
- В базе сохранялось: 1 ноября вместо 2 ноября

### Решение
Изменен способ формирования ISO строки для target_date - теперь используется форматирование без конвертации в UTC:

```javascript
// БЫЛО (неправильно):
target_date: selectedDate ? new Date(selectedDate).toISOString() : null

// СТАЛО (правильно):
let targetDateISO = null;
if (selectedDate) {
  const targetDate = new Date(selectedDate);
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  targetDateISO = `${year}-${month}-${day}T00:00:00`;
}
```

Теперь дата всегда сохраняется в формате `YYYY-MM-DDT00:00:00` без смещения timezone.

## Статус
✅ Реализовано, исправлена проблема с timezone, готово к тестированию
