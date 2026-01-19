"""
Cover Service - получение обложек треков через Deezer API
Автор: AI Assistant
Дата: 2025-07-08
"""
import aiohttp
import asyncio
import hashlib
import logging
from typing import Optional, Dict, List, Any
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
    """Сервис получения обложек треков через Deezer API"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.cover_cache
        self._session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
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
        
        # 4. Сохраняем "пустой" результат в кеш, чтобы не делать повторных запросов
        await self._save_to_cache(cache_key, artist, title, {})
        return None
    
    async def get_covers_batch(
        self, 
        tracks: List[Dict[str, Any]], 
        size: str = 'big'
    ) -> Dict[str, Optional[str]]:
        """
        Пакетное получение обложек для списка треков
        
        Args:
            tracks: Список треков [{"artist": ..., "title": ..., "id": ...}, ...]
            size: Размер обложки
        
        Returns:
            Словарь {track_id: cover_url}
        """
        if not tracks:
            return {}
        
        # Фильтруем треки без обложек (у которых cover = None)
        tracks_without_covers = [
            t for t in tracks 
            if not t.get('cover')
        ]
        
        if not tracks_without_covers:
            # Все треки уже имеют обложки
            return {t.get('id', ''): t.get('cover') for t in tracks}
        
        # Создаём задачи для получения обложек
        tasks = []
        track_ids = []
        
        for track in tracks_without_covers:
            artist = track.get('artist', '')
            title = track.get('title', '')
            track_id = track.get('id', f"{artist}_{title}")
            
            track_ids.append(track_id)
            tasks.append(self.get_cover(artist, title, size))
        
        # Параллельное выполнение с семафором для rate limiting
        semaphore = asyncio.Semaphore(10)  # Максимум 10 параллельных запросов
        
        async def limited_get_cover(task):
            async with semaphore:
                return await task
        
        results = await asyncio.gather(
            *[limited_get_cover(task) for task in tasks],
            return_exceptions=True
        )
        
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
            session = await self._get_session()
            
            # Формируем поисковый запрос - очищаем от лишних символов
            clean_artist = artist.strip()
            clean_title = title.strip()
            # Удаляем части в скобках/кавычках которые могут мешать поиску
            for char in ['(', ')', '[', ']', '"', "'"]:
                clean_title = clean_title.replace(char, '')
            
            query = f"{clean_artist} {clean_title}"
            url = "https://api.deezer.com/search"
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


def init_cover_service(db: AsyncIOMotorDatabase) -> CoverService:
    """Инициализация сервиса обложек"""
    global cover_service
    cover_service = CoverService(db)
    logger.info("✅ Cover service initialized")
    return cover_service


def get_cover_service() -> Optional[CoverService]:
    """Получение экземпляра сервиса"""
    return cover_service
