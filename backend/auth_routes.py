"""
Auth routes — регистрация/логин через Email, Telegram, VK, QR.

Экспортирует factory `create_auth_router(db)` → APIRouter с префиксом `/auth`.
Также экспортирует `migrate_user_settings_to_users(db)` для миграции при старте.
"""

import logging
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request
from pymongo.errors import DuplicateKeyError

from auth_utils import (
    hash_password,
    verify_password,
    generate_uid,
    create_jwt,
    verify_telegram_login_widget_hash,
    verify_telegram_webapp_init_data,
    get_current_user_required,
    get_current_user_optional,
)
from config import (
    get_telegram_bot_token,
    get_telegram_bot_username,
    VK_APP_ID,
    VK_CLIENT_SECRET,
    VK_REDIRECT_URI,
    ENV,
)
from models import (
    AuthTokenResponse,
    LoginEmailRequest,
    QRConfirmRequest,
    QRInitResponse,
    QRStatusResponse,
    RegisterEmailRequest,
    TelegramLoginRequest,
    TelegramWebAppLoginRequest,
    UpdateProfileStepRequest,
    User,
    UserPublic,
    UsernameCheckResponse,
    VKLoginRequest,
)

logger = logging.getLogger(__name__)

# ========== Константы ==========
QR_SESSION_TTL_MINUTES = 5
RESERVED_USERNAMES = {"admin", "root", "system", "support", "api", "auth", "login", "register", "rudn", "null", "undefined", "me"}

# ========== Rate Limiter (in-memory, per-IP) ==========
# Простой лимитер для /register/email, чтобы избежать спама.
# Для production можно заменить на Redis/slowapi.
from collections import defaultdict
from time import monotonic

_rate_limits: dict = defaultdict(list)  # ip -> list[timestamps]

def _check_rate_limit(ip: str, bucket: str, max_requests: int, window_seconds: int) -> bool:
    """Возвращает True если лимит НЕ превышен, False — превышен."""
    now = monotonic()
    key = f"{bucket}:{ip or 'unknown'}"
    arr = _rate_limits[key]
    # Удаляем старые
    cutoff = now - window_seconds
    _rate_limits[key] = [t for t in arr if t > cutoff]
    if len(_rate_limits[key]) >= max_requests:
        return False
    _rate_limits[key].append(now)
    return True


# ========== Helpers ==========

def _user_to_public(user_doc: dict, include_email: bool = False) -> UserPublic:
    """Конвертирует Mongo-doc `users` → UserPublic."""
    return UserPublic(
        uid=user_doc.get("uid"),
        username=user_doc.get("username"),
        first_name=user_doc.get("first_name"),
        last_name=user_doc.get("last_name"),
        email=user_doc.get("email") if include_email else None,
        telegram_id=user_doc.get("telegram_id"),
        vk_id=user_doc.get("vk_id"),
        auth_providers=user_doc.get("auth_providers", []),
        primary_auth=user_doc.get("primary_auth"),
        facultet_id=user_doc.get("facultet_id"),
        facultet_name=user_doc.get("facultet_name"),
        kurs=user_doc.get("kurs"),
        group_id=user_doc.get("group_id"),
        group_name=user_doc.get("group_name"),
        registration_step=user_doc.get("registration_step", 0),
        created_at=user_doc.get("created_at"),
    )


