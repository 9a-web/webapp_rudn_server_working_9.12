"""
Утилиты для аутентификации и управления пользователями.

Функции:
- generate_uid() — создание уникального 9-значного numeric UID
- hash_password/verify_password — bcrypt
- create_jwt/decode_jwt — JSON Web Tokens
- get_current_user_* — FastAPI dependencies
- verify_telegram_login_widget_hash — валидация Telegram Login Widget
- normalize_username — нормализация и валидация username
- pseudo_tid_from_uid — псевдо-telegram_id для синхронизации user_settings
- choose_primary_auth — детерминированный выбор primary_auth по приоритету
- check_rate_limit — простой in-memory rate limiter (dual key: IP/email)
"""

import hmac
import hashlib
import logging
import os  # Stage 7: B-05 TRUST_PROXY_HOPS env-var
import re
import secrets
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from time import monotonic
from typing import Optional, Dict, Any, Iterable, Tuple

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

# Диапазон значений псевдо-telegram_id (для email/VK/QR-регистраций без реального
# Telegram-аккаунта). Используется как ключ в legacy-коллекции `user_settings`,
# чтобы не ломать совместимость со старыми endpoints. 10^10 + uid гарантирует,
# что значение находится ВНЕ диапазона реальных Telegram ID (которые ≤ 10^10).
PSEUDO_TID_OFFSET = 10_000_000_000  # 10^10


def pseudo_tid_from_uid(uid: str | int) -> int:
    """Возвращает синтетический telegram_id для user_settings, гарантированно
    не пересекающийся с реальными Telegram ID.

    Пример: uid="123456789" → 10_123_456_789.
    """
    return PSEUDO_TID_OFFSET + int(uid)


def is_pseudo_tid(tid: Optional[int]) -> bool:
    """True если значение — наш синтетический ключ, а не реальный Telegram ID."""
    if tid is None:
        return False
    try:
        return int(tid) >= PSEUDO_TID_OFFSET
    except (TypeError, ValueError):
        return False


def effective_tid_for_user(user_doc: dict) -> Optional[int]:
    """Возвращает ключ для user_settings: реальный telegram_id если есть, иначе pseudo."""
    if not user_doc:
        return None
    tid = user_doc.get("telegram_id")
    if tid:
        try:
            return int(tid)
        except (TypeError, ValueError):
            pass
    uid = user_doc.get("uid")
    if not uid:
        return None
    try:
        return pseudo_tid_from_uid(uid)
    except (TypeError, ValueError):
        return None


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


# ----- Auth providers — приоритет / детерминированный выбор -----

# Канонический список + приоритет (для выбора primary_auth при unlink).
PROVIDERS: Tuple[str, ...] = ("email", "telegram", "vk")
# Приоритет совпадает с порядком: email > telegram > vk.
# Логика: email — самый «надёжный» (под контролем владельца, требует пароль),
# telegram — второй (привязан к номеру телефона), vk — третий.


def choose_primary_auth(active_providers: Iterable[str], fallback: str = "email") -> str:
    """Возвращает наиболее приоритетный провайдер из списка `active_providers`.

    Используется при unlink, чтобы детерминированно установить новый primary_auth.
    """
    active_set = set(active_providers or [])
    for p in PROVIDERS:
        if p in active_set:
            return p
    return fallback


# ----- Rate Limiter (in-memory, общий) -----
# Простой лимитер с двумя ключами (например, IP и email одновременно).
# Для production желательно заменить на Redis/slowapi, но для in-process FastAPI
# инстансов этого достаточно. Память автоматически освобождается через cutoff.
#
# Stage 7: B-17 — добавлен lazy GC, ограничение размера словаря + защита от
# неограниченного роста при атаке через случайные ключи (IP spoofing).

_rate_limits: dict = defaultdict(list)  # bucket:key -> list[timestamps]
_RATE_LIMIT_MAX_KEYS = 100_000          # жёсткий потолок на кол-во активных ключей
_rate_limit_gc_counter = 0              # инкрементируется при каждом вызове
_RATE_LIMIT_GC_EVERY = 1000             # раз в N вызовов делаем proactive GC


