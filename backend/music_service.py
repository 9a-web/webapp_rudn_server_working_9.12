"""
VK Music Service - обёртка над vkpymusic для RUDN Schedule App
"""
from vkpymusic import Service
from typing import List, Optional
import os
import logging
from dotenv import load_dotenv
from pathlib import Path

# Загрузка переменных окружения
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

class VKMusicService:
    """Сервис для работы с VK Music API"""
    
    def __init__(self):
        self.token = os.environ.get("VK_MUSIC_TOKEN")
        self.user_id = int(os.environ.get("VK_USER_ID", 0))
        self._service = None
        
    @property
    def service(self):
        """Ленивая инициализация сервиса"""
        if self._service is None:
            if not self.token:
                raise ValueError("VK_MUSIC_TOKEN not configured")
            # Инициализация с user_agent и токеном напрямую
            self._service = Service(
                user_agent="KateMobileAndroid/93 lite-530 (Android 10; SDK 29; arm64-v8a; Xiaomi Redmi Note 8 Pro; ru)",
                token=self.token
            )
        return self._service
    
    def search(self, query: str, count: int = 20) -> List[dict]:
        """Поиск треков по тексту"""
        try:
            tracks = self.service.search_songs_by_text(query, count=count)
            return [self._track_to_dict(t) for t in tracks]
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []
    
    def get_my_audio(self, count: int = 50) -> List[dict]:
        """Получение аудиозаписей пользователя"""
        try:
            tracks = self.service.get_songs_by_userid(self.user_id, count=count)
            return [self._track_to_dict(t) for t in tracks]
        except Exception as e:
            logger.error(f"Get my audio error: {e}")
            return []
    
    def get_popular(self, count: int = 30) -> List[dict]:
        """Получение популярных треков"""
        try:
            # Получаем популярное через поиск популярных исполнителей
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
    
    def get_playlist_tracks(self, owner_id: int, playlist_id: int, count: int = 100) -> List[dict]:
        """Получение треков плейлиста"""
        try:
            tracks = self.service.get_songs_by_playlist(owner_id, playlist_id, count=count)
            return [self._track_to_dict(t) for t in tracks]
        except Exception as e:
            logger.error(f"Get playlist tracks error: {e}")
            return []
    
    def _track_to_dict(self, track) -> dict:
        """Преобразование трека в словарь"""
        return {
            "id": f"{track.owner_id}_{track.id}",
            "owner_id": track.owner_id,
            "song_id": track.id,
            "artist": track.artist,
            "title": track.title,
            "duration": track.duration,
            "url": track.url,
            "cover": getattr(track, 'album', {}).get('thumb', {}).get('photo_300') if hasattr(track, 'album') else None
        }
    
    def _playlist_to_dict(self, playlist) -> dict:
        """Преобразование плейлиста в словарь"""
        return {
            "id": playlist.id,
            "owner_id": playlist.owner_id,
            "title": playlist.title,
            "count": getattr(playlist, 'count', 0),
            "cover": getattr(playlist, 'photo', {}).get('photo_300') if hasattr(playlist, 'photo') else None
        }

# Singleton instance
music_service = VKMusicService()