async def _create_new_user(
    db,
    *,
    email: Optional[str] = None,
    password_hash: Optional[str] = None,
    telegram_id: Optional[int] = None,
    vk_id: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    username: Optional[str] = None,
    primary_auth: str,
    registration_step: int = 2,  # 2 = нужно заполнить профиль
) -> dict:
    """Создаёт новый `users` документ с уникальным UID. Возвращает вставленный doc."""
    uid = await generate_uid(db)
    now = datetime.now(timezone.utc)

    doc = {
        "id": str(uuid.uuid4()),
        "uid": uid,
        "username": username,
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "password_hash": password_hash,
        "telegram_id": telegram_id,
        "vk_id": vk_id,
        "auth_providers": [primary_auth],
        "primary_auth": primary_auth,
        "email_verified": False,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "last_login_at": now,
        "registration_step": registration_step,
    }

    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError as e:
        logger.warning(f"Duplicate key on user create: {e}")
        raise HTTPException(
            status_code=409,
            detail="Такой пользователь уже существует (конфликт email/telegram_id/vk_id/uid)",
        )

    # Параллельно создаём/обновляем запись в user_settings (для обратной совместимости).
    # Для email/VK/QR-регистраций telegram_id может отсутствовать — в этом случае
    # используем int(uid) как синтетический ключ, чтобы старые endpoints вроде
    # GET /api/user-settings/{id} и дальнейшая загрузка в Home-компоненте работали
    # сразу после регистрации. UID — 9-значный numeric, не конфликтует с реальными
    # Telegram ID (которые обычно 10+ цифр).
    try:
        effective_tid = int(telegram_id) if telegram_id else int(uid)
    except (TypeError, ValueError):
        effective_tid = None

    if effective_tid is not None:
        await db.user_settings.update_one(
            {"telegram_id": effective_tid},
            {
                "$setOnInsert": {
                    "telegram_id": effective_tid,
                    "created_at": now,
                },
                "$set": {
                    "uid": uid,  # связь с новой коллекцией users
                    "first_name": first_name,
                    "last_name": last_name,
                    "username": username,
                },
            },
            upsert=True,
        )

    logger.info(f"✅ New user created: uid={uid} primary_auth={primary_auth} effective_tid={effective_tid}")
    return doc


async def _update_last_login(db, uid: str):
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"uid": uid},
        {"$set": {"last_login_at": now, "updated_at": now}},
    )


async def _issue_token(db, user_doc: dict, is_new: bool = False) -> AuthTokenResponse:
    """Генерирует JWT для пользователя и возвращает AuthTokenResponse."""
    token = create_jwt(
        uid=user_doc["uid"],
        telegram_id=user_doc.get("telegram_id"),
        providers=user_doc.get("auth_providers", []),
    )
    if not is_new:
        await _update_last_login(db, user_doc["uid"])

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=_user_to_public(user_doc, include_email=True),
        is_new_user=is_new,
    )


# ========== Миграция ==========


async def migrate_user_settings_to_users(db) -> Dict[str, int]:
    """Миграция: для всех `user_settings` без uid — создаём `users` запись.

    Вызывается при старте приложения.
    Идемпотентна — повторный запуск не создаёт дубликатов.
    """
    created = 0
    updated = 0
    errors = 0

    cursor = db.user_settings.find(
        {"$or": [{"uid": {"$exists": False}}, {"uid": None}]},
        {"telegram_id": 1, "first_name": 1, "last_name": 1, "username": 1,
         "facultet_id": 1, "facultet_name": 1, "level_id": 1, "form_code": 1,
         "kurs": 1, "group_id": 1, "group_name": 1, "created_at": 1},
    )

    async for settings_doc in cursor:
        tg_id = settings_doc.get("telegram_id")
        if not tg_id:
            continue

        try:
            # Уже есть user с таким telegram_id?
            existing = await db.users.find_one({"telegram_id": tg_id}, {"uid": 1})
            if existing and existing.get("uid"):
                # Просто проставим uid в user_settings
                await db.user_settings.update_one(
                    {"telegram_id": tg_id},
                    {"$set": {"uid": existing["uid"]}},
                )
                updated += 1
                continue

            # Создаём user
            uid = await generate_uid(db)
            now = datetime.now(timezone.utc)
            new_doc = {
                "id": str(uuid.uuid4()),
                "uid": uid,
                "username": settings_doc.get("username"),
                "first_name": settings_doc.get("first_name"),
                "last_name": settings_doc.get("last_name"),
                "email": None,
                "password_hash": None,
                "telegram_id": tg_id,
                "vk_id": None,
                "auth_providers": ["telegram"],
                "primary_auth": "telegram",
                "email_verified": False,
                "is_active": True,
                "created_at": settings_doc.get("created_at") or now,
                "updated_at": now,
                "last_login_at": None,
                "registration_step": 0,  # миграция = полностью настроенный профиль
                "facultet_id": settings_doc.get("facultet_id"),
                "facultet_name": settings_doc.get("facultet_name"),
                "level_id": settings_doc.get("level_id"),
                "form_code": settings_doc.get("form_code"),
                "kurs": settings_doc.get("kurs"),
                "group_id": settings_doc.get("group_id"),
                "group_name": settings_doc.get("group_name"),
            }

            try:
                await db.users.insert_one(new_doc)
                created += 1
            except DuplicateKeyError:
                # username конфликт — убираем username и повторяем
                new_doc["username"] = None
                await db.users.insert_one(new_doc)
                created += 1

            # Обновляем user_settings с uid
            await db.user_settings.update_one(
                {"telegram_id": tg_id},
                {"$set": {"uid": uid}},
            )

        except Exception as e:
            errors += 1
            logger.warning(f"Migration error for telegram_id={tg_id}: {e}")

    result = {"created": created, "updated": updated, "errors": errors}
    if created or updated:
        logger.info(f"✅ user_settings → users migration: {result}")
    return result


