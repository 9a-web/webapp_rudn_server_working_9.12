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
    Возвращает username Telegram бота в зависимости от ENV.
    
    - ENV=test -> rudn_mosbot (тестовый бот)
    - ENV=production -> rudn_mosbot (основной бот)
    
    Returns:
        str: Username бота для текущего окружения
    """
    if ENV == "production":
        return "rudn_mosbot"
    else:
        return "rudn_mosbot"


# Экспортируем активный токен для обратной совместимости
TELEGRAM_BOT_TOKEN = get_telegram_bot_token()

# Логируем текущую конфигурацию при импорте
logger.info(f"📋 Конфигурация загружена: ENV={ENV}")
