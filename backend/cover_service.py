"""
Cover Service - получение обложек треков через несколько источников.

Порядок приоритета:
  1. Кэш MongoDB (моментально)
  2. iTunes Search API — бесплатный, без ключа, высокая точность (сравнение артиста)
  3. Deezer API — fallback

iTunes возвращает artworkUrl100, который масштабируется до любого размера
заменой "100x100bb" → "600x600bb" и т.д.
"""
import aiohttp
import asyncio
import hashlib
import logging
import re
import unicodedata
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Размеры обложек (унифицированные ключи)
COVER_SIZES = {
    'small': 'cover_small',    # ~56-100px
    'medium': 'cover_medium',  # ~250px
    'big': 'cover_big',        # ~500px
    'xl': 'cover_xl'           # ~1000px
}

# Соответствие размеров для iTunes (замена в URL artworkUrl100)
ITUNES_SIZE_MAP = {
    'cover_small': '100x100bb',
    'cover_medium': '250x250bb',
    'cover_big': '600x600bb',
    'cover_xl': '1200x1200bb'
}

CACHE_TTL_DAYS = 30


def _normalize(text: str) -> str:
    """Нормализация: lowercase, без диакритики, только буквы/цифры/пробелы."""
    if not text:
        return ''
    text = text.lower().strip()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^a-zа-яё0-9\s]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


_FEAT_SPLIT = re.compile(r'\s*(?:feat\.?|ft\.?|&|,|\band\b|\bx\b)\s*', re.IGNORECASE)


def _split_artists(name: str) -> set:
    """Разбивает 'Miyagi & Эндшпиль feat. Brick Bazuka' → {'miyagi', 'эндшпиль', 'brick bazuka'}"""
    parts = _FEAT_SPLIT.split(_normalize(name))
    return {p.strip() for p in parts if p.strip()}


def _artist_match(query_artist: str, result_artist: str) -> bool:
    """
    Строгая проверка совпадения артиста.
    Правила:
      1. Точное совпадение нормализованных строк
      2. Хотя бы один «основной» артист (до feat) совпадает целиком
      3. Один целиком содержит другого, НО только если короткий ≥ 5 символов
         (чтобы "Ли" не матчил "Алиса", но "Weeknd" матчил "The Weeknd")
    """
    qa = _normalize(query_artist)
    ra = _normalize(result_artist)

    if not qa or not ra:
        return False

    # 1. Точное совпадение
    if qa == ra:
        return True

    # 2. Разбиваем по feat/ft/&/x/,  и ищем совпадение частей
    qa_parts = _split_artists(query_artist)
    ra_parts = _split_artists(result_artist)

    # Точное совпадение хотя бы одной части
    common = qa_parts & ra_parts
    if common:
        return True

    # 3. Один целиком содержит другого (только если ≥ 5 символов у меньшего)
    min_len = min(len(qa), len(ra))
    if min_len >= 5 and (qa in ra or ra in qa):
        return True

    # 4. Проверяем части: одна часть целиком совпадает с частью другого (≥ 5 символов)
    for qp in qa_parts:
        for rp in ra_parts:
            if len(qp) >= 5 and len(rp) >= 5 and (qp == rp):
                return True

    return False


def _title_match(query_title: str, result_title: str) -> bool:
    """
    Проверяет совпадение названия трека.
    Убирает скобки (remix/edit/feat) перед сравнением.
    """
    qt = _normalize(re.sub(r'\(.*?\)|\[.*?\]', '', query_title))
    rt = _normalize(re.sub(r'\(.*?\)|\[.*?\]', '', result_title))

    if not qt or not rt:
        return False

    # Точное совпадение
    if qt == rt:
        return True

    # Один содержит другого (≥ 4 символа у меньшего)
    if min(len(qt), len(rt)) >= 4 and (qt in rt or rt in qt):
        return True

    # Первые 2 слова совпадают
    qt_words = qt.split()
    rt_words = rt.split()
    if len(qt_words) >= 2 and len(rt_words) >= 2:
        if qt_words[0] == rt_words[0] and qt_words[1] == rt_words[1]:
            return True

    return False


