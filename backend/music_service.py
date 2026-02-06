"""
VK Music Service - асинхронная обёртка для VK Music API
Использует двухэтапный подход:
1. Поиск - получает метаданные треков
2. Стриминг - получает прямую ссылку при воспроизведении
"""
import asyncio
import aiohttp
from vkpymusic import Service
from typing import List, Optional, Dict, Any
import os
import logging
import re
from dotenv import load_dotenv
from pathlib import Path

# Загрузка переменных окружения
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# User-Agent для VK API (эмуляция Kate Mobile)
VK_USER_AGENT = "KateMobileAndroid/93 lite-530 (Android 10; SDK 29; arm64-v8a; Xiaomi Redmi Note 8 Pro; ru)"


class VKMusicService:
    """Асинхронный сервис для работы с VK Music API"""
    
    def __init__(self):
        self.token = os.environ.get("VK_MUSIC_TOKEN")
        self.user_id = int(os.environ.get("VK_USER_ID", 0))
        self._service = None
        self._session: Optional[aiohttp.ClientSession] = None
        
    @property
    def service(self):
        """Ленивая инициализация vkpymusic сервиса"""
        if self._service is None:
            if not self.token:
                raise ValueError("VK_MUSIC_TOKEN not configured")
            self._service = Service(
                user_agent=VK_USER_AGENT,
                token=self.token
            )
        return self._service
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Ленивая инициализация HTTP сессии (переиспользуется)"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=15),
                headers={'User-Agent': VK_USER_AGENT}
            )
        return self._session
    
    async def search(self, query: str, count: int = 20) -> List[dict]:
        """
        Асинхронный поиск треков через прямой VK API.
        Возвращает метаданные БЕЗ прямых ссылок (они получаются отдельно при воспроизведении).
        """
        if not query or not query.strip():
            return []
            
        session = await self._get_session()
        params = {
            'access_token': self.token,
            'v': '5.131',
            'q': query.strip(),
            'count': min(count, 100),
            'sort': 2,  # По популярности
            'auto_complete': 1
        }
        
        try:
            async with session.get(
                'https://api.vk.com/method/audio.search',
                params=params
            ) as resp:
                data = await resp.json()
        except Exception as e:
            logger.error(f"VK API connection error: {e}")
            return []
        
        if 'error' in data:
            error_msg = data['error'].get('error_msg', 'Unknown error')
            logger.error(f"VK API error: {error_msg}")
            return []
        
        items = data.get('response', {}).get('items', [])
        tracks = []
        
        for item in items:
            track = self._vk_item_to_dict(item)
            if track:
                tracks.append(track)
        
        logger.info(f"Found {len(tracks)} tracks for query: {query}")
        return tracks
    
    async def get_track_url(self, track_id: str) -> Optional[str]:
        """
        Получение прямой ссылки на трек через vkpymusic.
        Вызывается при нажатии play.
        """
        # Валидация track_id
        if not re.match(r'^-?\d+_\d+$', track_id):
            logger.error(f"Invalid track_id format: {track_id}")
            return None
        
        try:
            # vkpymusic работает синхронно, запускаем в thread executor
            songs = await asyncio.to_thread(
                self.service.get_songs_by_id, 
                [track_id]
            )
            
            if not songs:
                logger.warning(f"Track not found: {track_id}")
                return None
            
            url = songs[0].url
            if not url or 'audio_api_unavailable' in str(url):
                logger.warning(f"Track has no URL or blocked: {track_id}")
                return None
                
            logger.info(f"Got URL for track {track_id}: {url[:60]}...")
            return url
            
        except Exception as e:
            logger.error(f"Error getting track URL for {track_id}: {e}")
            return None
    
    async def get_my_audio(self, count: int = 50, offset: int = 0) -> List[dict]:
        """Получение аудиозаписей пользователя (async через thread)"""
        try:
            tracks = await asyncio.to_thread(
                self.service.get_songs_by_userid, 
                self.user_id, count=count, offset=offset
            )
            return [self._track_to_dict(t) for t in tracks]
        except Exception as e:
            logger.error(f"Get my audio error: {e}")
            return []
    
    async def get_popular(self, count: int = 30, offset: int = 0) -> List[dict]:
        """Получение популярных треков с пагинацией (async через thread)"""
        try:
            # Используем разные запросы для разных страниц чтобы получить разнообразные треки
            queries = [
                "популярное 2025",
                "хиты 2025",
                "топ чарт россия",
                "новинки музыки",
                "тренды музыка"
            ]
            query_index = (offset // count) % len(queries)
            query = queries[query_index]
            
            tracks = await asyncio.to_thread(
                self.service.search_songs_by_text, query, count=count
            )
            return [self._track_to_dict(t) for t in tracks]
        except Exception as e:
            logger.error(f"Get popular error: {e}")
            return []
    
    async def get_playlists(self) -> List[dict]:
        """Получение плейлистов пользователя (async через thread)"""
        try:
            playlists = await asyncio.to_thread(
                self.service.get_playlists_by_userid, self.user_id
            )
            return [self._playlist_to_dict(p) for p in playlists]
        except Exception as e:
            logger.error(f"Get playlists error: {e}")
            return []
    
    async def get_playlist_tracks(self, owner_id: int, playlist_id: int, access_key: str = "", count: int = 100) -> List[dict]:
        """Получение треков плейлиста (async через thread)"""
        try:
            tracks = await asyncio.to_thread(
                self.service.get_songs_by_playlist_id,
                user_id=owner_id,
                playlist_id=playlist_id,
                access_key=access_key,
                count=count
            )
            return [self._track_to_dict(t) for t in tracks]
        except Exception as e:
            logger.error(f"Get playlist tracks error: {e}")
            return []
    
    @staticmethod
    def _vk_item_to_dict(item: dict) -> Optional[dict]:
        """Преобразование raw VK API item в стандартный dict трека"""
        try:
            owner_id = item.get('owner_id')
            song_id = item.get('id')
            if owner_id is None or song_id is None:
                return None
                
            track_id = f"{owner_id}_{song_id}"
            
            # Извлекаем обложку и название альбома
            cover_url = None
            album_name = ''
            album = item.get('album')
            if album and isinstance(album, dict):
                album_name = album.get('title', '')
                thumb = album.get('thumb')
                if thumb and isinstance(thumb, dict):
                    cover_url = thumb.get('photo_600') or thumb.get('photo_300') or thumb.get('photo_68')
            
            # Проверяем URL
            direct_url = item.get('url', '')
            is_blocked = (
                not direct_url or 
                'audio_api_unavailable' in str(direct_url) or
                item.get('content_restricted') == 1
            )
            
            return {
                "id": track_id,
                "owner_id": owner_id,
                "song_id": song_id,
                "artist": item.get('artist', 'Unknown'),
                "title": item.get('title', 'Unknown'),
                "duration": item.get('duration', 0),
                "url": direct_url if not is_blocked else None,
                "cover": cover_url,
                "album": album_name,
                "stream_url": f"/api/music/stream/{track_id}",
                "is_blocked": is_blocked
            }
        except Exception as e:
            logger.error(f"Error converting VK item to dict: {e}")
            return None
    
    def _track_to_dict(self, track) -> dict:
        """Преобразование объекта трека vkpymusic в словарь"""
        song_id = getattr(track, 'id', None) or getattr(track, 'track_id', 0)
        owner_id = getattr(track, 'owner_id', 0)
        full_id = f"{owner_id}_{song_id}"
        
        # Получаем обложку и название альбома
        cover = None
        album_name = ''
        if hasattr(track, 'album') and track.album:
            album = track.album
            if isinstance(album, dict):
                album_name = album.get('title', '')
                thumb = album.get('thumb', {})
                if thumb and isinstance(thumb, dict):
                    cover = thumb.get('photo_300') or thumb.get('photo_600')
        
        track_url = getattr(track, 'url', None)
        is_blocked = (
            not track_url or 
            'audio_api_unavailable' in str(track_url)
        )
        
        return {
            "id": full_id,
            "owner_id": owner_id,
            "song_id": song_id,
            "artist": getattr(track, 'artist', 'Unknown'),
            "title": getattr(track, 'title', 'Unknown'),
            "duration": getattr(track, 'duration', 0),
            "url": track_url if not is_blocked else None,
            "cover": cover,
            "album": album_name,
            "stream_url": f"/api/music/stream/{full_id}",
            "is_blocked": is_blocked
        }
    
    def _playlist_to_dict(self, playlist) -> dict:
        """Преобразование объекта плейлиста в словарь"""
        return {
            "id": getattr(playlist, 'playlist_id', 0) or getattr(playlist, 'id', 0),
            "owner_id": getattr(playlist, 'owner_id', 0),
            "title": getattr(playlist, 'title', 'Без названия'),
            "count": getattr(playlist, 'count', 0),
            "cover": getattr(playlist, 'photo', None),
            "access_key": getattr(playlist, 'access_key', "")
        }

    async def get_artist_tracks(self, artist_name: str, count: int = 50) -> Dict[str, Any]:
        """
        Получить треки артиста через поиск.
        Возвращает треки, отфильтрованные по имени артиста.
        """
        if not artist_name or not artist_name.strip():
            return {"artist": "", "tracks": [], "count": 0}
        
        # Поиск треков по имени артиста
        all_tracks = await self.search(artist_name.strip(), count=count)
        
        # Фильтруем треки, где имя артиста совпадает (нечёткое сравнение)
        artist_lower = artist_name.lower().strip()
        filtered_tracks = []
        
        for track in all_tracks:
            track_artist = track.get('artist', '').lower().strip()
            # Проверяем точное совпадение или содержание
            if artist_lower == track_artist or artist_lower in track_artist or track_artist in artist_lower:
                filtered_tracks.append(track)
        
        # Если отфильтрованных треков мало, добавляем все из поиска
        if len(filtered_tracks) < 5:
            seen_ids = {t['id'] for t in filtered_tracks}
            for track in all_tracks:
                if track['id'] not in seen_ids:
                    filtered_tracks.append(track)
                if len(filtered_tracks) >= count:
                    break
        
        return {
            "artist": artist_name,
            "tracks": filtered_tracks[:count],
            "count": len(filtered_tracks[:count])
        }


    async def enrich_tracks_with_covers(self, tracks: list) -> list:
        """
        Добавляет обложки к трекам из Deezer API (для треков без обложек).
        """
        if not tracks:
            return tracks
        
        try:
            from cover_service import get_cover_service
            cover_svc = get_cover_service()
            
            if not cover_svc:
                return tracks
            
            # Получаем обложки пакетно для треков без обложек
            covers = await cover_svc.get_covers_batch(tracks, size='big')
            
            # Обогащаем треки (создаём новые dict, не мутируем оригиналы)
            enriched = []
            for track in tracks:
                track_id = track.get('id')
                if not track.get('cover') and track_id in covers and covers[track_id]:
                    enriched.append({**track, 'cover': covers[track_id]})
                else:
                    enriched.append(track)
            
            return enriched
            
        except Exception as e:
            logger.error(f"Error enriching tracks with covers: {e}")
            return tracks
    
    async def close(self):
        """Закрытие HTTP сессии"""
        if self._session and not self._session.closed:
            await self._session.close()


# Singleton instance
music_service = VKMusicService()