def _rate_limit_gc(now: float) -> None:
    """Удаляет bucket:key с полностью устаревшими timestamps.

    Вызывается проактивно каждые _RATE_LIMIT_GC_EVERY обращений к
    check_rate_limit. Также делает аварийный dump при переполнении
    _RATE_LIMIT_MAX_KEYS.
    """
    global _rate_limits
    # Максимальное окно из всех buckets — 3600 сек (час). Ключи старше
    # (now - 3600) уже никому не нужны.
    cutoff = now - 3600
    dead: list = []
    for k, arr in _rate_limits.items():
        if not arr or arr[-1] <= cutoff:
            dead.append(k)
    for k in dead:
        _rate_limits.pop(k, None)

    # Аварийный сброс при переполнении (anti-DoS через IP-spoofing)
    if len(_rate_limits) > _RATE_LIMIT_MAX_KEYS:
        # Оставляем только самые свежие 50% (по max timestamp)
        items = sorted(
            _rate_limits.items(),
            key=lambda kv: (kv[1][-1] if kv[1] else 0),
            reverse=True,
        )
        keep = dict(items[: _RATE_LIMIT_MAX_KEYS // 2])
        _rate_limits.clear()
        _rate_limits.update(keep)


def check_rate_limit(
    key: str,
    bucket: str,
    max_requests: int,
    window_seconds: int,
) -> bool:
    """Возвращает True если лимит НЕ превышен, False — превышен.

    Имя bucket'а должно быть стабильным (например, `login_email_ip`,
    `login_email_email`), key — уникальное значение в этом bucket'е (IP или email).
    """
    global _rate_limit_gc_counter
    now = monotonic()
    _rate_limit_gc_counter += 1
    if _rate_limit_gc_counter >= _RATE_LIMIT_GC_EVERY:
        _rate_limit_gc_counter = 0
        try:
            _rate_limit_gc(now)
        except Exception:  # pragma: no cover
            pass

    full_key = f"{bucket}:{key or 'unknown'}"
    arr = _rate_limits[full_key]
    cutoff = now - window_seconds
    arr_filtered = [t for t in arr if t > cutoff]
    if len(arr_filtered) >= max_requests:
        _rate_limits[full_key] = arr_filtered
        return False
    arr_filtered.append(now)
    _rate_limits[full_key] = arr_filtered
    return True


# Stage 7: B-05 — ENV-управляемая защита от IP-spoofing через X-Forwarded-For.
# Только TRUST_PROXY_HOPS последних прокси-элементов будут игнорироваться;
# реальный клиент = элемент №(len(xff_list) - TRUST_PROXY_HOPS).
# По умолчанию доверяем 1 хопу (типичный K8s ingress).
try:
    _TRUST_PROXY_HOPS = int(os.getenv("TRUST_PROXY_HOPS", "1"))
except (TypeError, ValueError):
    _TRUST_PROXY_HOPS = 1
if _TRUST_PROXY_HOPS < 0:
    _TRUST_PROXY_HOPS = 0


def get_client_ip(request: Request) -> str:
    """Аккуратно достаёт client IP, учитывая X-Forwarded-For (за прокси/ingress).

    Stage 7: B-05 — защита от IP-spoofing: если TRUST_PROXY_HOPS=N, то
    берём элемент X-Forwarded-For из позиции (len-N-1), а не первый элемент
    (который юзер может подменить через заголовок).
    """
    if not request:
        return "unknown"
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            # Выбираем элемент с учётом количества доверенных прокси.
            # Если доверяем 1 хопу (наш ingress), то берём предпоследний.
            idx = max(0, len(parts) - 1 - _TRUST_PROXY_HOPS)
            return parts[idx]
    real_ip = request.headers.get("X-Real-IP", "")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


# ----- JWT -----


def create_jwt(
    uid: str,
    telegram_id: Optional[int] = None,
    providers: Optional[list] = None,
    expire_days: Optional[int] = None,
    jti: Optional[str] = None,
) -> str:
    """Создаёт JWT access token.

    Args:
        uid: 9-digit numeric UID пользователя (sub)
        telegram_id: telegram_id если привязан
        providers: список активных auth-провайдеров
        expire_days: переопределение срока жизни
        jti: уникальный идентификатор токена (для будущего blacklist/sessions API)
    """
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=expire_days or JWT_EXPIRE_DAYS)

    payload = {
        "sub": str(uid),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "providers": providers or [],
        "jti": jti or secrets.token_urlsafe(12),
    }
    if telegram_id:
        payload["tid"] = int(telegram_id)

    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> Dict[str, Any]:
    """Декодирует JWT. Бросает JWTError при невалидности/истечении."""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


# ----- FastAPI dependencies -----

# Один scheme — auto_error=False. `required` сам проверяет наличие токена и
# бросает 401, если его нет. Это даёт возможность поддержать также `?access_token=`
# query parameter (для случаев когда клиент не может выставить заголовок —
# например, внутренние ссылки на изображения или legacy fetch без axios-interceptor).
_bearer_scheme = HTTPBearer(auto_error=False)


def _extract_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    if credentials and credentials.scheme and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    return request.query_params.get("access_token")


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[Dict[str, Any]]:
    """Опциональная аутентификация — возвращает payload или None."""
    token = _extract_token(request, credentials)
    if not token:
        return None
    try:
        return decode_jwt(token)
    except JWTError as e:
        logger.debug(f"Invalid JWT (optional): {e}")
        return None


async def get_current_user_required(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Dict[str, Any]:
    """Обязательная аутентификация — бросает 401 при отсутствии/невалидности токена."""
    token = _extract_token(request, credentials)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Требуется авторизация (токен отсутствует)",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_jwt(token)
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Невалидный токен (нет subject)")
        return payload
    except JWTError as e:
        logger.debug(f"Invalid JWT (required): {e}")
        raise HTTPException(
            status_code=401,
            detail="Невалидный или истёкший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )


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
