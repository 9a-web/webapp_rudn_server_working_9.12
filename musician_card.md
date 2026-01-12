# 🎤 План реализации карточки артиста

**Создано:** 2025-07-06 | **Статус:** 🚧 В работе

---

## 📋 Общий план

### Этап 1: Backend API для артиста
- [x] Добавить endpoint `/api/music/artist/{artist_name}` — получить треки артиста ✅ (УЖЕ СУЩЕСТВУЕТ)
- [x] Добавить поиск по имени артиста через VK API ✅ (метод get_artist_tracks в music_service.py)

### Этап 2: Frontend компонент ArtistCard
- [ ] Создать `ArtistCard.jsx` — модальное окно с информацией об артисте
- [ ] Добавить список треков артиста с возможностью воспроизведения
- [ ] Добавить анимации открытия/закрытия
- [ ] Добавить свайп вниз для закрытия

### Этап 3: Интеграция
- [ ] Добавить кликабельность на имя артиста в TrackCard
- [ ] Добавить кликабельность на имя артиста в FullscreenPlayer
- [ ] Добавить кликабельность на имя артиста в MiniPlayer
- [ ] Экспортировать компонент в index.js

### Этап 4: UI/UX улучшения
- [ ] Добавить скелетон загрузки
- [ ] Добавить обработку ошибок
- [ ] Добавить haptic feedback

---

## 🔄 Прогресс выполнения

### ✅ Выполнено:
- [x] Backend API `/api/music/artist/{artist_name}` - УЖЕ СУЩЕСТВУЕТ
- [x] Метод `get_artist_tracks` в `music_service.py` - УЖЕ СУЩЕСТВУЕТ
- [x] Добавить метод `getArtistTracks` в musicAPI.js ✅
- [x] Создать `ArtistCard.jsx` — модальное окно с информацией об артисте ✅
- [x] Экспортировать компонент в index.js ✅
- [x] Добавить кликабельность на имя артиста в TrackCard ✅
- [x] Добавить кликабельность на имя артиста в FullscreenPlayer ✅
- [x] Добавить кликабельность на имя артиста в MiniPlayer ✅
- [x] Интеграция в App.jsx (состояние, хендлеры, компонент) ✅

### 🔄 В процессе:
- Тестирование функционала

---

## 📁 Файлы для изменения/создания

| Файл | Действие | Статус |
|------|----------|--------|
| `/app/backend/server.py` | Endpoint существует | ✅ |
| `/app/backend/music_service.py` | Метод существует | ✅ |
| `/app/frontend/src/components/music/ArtistCard.jsx` | Создан | ✅ |
| `/app/frontend/src/components/music/index.js` | Экспорт добавлен | ✅ |
| `/app/frontend/src/components/music/TrackCard.jsx` | onArtistClick добавлен | ✅ |
| `/app/frontend/src/components/music/FullscreenPlayer.jsx` | onArtistClick добавлен | ✅ |
| `/app/frontend/src/components/music/MiniPlayer.jsx` | onArtistClick добавлен | ✅ |
| `/app/frontend/src/services/musicAPI.js` | getArtistTracks добавлен | ✅ |
| `/app/frontend/src/App.jsx` | Интеграция ArtistCard | ✅ |

---

## 🎨 Дизайн карточки артиста

```
┌─────────────────────────────────────────────────┐
│  ▬▬▬ (drag handle)                              │
│                                                  │
│        ┌──────────┐                              │
│        │  🎤 ICON │   ← Градиент/иконка         │
│        └──────────┘                              │
│                                                  │
│     ARTIST NAME                                  │
│     N треков найдено                            │
│                                                  │
│  ─────────────────────────────────────────────  │
│                                                  │
│  🎵 Track 1 - Title                    3:45  ▶️ │
│  🎵 Track 2 - Title                    4:12  ▶️ │
│  🎵 Track 3 - Title                    3:21  ▶️ │
│  ...                                            │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 📝 Логи реализации

- `[ВРЕМЯ]` — Описание действия