# ========== Router factory ==========


def create_auth_router(db) -> APIRouter:
    """Создаёт и возвращает APIRouter с auth endpoints."""
    router = APIRouter(prefix="/auth", tags=["auth"])

    # ============= REGISTER (email) =============

    @router.post("/register/email", response_model=AuthTokenResponse)
    async def register_email(req: RegisterEmailRequest, request: Request):
        """Шаг 1 регистрации через email/пароль."""
        # Rate limit: 5 registrations per hour per IP
        client_ip = request.client.host if request.client else None
        if not _check_rate_limit(client_ip, "register_email", max_requests=5, window_seconds=3600):
            raise HTTPException(
                status_code=429,
                detail="Слишком много регистраций с этого IP. Попробуйте через час.",
            )

        email_norm = req.email.strip().lower()

        existing = await db.users.find_one({"email": email_norm})
        if existing:
            raise HTTPException(status_code=409, detail="Email уже зарегистрирован")

        try:
            password_hash = hash_password(req.password)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        user_doc = await _create_new_user(
            db,
            email=email_norm,
            password_hash=password_hash,
            first_name=req.first_name,
            last_name=req.last_name,
            primary_auth="email",
            registration_step=2,  # → шаг 2: заполнить username/имя
        )

        return await _issue_token(db, user_doc, is_new=True)

    # ============= LOGIN (email) =============

    @router.post("/login/email", response_model=AuthTokenResponse)
    async def login_email(req: LoginEmailRequest):
        email_norm = req.email.strip().lower()
        user_doc = await db.users.find_one({"email": email_norm})
        if not user_doc or not user_doc.get("password_hash"):
            raise HTTPException(status_code=401, detail="Неверный email или пароль")

        if not user_doc.get("is_active", True):
            raise HTTPException(status_code=403, detail="Аккаунт деактивирован")

        if not verify_password(req.password, user_doc["password_hash"]):
            raise HTTPException(status_code=401, detail="Неверный email или пароль")

        return await _issue_token(db, user_doc, is_new=False)

    # ============= LOGIN (Telegram Login Widget) =============

    @router.post("/login/telegram", response_model=AuthTokenResponse)
    async def login_telegram(req: TelegramLoginRequest):
        data = req.model_dump(exclude={"referral_code"}, exclude_none=True)

        if not verify_telegram_login_widget_hash(data):
            raise HTTPException(status_code=401, detail="Невалидная подпись Telegram")

        tg_id = req.id
        existing = await db.users.find_one({"telegram_id": tg_id})
        is_new = False
        if existing:
            # Уже есть user — обновим данные и выдадим JWT
            update_fields = {
                "updated_at": datetime.now(timezone.utc),
                "last_login_at": datetime.now(timezone.utc),
            }
            if req.username and not existing.get("username"):
                # Автоматически сохраним Telegram username как initial (проверив уникальность)
                dup = await db.users.find_one({"username": req.username, "uid": {"$ne": existing["uid"]}})
                if not dup:
                    update_fields["username"] = req.username
            if req.first_name:
                update_fields["first_name"] = existing.get("first_name") or req.first_name
            if req.last_name:
                update_fields["last_name"] = existing.get("last_name") or req.last_name
            if "telegram" not in existing.get("auth_providers", []):
                await db.users.update_one(
                    {"uid": existing["uid"]},
                    {"$addToSet": {"auth_providers": "telegram"}},
                )

            await db.users.update_one({"uid": existing["uid"]}, {"$set": update_fields})
            user_doc = await db.users.find_one({"uid": existing["uid"]})
        else:
            # Новый user
            user_doc = await _create_new_user(
                db,
                telegram_id=tg_id,
                first_name=req.first_name,
                last_name=req.last_name,
                username=req.username,
                primary_auth="telegram",
                registration_step=2,
            )
            is_new = True

        return await _issue_token(db, user_doc, is_new=is_new)

    # ============= LOGIN (Telegram WebApp initData) =============

    @router.post("/login/telegram-webapp", response_model=AuthTokenResponse)
    async def login_telegram_webapp(req: TelegramWebAppLoginRequest):
        """Логин через Telegram WebApp — пользователь уже в боте, просто верифицируем initData."""
        parsed = verify_telegram_webapp_init_data(req.init_data)
        if not parsed or not parsed.get("user"):
            raise HTTPException(status_code=401, detail="Невалидные данные Telegram WebApp")

        tg_user = parsed["user"]
        tg_id = tg_user.get("id")
        if not tg_id:
            raise HTTPException(status_code=400, detail="user.id отсутствует в initData")

        existing = await db.users.find_one({"telegram_id": tg_id})
        is_new = False
        if existing:
            await db.users.update_one(
                {"uid": existing["uid"]},
                {
                    "$set": {
                        "last_login_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    },
                    "$addToSet": {"auth_providers": "telegram"},
                },
            )
            user_doc = await db.users.find_one({"uid": existing["uid"]})
        else:
            user_doc = await _create_new_user(
                db,
                telegram_id=tg_id,
                first_name=tg_user.get("first_name"),
                last_name=tg_user.get("last_name"),
                username=tg_user.get("username"),
                primary_auth="telegram",
                registration_step=2,
            )
            is_new = True

        return await _issue_token(db, user_doc, is_new=is_new)

    # ============= LOGIN (VK ID OAuth) =============

    @router.post("/login/vk", response_model=AuthTokenResponse)
    async def login_vk(req: VKLoginRequest):
        """VK OAuth — обмен code → access_token → данные профиля."""
        if not VK_APP_ID or not VK_CLIENT_SECRET:
            raise HTTPException(status_code=500, detail="VK OAuth не сконфигурирован")

        redirect_uri = req.redirect_uri or VK_REDIRECT_URI
        if not redirect_uri:
            raise HTTPException(status_code=400, detail="redirect_uri обязателен")

        # Обмен code на токен через VK ID (новый VK ID endpoint)
        # Для старого VK OAuth: https://oauth.vk.com/access_token
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                # Пробуем VK ID endpoint
                token_resp = await client.post(
                    "https://id.vk.com/oauth2/auth",
                    data={
                        "grant_type": "authorization_code",
                        "code": req.code,
                        "client_id": VK_APP_ID,
                        "client_secret": VK_CLIENT_SECRET,
                        "redirect_uri": redirect_uri,
                        "device_id": req.device_id or "",
                        "code_verifier": req.code_verifier or "",
                        "state": req.state or "",
                    },
                )
                token_data = token_resp.json()
            except Exception as e:
                logger.error(f"VK token exchange error: {e}")
                raise HTTPException(status_code=502, detail=f"Ошибка связи с VK: {e}")

        if "access_token" not in token_data:
            # Fallback на legacy oauth.vk.com
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    legacy_resp = await client.get(
                        "https://oauth.vk.com/access_token",
                        params={
                            "client_id": VK_APP_ID,
                            "client_secret": VK_CLIENT_SECRET,
                            "redirect_uri": redirect_uri,
                            "code": req.code,
                        },
                    )
                    token_data = legacy_resp.json()
            except Exception as e:
                logger.error(f"VK legacy token exchange error: {e}")

        access_token = token_data.get("access_token")
        vk_user_id = token_data.get("user_id")

        if not access_token or not vk_user_id:
            raise HTTPException(
                status_code=401,
                detail=f"VK не вернул токен: {token_data.get('error_description') or token_data.get('error') or 'unknown'}",
            )

        vk_id_str = str(vk_user_id)

        # Получаем профиль
        vk_profile = {}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                prof_resp = await client.get(
                    "https://api.vk.com/method/users.get",
                    params={
                        "access_token": access_token,
                        "v": "5.131",
                        "fields": "photo_200,screen_name,first_name,last_name",
                    },
                )
                prof = prof_resp.json()
                if "response" in prof and prof["response"]:
                    vk_profile = prof["response"][0]
        except Exception as e:
            logger.warning(f"VK users.get error: {e}")

        # Поиск/создание
        existing = await db.users.find_one({"vk_id": vk_id_str})
        is_new = False
        if existing:
            await db.users.update_one(
                {"uid": existing["uid"]},
                {
                    "$set": {
                        "last_login_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    },
                    "$addToSet": {"auth_providers": "vk"},
                },
            )
            user_doc = await db.users.find_one({"uid": existing["uid"]})
        else:
            user_doc = await _create_new_user(
                db,
                vk_id=vk_id_str,
                first_name=vk_profile.get("first_name"),
                last_name=vk_profile.get("last_name"),
                username=vk_profile.get("screen_name"),
                primary_auth="vk",
                registration_step=2,
            )
            is_new = True

        return await _issue_token(db, user_doc, is_new=is_new)

    # ============= QR LOGIN =============

    @router.post("/login/qr/init", response_model=QRInitResponse)
    async def qr_init(request: Request):
        """Инициирует QR-login сессию.

        Возвращает `qr_token` + `qr_url`. Сайт показывает QR, опрашивает `/status`
        каждые 2 сек. Авторизованное устройство сканирует QR и вызывает `/confirm`.
        """
        qr_token = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=QR_SESSION_TTL_MINUTES)

        ua = request.headers.get("User-Agent", "")
        ip = request.client.host if request.client else None

        await db.auth_qr_sessions.insert_one({
            "id": str(uuid.uuid4()),
            "qr_token": qr_token,
            "status": "pending",
            "user_agent": ua,
            "ip_address": ip,
            "confirmed_uid": None,
            "created_at": now,
            "expires_at": expires_at,
        })

        # QR-URL — deep link на /auth/qr/{token} в приложении
        # Клиент сам решает как формировать URL; дадим базовый формат
        qr_url = f"qr-login:{qr_token}"

        return QRInitResponse(
            qr_token=qr_token,
            qr_url=qr_url,
            expires_at=expires_at,
            status="pending",
        )

    @router.get("/login/qr/{qr_token}/status", response_model=QRStatusResponse)
    async def qr_status(qr_token: str):
        session = await db.auth_qr_sessions.find_one({"qr_token": qr_token})
        if not session:
            raise HTTPException(status_code=404, detail="QR-сессия не найдена")

        now = datetime.now(timezone.utc)
        expires_at = session.get("expires_at")
        # Привести к aware
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if session["status"] == "pending" and expires_at and now > expires_at:
            await db.auth_qr_sessions.update_one(
                {"qr_token": qr_token},
                {"$set": {"status": "expired"}},
            )
            return QRStatusResponse(status="expired", expires_at=expires_at)

        if session["status"] == "confirmed" and session.get("confirmed_uid"):
            user_doc = await db.users.find_one({"uid": session["confirmed_uid"]})
            if user_doc:
                token = create_jwt(
                    uid=user_doc["uid"],
                    telegram_id=user_doc.get("telegram_id"),
                    providers=user_doc.get("auth_providers", []),
                )
                # Удаляем сессию после отдачи (one-time)
                await db.auth_qr_sessions.update_one(
                    {"qr_token": qr_token},
                    {"$set": {"status": "consumed"}},
                )
                await _update_last_login(db, user_doc["uid"])
                return QRStatusResponse(
                    status="confirmed",
                    access_token=token,
                    user=_user_to_public(user_doc, include_email=True),
                    expires_at=expires_at,
                )

        return QRStatusResponse(status=session["status"], expires_at=expires_at)

    @router.post("/login/qr/{qr_token}/confirm")
    async def qr_confirm(
        qr_token: str,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Авторизованное устройство подтверждает QR-сессию."""
        session = await db.auth_qr_sessions.find_one({"qr_token": qr_token})
        if not session:
            raise HTTPException(status_code=404, detail="QR-сессия не найдена")

        now = datetime.now(timezone.utc)
        expires_at = session.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at and now > expires_at:
            raise HTTPException(status_code=410, detail="QR-сессия истекла")

        if session["status"] not in ("pending",):
            raise HTTPException(status_code=409, detail=f"QR-сессия уже в статусе {session['status']}")

        await db.auth_qr_sessions.update_one(
            {"qr_token": qr_token},
            {
                "$set": {
                    "status": "confirmed",
                    "confirmed_uid": current_user["sub"],
                    "confirmed_at": now,
                }
            },
        )
        return {"success": True, "message": "QR подтверждён"}

    # ============= /me =============

    @router.get("/me", response_model=UserPublic)
    async def me(current_user: Dict[str, Any] = Depends(get_current_user_required)):
        user_doc = await db.users.find_one({"uid": current_user["sub"]})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        return _user_to_public(user_doc, include_email=True)

    # ============= /logout =============

    @router.post("/logout")
    async def logout(current_user: Dict[str, Any] = Depends(get_current_user_required)):
        """Logout — клиент просто удаляет JWT. Опционально можно добавить blacklist."""
        return {"success": True, "message": "Logged out. Delete the token on client side."}

    # ============= Link additional provider =============

    @router.post("/link/email")
    async def link_email(
        req: RegisterEmailRequest,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Привязать email+пароль к существующему аккаунту."""
        user_doc = await db.users.find_one({"uid": current_user["sub"]})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        if user_doc.get("email"):
            raise HTTPException(status_code=409, detail="Email уже привязан")

        email_norm = req.email.strip().lower()
        existing = await db.users.find_one({"email": email_norm})
        if existing:
            raise HTTPException(status_code=409, detail="Email уже занят")

        try:
            password_hash = hash_password(req.password)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        await db.users.update_one(
            {"uid": user_doc["uid"]},
            {
                "$set": {
                    "email": email_norm,
                    "password_hash": password_hash,
                    "updated_at": datetime.now(timezone.utc),
                },
                "$addToSet": {"auth_providers": "email"},
            },
        )
        return {"success": True, "message": "Email привязан"}

    # ============= Username check =============

    @router.get("/check-username/{username}", response_model=UsernameCheckResponse)
    async def check_username(
        username: str,
        current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    ):
        username_norm = username.strip().lower()

        if len(username_norm) < 3 or len(username_norm) > 32:
            return UsernameCheckResponse(
                username=username, available=False, reason="Длина должна быть 3-32 символа"
            )

        import re
        if not re.match(r"^[a-zA-Z0-9_]+$", username_norm):
            return UsernameCheckResponse(
                username=username, available=False, reason="Только a-z, 0-9, _"
            )

        if username_norm in RESERVED_USERNAMES:
            return UsernameCheckResponse(username=username, available=False, reason="Зарезервировано")

        # Case-insensitive check: ищем регистронезависимо
        query = {"username": {"$regex": f"^{re.escape(username_norm)}$", "$options": "i"}}
        if current_user:
            # Собственный username — считается доступным
            query["uid"] = {"$ne": current_user["sub"]}

        existing = await db.users.find_one(query, {"_id": 1})
        if existing:
            return UsernameCheckResponse(username=username, available=False, reason="Занято")

        return UsernameCheckResponse(username=username, available=True)

    # ============= Profile step (регистрационный визард) =============

    @router.patch("/profile-step", response_model=UserPublic)
    async def update_profile_step(
        req: UpdateProfileStepRequest,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        user_doc = await db.users.find_one({"uid": current_user["sub"]})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        update_data = req.model_dump(exclude_unset=True, exclude_none=True)
        complete_step = update_data.pop("complete_step", None)

        if "username" in update_data:
            username = update_data["username"].strip().lower()
            if username in RESERVED_USERNAMES:
                raise HTTPException(status_code=400, detail="Username зарезервирован")
            # Уникальность
            import re
            dup = await db.users.find_one({
                "username": {"$regex": f"^{re.escape(username)}$", "$options": "i"},
                "uid": {"$ne": user_doc["uid"]},
            })
            if dup:
                raise HTTPException(status_code=409, detail="Username занят")
            update_data["username"] = username

        if not update_data and complete_step is None:
            return _user_to_public(user_doc, include_email=True)

        update_data["updated_at"] = datetime.now(timezone.utc)

        # Обновляем шаг регистрации
        if complete_step is not None:
            # complete_step = 3 → всё готово (step=0)
            # complete_step = 2 → перешли на шаг 3 (step=3)
            next_step = 3 if complete_step == 2 else (0 if complete_step >= 3 else complete_step + 1)
            update_data["registration_step"] = next_step

        try:
            await db.users.update_one(
                {"uid": user_doc["uid"]},
                {"$set": update_data},
            )
        except DuplicateKeyError:
            raise HTTPException(status_code=409, detail="Username занят")

        # Синхронизация с user_settings (для обратной совместимости).
        # effective_tid = telegram_id если есть, иначе int(uid) — чтобы email/VK/QR
        # пользователи тоже имели user_settings-документ и фронтенд мог загружать
        # их настройки через legacy GET /api/user-settings/{id}.
        try:
            effective_tid = (
                int(user_doc["telegram_id"]) if user_doc.get("telegram_id") else int(user_doc["uid"])
            )
        except (TypeError, ValueError):
            effective_tid = None

        if effective_tid is not None:
            mirror = {k: v for k, v in update_data.items() if k in (
                "first_name", "last_name", "username",
                "facultet_id", "facultet_name", "level_id", "form_code",
                "kurs", "group_id", "group_name",
            )}
            if mirror:
                # upsert=True — создаём user_settings если его ещё нет
                mirror["uid"] = user_doc["uid"]
                await db.user_settings.update_one(
                    {"telegram_id": effective_tid},
                    {
                        "$set": mirror,
                        "$setOnInsert": {
                            "telegram_id": effective_tid,
                            "created_at": datetime.now(timezone.utc),
                        },
                    },
                    upsert=True,
                )

        updated = await db.users.find_one({"uid": user_doc["uid"]})
        return _user_to_public(updated, include_email=True)

    # ============= Public auth config =============

    @router.get("/config")
    async def auth_config():
        """Публичная конфигурация для frontend:
        - telegram_bot_username (для Telegram Login Widget)
        - vk_app_id (для VK ID OAuth)
        - vk_redirect_uri_default (ссылка на фронтовый VK callback)
        - env
        """
        return {
            "telegram_bot_username": get_telegram_bot_username(),
            "vk_app_id": VK_APP_ID,
            "vk_redirect_uri_default": VK_REDIRECT_URI,
            "env": ENV,
            "features": {
                "email_verification": False,
                "qr_login": True,
                "vk_login": bool(VK_APP_ID and VK_CLIENT_SECRET),
                "telegram_login": True,
            },
        }

    return router
