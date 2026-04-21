"""Простое кеширование в память для оптимизации"""
from datetime import datetime, timedelta
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)

class SimpleCache:
    def __init__(self):
        self._cache = {}
        
    def get(self, key: str) -> Optional[Any]:
        """Получить значение из кеша"""
        if key in self._cache:
            value, expiry = self._cache[key]
            if datetime.now() < expiry:
                logger.info(f"Cache hit for key: {key}")
                return value
            else:
                # Удалить устаревшее значение
                del self._cache[key]
                logger.info(f"Cache expired for key: {key}")
        return None
        
    def set(self, key: str, value: Any, ttl_minutes: int = 60):
        """Установить значение в кеш с TTL"""
        expiry = datetime.now() + timedelta(minutes=ttl_minutes)
        self._cache[key] = (value, expiry)
        logger.info(f"Cache set for key: {key}, TTL: {ttl_minutes} min")
        
    def clear(self, key: Optional[str] = None):
        """Очистить кеш (весь или конкретный ключ)"""
        if key:
            if key in self._cache:
                del self._cache[key]
                logger.info(f"Cache cleared for key: {key}")
        else:
            self._cache.clear()
            logger.info("Cache cleared completely")

# Глобальный экземпляр кеша
cache = SimpleCache()
