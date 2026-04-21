# 🎵 План интеграции VK Music в RUDN Schedule App

## Обзор

Добавление полноценного музыкального раздела с мини-плеером, интегрированного в существующее Telegram Web App.

---

## 📋 Содержание

1. [Архитектура](#1-архитектура)
2. [Backend API](#2-backend-api)
3. [Frontend компоненты](#3-frontend-компоненты)
4. [База данных](#4-база-данных)
5. [Этапы реализации](#5-этапы-реализации)
6. [Оценка времени](#6-оценка-времени)

---

## 1. Архитектура

### Общая схема
```
┌─────────────────────────────────────────────────────────────────┐
│                     Telegram WebApp                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Поиск     │  │  Мои аудио  │  │  Популярное │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────────────────────────────────────────┐            │
│  │              Плейлисты                          │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  🎵 Мини-плеер (фиксированный внизу над BottomNavigation)   ││
│  │  [⏮] [▶/⏸] [⏭]  Artist - Title  ▬▬▬●▬▬▬▬ 2:34/4:15        ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              BottomNavigation (существующий)                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                               │
│  /api/music/search         - поиск треков                       │
│  /api/music/my             - мои аудиозаписи                    │
│  /api/music/popular        - популярные треки                   │
│  /api/music/playlists      - плейлисты пользователя             │
│  /api/music/playlist/{id}  - треки плейлиста                    │
│  /api/music/track/{id}     - получить свежий URL трека          │
│  /api/music/favorites      - избранные треки (в MongoDB)        │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│      VK Music API       │     │        MongoDB          │
│   (через vkpymusic)     │     │  - user_favorites       │
│   - Поиск               │     │  - listening_history    │
│   - Аудио юзера         │     │  - user_playlists       │
│   - Популярное          │     │                         │
│   - Плейлисты           │     │                         │
└─────────────────────────┘     └─────────────────────────┘
```

### Поток данных
```
1. User → Frontend: Запрос поиска/плейлиста
2. Frontend → Backend API: GET /api/music/search?q=...
3. Backend → VK API: vkpymusic.search_songs_by_text()
4. VK API → Backend: Список треков с URL
5. Backend → Frontend: JSON с треками
6. Frontend → HTML5 Audio: Воспроизведение по URL
```

---

## 2. Backend API

### 2.1 Конфигурация (.env)
```env
# Добавить в /app/backend/.env
VK_MUSIC_TOKEN="vk1.a.lyp1i1MKMUGJ2uEVAkgF9wwGOcCoTmO_Ss2pxI1O9uss8Q1yQTOxIBTclyFZ8KhfUINaAHp9ESPCPR0RYqXBToGB_BnJLnEoh-Giyc4kuvTqfm9sn-FJ6CfEafGsLIwyL-UoYy48Hjp1FnyA23ENxVvsiV2SWDU43L09CRmPJEsx7h0-s9nsquzTe2KbL35iSCNO7TrFff1yHTX52Scrog"
VK_USER_ID=523439151
```

### 2.2 Новый файл: `/app/backend/music_service.py`
```python
"""
VK Music Service - обёртка над vkpymusic
"""
from vkpymusic import Service
from typing import List, Optional
import os

class VKMusicService:
    def __init__(self):
        self.token = os.environ.get("VK_MUSIC_TOKEN")
        self.user_id = int(os.environ.get("VK_USER_ID", 0))
        self.service = Service(
            user_agent="KateMobileAndroid/93 lite-530",
            token=self.token
        )
    
    def search(self, query: str, count: int = 20) -> List[dict]:
        """Поиск треков"""
        tracks = self.service.search_songs_by_text(query, count=count)
        return [self._track_to_dict(t) for t in tracks]
    
    def get_my_audio(self, count: int = 50) -> List[dict]:
        """Мои аудиозаписи"""
        tracks = self.service.get_songs_by_userid(self.user_id, count=count)
        return [self._track_to_dict(t) for t in tracks]
    
    def get_popular(self, count: int = 30) -> List[dict]:
        """Популярные треки"""
        tracks = self.service.get_popular(count=count)
        return [self._track_to_dict(t) for t in tracks]
    
    def get_playlists(self) -> List[dict]:
        """Плейлисты пользователя"""
        playlists = self.service.get_playlists_by_userid(self.user_id)
        return [self._playlist_to_dict(p) for p in playlists]
    
    def get_playlist_tracks(self, owner_id: int, playlist_id: int, count: int = 100) -> List[dict]:
        """Треки плейлиста"""
        # vkpymusic метод для получения треков плейлиста
        tracks = self.service.get_songs_by_playlist(owner_id, playlist_id, count=count)
        return [self._track_to_dict(t) for t in tracks]
    
    def _track_to_dict(self, track) -> dict:
        return {
            "id": f"{track.owner_id}_{track.song_id}",
            "owner_id": track.owner_id,
            "song_id": track.song_id,
            "artist": track.artist,
            "title": track.title,
            "duration": track.duration,
            "url": track.url,
            "cover": getattr(track, 'cover', None)  # Обложка если есть
        }
    
    def _playlist_to_dict(self, playlist) -> dict:
        return {
            "id": playlist.playlist_id,
            "owner_id": playlist.owner_id,
            "title": playlist.title,
            "count": playlist.count,
            "cover": getattr(playlist, 'photo', None)
        }

# Singleton
music_service = VKMusicService()
```

### 2.3 API Endpoints (добавить в server.py)
```python
# ============ MUSIC API ============

@api_router.get("/music/search")
async def music_search(q: str, count: int = 20):
    """Поиск музыки"""
    try:
        tracks = music_service.search(q, count)
        return {"tracks": tracks, "count": len(tracks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/music/my")
async def music_my_audio(count: int = 50):
    """Мои аудиозаписи"""
    try:
        tracks = music_service.get_my_audio(count)
        return {"tracks": tracks, "count": len(tracks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/music/popular")
async def music_popular(count: int = 30):
    """Популярные треки"""
    try:
        tracks = music_service.get_popular(count)
        return {"tracks": tracks, "count": len(tracks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/music/playlists")
async def music_playlists():
    """Плейлисты"""
    try:
        playlists = music_service.get_playlists()
        return {"playlists": playlists}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/music/playlist/{owner_id}/{playlist_id}")
async def music_playlist_tracks(owner_id: int, playlist_id: int, count: int = 100):
    """Треки плейлиста"""
    try:
        tracks = music_service.get_playlist_tracks(owner_id, playlist_id, count)
        return {"tracks": tracks, "count": len(tracks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Избранное (хранится в MongoDB)
@api_router.get("/music/favorites/{telegram_id}")
async def get_favorites(telegram_id: int):
    """Избранные треки пользователя"""
    favorites = await db.music_favorites.find({"telegram_id": telegram_id}).to_list(500)
    return {"tracks": favorites}

@api_router.post("/music/favorites/{telegram_id}")
async def add_favorite(telegram_id: int, track: dict):
    """Добавить в избранное"""
    track["telegram_id"] = telegram_id
    track["added_at"] = datetime.utcnow()
    await db.music_favorites.insert_one(track)
    return {"success": True}

@api_router.delete("/music/favorites/{telegram_id}/{track_id}")
async def remove_favorite(telegram_id: int, track_id: str):
    """Удалить из избранного"""
    await db.music_favorites.delete_one({"telegram_id": telegram_id, "id": track_id})
    return {"success": True}
```

---

## 3. Frontend компоненты

### 3.1 Структура файлов
```
/app/frontend/src/
├── components/
│   └── music/
│       ├── index.js              # Экспорт всех компонентов
│       ├── MiniPlayer.jsx        # Мини-плеер (фикс. внизу)
│       ├── MusicSection.jsx      # Главный раздел музыки
│       ├── MusicSearch.jsx       # Поиск с результатами
│       ├── TrackList.jsx         # Список треков
│       ├── TrackCard.jsx         # Карточка трека
│       ├── PlaylistCard.jsx      # Карточка плейлиста
│       ├── PlaylistModal.jsx     # Модалка плейлиста
│       └── PlayerContext.jsx     # Контекст плеера (глобальное состояние)
├── services/
│   └── musicAPI.js               # API вызовы для музыки
└── hooks/
    └── useAudioPlayer.js         # Хук для управления аудио
```

### 3.2 PlayerContext.jsx (глобальное состояние плеера)
```jsx
import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const audioRef = useRef(new Audio());
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const play = useCallback((track, trackList = []) => {
    if (trackList.length > 0) {
      setQueue(trackList);
      setQueueIndex(trackList.findIndex(t => t.id === track.id));
    }
    setCurrentTrack(track);
    audioRef.current.src = track.url;
    audioRef.current.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else audioRef.current.play().then(() => setIsPlaying(true));
  }, [isPlaying, pause]);

  const next = useCallback(() => {
    if (queueIndex < queue.length - 1) {
      const nextTrack = queue[queueIndex + 1];
      setQueueIndex(queueIndex + 1);
      play(nextTrack);
    }
  }, [queue, queueIndex, play]);

  const prev = useCallback(() => {
    if (queueIndex > 0) {
      const prevTrack = queue[queueIndex - 1];
      setQueueIndex(queueIndex - 1);
      play(prevTrack);
    }
  }, [queue, queueIndex, play]);

  const seek = useCallback((time) => {
    audioRef.current.currentTime = time;
  }, []);

  // Audio events
  React.useEffect(() => {
    const audio = audioRef.current;
    
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => next();
    
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [next]);

  return (
    <PlayerContext.Provider value={{
      currentTrack,
      isPlaying,
      progress,
      duration,
      queue,
      play,
      pause,
      toggle,
      next,
      prev,
      seek
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
```

### 3.3 MiniPlayer.jsx
```jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Music } from 'lucide-react';
import { usePlayer } from './PlayerContext';

export const MiniPlayer = ({ onExpand }) => {
  const { currentTrack, isPlaying, progress, duration, toggle, next, prev } = usePlayer();

  if (!currentTrack) return null;

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed z-40"
        style={{
          bottom: '70px', // Над BottomNavigation
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: '400px'
        }}
      >
        <div 
          className="rounded-2xl border border-white/10 p-3"
          style={{
            backgroundColor: 'rgba(28, 28, 30, 0.9)',
            backdropFilter: 'blur(20px)'
          }}
          onClick={onExpand}
        >
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Cover/Icon */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Music className="w-6 h-6 text-purple-400" />
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <p className="text-white font-medium truncate text-sm">
                {currentTrack.title}
              </p>
              <p className="text-white/60 text-xs truncate">
                {currentTrack.artist}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button onClick={prev} className="p-2 text-white/60 hover:text-white">
                <SkipBack className="w-5 h-5" />
              </button>
              <button 
                onClick={toggle}
                className="p-2 bg-white rounded-full"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-black" />
                ) : (
                  <Play className="w-5 h-5 text-black ml-0.5" />
                )}
              </button>
              <button onClick={next} className="p-2 text-white/60 hover:text-white">
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Time */}
            <span className="text-xs text-white/40 w-10 text-right">
              {formatTime(progress)}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
```

### 3.4 MusicSection.jsx (главный раздел)
```jsx
import React, { useState, useEffect } from 'react';
import { Search, Music, TrendingUp, ListMusic, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { musicAPI } from '../../services/musicAPI';
import { TrackList } from './TrackList';
import { MusicSearch } from './MusicSearch';

export const MusicSection = () => {
  const [activeTab, setActiveTab] = useState('search'); // search, my, popular, playlists, favorites
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'search', icon: Search, label: 'Поиск' },
    { id: 'my', icon: Music, label: 'Мои' },
    { id: 'popular', icon: TrendingUp, label: 'Популярное' },
    { id: 'playlists', icon: ListMusic, label: 'Плейлисты' },
    { id: 'favorites', icon: Heart, label: 'Избранное' },
  ];

  useEffect(() => {
    loadContent();
  }, [activeTab]);

  const loadContent = async () => {
    if (activeTab === 'search') return; // Поиск отдельно
    
    setLoading(true);
    try {
      switch (activeTab) {
        case 'my':
          const my = await musicAPI.getMyAudio();
          setTracks(my.tracks);
          break;
        case 'popular':
          const popular = await musicAPI.getPopular();
          setTracks(popular.tracks);
          break;
        case 'playlists':
          const pl = await musicAPI.getPlaylists();
          setPlaylists(pl.playlists);
          break;
        case 'favorites':
          const fav = await musicAPI.getFavorites(telegramId);
          setTracks(fav.tracks);
          break;
      }
    } catch (error) {
      console.error('Error loading music:', error);
    }
    setLoading(false);
  };

  return (
    <div className="pb-32"> {/* Отступ для мини-плеера */}
      {/* Tabs */}
      <div className="flex gap-2 p-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-purple-500 text-white'
                : 'bg-white/5 text-white/60'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'search' ? (
        <MusicSearch />
      ) : activeTab === 'playlists' ? (
        <div className="grid grid-cols-2 gap-3 p-4">
          {playlists.map(playlist => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      ) : (
        <TrackList tracks={tracks} loading={loading} />
      )}
    </div>
  );
};
```

### 3.5 musicAPI.js (сервис)
```javascript
// /app/frontend/src/services/musicAPI.js
import api from './api';

export const musicAPI = {
  search: (query, count = 20) => 
    api.get(`/music/search?q=${encodeURIComponent(query)}&count=${count}`),
  
  getMyAudio: (count = 50) => 
    api.get(`/music/my?count=${count}`),
  
  getPopular: (count = 30) => 
    api.get(`/music/popular?count=${count}`),
  
  getPlaylists: () => 
    api.get('/music/playlists'),
  
  getPlaylistTracks: (ownerId, playlistId, count = 100) =>
    api.get(`/music/playlist/${ownerId}/${playlistId}?count=${count}`),
  
  getFavorites: (telegramId) =>
    api.get(`/music/favorites/${telegramId}`),
  
  addFavorite: (telegramId, track) =>
    api.post(`/music/favorites/${telegramId}`, track),
  
  removeFavorite: (telegramId, trackId) =>
    api.delete(`/music/favorites/${telegramId}/${trackId}`)
};
```

---

## 4. База данных (MongoDB)

### 4.1 Новые коллекции

**music_favorites** - Избранные треки
```javascript
{
  "_id": ObjectId,
  "telegram_id": 123456789,
  "id": "12345_67890",        // owner_id_song_id
  "owner_id": 12345,
  "song_id": 67890,
  "artist": "Imagine Dragons",
  "title": "Believer",
  "duration": 204,
  "added_at": ISODate("2025-01-06T12:00:00Z")
}
```

**music_history** - История прослушивания (опционально)
```javascript
{
  "_id": ObjectId,
  "telegram_id": 123456789,
  "track_id": "12345_67890",
  "artist": "Imagine Dragons",
  "title": "Believer",
  "played_at": ISODate("2025-01-06T12:00:00Z")
}
```

---

## 5. Этапы реализации

### Этап 1: Backend базовый (30 мин)
- [ ] Добавить VK_MUSIC_TOKEN в .env
- [ ] Создать `/app/backend/music_service.py`
- [ ] Добавить API endpoints в server.py
- [ ] Тестирование через curl

### Этап 2: Frontend инфраструктура (20 мин)
- [ ] Создать папку `/app/frontend/src/components/music/`
- [ ] Создать `musicAPI.js`
- [ ] Создать `PlayerContext.jsx`

### Этап 3: Мини-плеер (30 мин)
- [ ] Создать `MiniPlayer.jsx`
- [ ] Интегрировать PlayerProvider в App.jsx
- [ ] Позиционирование над BottomNavigation

### Этап 4: Музыкальный раздел (40 мин)
- [ ] Создать `MusicSection.jsx`
- [ ] Создать `TrackList.jsx`, `TrackCard.jsx`
- [ ] Создать `MusicSearch.jsx`
- [ ] Добавить вкладку "Музыка" в BottomNavigation

### Этап 5: Плейлисты и избранное (30 мин)
- [ ] Создать `PlaylistCard.jsx`, `PlaylistModal.jsx`
- [ ] Реализовать добавление в избранное
- [ ] MongoDB интеграция для favorites

### Этап 6: Полировка UI (20 мин)
- [ ] Анимации (framer-motion)
- [ ] Haptic feedback
- [ ] Адаптив для разных экранов
- [ ] Обработка ошибок

### Этап 7: Тестирование (20 мин)
- [ ] Проверка всех функций
- [ ] Тест в Telegram WebApp
- [ ] Исправление багов

---

## 6. Оценка времени

| Этап | Время |
|------|-------|
| Backend базовый | 30 мин |
| Frontend инфраструктура | 20 мин |
| Мини-плеер | 30 мин |
| Музыкальный раздел | 40 мин |
| Плейлисты и избранное | 30 мин |
| Полировка UI | 20 мин |
| Тестирование | 20 мин |
| **ИТОГО** | **~3 часа** |

---

## 7. Визуальная концепция

### Мини-плеер (свёрнутый)
```
┌─────────────────────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬▬▬●▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬│ ← прогресс
│ 🎵  Imagine Dragons - Believer    [⏮][▶][⏭] 2:34│
└─────────────────────────────────────────────────┘
```

### Вкладки музыкального раздела
```
[ 🔍 Поиск ] [ 🎵 Мои ] [ 📈 Популярное ] [ 📁 Плейлисты ] [ ❤️ Избранное ]
```

### Карточка трека
```
┌─────────────────────────────────────────────────┐
│ [🎵]  Imagine Dragons            ▶️   ❤️   ⋮   │
│       Believer • 3:24                           │
└─────────────────────────────────────────────────┘
```

---

## 8. Важные замечания

### ⚠️ Ограничения VK API
1. **URL временные** - живут несколько часов, нужно обновлять
2. **Rate limits** - не более ~3 запросов в секунду
3. **Токен** - может истечь, нужен механизм обновления

### 💡 Рекомендации
1. Кэшировать результаты поиска на 5-10 минут
2. Lazy loading для длинных списков
3. Показывать skeleton при загрузке
4. Сохранять состояние плеера при навигации

---

**Готов к реализации?** Подтвердите план или предложите изменения!
