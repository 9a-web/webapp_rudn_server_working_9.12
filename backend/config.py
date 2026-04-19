"""
Конфигурация приложения RUDN Schedule
Управление переменными окружения и выбор токенов в зависимости от ENV
"""

import os
import logging
from dotenv import load_dotenv
from pathlib import Path

# Загрузка переменных окружения
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# Получение текущего окружения
ENV = os.getenv("ENV", "test").lower()

# Токены ботов
PRODUCTION_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TEST_BOT_TOKEN = os.getenv("TEST_TELEGRAM_BOT_TOKEN")


def get_telegram_bot_token() -> str:
    """
    Возвращает токен Telegram бота в зависимости от ENV.
    
    - ENV=test -> TEST_TELEGRAM_BOT_TOKEN
    - ENV=production -> TELEGRAM_BOT_TOKEN
    
    Returns:
        str: Токен бота для текущего окружения
    """
    if ENV == "production":
        token = PRODUCTION_BOT_TOKEN
        bot_type = "PRODUCTION"
    else:
        # По умолчанию используем тестовый токен
        token = TEST_BOT_TOKEN or PRODUCTION_BOT_TOKEN
        bot_type = "TEST" if TEST_BOT_TOKEN else "PRODUCTION (fallback)"
    
    if token:
        # Показываем только первые 10 символов токена для безопасности
        masked_token = token[:10] + "..." if len(token) > 10 else token
        logger.info(f"🤖 Используется {bot_type} бот (ENV={ENV}): {masked_token}")
    else:
        logger.error(f"❌ Токен бота не найден! ENV={ENV}")
    
    return token


def is_test_environment() -> bool:
    """
    Проверяет, является ли текущее окружение тестовым.
    
    Returns:
        bool: True если ENV != production
    """
    return ENV != "production"


def is_production_environment() -> bool:
    """
    Проверяет, является ли текущее окружение продакшн.
    
    Returns:
        bool: True если ENV == production
    """
    return ENV == "production"


def get_telegram_bot_username() -> str:
    """
    Возвращает username Telegram бота.
    Сначала проверяет кэш (заполняется при старте через getMe).
    Если кэш пуст — возвращает fallback.
    """
    return _bot_username_cache.get("username", "bot")


# Кэш username бота (заполняется при старте)
_bot_username_cache = {}


async def _fetch_bot_username():
    """Получает username бота через Telegram Bot API getMe и кэширует."""
    import httpx
    token = get_telegram_bot_token()
    if not token:
        logger.error("❌ Не удалось получить username бота: токен не задан")
        return
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://api.telegram.org/bot{token}/getMe", timeout=10)
            data = resp.json()
            if data.get("ok") and data.get("result", {}).get("username"):
                username = data["result"]["username"]
                _bot_username_cache["username"] = username
                _bot_username_cache["first_name"] = data["result"].get("first_name", "")
                _bot_username_cache["id"] = data["result"].get("id", 0)
                logger.info(f"🤖 Bot username получен через getMe: @{username} (ENV={ENV})")
            else:
                logger.warning(f"⚠️ getMe вернул неожиданный ответ: {data}")
    except Exception as e:
        logger.error(f"❌ Ошибка при вызове getMe: {e}")


# Экспортируем активный токен для обратной совместимости
TELEGRAM_BOT_TOKEN = get_telegram_bot_token()

# ========== JWT / AUTH КОНФИГУРАЦИЯ ==========

# JWT secret — обязательно переопределять в production
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "rudn-auth-default-secret-CHANGE-ME-IN-PROD-8f3a2b1c9d7e")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "30"))

# VK OAuth
VK_APP_ID = os.getenv("VK_APP_ID", "")
VK_CLIENT_SECRET = os.getenv("VK_CLIENT_SECRET", "")
VK_REDIRECT_URI = os.getenv("VK_REDIRECT_URI", "")

# Публичный URL для shareable-ссылок (= REACT_APP_BACKEND_URL во frontend .env)
# Используется для генерации `/u/{uid}` публичных ссылок
# Источник истины — frontend .env (REACT_APP_BACKEND_URL), но и backend может его знать
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "")

# Логируем текущую конфигурацию при импорте
logger.info(f"📋 Конфигурация загружена: ENV={ENV}")
if JWT_SECRET_KEY.startswith("rudn-auth-default"):
    logger.warning("⚠️  JWT_SECRET_KEY использует дефолтное значение! Задайте свой в .env")
