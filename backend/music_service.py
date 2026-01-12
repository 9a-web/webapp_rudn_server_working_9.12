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
    
    async def search(self, query: str, count: int = 20) -> List[dict]:
        """
        Асинхронный поиск треков через прямой VK API.
        Возвращает метаданные БЕЗ прямых ссылок (они получаются отдельно при воспроизведении).
        """
        if not query:
            return []
            
        async with aiohttp.ClientSession() as session:
            params = {
                'access_token': self.token,
                'v': '5.131',
                'q': query,
                'count': min(count, 100),
                'sort': 2,  # По популярности
                'auto_complete': 1
            }
            headers = {
                'User-Agent': VK_USER_AGENT
            }
            
            try:
                async with session.get(
                    'https://api.vk.com/method/audio.search',
                    params=params,
                    headers=headers
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
            # Извлекаем обложку альбома
            cover_url = None
            album = item.get('album', {})
            if album:
                thumb = album.get('thumb', {})
                if thumb:
                    cover_url = thumb.get('photo_600') or thumb.get('photo_300') or thumb.get('photo_68')
            
            track_id = f"{item['owner_id']}_{item['id']}"
            
            # Проверяем, есть ли URL (некоторые треки доступны сразу)
            direct_url = item.get('url', '')
            
            # Определяем, заблокирован ли трек правообладателем
            # VK возвращает специальный URL для заблокированных треков
            is_blocked = (
                not direct_url or 
                'audio_api_unavailable' in direct_url or
                item.get('content_restricted') == 1
            )
            
            tracks.append({
                "id": track_id,
                "owner_id": item['owner_id'],
                "song_id": item['id'],
                "artist": item.get('artist', 'Unknown'),
                "title": item.get('title', 'Unknown'),
                "duration": item.get('duration', 0),
                "url": direct_url if direct_url and 'audio_api_unavailable' not in direct_url else None,
                "cover": cover_url,
                "stream_url": f"/api/music/stream/{track_id}",
                "is_blocked": is_blocked  # Трек заблокирован правообладателем
            })
        
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
            if not url:
                logger.warning(f"Track has no URL: {track_id}")
                return None
                
            logger.info(f"Got URL for track {track_id}: {url[:60]}...")
            return url
            
        except Exception as e:
            logger.error(f"Error getting track URL for {track_id}: {e}")
            return None
    
    def get_my_audio(self, count: int = 50, offset: int = 0) -> List[dict]:
        """Получение аудиозаписей пользователя (синхронно для совместимости)"""
        try:
            tracks = self.service.get_songs_by_userid(self.user_id, count=count, offset=offset)
            return [self._track_to_dict(t) for t in tracks]
        except Exception as e:
            logger.error(f"Get my audio error: {e}")
            return []
    
    def get_popular(self, count: int = 30) -> List[dict]:
        """Получение популярных треков"""
        try:
            # Ищем популярное через текстовый запрос
            tracks = self.service.search_songs_by_text("популярное 2025", count=count)
            return [self._track_to_dict(t) for t in tracks]
        except Exception as e:
            logger.error(f"Get popular error: {e}")
            return []
    
    def get_playlists(self) -> List[dict]:
        """Получение плейлистов пользователя"""
        try:
            playlists = self.service.get_playlists_by_userid(self.user_id)
            return [self._playlist_to_dict(p) for p in playlists]
        except Exception as e:
            logger.error(f"Get playlists error: {e}")
            return []
    
    def get_playlist_tracks(self, owner_id: int, playlist_id: int, access_key: str = "", count: int = 100) -> List[dict]:
        """Получение треков плейлиста"""
        try:
            tracks = self.service.get_songs_by_playlist_id(
                user_id=owner_id,
                playlist_id=playlist_id,
                access_key=access_key,
                count=count
            )
            return [self._track_to_dict(t) for t in tracks]
        except Exception as e:
            logger.error(f"Get playlist tracks error: {e}")
            return []
    
    def _track_to_dict(self, track) -> dict:
        """Преобразование объекта трека vkpymusic в словарь"""
        track_id = getattr(track, 'track_id', 0)
        owner_id = track.owner_id
        full_id = f"{owner_id}_{track_id}"
        
        # Получаем обложку
        cover = None
        if hasattr(track, 'album') and track.album:
            album = track.album
            if isinstance(album, dict):
                thumb = album.get('thumb', {})
                if thumb:
                    cover = thumb.get('photo_300') or thumb.get('photo_600')
        
        # Проверяем, заблокирован ли трек
        track_url = track.url if hasattr(track, 'url') else None
        is_blocked = (
            not track_url or 
            'audio_api_unavailable' in str(track_url)
        )
        
        return {
            "id": full_id,
            "owner_id": owner_id,
            "song_id": track_id,
            "artist": track.artist,
            "title": track.title,
            "duration": track.duration,
            "url": track_url if track_url and 'audio_api_unavailable' not in str(track_url) else None,
            "cover": cover,
            "stream_url": f"/api/music/stream/{full_id}",
            "is_blocked": is_blocked
        }
    
    def _playlist_to_dict(self, playlist) -> dict:
        """Преобразование объекта плейлиста в словарь"""
        return {
            "id": getattr(playlist, 'playlist_id', 0),
            "owner_id": playlist.owner_id,
            "title": playlist.title,
            "count": getattr(playlist, 'count', 0),
            "cover": getattr(playlist, 'photo', None),
            "access_key": getattr(playlist, 'access_key', "")
        }


# Singleton instance
music_service = VKMusicService()
