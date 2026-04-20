"""
Утилиты для аутентификации и управления пользователями.

Функции:
- generate_uid() — создание уникального 9-значного numeric UID
- hash_password/verify_password — bcrypt
- create_jwt/decode_jwt — JSON Web Tokens
- get_current_user_* — FastAPI dependencies
- verify_telegram_login_widget_hash — валидация Telegram Login Widget
- normalize_username — нормализация и валидация username
"""

import hmac
import hashlib
import logging
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_DAYS, get_telegram_bot_token

logger = logging.getLogger(__name__)

# ----- Password hashing -----
# bcrypt__rounds=12 — баланс между безопасностью и скоростью
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    """Хэширует пароль через bcrypt."""
    if not password or len(password) < 6:
        raise ValueError("Пароль должен содержать минимум 6 символов")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль против bcrypt хэша."""
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.warning(f"Password verification error: {e}")
        return False


# ----- UID generation -----

# UID = 9-значный numeric, от 100000000 до 999999999
# Диапазон: 900 млн возможных UID (достаточно)
UID_MIN = 100_000_000
UID_MAX = 999_999_999


async def generate_uid(db) -> str:
    """Генерирует уникальный 9-значный numeric UID (строка).

    Проверяет коллизии в db.users.uid (до 20 попыток).
    """
    for _ in range(20):
        # secrets.randbelow() для криптографической случайности
        candidate = str(UID_MIN + secrets.randbelow(UID_MAX - UID_MIN + 1))
        existing = await db.users.find_one({"uid": candidate}, {"_id": 1})
        if not existing:
            return candidate
    # Если 20 раз подряд коллизия — что-то не так, но fallback
    raise RuntimeError("Не удалось сгенерировать уникальный UID после 20 попыток")


# ----- Username normalization -----

# Паттерн публичного username (совпадает с UpdateProfileStepRequest в models.py).
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
USERNAME_RESERVED = {
    "admin", "root", "system", "support", "api", "auth", "login",
    "register", "rudn", "null", "undefined", "me", "settings",
    "profile", "users", "user", "telegram", "vk", "email",
}


def normalize_username(raw: Optional[str]) -> Optional[str]:
    """Нормализует username в lowercase + валидирует формат.

    Возвращает:
        - нормализованный username (lowercase, 3-32 символа a-z0-9_) — если валиден;
        - None — если `raw` пустой, не проходит валидацию, зарезервирован.

    Используется при регистрации через Telegram/VK (где username приходит
    с провайдера) и при ручном выборе username пользователем.
    """
    if not raw:
        return None
    candidate = str(raw).strip().lower()
    if not candidate:
        return None
    if not USERNAME_PATTERN.match(candidate):
        return None
    if candidate in USERNAME_RESERVED:
        return None
    return candidate


async def resolve_safe_username(
    db,
    raw: Optional[str],
    exclude_uid: Optional[str] = None,
) -> tuple[Optional[str], Optional[str]]:
    """Возвращает (safe_username, conflict_original).

    - Нормализует `raw`.
    - Если не валидный формат → (None, None).
    - Если нормализованное username уже занят другим uid
      (case-insensitive) → (None, original_raw) — вызывающий может показать
      UI «ник занят, выберите другой».
    - Иначе → (normalized, None).

    Используется для безопасной регистрации через Telegram/VK: если username
    из провайдера конфликтует с существующим — не пытаемся привязаться, а
    создаём нового user с пустым username и просим выбрать свой.
    """
    normalized = normalize_username(raw)
    if not normalized:
        return None, None

    query: Dict[str, Any] = {
        "username": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"},
    }
    if exclude_uid:
        query["uid"] = {"$ne": exclude_uid}

    existing = await db.users.find_one(query, {"_id": 1, "uid": 1})
    if existing:
        return None, raw  # конфликт — возвращаем оригинал, чтобы показать пользователю
    return normalized, None


# ----- JWT -----


def create_jwt(
    uid: str,
    telegram_id: Optional[int] = None,
    providers: Optional[list] = None,
    expire_days: Optional[int] = None,
) -> str:
    """Создаёт JWT access token.

    Args:
        uid: 9-digit numeric UID пользователя (sub)
        telegram_id: telegram_id если привязан
        providers: список активных auth-провайдеров
        expire_days: переопределение срока жизни
    """
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=expire_days or JWT_EXPIRE_DAYS)

    payload = {
        "sub": str(uid),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "providers": providers or [],
    }
    if telegram_id:
        payload["tid"] = int(telegram_id)

    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> Dict[str, Any]:
    """Декодирует JWT. Бросает JWTError при невалидности/истечении."""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


# ----- FastAPI dependencies -----

# Для endpoint'ов, где auth опциональна
_bearer_scheme_optional = HTTPBearer(auto_error=False)
# Для endpoint'ов, где auth обязательна
_bearer_scheme_required = HTTPBearer(auto_error=True)


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme_optional),
) -> Optional[Dict[str, Any]]:
    """Опциональная аутентификация — возвращает payload или None.

    Токен можно передать как:
    - Authorization: Bearer <token>
    - ?access_token=<token> (для случаев когда заголовки недоступны)
    """
    token: Optional[str] = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    else:
        token = request.query_params.get("access_token")

    if not token:
        return None

    try:
        payload = decode_jwt(token)
        return payload
    except JWTError as e:
        logger.debug(f"Invalid JWT (optional): {e}")
        return None


async def get_current_user_required(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme_optional),
) -> Dict[str, Any]:
    """Обязательная аутентификация — бросает 401 при отсутствии/невалидности токена."""
    token: Optional[str] = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    else:
        token = request.query_params.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Требуется авторизация (токен отсутствует)")

    try:
        payload = decode_jwt(token)
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Невалидный токен (нет subject)")
        return payload
    except JWTError as e:
        logger.debug(f"Invalid JWT (required): {e}")
        raise HTTPException(status_code=401, detail=f"Невалидный или истёкший токен")


# ----- Telegram Login Widget validation -----


def verify_telegram_login_widget_hash(data: Dict[str, Any], bot_token: Optional[str] = None) -> bool:
    """Проверяет HMAC hash из Telegram Login Widget.

    По документации: https://core.telegram.org/widgets/login#checking-authorization

    Формат `data`:
        id, first_name, last_name, username, photo_url, auth_date, hash
    """
    if not data or "hash" not in data:
        return False

    bot_token = bot_token or get_telegram_bot_token()
    if not bot_token:
        logger.error("verify_telegram_login_widget_hash: bot_token не задан")
        return False

    received_hash = data.get("hash", "")

    # Формируем data_check_string (без поля hash, отсортировано)
    fields = [
        f"{k}={v}"
        for k, v in sorted(data.items())
        if k != "hash" and v is not None and v != ""
    ]
    data_check_string = "\n".join(fields)

    # secret_key = SHA256(bot_token)
    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()

    # HMAC-SHA256
    computed_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        logger.warning("Telegram Login Widget: hash mismatch")
        return False

    # Проверка свежести (auth_date не старше 1 дня)
    try:
        auth_date = int(data.get("auth_date", 0))
        if datetime.now(timezone.utc).timestamp() - auth_date > 86400:
            logger.warning("Telegram Login Widget: auth_date устарел (>24h)")
            return False
    except (TypeError, ValueError):
        return False

    return True


# ----- Telegram WebApp initData validation -----


def verify_telegram_webapp_init_data(init_data: str, bot_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Проверяет `initData` из Telegram WebApp (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).

    Возвращает распарсенные данные (user, auth_date...) если валидно, иначе None.
    """
    if not init_data:
        return None

    bot_token = bot_token or get_telegram_bot_token()
    if not bot_token:
        return None

    try:
        from urllib.parse import parse_qsl
        import json

        pairs = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = pairs.pop("hash", "")
        if not received_hash:
            return None

        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))

        # Для WebApp: secret_key = HMAC-SHA256("WebAppData", bot_token)
        secret_key = hmac.new(
            b"WebAppData",
            bot_token.encode("utf-8"),
            hashlib.sha256,
        ).digest()

        computed_hash = hmac.new(
            secret_key,
            data_check_string.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(computed_hash, received_hash):
            return None

        # Проверка свежести (auth_date не старше 1 дня)
        auth_date = int(pairs.get("auth_date", "0"))
        if datetime.now(timezone.utc).timestamp() - auth_date > 86400:
            logger.warning("WebApp initData: auth_date устарел (>24h)")
            return None

        # Распарсим user JSON если есть
        result = dict(pairs)
        if "user" in result:
            try:
                result["user"] = json.loads(result["user"])
            except json.JSONDecodeError:
                pass
        return result
    except Exception as e:
        logger.warning(f"verify_telegram_webapp_init_data error: {e}")
        return None
