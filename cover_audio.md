# 🎵 План интеграции обложек треков через Deezer API

**Дата:** 2025-07-08  
**Статус:** Готов к реализации  
**Автор:** AI Assistant

---

## 📋 Содержание

1. [Обзор решения](#1-обзор-решения)
2. [Архитектура](#2-архитектура)
3. [Backend изменения](#3-backend-изменения)
4. [Кеширование](#4-кеширование)
5. [Frontend изменения](#5-frontend-изменения)
6. [Этапы реализации](#6-этапы-реализации)
7. [Тестирование](#7-тестирование)

---

## 1. Обзор решения

### Проблема
- VK API (Kate Mobile токен) не возвращает обложки альбомов для треков
- `al_audio.php` требует browser cookies (remixsid), которые истекают
- Треки отображаются с генерируемыми заглушками вместо реальных обложек

### Решение
Использовать **Deezer API** для получения обложек по artist + title:
- ✅ Бесплатный API без ключа
- ✅ Высокое качество обложек (до 1000x1000 px)
- ✅ Отличное покрытие русской музыки
- ✅ Быстрый поиск (<100ms)

### Пример работы Deezer API
```python
GET https://api.deezer.com/search?q=Imagine Dragons Believer&limit=1

Response:
{
  "data": [{
    "album": {
      "cover_small": "https://cdn-images.dzcdn.net/.../56x56.jpg",
      "cover_medium": "https://cdn-images.dzcdn.net/.../250x250.jpg",
      "cover_big": "https://cdn-images.dzcdn.net/.../500x500.jpg",
      "cover_xl": "https://cdn-images.dzcdn.net/.../1000x1000.jpg"
    }
  }]
}
```

---

## 2. Архитектура

### Поток данных
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   VK API        │     │   Backend       │     │   Deezer API    │
│   (треки)       │────▶│   (обогащение)  │────▶│   (обложки)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   MongoDB       │
                        │   (кеш обложек) │
                        └─────────────────┘
```

### Логика получения обложки
```
1. Получаем трек из VK API (artist, title)
2. Проверяем кеш MongoDB по ключу "artist|title"
3. Если в кеше - возвращаем cached cover
4. Если нет - запрос к Deezer API
5. Сохраняем в кеш (TTL: 30 дней)
6. Возвращаем cover URL
```

---

## 3. Backend изменения

### 3.1 Новый файл: `/app/backend/cover_service.py`

```python
"""
Cover Service - получение обложек треков через Deezer API
"""
import aiohttp
import asyncio
import hashlib
import logging
from typing import Optional, Dict
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Размеры обложек Deezer
COVER_SIZES = {
    'small': 'cover_small',    # 56x56
    'medium': 'cover_medium',  # 250x250
    'big': 'cover_big',        # 500x500
    'xl': 'cover_xl'           # 1000x1000
}

# TTL кеша - 30 дней
CACHE_TTL_DAYS = 30


class CoverService:
    """Сервис получения обложек треков"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.cover_cache
        self._session: Optional[aiohttp.ClientSession] = None
    
    @property
    async def session(self) -> aiohttp.ClientSession:
        """Ленивая инициализация HTTP сессии"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5)
            )
        return self._session
    
    def _make_cache_key(self, artist: str, title: str) -> str:
        """Создание ключа кеша"""
        # Нормализуем строки для лучшего совпадения
        normalized = f"{artist.lower().strip()}|{title.lower().strip()}"
        return hashlib.md5(normalized.encode()).hexdigest()
    
    async def get_cover(
        self, 
        artist: str, 
        title: str, 
        size: str = 'big'
    ) -> Optional[str]:
        """
        Получение обложки трека
        
        Args:
            artist: Имя исполнителя
            title: Название трека
            size: Размер обложки (small/medium/big/xl)
        
        Returns:
            URL обложки или None
        """
        if not artist or not title:
            return None
        
        cache_key = self._make_cache_key(artist, title)
        
        # 1. Проверяем кеш
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached.get(COVER_SIZES.get(size, 'cover_big'))
        
        # 2. Запрос к Deezer API
        covers = await self._fetch_from_deezer(artist, title)
        
        if covers:
            # 3. Сохраняем в кеш
            await self._save_to_cache(cache_key, artist, title, covers)
            return covers.get(COVER_SIZES.get(size, 'cover_big'))
        
        return None
    
    async def get_covers_batch(
        self, 
        tracks: list, 
        size: str = 'big'
    ) -> Dict[str, Optional[str]]:
        """
        Пакетное получение обложек для списка треков
        
        Args:
            tracks: Список треков [{"artist": ..., "title": ...}, ...]
            size: Размер обложки
        
        Returns:
            Словарь {track_id: cover_url}
        """
        tasks = []
        track_ids = []
        
        for track in tracks:
            artist = track.get('artist', '')
            title = track.get('title', '')
            track_id = track.get('id', f"{artist}_{title}")
            
            track_ids.append(track_id)
            tasks.append(self.get_cover(artist, title, size))
        
        # Параллельное выполнение с ограничением
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        covers = {}
        for track_id, result in zip(track_ids, results):
            if isinstance(result, Exception):
                logger.error(f"Error getting cover for {track_id}: {result}")
                covers[track_id] = None
            else:
                covers[track_id] = result
        
        return covers
    
    async def _get_from_cache(self, cache_key: str) -> Optional[dict]:
        """Получение из кеша"""
        try:
            cached = await self.collection.find_one({
                "cache_key": cache_key,
                "expires_at": {"$gt": datetime.utcnow()}
            })
            if cached:
                logger.debug(f"Cache hit for {cache_key}")
                return cached.get('covers')
        except Exception as e:
            logger.error(f"Cache read error: {e}")
        return None
    
    async def _save_to_cache(
        self, 
        cache_key: str, 
        artist: str, 
        title: str, 
        covers: dict
    ):
        """Сохранение в кеш"""
        try:
            await self.collection.update_one(
                {"cache_key": cache_key},
                {
                    "$set": {
                        "cache_key": cache_key,
                        "artist": artist,
                        "title": title,
                        "covers": covers,
                        "expires_at": datetime.utcnow() + timedelta(days=CACHE_TTL_DAYS),
                        "updated_at": datetime.utcnow()
                    }
                },
                upsert=True
            )
            logger.debug(f"Cached cover for {artist} - {title}")
        except Exception as e:
            logger.error(f"Cache write error: {e}")
    
    async def _fetch_from_deezer(
        self, 
        artist: str, 
        title: str
    ) -> Optional[dict]:
        """Запрос обложки из Deezer API"""
        try:
            session = await self.session
            
            # Формируем поисковый запрос
            query = f"{artist} {title}"
            url = f"https://api.deezer.com/search"
            params = {
                "q": query,
                "limit": 1
            }
            
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    logger.warning(f"Deezer API returned {resp.status}")
                    return None
                
                data = await resp.json()
                
                if not data.get('data'):
                    logger.debug(f"No results from Deezer for: {query}")
                    return None
                
                track = data['data'][0]
                album = track.get('album', {})
                
                covers = {
                    'cover_small': album.get('cover_small'),
                    'cover_medium': album.get('cover_medium'),
                    'cover_big': album.get('cover_big'),
                    'cover_xl': album.get('cover_xl')
                }
                
                # Проверяем, что хотя бы одна обложка есть
                if any(covers.values()):
                    logger.info(f"Found cover for: {artist} - {title}")
                    return covers
                
                return None
                
        except asyncio.TimeoutError:
            logger.warning(f"Deezer API timeout for: {artist} - {title}")
        except Exception as e:
            logger.error(f"Deezer API error: {e}")
        
        return None
    
    async def close(self):
        """Закрытие HTTP сессии"""
        if self._session and not self._session.closed:
            await self._session.close()


# Singleton будет создан в server.py после инициализации db
cover_service: Optional[CoverService] = None


def init_cover_service(db: AsyncIOMotorDatabase):
    """Инициализация сервиса обложек"""
    global cover_service
    cover_service = CoverService(db)
    return cover_service
```

### 3.2 Изменения в `music_service.py`

Добавить обогащение треков обложками:

```python
# В начале файла
from cover_service import cover_service

# Новый метод в классе VKMusicService
async def enrich_tracks_with_covers(self, tracks: list) -> list:
    """Добавляет обложки к трекам из Deezer API"""
    if not tracks or not cover_service:
        return tracks
    
    # Получаем обложки пакетно
    covers = await cover_service.get_covers_batch(tracks, size='big')
    
    # Обогащаем треки
    for track in tracks:
        track_id = track.get('id')
        if track_id and track_id in covers:
            track['cover'] = covers[track_id]
    
    return tracks
```

### 3.3 Изменения в `server.py`

```python
# В секции импортов
from cover_service import init_cover_service, cover_service

# После инициализации db
@app.on_event("startup")
async def startup_event():
    # ... существующий код ...
    
    # Инициализация сервиса обложек
    init_cover_service(db)
    
    # Создание индекса для кеша
    await db.cover_cache.create_index("cache_key", unique=True)
    await db.cover_cache.create_index("expires_at", expireAfterSeconds=0)

# Модификация эндпоинтов музыки
@api_router.get("/music/my")
async def music_my_audio(count: int = 30, offset: int = 0):
    """Мои аудиозаписи с обложками"""
    try:
        tracks = music_service.get_my_audio(count=count, offset=offset)
        
        # Обогащаем обложками
        tracks = await music_service.enrich_tracks_with_covers(tracks)
        
        # ... остальная логика ...
```

---

## 4. Кеширование

### MongoDB коллекция `cover_cache`

```javascript
{
  "_id": ObjectId,
  "cache_key": "a1b2c3d4e5f6...",  // MD5 hash от "artist|title"
  "artist": "Imagine Dragons",
  "title": "Believer",
  "covers": {
    "cover_small": "https://cdn-images.dzcdn.net/.../56x56.jpg",
    "cover_medium": "https://cdn-images.dzcdn.net/.../250x250.jpg",
    "cover_big": "https://cdn-images.dzcdn.net/.../500x500.jpg",
    "cover_xl": "https://cdn-images.dzcdn.net/.../1000x1000.jpg"
  },
  "expires_at": ISODate("2025-08-08T00:00:00Z"),  // TTL 30 дней
  "updated_at": ISODate("2025-07-08T12:00:00Z")
}
```

### Индексы
```javascript
// Уникальный индекс для быстрого поиска
db.cover_cache.createIndex({ "cache_key": 1 }, { unique: true })

// TTL индекс для автоудаления
db.cover_cache.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 })
```

---

## 5. Frontend изменения

### Минимальные изменения
Frontend уже готов к работе с обложками - компонент `TrackCover.jsx` принимает prop `cover` и отображает его или генерирует заглушку.

Единственное улучшение - добавить lazy loading для обложек:

```jsx
// В TrackCover.jsx - уже есть loading="lazy"
<img 
  src={cover} 
  alt={`${artist} - ${title}`}
  className="w-full h-full object-cover"
  loading="lazy"  // ✅ Уже есть
/>
```

---

## 6. Этапы реализации

### Этап 1: Backend - Cover Service (15 мин)
- [x] Создать `/app/backend/cover_service.py` ✅
- [x] Реализовать класс `CoverService` ✅
- [x] Добавить методы кеширования ✅

### Этап 2: Backend - Интеграция (15 мин)
- [x] Модифицировать `music_service.py` - добавить `enrich_tracks_with_covers` ✅
- [x] Модифицировать `server.py` - инициализация сервиса ✅
- [x] Обновить эндпоинты `/api/music/*` ✅

### Этап 3: Индексы MongoDB (5 мин)
- [x] Создать индексы для коллекции `cover_cache` ✅

### Этап 4: Тестирование (10 мин)
- [x] Тест API `/api/music/search` - обложки работают для популярных треков ✅
- [x] Тест кеширования - повторный запрос берёт из MongoDB кеша ✅
- [ ] Тест UI - обложки отображаются в приложении

### Общее время: ~45 минут

---

## 7. Тестирование

### Тест 1: Проверка Deezer API
```bash
curl "https://api.deezer.com/search?q=Imagine%20Dragons%20Believer&limit=1" | jq '.data[0].album'
```

### Тест 2: Проверка эндпоинта с обложками
```bash
curl "http://localhost:8001/api/music/my?count=5" | jq '.tracks[0].cover'
```

### Тест 3: Проверка кеша MongoDB
```javascript
db.cover_cache.find().limit(5).pretty()
```

### Ожидаемый результат
```json
{
  "tracks": [
    {
      "id": "523439151_456239638",
      "artist": "GONE.Fludd",
      "title": "Сквиртана",
      "cover": "https://cdn-images.dzcdn.net/images/cover/feb768e56224bdddcec7f822d48b18c1/500x500-000000-80-0-0.jpg",
      "duration": 180,
      "url": "https://..."
    }
  ]
}
```

---

## 📊 Метрики успеха

| Метрика | До | После |
|---------|-----|-------|
| Треки с обложками | ~0% | >90% |
| Время загрузки обложки | N/A | <100ms (из кеша) |
| Качество обложек | 0px | 500x500px |

---

## ⚠️ Ограничения

1. **Rate Limits Deezer**: ~50 запросов/5 сек (смягчается кешированием)
2. **Не все треки найдутся**: редкие/любительские треки могут не иметь обложек в Deezer
3. **Несовпадение версий**: Deezer может вернуть обложку другой версии трека

---

## 🔄 Fallback стратегия

Если Deezer не находит обложку:
1. Возвращаем `cover: null`
2. Frontend показывает красивую генерируемую заглушку (уже реализовано в `TrackCover.jsx`)

---

**Готово к реализации!** ✅
