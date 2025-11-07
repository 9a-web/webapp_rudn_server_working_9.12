# Исправление Drag and Drop в списке задач

## 🐛 Проблема

Перетаскивание задач в карточке "Сегодня" не работало из-за неправильной реализации с вложенными `Reorder.Item`.

### Симптомы:
- Иконка GripVertical (3 полоски) отображалась корректно
- При попытке перетащить задачу ничего не происходило
- Курсор менялся на `grab`, но перетаскивание не инициировалось

### Причина:
```jsx
// ❌ НЕПРАВИЛЬНО - вложенный Reorder.Item
<Reorder.Item value={task} dragListener={false}>
  <Reorder.Item value={task} dragListener={true}>
    <GripVertical />
  </Reorder.Item>
</Reorder.Item>
```

Вложенный `Reorder.Item` создавал конфликт, и события drag не обрабатывались корректно.

---

## ✅ Решение

### 1. Использование `useDragControls` hook

Правильный подход - использовать `useDragControls` из Framer Motion:

```jsx
import { useDragControls } from 'framer-motion';

const TodayTaskItem = ({ task, ... }) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={dragControls}
    >
      <div
        onPointerDown={(e) => {
          dragControls.start(e);
          hapticFeedback && hapticFeedback('impact', 'light');
        }}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      {/* остальной контент */}
    </Reorder.Item>
  );
};
```

### 2. Ключевые моменты реализации

#### a) Создание dragControls
```jsx
const dragControls = useDragControls();
```

#### b) Настройка Reorder.Item
```jsx
<Reorder.Item
  value={task}
  dragListener={false}  // ✅ Отключаем автоматический listener
  dragControls={dragControls}  // ✅ Передаем controls
>
```

#### c) Drag Handle с onPointerDown
```jsx
<div
  onPointerDown={(e) => {
    dragControls.start(e);  // ✅ Запускаем перетаскивание вручную
    hapticFeedback && hapticFeedback('impact', 'light');
  }}
  className="cursor-grab active:cursor-grabbing touch-none"
>
  <GripVertical />
</div>
```

---

## 📋 Полная структура компонента

```jsx
const TodayTaskItem = ({ 
  task, 
  isEditing, 
  editingText, 
  setEditingText,
  onToggle,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  getCategoryEmoji,
  getPriorityColor,
  getDeadlineStatus,
  hapticFeedback
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      key={task.id}
      value={task}
      dragListener={false}
      dragControls={dragControls}
      className="relative"
    >
      <motion.div className="bg-white rounded-lg p-2 group shadow-sm">
        {isEditing ? (
          // Режим редактирования
          <EditMode />
        ) : (
          // Обычный режим
          <div className="flex items-start gap-2">
            {/* Drag Handle */}
            <div
              onPointerDown={(e) => {
                dragControls.start(e);
                hapticFeedback && hapticFeedback('impact', 'light');
              }}
              className="flex-shrink-0 cursor-grab active:cursor-grabbing mt-0.5 touch-none"
            >
              <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </div>
            
            {/* Checkbox */}
            <Checkbox />
            
            {/* Текст задачи */}
            <TaskContent />
            
            {/* Кнопка удаления */}
            <DeleteButton />
          </div>
        )}
      </motion.div>
    </Reorder.Item>
  );
};
```

---

## 🎨 CSS классы для drag handle

```css
/* Важные классы */
.cursor-grab          /* Курсор в виде руки */
.active:cursor-grabbing  /* Курсор при перетаскивании */
.touch-none           /* Отключает браузерные touch жесты */
```

### Зачем `touch-none`?
Класс `touch-none` критичен для мобильных устройств. Он отключает встроенные браузерные жесты (scroll, zoom) и позволяет Framer Motion полностью контролировать touch события.

---

## 🔧 Интеграция с Reorder.Group

```jsx
<Reorder.Group 
  axis="y" 
  values={todayTasks} 
  onReorder={handleReorderTasks}
  className="space-y-2"
>
  {todayTasks.map((task) => (
    <TodayTaskItem
      key={task.id}
      task={task}
      // ... остальные пропсы
    />
  ))}
</Reorder.Group>
```

### handleReorderTasks callback:
```jsx
const handleReorderTasks = (newOrder) => {
  setTasks(newOrder);
  hapticFeedback && hapticFeedback('impact', 'light');
  // Опционально: сохранить порядок на сервер
};
```

---

## 📱 Поддержка мобильных устройств

### Проблемы на мобильных:
1. **Конфликт с scroll**: Браузер может перехватывать touch события для scroll
2. **Delayed drag start**: На iOS может быть задержка

### Решения:
```jsx
<div
  onPointerDown={(e) => {
    e.preventDefault();  // Предотвращает браузерные жесты
    dragControls.start(e);
  }}
  className="touch-none select-none"  // CSS для блокировки жестов
>
```

---

## ✅ Преимущества нового подхода

1. **Явный контроль**: Перетаскивание запускается только при клике на handle
2. **Нет конфликтов**: Другие элементы (checkbox, кнопки) работают независимо
3. **Лучший UX**: Пользователь точно знает где можно перетаскивать
4. **Haptic feedback**: Тактильная обратная связь при начале перетаскивания
5. **Touch support**: Работает на мобильных устройствах

---

## 🧪 Тестирование

### Desktop:
1. ✅ Наведение на GripVertical меняет курсор на `grab`
2. ✅ Клик и удержание меняет курсор на `grabbing`
3. ✅ Перетаскивание изменяет порядок задач
4. ✅ Другие элементы (checkbox, кнопки) работают независимо

### Mobile:
1. ✅ Touch на GripVertical запускает перетаскивание
2. ✅ Haptic feedback при начале drag
3. ✅ Scroll работает на остальной части экрана
4. ✅ Перетаскивание плавное без задержек

---

## 📚 Документация Framer Motion

- [Reorder.Group](https://www.framer.com/motion/reorder/#reorder.group)
- [Reorder.Item](https://www.framer.com/motion/reorder/#reorder.item)
- [useDragControls](https://www.framer.com/motion/use-drag-controls/)

---

## 🔍 Отладка

### Если drag не работает:

1. **Проверьте dragControls**
   ```jsx
   console.log('dragControls:', dragControls);
   ```

2. **Проверьте onPointerDown**
   ```jsx
   onPointerDown={(e) => {
     console.log('Pointer down:', e);
     dragControls.start(e);
   }}
   ```

3. **Проверьте Reorder.Item props**
   ```jsx
   <Reorder.Item
     dragListener={false}  // ✅ Должен быть false
     dragControls={dragControls}  // ✅ Должен быть передан
   >
   ```

4. **Проверьте CSS**
   ```css
   /* Убедитесь что нет pointer-events: none */
   .drag-handle {
     pointer-events: auto;
     touch-action: none;
   }
   ```

---

## 🎯 Итог

Правильное использование `useDragControls` + `onPointerDown` обеспечивает:
- ✅ Работающее перетаскивание на всех устройствах
- ✅ Точный контроль drag области
- ✅ Независимость других интерактивных элементов
- ✅ Лучший UX с haptic feedback