class CoverService:
    """Сервис получения обложек: iTunes → Deezer → None"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.cover_cache
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=6)
            )
        return self._session

    # ------------------------------------------------------------------
    #  CACHE
    # ------------------------------------------------------------------

    def _make_cache_key(self, artist: str, title: str) -> str:
        normalized = f"{artist.lower().strip()}|{title.lower().strip()}"
        return hashlib.md5(normalized.encode()).hexdigest()

    async def _get_from_cache(self, cache_key: str) -> Optional[dict]:
        try:
            cached = await self.collection.find_one({
                "cache_key": cache_key,
                "expires_at": {"$gt": datetime.utcnow()}
            })
            if cached and cached.get('covers'):
                return cached['covers']
        except Exception as e:
            logger.error(f"Cache read error: {e}")
        return None

    async def _save_to_cache(self, cache_key: str, artist: str, title: str, covers: dict, source: str = ''):
        try:
            await self.collection.update_one(
                {"cache_key": cache_key},
                {"$set": {
                    "cache_key": cache_key,
                    "artist": artist,
                    "title": title,
                    "covers": covers,
                    "source": source,
                    "expires_at": datetime.utcnow() + timedelta(days=CACHE_TTL_DAYS),
                    "updated_at": datetime.utcnow()
                }},
                upsert=True
            )
        except Exception as e:
            logger.error(f"Cache write error: {e}")

    # ------------------------------------------------------------------
    #  PUBLIC API
    # ------------------------------------------------------------------

    async def get_cover(self, artist: str, title: str, size: str = 'big') -> Optional[str]:
        """
        Получение обложки трека (кэш → iTunes → Deezer).
        """
        if not artist or not title:
            return None

        cache_key = self._make_cache_key(artist, title)
        size_key = COVER_SIZES.get(size, 'cover_big')

        # 1. Кэш
        cached = await self._get_from_cache(cache_key)
        if cached is not None:
            url = cached.get(size_key)
            if url:
                return url
            # Кэш есть, но пустой — значит ранее не нашли, не делаем повторный запрос
            if cached == {}:
                return None

        # 2. iTunes
        covers = await self._fetch_from_itunes(artist, title)
        if covers:
            await self._save_to_cache(cache_key, artist, title, covers, source='itunes')
            return covers.get(size_key)

        # 3. Deezer fallback
        covers = await self._fetch_from_deezer(artist, title)
        if covers:
            await self._save_to_cache(cache_key, artist, title, covers, source='deezer')
            return covers.get(size_key)

        # Ничего не нашли — кэшируем пустой результат
        await self._save_to_cache(cache_key, artist, title, {}, source='none')
        return None

    async def get_covers_batch(
        self,
        tracks: List[Dict[str, Any]],
        size: str = 'big'
    ) -> Dict[str, Optional[str]]:
        """Пакетное получение обложек для треков без cover."""
        if not tracks:
            return {}

        tracks_need = [t for t in tracks if not t.get('cover')]
        if not tracks_need:
            return {t.get('id', ''): t.get('cover') for t in tracks}

        semaphore = asyncio.Semaphore(8)

        async def _limited(track):
            async with semaphore:
                return track.get('id', ''), await self.get_cover(
                    track.get('artist', ''),
                    track.get('title', ''),
                    size
                )

        results = await asyncio.gather(
            *[_limited(t) for t in tracks_need],
            return_exceptions=True
        )

        covers = {}
        for r in results:
            if isinstance(r, Exception):
                logger.error(f"Batch cover error: {r}")
                continue
            track_id, url = r
            covers[track_id] = url

        return covers

    # ------------------------------------------------------------------
    #  iTunes Search API
    # ------------------------------------------------------------------

    async def _fetch_from_itunes(self, artist: str, title: str) -> Optional[dict]:
        """
        Поиск обложки через iTunes Search API.
        Приоритет: артист+название совпадают → только артист (но тот же альбом).
        """
        try:
            session = await self._get_session()

            clean_title = re.sub(r'\(.*?\)|\[.*?\]', '', title).strip()
            clean_artist = artist.strip()
            query = f"{clean_artist} {clean_title}"

            async with session.get(
                'https://itunes.apple.com/search',
                params={
                    'term': query,
                    'media': 'music',
                    'entity': 'song',
                    'limit': 10
                }
            ) as resp:
                if resp.status != 200:
                    logger.warning(f"iTunes API status {resp.status}")
                    return None

                data = await resp.json(content_type=None)

            results = data.get('results', [])
            if not results:
                logger.debug(f"iTunes: no results for «{query}»")
                return None

            # ПРИОРИТЕТ 1: Артист И название совпадают → точная обложка
            for item in results:
                item_artist = item.get('artistName', '')
                item_title = item.get('trackName', '')
                artwork_url = item.get('artworkUrl100', '')

                if not artwork_url:
                    continue

                if _artist_match(clean_artist, item_artist) and _title_match(clean_title, item_title):
                    covers = {}
                    for key, size_str in ITUNES_SIZE_MAP.items():
                        covers[key] = re.sub(r'\d+x\d+bb', size_str, artwork_url)
                    logger.info(f"iTunes cover ✓ exact «{artist} — {title}» → «{item_artist} — {item_title}»")
                    return covers

            # ПРИОРИТЕТ 2: Только артист совпадает — НЕ берём (это другая песня = другая обложка)
            logger.debug(f"iTunes: artist ok but title mismatch for «{artist} — {title}», results: {[(r.get('artistName',''), r.get('trackName','')) for r in results[:3]]}")
            return None

        except asyncio.TimeoutError:
            logger.warning(f"iTunes timeout: «{artist} — {title}»")
        except Exception as e:
            logger.error(f"iTunes error: {e}")
        return None

    # ------------------------------------------------------------------
    #  Deezer API (fallback)
    # ------------------------------------------------------------------

    async def _fetch_from_deezer(self, artist: str, title: str) -> Optional[dict]:
        """Запрос обложки из Deezer API (fallback). Проверяет артист + название."""
        try:
            session = await self._get_session()

            clean_title = re.sub(r'[(\[\]"\')]', '', title).strip()
            query = f"{artist.strip()} {clean_title}"

            async with session.get(
                'https://api.deezer.com/search',
                params={'q': query, 'limit': 5}
            ) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json()

            items = data.get('data', [])
            if not items:
                return None

            # Ищем совпадение артиста И названия
            for item in items:
                item_artist = item.get('artist', {}).get('name', '')
                item_title = item.get('title', '')
                album = item.get('album', {})
                if _artist_match(artist, item_artist) and _title_match(title, item_title) and album.get('cover_big'):
                    covers = {
                        'cover_small': album.get('cover_small'),
                        'cover_medium': album.get('cover_medium'),
                        'cover_big': album.get('cover_big'),
                        'cover_xl': album.get('cover_xl')
                    }
                    if any(covers.values()):
                        logger.info(f"Deezer cover ✓ exact «{artist} — {title}» → «{item_artist} — {item_title}»")
                        return covers

            # Название не совпало — НЕ берём чужую обложку
            logger.debug(f"Deezer: title mismatch for «{artist} — {title}», results: {[(i.get('artist',{}).get('name',''), i.get('title','')) for i in items[:3]]}")
            return None

        except asyncio.TimeoutError:
            logger.warning(f"Deezer timeout: «{artist} — {title}»")
        except Exception as e:
            logger.error(f"Deezer error: {e}")
        return None

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()


# Singleton
cover_service: Optional[CoverService] = None


def init_cover_service(db: AsyncIOMotorDatabase) -> CoverService:
    global cover_service
    cover_service = CoverService(db)
    logger.info("✅ Cover service initialized (iTunes → Deezer)")
    return cover_service


def get_cover_service() -> Optional[CoverService]:
    return cover_service
