# Скрытие нижнего меню при открытии модальных окон

## Описание задачи
Реализовано автоматическое скрытие нижнего меню навигации (BottomNavigation) при открытии модальных окон, **за исключением окна профиля (ProfileModal)**.

## Реализованные изменения

### 1. App.js - Централизованное управление состоянием модальных окон

**Добавлены новые состояния для отслеживания модальных окон:**
```javascript
// Состояние для отслеживания модального окна AddTaskModal из TasksSection
const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
// Состояния для модальных окон в Header (для отслеживания)
const [isMenuOpen, setIsMenuOpen] = useState(false);
// Состояние для модального окна ShareScheduleModal
const [isShareModalOpen, setIsShareModalOpen] = useState(false);
```

**Добавлена логика объединения всех состояний модальных окон:**
```javascript
// Отслеживание всех модальных окон (кроме ProfileModal) для скрытия нижнего меню
const isAnyModalOpen = 
  isCalendarOpen || 
  isAnalyticsOpen || 
  isAchievementsOpen || 
  isNotificationSettingsOpen ||
  isMenuOpen ||
  isShareModalOpen ||
  isAddTaskModalOpen; // from TasksSection's AddTaskModal
```

**Обновлен проп для BottomNavigation:**
```javascript
<BottomNavigation 
  activeTab={activeTab}
  onTabChange={handleTabChange}
  hapticFeedback={hapticFeedback}
  isHidden={isAnyModalOpen} // Было: isModalOpen
/>
```

**Добавлены коллбеки для дочерних компонентов:**
- `Header` получил проп `onMenuStateChange={setIsMenuOpen}`
- `LiveScheduleSection` получил проп `onShareModalStateChange={setIsShareModalOpen}`
- `TasksSection` получил обновленный проп `onModalStateChange={setIsAddTaskModalOpen}`

### 2. Header.jsx - Уведомление родителя о состоянии MenuModal

**Добавлен новый проп:**
```javascript
export const Header = React.memo(({ 
  user, 
  userSettings, 
  onCalendarClick, 
  onNotificationsClick, 
  onAnalyticsClick, 
  onAchievementsClick, 
  hapticFeedback, 
  onMenuStateChange // НОВЫЙ ПРОП
}) => {
```

**Добавлен useEffect для уведомления родителя:**
```javascript
// Уведомляем родительский компонент о состоянии MenuModal
useEffect(() => {
  if (onMenuStateChange) {
    onMenuStateChange(isMenuOpen);
  }
}, [isMenuOpen, onMenuStateChange]);
```

### 3. LiveScheduleSection.jsx - Уведомление родителя о состоянии ShareScheduleModal

**Добавлен новый проп:**
```javascript
export const LiveScheduleSection = ({ 
  selectedDate, 
  mockSchedule, 
  weekNumber = 1,
  onWeekChange,
  groupName,
  onChangeGroup,
  hapticFeedback,
  onDateSelect,
  telegramId,
  onShareModalStateChange // НОВЫЙ ПРОП
}) => {
```

**Добавлен useEffect для уведомления родителя:**
```javascript
// Уведомляем родительский компонент о состоянии ShareScheduleModal
useEffect(() => {
  if (onShareModalStateChange) {
    onShareModalStateChange(isShareModalOpen);
  }
}, [isShareModalOpen, onShareModalStateChange]);
```

## Список модальных окон, скрывающих нижнее меню

### ✅ Модальные окна, которые скрывают нижнее меню:
1. **CalendarModal** - календарь для выбора даты
2. **AnalyticsModal** - аналитика расписания
3. **AchievementsModal** - достижения пользователя
4. **NotificationSettings** - настройки уведомлений
5. **MenuModal** - гамбургер-меню (в Header)
6. **ShareScheduleModal** - модальное окно шаринга расписания
7. **AddTaskModal** - модальное окно создания задачи (в TasksSection)

### ❌ Модальные окна, которые НЕ скрывают нижнее меню:
1. **ProfileModal** - окно профиля пользователя (по требованию задачи)

### ℹ️ Специальные уведомления:
- **AchievementNotification** - всплывающее уведомление о достижении (не скрывает меню, так как не блокирует интерфейс)

## Архитектура решения

### Принцип работы:
1. **Централизованное управление**: App.js является единственным источником правды о состоянии нижнего меню
2. **Двунаправленная связь**: Дочерние компоненты уведомляют родителя через коллбеки
3. **Реактивность**: Изменение состояния любого модального окна автоматически обновляет видимость нижнего меню
4. **Исключение ProfileModal**: Состояние ProfileModal намеренно не включено в `isAnyModalOpen`

### Поток данных:
```
App.js (родитель)
  ↓ props: onMenuStateChange
Header.jsx → MenuModal (isMenuOpen) → useEffect → onMenuStateChange(isMenuOpen)
  ↑ уведомление о состоянии

App.js (родитель)  
  ↓ props: onShareModalStateChange
LiveScheduleSection.jsx → ShareScheduleModal (isShareModalOpen) → useEffect → onShareModalStateChange(isShareModalOpen)
  ↑ уведомление о состоянии

App.js (родитель)
  ↓ props: onModalStateChange  
TasksSection.jsx → AddTaskModal (isAddModalOpen) → onModalStateChange(isAddModalOpen)
  ↑ уведомление о состоянии
```

## Тестирование

### Сценарии для проверки:
1. ✅ Открыть календарь → нижнее меню должно скрыться
2. ✅ Открыть аналитику → нижнее меню должно скрыться
3. ✅ Открыть достижения → нижнее меню должно скрыться
4. ✅ Открыть настройки уведомлений → нижнее меню должно скрыться
5. ✅ Открыть гамбургер-меню → нижнее меню должно скрыться
6. ✅ Открыть модальное окно шаринга → нижнее меню должно скрыться
7. ✅ Открыть модальное окно создания задачи → нижнее меню должно скрыться
8. ✅ Открыть профиль пользователя → нижнее меню должно ОСТАТЬСЯ видимым
9. ✅ Закрыть любое модальное окно → нижнее меню должно появиться снова

## Преимущества реализации

1. **Улучшенный UX**: Модальные окна получают полное внимание пользователя без отвлекающих элементов
2. **Централизация логики**: Вся логика управления видимостью в одном месте (App.js)
3. **Масштабируемость**: Легко добавить новые модальные окна в систему
4. **Консистентность**: Единое поведение для всех модальных окон (кроме ProfileModal)
5. **Гибкость**: Легко изменить список исключений

## Статус
✅ **РЕАЛИЗОВАНО И ПРОТЕСТИРОВАНО**

Дата: 2025-01-XX
Автор: Main Agent
Frontend скомпилирован успешно без ошибок.
Сервисы перезапущены и работают корректно.
