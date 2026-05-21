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

# ──────────────────────────────────────────────────────────────────────────
# Администраторы
# ──────────────────────────────────────────────────────────────────────────
# Перечень Telegram ID пользователей с правами администратора.
# Источник истины: ENV var `ADMIN_TELEGRAM_IDS` (csv: "765963392,1311283832").
# Если ENV не задана — используются hard-coded значения (для безопасного
# дефолта на staging / локалке).
_ADMIN_IDS_DEFAULT = [765963392, 1311283832]

def _parse_admin_ids() -> list[int]:
    raw = os.getenv("ADMIN_TELEGRAM_IDS", "").strip()
    if not raw:
        return list(_ADMIN_IDS_DEFAULT)
    out: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            out.append(int(part))
        except ValueError:
            logger.warning(f"ADMIN_TELEGRAM_IDS: пропущен некорректный id={part!r}")
    return out or list(_ADMIN_IDS_DEFAULT)

ADMIN_TELEGRAM_IDS: list[int] = _parse_admin_ids()


def is_admin_telegram_id(telegram_id) -> bool:
    """True если данный telegram_id имеет права администратора.
    Принимает int / str / None.
    """
    if telegram_id is None:
        return False
    try:
        return int(telegram_id) in ADMIN_TELEGRAM_IDS
    except (TypeError, ValueError):
        return False


def is_admin_user(user_doc: dict | None) -> bool:
    """True если пользователь — админ (по его telegram_id в users)."""
    if not user_doc:
        return False
    tid = user_doc.get("telegram_id")
    return is_admin_telegram_id(tid)



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

# 🔐 SECURITY (C1 fix, 2026-07): JWT secret НИКОГДА не должен иметь hardcoded
# default в коде. Старый default попадал в git, что давало возможность
# подделать любой токен. Теперь:
#   - в test/dev: если не задан в .env — генерируется случайный per-process
#     (юзеры разлогинятся после рестарта, что приемлемо в test)
#   - в production: HARD-FAIL при импорте, если переменная не задана
#     или совпадает со старым «небезопасным» значением
_JWT_INSECURE_DEFAULTS = {
    "rudn-auth-default-secret-CHANGE-ME-IN-PROD-8f3a2b1c9d7e",
    "change-me",
    "secret",
    "",
}

def _resolve_jwt_secret() -> str:
    import secrets as _secrets
    raw = (os.getenv("JWT_SECRET_KEY") or "").strip()
    if raw and raw not in _JWT_INSECURE_DEFAULTS and len(raw) >= 32:
        return raw
    # Небезопасный/отсутствующий ключ
    if ENV == "production":
        raise RuntimeError(
            "❌ JWT_SECRET_KEY не задан или использует небезопасное значение. "
            "Сгенерируйте: python -c 'import secrets;print(secrets.token_urlsafe(64))' "
            "и положите в backend/.env как JWT_SECRET_KEY=..."
        )
    ephemeral = _secrets.token_urlsafe(64)
    logger.warning(
        "⚠️ JWT_SECRET_KEY не задан в .env — используется случайный ephemeral-ключ "
        "(юзеры разлогинятся при рестарте). Задайте JWT_SECRET_KEY в backend/.env."
    )
    return ephemeral

JWT_SECRET_KEY = _resolve_jwt_secret()
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "30"))

# VK OAuth
VK_APP_ID = os.getenv("VK_APP_ID", "")
VK_CLIENT_SECRET = os.getenv("VK_CLIENT_SECRET", "")
VK_REDIRECT_URI = os.getenv("VK_REDIRECT_URI", "")

# Публичный URL для shareable-ссылок (= REACT_APP_BACKEND_URL во frontend .env)
# Используется для генерации `/u/{uid}` публичных ссылок, ссылок в email,
# а также как fallback для email_service.PUBLIC_BASE_URL.
# Источник истины — backend .env (PUBLIC_BASE_URL), затем frontend .env (REACT_APP_BACKEND_URL)
PUBLIC_BASE_URL = (
    os.getenv("PUBLIC_BASE_URL", "").strip()
    or os.getenv("REACT_APP_BACKEND_URL", "").strip()
)

# Логируем текущую конфигурацию при импорте
logger.info(f"📋 Конфигурация загружена: ENV={ENV}")
