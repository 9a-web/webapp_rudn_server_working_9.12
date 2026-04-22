"""
Auth routes — регистрация/логин через Email, Telegram, VK, QR.

Экспортирует factory `create_auth_router(db)` → APIRouter с префиксом `/auth`.
Также экспортирует `migrate_user_settings_to_users(db)` для миграции при старте.

🔍 Stage 6 hardening (2026-04):
  - Использование `pseudo_tid_from_uid` для синхронизации с `user_settings`
    (значение вне диапазона реальных Telegram ID — нет коллизий).
  - Хелпер `_remap_user_settings_tid` — при привязке реального Telegram переносим
    данные из user_settings(pseudo_tid) → user_settings(real_tid) без потерь.
  - Хелпер `_vk_exchange_code` — устранён дубликат VK OAuth обмена.
  - Rate-limit на /login/email (IP + email).
  - Детерминированный выбор primary_auth по приоритету (email > telegram > vk).
  - QR session consumed-grace-period (30 сек) — устойчивость к потере ответа.
  - Auth-event log в `auth_events` коллекцию для security audit.
  - last_login_ip / last_login_ua сохраняются в user-документ.
"""

import logging
import hashlib  # Stage 7: B-15 — hash email в логах
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple, List

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request
from pymongo.errors import DuplicateKeyError

from auth_utils import (
    PROVIDERS,
    USERNAME_RESERVED as RESERVED_USERNAMES,
    check_rate_limit,
    choose_primary_auth,
    create_jwt,
    decode_jwt,
    effective_tid_for_user,
    generate_uid,
    get_client_ip,
    get_current_user_optional,
    get_current_user_required,
    hash_password,
    hash_token,
    is_real_telegram_user,
    is_session_active,
    list_user_sessions,
    new_secure_token,
    normalize_username,
    parse_device_label,
    pseudo_tid_from_uid,
    register_session,
    resolve_safe_username,
    revoke_all_sessions,
    revoke_session,
    touch_session,
    verify_password,
    verify_telegram_login_widget_hash,
    verify_telegram_webapp_init_data,
)
from config import (
    get_telegram_bot_token,  # noqa: F401  (используется в verify_*)
    get_telegram_bot_username,
    VK_APP_ID,
    VK_CLIENT_SECRET,
    VK_REDIRECT_URI,
    ENV,
    JWT_EXPIRE_DAYS,
)
from email_service import (
    send_email,
    template_password_reset,
    template_email_verification,
    template_password_changed,
    is_email_configured,
    PUBLIC_BASE_URL as EMAIL_PUBLIC_BASE_URL,
)
from models import (
    AuthTokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GenericSuccessResponse,
    LinkTelegramRequest,
    LinkTelegramWebAppRequest,
    LinkVKRequest,
    LoginEmailRequest,
    QRConfirmRequest,  # noqa: F401  (используется внутри QR flow)
    QRInitResponse,
    QRStatusResponse,
    RegisterEmailRequest,
    ResetPasswordRequest,
    SessionInfo,
    SessionsListResponse,
    TelegramLoginRequest,
    TelegramWebAppLoginRequest,
    VerifyEmailRequest,
    UpdateProfileStepRequest,
    User,  # noqa: F401  (документация модели)
    UserPublic,
    UsernameCheckResponse,
    VKLoginRequest,
)

logger = logging.getLogger(__name__)

# ========== Константы ==========
QR_SESSION_TTL_MINUTES = 5
QR_CONSUMED_GRACE_SECONDS = 30  # окно повторной отдачи токена при потере сети

# Карта переходов registration_step (вместо запутанной тернарной логики).
# Ключ: complete_step, который пользователь только что завершил.
# Значение: следующий step (0 = всё готово).
_STEP_TRANSITIONS: Dict[int, int] = {1: 2, 2: 3, 3: 0}

# Rate-limit конфигурация: bucket → (max_requests, window_sec)
# Stage 7: B-02 — расширенные buckets для hardening всех sensitive endpoints.
_RATE_LIMITS = {
    "register_email_ip": (5, 3600),      # 5 регистраций/час с IP
    "login_email_ip": (10, 300),         # 10 попыток/5 мин с IP
    "login_email_email": (20, 3600),     # 20 попыток/час на конкретный email

    # Stage 7: B-02 — новые buckets
    "login_telegram_ip": (30, 600),      # /login/telegram + /login/telegram-webapp
    "login_vk_ip":       (15, 600),
    "qr_init_ip":        (20, 600),      # 20 QR / IP / 10 мин
    "qr_init_ua":        (10, 600),      # 10 QR / UA / 10 мин (доп. сигнал)
    "qr_status_ip":      (300, 60),      # 5 polls/sec/IP
    "qr_confirm_uid":    (10, 600),      # 10 confirm / uid / 10 мин
    "link_provider_uid": (20, 3600),     # 20 link/unlink / uid / час
    "profile_step_uid":  (60, 600),      # 60 patch / uid / 10 мин
    "check_username_ip": (120, 60),      # 2 запроса/сек/IP
    "check_username_uid": (60, 60),      # для авторизованных

    # P2: password management
    "forgot_password_ip":    (5, 3600),   # 5 запросов/час с IP
    "forgot_password_email": (3, 3600),   # 3 запроса/час на email (анти-abuse)
    "reset_password_ip":     (10, 3600),  # 10 попыток reset/час с IP
    "change_password_uid":   (10, 3600),
    # P3: email verification
    "send_verify_uid":       (5, 3600),
    "verify_email_ip":       (20, 600),
}

# P2/P3: TTL токенов (минуты)
_PASSWORD_RESET_TTL_MIN = 30
_EMAIL_VERIFY_TTL_MIN = 24 * 60  # 24 часа


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
        photo_url=user_doc.get("photo_url"),
        auth_providers=user_doc.get("auth_providers", []),
        primary_auth=user_doc.get("primary_auth"),
        facultet_id=user_doc.get("facultet_id"),
        facultet_name=user_doc.get("facultet_name"),
        level_id=user_doc.get("level_id"),
        form_code=user_doc.get("form_code"),
        kurs=user_doc.get("kurs"),
        group_id=user_doc.get("group_id"),
        group_name=user_doc.get("group_name"),
        registration_step=user_doc.get("registration_step", 0),
        created_at=user_doc.get("created_at"),
        last_login_at=user_doc.get("last_login_at"),
    )


async def _log_auth_event(
    db,
    *,
    event_type: str,
    uid: Optional[str] = None,
    provider: Optional[str] = None,
    success: bool = True,
    request: Optional[Request] = None,
    extra: Optional[dict] = None,
) -> None:
    """Логирует событие авторизации в коллекцию auth_events (для security audit).

    Не блокирует основной flow — ошибки записи поглощаются.

    Stage 7: B-15 + B-22:
      - email в extra хешируется (PII-безопасность)
      - extra ограничивается 2KB JSON (чтобы атакующий не раздул коллекцию)
    """
    try:
        doc = {
            "id": str(uuid.uuid4()),
            "event": event_type,
            "uid": uid,
            "provider": provider,
            "success": success,
            "ts": datetime.now(timezone.utc),
        }
        if request is not None:
            doc["ip"] = get_client_ip(request)
            doc["ua"] = request.headers.get("User-Agent", "")[:500]
        if extra:
            # Stage 7: B-15 — безопасный хэш email (не храним PII в логах)
            sanitized: Dict[str, Any] = {}
            for k, v in extra.items():
                if k == "email" and isinstance(v, str):
                    sanitized["email_hash"] = hashlib.sha256(
                        v.strip().lower().encode("utf-8")
                    ).hexdigest()[:16]
                else:
                    sanitized[k] = v
            # Stage 7: B-22 — сериализуем и обрезаем до 2KB
            try:
                import json as _json
                payload = _json.dumps(sanitized, default=str, ensure_ascii=False)
                if len(payload) > 2048:
                    sanitized = {"_truncated": True, "size": len(payload)}
            except Exception:
                sanitized = {"_truncated": True}
            doc["extra"] = sanitized
        await db.auth_events.insert_one(doc)
    except Exception as e:  # noqa: BLE001
        logger.debug(f"_log_auth_event suppressed error: {e}")


async def _remap_user_settings_tid(
    db,
    uid: str,
    old_tid: Optional[int],
    new_tid: int,
) -> None:
    """Переносит документ user_settings со старого telegram_id на новый.

    Сценарий: email/VK-юзер привязал реальный Telegram. У него был
    `user_settings.telegram_id = pseudo_tid` — теперь нужно перенести данные
    в `user_settings.telegram_id = real_tid`, чтобы legacy-endpoints
    (`/api/profile/{telegram_id}/*`, `/api/user-settings/{id}`) работали.

    Корректно обрабатывает edge-cases:
      - Если old_tid == new_tid → no-op.
      - Если уже есть документ с new_tid (Telegram-юзер ранее логинился) → merge.
      - Если old_doc нет → просто проставляем uid в new_doc (если он есть).
    """
    if not new_tid:
        return
    try:
        new_tid_int = int(new_tid)
    except (TypeError, ValueError):
        return
    if old_tid is not None:
        try:
            old_tid_int = int(old_tid)
        except (TypeError, ValueError):
            old_tid_int = None
    else:
        old_tid_int = None

    if old_tid_int == new_tid_int:
        return

    # 1) Получаем старый и новый документы
    old_doc = (
        await db.user_settings.find_one({"telegram_id": old_tid_int})
        if old_tid_int is not None else None
    )
    new_doc = await db.user_settings.find_one({"telegram_id": new_tid_int})

    if not old_doc and not new_doc:
        # Нечего мигрировать — создадим минимальный stub под новый tid.
        try:
            await db.user_settings.insert_one({
                "telegram_id": new_tid_int,
                "uid": uid,
                "created_at": datetime.now(timezone.utc),
            })
        except DuplicateKeyError:
            pass
        return

    if old_doc and not new_doc:
        # Простой случай: переименовываем telegram_id у старого документа.
        try:
            await db.user_settings.update_one(
                {"telegram_id": old_tid_int},
                {"$set": {"telegram_id": new_tid_int, "uid": uid}},
            )
            logger.info(
                f"📦 user_settings remap: uid={uid} telegram_id {old_tid_int} → {new_tid_int}"
            )
        except DuplicateKeyError:
            # Race — на новый tid кто-то уже записал. Падаем в merge-ветку.
            new_doc = await db.user_settings.find_one({"telegram_id": new_tid_int})
        else:
            return

    # Merge: old_doc + new_doc (new_doc приоритетнее, кроме незаполненных полей)
    merged: Dict[str, Any] = {"uid": uid}
    if old_doc:
        for k, v in old_doc.items():
            if k in ("_id", "telegram_id", "uid"):
                continue
            if v is None or v == "":
                continue
            # Не перезаписываем уже заполненные поля в new_doc
            if new_doc and new_doc.get(k):
                continue
            merged[k] = v

    await db.user_settings.update_one(
        {"telegram_id": new_tid_int},
        {"$set": merged},
        upsert=True,
    )
    # Удаляем старый stub, если он существовал
    if old_doc and old_tid_int is not None:
        try:
            await db.user_settings.delete_one({"telegram_id": old_tid_int})
        except Exception:  # noqa: BLE001
            pass

    logger.info(
        f"📦 user_settings merge-remap: uid={uid} telegram_id {old_tid_int} → {new_tid_int}"
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
    photo_url: Optional[str] = None,
    primary_auth: str,
    registration_step: int = 2,
) -> dict:
    """Создаёт новый `users` документ с уникальным UID. Возвращает вставленный doc.

    Параллельно создаёт зеркальный документ в `user_settings` (для совместимости
    с legacy-endpoints). Если реального `telegram_id` нет — используется
    pseudo-tid (10^10 + uid), который гарантированно вне диапазона Telegram ID.
    """
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
        "photo_url": photo_url,
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
        # Stage 7: B-04 — Race recovery. При параллельных логинах через
        # Telegram/VK второй запрос может получить DuplicateKeyError по
        # telegram_id/vk_id/email. В этом случае возвращаем уже созданный doc
        # (вместо 409), чтобы клиент прозрачно залогинился.
        pattern = (getattr(e, "details", None) or {}).get("keyPattern", {}) or {}
        if "telegram_id" in pattern and telegram_id:
            existing = await db.users.find_one({"telegram_id": telegram_id})
            if existing:
                logger.info(f"⚡ Race recovered: telegram_id={telegram_id} → uid={existing['uid']}")
                existing["_race_recovered"] = True
                return existing
        if "vk_id" in pattern and vk_id:
            existing = await db.users.find_one({"vk_id": vk_id})
            if existing:
                logger.info(f"⚡ Race recovered: vk_id={vk_id} → uid={existing['uid']}")
                existing["_race_recovered"] = True
                return existing
        if "email" in pattern and email:
            # Для email-регистрации race — это валидный 409 "email занят"
            # (пользователь, возможно, намеренно нажал регистрацию ещё раз).
            # Но если это происходит в рамках link/telegram/vk — пропустить.
            # Поэтому всегда пробрасываем 409 для email.
            logger.warning(f"Duplicate email on user create: {email}")
            raise HTTPException(
                status_code=409,
                detail="Пользователь с таким email уже существует",
            )
        # Не race по нашим ключам — настоящий конфликт (uid?)
        logger.warning(f"Duplicate key on user create (no race recovery): {e}")
        raise HTTPException(
            status_code=409,
            detail="Такой пользователь уже существует (конфликт email/telegram_id/vk_id/uid)",
        )

    # Зеркало в user_settings — реальный tid если есть, иначе pseudo-tid.
    effective_tid = int(telegram_id) if telegram_id else pseudo_tid_from_uid(uid)
    try:
        await db.user_settings.update_one(
            {"telegram_id": effective_tid},
            {
                "$setOnInsert": {
                    "telegram_id": effective_tid,
                    "created_at": now,
                },
                "$set": {
                    "uid": uid,
                    "first_name": first_name,
                    "last_name": last_name,
                    "username": username,
                },
            },
            upsert=True,
        )
    except DuplicateKeyError as e:
        # Не должно случаться (pseudo_tid детерминированный по uid, а uid уникален),
        # но логируем — это сигнал об инконсистентности.
        logger.error(
            f"user_settings upsert collision for uid={uid} effective_tid={effective_tid}: {e}"
        )

    logger.info(
        f"✅ New user created: uid={uid} primary_auth={primary_auth} "
        f"effective_tid={effective_tid}"
    )
    return doc


async def _update_last_login(
    db,
    uid: str,
    request: Optional[Request] = None,
) -> None:
    """Обновляет last_login_at + опционально last_login_ip/last_login_ua."""
    now = datetime.now(timezone.utc)
    update: Dict[str, Any] = {"last_login_at": now, "updated_at": now}
    if request is not None:
        update["last_login_ip"] = get_client_ip(request)
        update["last_login_ua"] = request.headers.get("User-Agent", "")[:500]
    await db.users.update_one({"uid": uid}, {"$set": update})


# ==================== P4: REFERRAL INTEGRATION ====================

async def _process_referral_for_new_user(
    db,
    *,
    referral_code: Optional[str],
    user_doc: dict,
    request: Optional[Request] = None,
) -> None:
    """🔗 P4: Обрабатывает `referral_code` при создании нового пользователя.

    Связывает нового юзера с рефером, создаёт `referral_events` и начисляет
    бонусы (до 3 уровней в цепочке). Идемпотентна, fail-soft — не падает на
    ошибках, только логирует (чтобы не ломать регистрацию).
    """
    if not referral_code:
        return
    code = str(referral_code).strip().upper()
    if len(code) < 4:
        return
    try:
        # Ищем реферера по коду в user_settings (legacy, но единственный источник).
        referrer = await db.user_settings.find_one(
            {"referral_code": code},
            {"telegram_id": 1, "first_name": 1, "username": 1, "uid": 1, "_id": 0},
        )
        if not referrer:
            logger.info(f"🔗 Referral code not found: {code}")
            return

        referrer_tid = referrer.get("telegram_id")
        new_tid = user_doc.get("telegram_id") or pseudo_tid_from_uid(user_doc["uid"])
        if referrer_tid == new_tid:
            logger.info(f"🔗 Self-referral ignored: {code}")
            return

        # Не позволяем перепривязать если у юзера уже есть referred_by
        existing_us = await db.user_settings.find_one(
            {"telegram_id": new_tid},
            {"referred_by": 1, "referral_code": 1, "_id": 0},
        )
        if existing_us and existing_us.get("referred_by"):
            logger.info(f"🔗 User already has referrer: uid={user_doc['uid']}")
            return

        # Проставляем referred_by + генерим собственный referral_code (если нет)
        from server import generate_referral_code, create_referral_connections, award_referral_bonus
        new_referral_code = (existing_us or {}).get("referral_code") or generate_referral_code(new_tid)
        await db.user_settings.update_one(
            {"telegram_id": new_tid},
            {
                "$set": {
                    "referred_by": referrer_tid,
                    "referral_code": new_referral_code,
                    "referral_processed_at": datetime.now(timezone.utc),
                },
                "$setOnInsert": {"invited_count": 0, "referral_points_earned": 0},
            },
            upsert=True,
        )
        # Создаём цепочку связей (до 3 уровней) и начисляем бонусы
        try:
            await create_referral_connections(new_tid, referrer_tid, db)
        except Exception as e:
            logger.warning(f"create_referral_connections failed: {e}")
        try:
            await award_referral_bonus(referrer_tid, new_tid, 50, 1, db)
        except Exception as e:
            logger.warning(f"award_referral_bonus failed: {e}")

        # Инкременты счётчиков
        await db.user_settings.update_one(
            {"telegram_id": referrer_tid},
            {"$inc": {"invited_count": 1}},
        )
        await _log_auth_event(
            db, event_type="referral_processed", uid=user_doc["uid"],
            request=request, success=True,
            extra={"referral_code": code, "referrer_tid": referrer_tid},
        )
        logger.info(
            f"🔗 Referral linked: new uid={user_doc['uid']} (tid={new_tid}) ← "
            f"referrer tid={referrer_tid} via code={code}"
        )
    except Exception as e:
        logger.warning(f"_process_referral_for_new_user failed: {e}", exc_info=True)


async def _issue_token(
    db,
    user_doc: dict,
    *,
    is_new: bool = False,
    suggested_username_taken: Optional[str] = None,
    request: Optional[Request] = None,
    provider: Optional[str] = None,
) -> AuthTokenResponse:
    """Генерирует JWT для пользователя и возвращает AuthTokenResponse.

    🐛 BUG-FIX (2026-04): раньше в JWT писался только реальный `telegram_id`,
    поэтому для VK/Email-юзеров (у которых telegram_id=None) поле `tid`
    отсутствовало вовсе. Это ломало все legacy `/profile/*` endpoints
    (аватар, граффити, activity-ping и т.п.), потому что они проверяют
    `current_user.tid` против pseudo_tid из URL. Теперь в JWT всегда кладём
    `effective_tid` — реальный TG-ID если привязан, иначе pseudo_tid (10^10+uid),
    что совпадает с тем, как фронтенд формирует `user.id` в App.jsx.

    🔐 P4 (sessions): регистрируем сессию в `auth_sessions` для
    управления устройствами (GET/DELETE /auth/sessions).
    """
    import secrets as _secrets
    jti = _secrets.token_urlsafe(12)
    now = datetime.now(timezone.utc)
    from config import JWT_EXPIRE_DAYS as _EXP_DAYS
    expires_at = now + timedelta(days=_EXP_DAYS)

    token = create_jwt(
        uid=user_doc["uid"],
        telegram_id=effective_tid_for_user(user_doc),
        providers=user_doc.get("auth_providers", []),
        jti=jti,
    )
    # Регистрируем сессию (best-effort, не блокирует выдачу токена)
    await register_session(
        db, uid=user_doc["uid"], jti=jti, expires_at=expires_at,
        request=request, provider=provider or user_doc.get("primary_auth"),
    )
    if not is_new:
        await _update_last_login(db, user_doc["uid"], request=request)

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=_user_to_public(user_doc, include_email=True),
        is_new_user=is_new,
        suggested_username_taken=suggested_username_taken,
    )


# ----- VK OAuth helper (общий для login/vk и link/vk) -----


async def _vk_exchange_code(
    *,
    code: str,
    redirect_uri: str,
    device_id: Optional[str] = None,
    code_verifier: Optional[str] = None,
    state: Optional[str] = None,
) -> Tuple[str, str, dict]:
    """Обменивает VK OAuth code на access_token + получает профиль.

    Возвращает: (access_token, vk_user_id_str, vk_profile_dict)

    Raises:
        HTTPException(401) — VK не вернул токен (просрочен code, неверные параметры).
        HTTPException(502) — не удалось связаться с VK API.
    """
    token_data: Dict[str, Any] = {}

    # Попытка 1: новый VK ID endpoint
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://id.vk.com/oauth2/auth",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": VK_APP_ID,
                    "client_secret": VK_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "device_id": device_id or "",
                    "code_verifier": code_verifier or "",
                    "state": state or "",
                },
            )
            token_data = resp.json() or {}
    except Exception as e:  # noqa: BLE001
        logger.warning(f"VK ID endpoint failed: {e} — fallback to legacy")

    # Попытка 2: legacy oauth.vk.com
    if "access_token" not in token_data:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                legacy_resp = await client.get(
                    "https://oauth.vk.com/access_token",
                    params={
                        "client_id": VK_APP_ID,
                        "client_secret": VK_CLIENT_SECRET,
                        "redirect_uri": redirect_uri,
                        "code": code,
                    },
                )
                token_data = legacy_resp.json() or {}
        except Exception as e:  # noqa: BLE001
            logger.error(f"VK legacy endpoint failed: {e}")
            raise HTTPException(status_code=502, detail=f"Ошибка связи с VK: {e}")

    access_token = token_data.get("access_token")
    vk_user_id = token_data.get("user_id")

    if not access_token or not vk_user_id:
        err = token_data.get("error_description") or token_data.get("error") or "unknown"
        raise HTTPException(status_code=401, detail=f"VK не вернул токен: {err}")

    # Получаем профиль
    vk_profile: Dict[str, Any] = {}
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
            prof = prof_resp.json() or {}
            if "response" in prof and prof["response"]:
                vk_profile = prof["response"][0]
    except Exception as e:  # noqa: BLE001
        logger.warning(f"VK users.get error: {e}")

    return access_token, str(vk_user_id), vk_profile


# ========== Миграция ==========


async def migrate_user_settings_to_users(db) -> Dict[str, int]:
    """Миграция: для всех `user_settings` без uid — создаём `users` запись.

    Идемпотентна. Корректно обрабатывает дубли как по username, так и по
    другим уникальным ключам (через анализ keyPattern).
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
                await db.user_settings.update_one(
                    {"telegram_id": tg_id},
                    {"$set": {"uid": existing["uid"]}},
                )
                updated += 1
                continue

            uid = await generate_uid(db)
            now = datetime.now(timezone.utc)
            # 🐛 P1-FIX: нормализуем username при миграции, чтобы избежать
            # регистрозависимых дубликатов и гарантировать работу unique index.
            raw_username = settings_doc.get("username")
            normalized_username = None
            if raw_username:
                try:
                    normalized_username = normalize_username(raw_username)
                except ValueError:
                    normalized_username = None  # некорректный — оставляем пустым
            new_doc = {
                "id": str(uuid.uuid4()),
                "uid": uid,
                "username": normalized_username,
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
                "registration_step": 0,
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
            except DuplicateKeyError as dup_err:
                # Анализируем причину дубликата.
                pattern = (getattr(dup_err, "details", None) or {}).get("keyPattern", {}) or {}
                if "username" in pattern:
                    new_doc["username"] = None
                    try:
                        await db.users.insert_one(new_doc)
                        created += 1
                    except DuplicateKeyError as second_err:
                        logger.warning(
                            f"Migration: still duplicate after username clear "
                            f"telegram_id={tg_id}: {second_err}"
                        )
                        errors += 1
                        continue
                elif "telegram_id" in pattern:
                    # Другой документ users уже забрал этот tg_id (race)
                    other = await db.users.find_one({"telegram_id": tg_id}, {"uid": 1})
                    if other and other.get("uid"):
                        await db.user_settings.update_one(
                            {"telegram_id": tg_id},
                            {"$set": {"uid": other["uid"]}},
                        )
                        updated += 1
                    else:
                        errors += 1
                    continue
                else:
                    logger.warning(
                        f"Migration: unknown duplicate key for telegram_id={tg_id}: {pattern}"
                    )
                    errors += 1
                    continue

            await db.user_settings.update_one(
                {"telegram_id": tg_id},
                {"$set": {"uid": uid}},
            )

        except Exception as e:  # noqa: BLE001
            errors += 1
            logger.warning(f"Migration error for telegram_id={tg_id}: {e}")

    result = {"created": created, "updated": updated, "errors": errors}
    if created or updated:
        logger.info(f"✅ user_settings → users migration: {result}")
    return result


async def migrate_usernames_to_lowercase(db) -> Dict[str, int]:
    """🐛 P1: Приводит все username к lowercase (идемпотентно).

    Цель — убрать регистрозависимые дубликаты, чтобы unique-индекс
    `users.username` гарантированно работал, а `check_username` не
    зависел от регистра.

    Корректно обрабатывает коллизии (если `Alice` и `alice` обе существуют —
    оставляем lowercase-версию, конфликтующую обнуляем в None, чтобы
    пользователь выбрал новый при следующем входе).
    """
    changed = 0
    nulled = 0
    errors = 0

    # Найти все users с username в верхнем регистре (отличающимся от .lower())
    # Используем aggregation-проекцию на клиенте, т.к. Mongo нет easy lowercase filter
    cursor = db.users.find(
        {"username": {"$exists": True, "$ne": None, "$type": "string"}},
        {"uid": 1, "username": 1},
    )

    async for doc in cursor:
        uid = doc.get("uid")
        u = doc.get("username")
        if not isinstance(u, str) or not u:
            continue
        low = u.lower().strip()
        if low == u:
            continue  # уже lowercase
        try:
            await db.users.update_one({"uid": uid}, {"$set": {"username": low}})
            changed += 1
        except DuplicateKeyError:
            # Коллизия с другим lowercase username — обнуляем, заставим выбрать новый
            try:
                await db.users.update_one(
                    {"uid": uid},
                    {"$set": {"username": None, "registration_step": 2,
                              "updated_at": datetime.now(timezone.utc)}},
                )
                nulled += 1
                logger.warning(
                    f"⚠️ Username lowercase collision — cleared for uid={uid} (was '{u}')"
                )
            except Exception as e2:
                errors += 1
                logger.error(f"Failed to clear conflicting username uid={uid}: {e2}")
        except Exception as e:
            errors += 1
            logger.error(f"Failed to lowercase username uid={uid}: {e}")

    res = {"changed": changed, "nulled": nulled, "errors": errors}
    if changed or nulled:
        logger.info(f"✅ username lowercase migration: {res}")
    return res


# ========== Router factory ==========


def create_auth_router(db) -> APIRouter:
    """Создаёт и возвращает APIRouter с auth endpoints."""
    router = APIRouter(prefix="/auth", tags=["auth"])

    # ============= REGISTER (email) =============

    @router.post("/register/email", response_model=AuthTokenResponse)
    async def register_email(req: RegisterEmailRequest, request: Request):
        """Шаг 1 регистрации через email/пароль."""
        client_ip = get_client_ip(request)
        max_req, window = _RATE_LIMITS["register_email_ip"]
        if not check_rate_limit(client_ip, "register_email_ip", max_req, window):
            await _log_auth_event(
                db, event_type="register_email", success=False, request=request,
                extra={"reason": "rate_limited"},
            )
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
            registration_step=2,
        )

        # 🔗 P4: Обработка referral_code (если передан)
        await _process_referral_for_new_user(
            db, referral_code=req.referral_code, user_doc=user_doc, request=request,
        )

        await _log_auth_event(
            db, event_type="register_email", uid=user_doc["uid"],
            provider="email", success=True, request=request,
        )
        return await _issue_token(db, user_doc, is_new=True, request=request, provider="email")

    # ============= LOGIN (email) =============

    @router.post("/login/email", response_model=AuthTokenResponse)
    async def login_email(req: LoginEmailRequest, request: Request):
        client_ip = get_client_ip(request)
        email_norm = req.email.strip().lower()

        # Rate-limit двойной: per-IP и per-email — защита от brute-force
        ip_max, ip_window = _RATE_LIMITS["login_email_ip"]
        em_max, em_window = _RATE_LIMITS["login_email_email"]
        if not check_rate_limit(client_ip, "login_email_ip", ip_max, ip_window):
            await _log_auth_event(
                db, event_type="login_email", success=False, request=request,
                extra={"reason": "rate_limited_ip", "email": email_norm},
            )
            raise HTTPException(
                status_code=429,
                detail="Слишком много попыток входа с этого IP. Попробуйте позже.",
            )
        if not check_rate_limit(email_norm, "login_email_email", em_max, em_window):
            await _log_auth_event(
                db, event_type="login_email", success=False, request=request,
                extra={"reason": "rate_limited_email", "email": email_norm},
            )
            raise HTTPException(
                status_code=429,
                detail="Слишком много попыток для этого email. Попробуйте позже.",
            )

        user_doc = await db.users.find_one({"email": email_norm})
        if not user_doc or not user_doc.get("password_hash"):
            await _log_auth_event(
                db, event_type="login_email", success=False, request=request,
                extra={"reason": "no_user", "email": email_norm},
            )
            raise HTTPException(status_code=401, detail="Неверный email или пароль")

        if not user_doc.get("is_active", True):
            await _log_auth_event(
                db, event_type="login_email", uid=user_doc["uid"],
                success=False, request=request, extra={"reason": "inactive"},
            )
            raise HTTPException(status_code=403, detail="Аккаунт деактивирован")

        if not verify_password(req.password, user_doc["password_hash"]):
            await _log_auth_event(
                db, event_type="login_email", uid=user_doc["uid"],
                success=False, request=request, extra={"reason": "wrong_password"},
            )
            raise HTTPException(status_code=401, detail="Неверный email или пароль")

        await _log_auth_event(
            db, event_type="login_email", uid=user_doc["uid"],
            provider="email", success=True, request=request,
        )
        return await _issue_token(db, user_doc, is_new=False, request=request)

    # ============= LOGIN (Telegram Login Widget) =============

    @router.post("/login/telegram", response_model=AuthTokenResponse)
    async def login_telegram(req: TelegramLoginRequest, request: Request):
        """Логин через Telegram Login Widget (веб-сайт вне Telegram).

        🔐 Аутентификация СТРОГО по `telegram_id`. Никакой авто-линковки по
        `username` — это уязвимость. Линковать Telegram к существующему
        email/VK-аккаунту можно только явно через POST /api/auth/link/telegram.
        """
        # Stage 7: B-02 — rate limit по IP
        client_ip = get_client_ip(request)
        rl_max, rl_win = _RATE_LIMITS["login_telegram_ip"]
        if not check_rate_limit(client_ip, "login_telegram_ip", rl_max, rl_win):
            await _log_auth_event(
                db, event_type="login_telegram", success=False, request=request,
                extra={"reason": "rate_limited_ip"},
            )
            raise HTTPException(
                status_code=429,
                detail="Слишком много попыток. Попробуйте позже.",
            )

        data = req.model_dump(exclude={"referral_code"}, exclude_none=True)

        if not verify_telegram_login_widget_hash(data):
            await _log_auth_event(
                db, event_type="login_telegram", success=False, request=request,
                extra={"reason": "bad_hash"},
            )
            raise HTTPException(status_code=401, detail="Невалидная подпись Telegram")

        tg_id = req.id
        now = datetime.now(timezone.utc)
        existing = await db.users.find_one({"telegram_id": tg_id})

        if existing:
            update_fields: Dict[str, Any] = {"updated_at": now, "last_login_at": now}
            if req.first_name and not existing.get("first_name"):
                update_fields["first_name"] = req.first_name
            if req.last_name and not existing.get("last_name"):
                update_fields["last_name"] = req.last_name

            # Обновляем photo_url из Telegram — свежий URL с каждого логина
            # (только если юзер не проставил свой кастомный).
            if req.photo_url and not existing.get("photo_url_custom"):
                update_fields["photo_url"] = req.photo_url

            # Username — пытаемся проставить если у user'а его нет
            conflict_for_existing: Optional[str] = None
            if req.username and not existing.get("username"):
                safe_username, conflict_for_existing = await resolve_safe_username(
                    db, req.username, exclude_uid=existing["uid"]
                )
                if safe_username:
                    update_fields["username"] = safe_username
                    conflict_for_existing = None  # успешно поставили — нет конфликта

            await db.users.update_one(
                {"uid": existing["uid"]},
                {
                    "$set": update_fields,
                    "$addToSet": {"auth_providers": "telegram"},
                },
            )
            user_doc = await db.users.find_one({"uid": existing["uid"]})
            await _log_auth_event(
                db, event_type="login_telegram", uid=user_doc["uid"],
                provider="telegram", success=True, request=request,
            )
            return await _issue_token(
                db, user_doc, is_new=False,
                suggested_username_taken=conflict_for_existing,
                request=request,
            )

        # Новый пользователь
        safe_username, conflict = await resolve_safe_username(db, req.username)
        if conflict:
            logger.info(
                f"ℹ️ Telegram username '@{req.username}' занят. "
                f"Создаём новый аккаунт tg_id={tg_id} БЕЗ username."
            )

        user_doc = await _create_new_user(
            db,
            telegram_id=tg_id,
            first_name=req.first_name,
            last_name=req.last_name,
            username=safe_username,
            photo_url=req.photo_url,
            primary_auth="telegram",
            registration_step=2,
        )

        # 🔗 P4: Обработка referral_code
        await _process_referral_for_new_user(
            db, referral_code=req.referral_code, user_doc=user_doc, request=request,
        )

        await _log_auth_event(
            db, event_type="register_telegram", uid=user_doc["uid"],
            provider="telegram", success=True, request=request,
        )
        return await _issue_token(
            db, user_doc, is_new=True,
            suggested_username_taken=conflict, request=request, provider="telegram",
        )

    # ============= LOGIN (Telegram WebApp initData) =============

    @router.post("/login/telegram-webapp", response_model=AuthTokenResponse)
    async def login_telegram_webapp(req: TelegramWebAppLoginRequest, request: Request):
        """Логин через Telegram WebApp — пользователь уже в боте, верифицируем initData.

        🔐 Аналогично /login/telegram: аутентификация по telegram_id. Auto-link
        по username запрещён (см. подробности в коде /login/telegram).
        """
        # Stage 7: B-02 — rate limit по IP (общий с login_telegram)
        client_ip = get_client_ip(request)
        rl_max, rl_win = _RATE_LIMITS["login_telegram_ip"]
        if not check_rate_limit(client_ip, "login_telegram_ip", rl_max, rl_win):
            await _log_auth_event(
                db, event_type="login_telegram_webapp", success=False,
                request=request, extra={"reason": "rate_limited_ip"},
            )
            raise HTTPException(
                status_code=429,
                detail="Слишком много попыток. Попробуйте позже.",
            )

        parsed = verify_telegram_webapp_init_data(req.init_data)
        if not parsed or not parsed.get("user"):
            await _log_auth_event(
                db, event_type="login_telegram_webapp", success=False,
                request=request, extra={"reason": "bad_initdata"},
            )
            raise HTTPException(status_code=401, detail="Невалидные данные Telegram WebApp")

        tg_user = parsed["user"]
        tg_id = tg_user.get("id")
        if not tg_id:
            raise HTTPException(status_code=400, detail="user.id отсутствует в initData")

        now = datetime.now(timezone.utc)
        existing = await db.users.find_one({"telegram_id": tg_id})

        tg_username = tg_user.get("username")
        tg_first = tg_user.get("first_name")
        tg_last = tg_user.get("last_name")
        tg_photo = tg_user.get("photo_url")

        if existing:
            update_fields: Dict[str, Any] = {"updated_at": now, "last_login_at": now}
            if tg_first and not existing.get("first_name"):
                update_fields["first_name"] = tg_first
            if tg_last and not existing.get("last_name"):
                update_fields["last_name"] = tg_last
            if tg_photo and not existing.get("photo_url_custom"):
                update_fields["photo_url"] = tg_photo

            conflict_for_existing: Optional[str] = None
            if tg_username and not existing.get("username"):
                safe_username, conflict_for_existing = await resolve_safe_username(
                    db, tg_username, exclude_uid=existing["uid"]
                )
                if safe_username:
                    update_fields["username"] = safe_username
                    conflict_for_existing = None

            await db.users.update_one(
                {"uid": existing["uid"]},
                {
                    "$set": update_fields,
                    "$addToSet": {"auth_providers": "telegram"},
                },
            )
            user_doc = await db.users.find_one({"uid": existing["uid"]})
            await _log_auth_event(
                db, event_type="login_telegram_webapp", uid=user_doc["uid"],
                provider="telegram", success=True, request=request,
            )
            return await _issue_token(
                db, user_doc, is_new=False,
                suggested_username_taken=conflict_for_existing,
                request=request,
            )

        # Новый аккаунт
        safe_username, conflict = await resolve_safe_username(db, tg_username)
        if conflict:
            logger.info(
                f"ℹ️ Telegram username '@{tg_username}' занят другим пользователем. "
                f"Создаём новый аккаунт для tg_id={tg_id} БЕЗ username."
            )

        user_doc = await _create_new_user(
            db,
            telegram_id=tg_id,
            first_name=tg_first,
            last_name=tg_last,
            username=safe_username,
            photo_url=tg_photo,
            primary_auth="telegram",
            registration_step=2,
        )

        # 🔗 P4: Обработка referral_code
        await _process_referral_for_new_user(
            db, referral_code=req.referral_code, user_doc=user_doc, request=request,
        )

        await _log_auth_event(
            db, event_type="register_telegram_webapp", uid=user_doc["uid"],
            provider="telegram", success=True, request=request,
        )
        return await _issue_token(
            db, user_doc, is_new=True,
            suggested_username_taken=conflict, request=request, provider="telegram",
        )

    # ============= LOGIN (VK ID OAuth) =============

    @router.post("/login/vk", response_model=AuthTokenResponse)
    async def login_vk(req: VKLoginRequest, request: Request):
        """VK OAuth — обмен code → access_token → данные профиля."""
        # Stage 7: B-02 — rate limit по IP
        client_ip = get_client_ip(request)
        rl_max, rl_win = _RATE_LIMITS["login_vk_ip"]
        if not check_rate_limit(client_ip, "login_vk_ip", rl_max, rl_win):
            await _log_auth_event(
                db, event_type="login_vk", success=False, request=request,
                extra={"reason": "rate_limited_ip"},
            )
            raise HTTPException(
                status_code=429,
                detail="Слишком много попыток. Попробуйте позже.",
            )

        if not VK_APP_ID or not VK_CLIENT_SECRET:
            raise HTTPException(status_code=500, detail="VK OAuth не сконфигурирован")

        redirect_uri = req.redirect_uri or VK_REDIRECT_URI
        if not redirect_uri:
            raise HTTPException(status_code=400, detail="redirect_uri обязателен")

        try:
            _access_token, vk_id_str, vk_profile = await _vk_exchange_code(
                code=req.code,
                redirect_uri=redirect_uri,
                device_id=req.device_id,
                code_verifier=req.code_verifier,
                state=req.state,
            )
        except HTTPException:
            await _log_auth_event(
                db, event_type="login_vk", success=False, request=request,
                extra={"reason": "vk_exchange_failed"},
            )
            raise

        existing = await db.users.find_one({"vk_id": vk_id_str})
        is_new = False
        conflict_username: Optional[str] = None
        now = datetime.now(timezone.utc)

        if existing:
            update_fields: Dict[str, Any] = {"last_login_at": now, "updated_at": now}
            if vk_profile.get("first_name") and not existing.get("first_name"):
                update_fields["first_name"] = vk_profile["first_name"]
            if vk_profile.get("last_name") and not existing.get("last_name"):
                update_fields["last_name"] = vk_profile["last_name"]

            # Обновляем photo_url из VK (VK часто меняет URL — перетираем всегда,
            # если VK вернул свежий URL; но только если юзер не проставил свой вручную).
            vk_photo = vk_profile.get("photo_200")
            if vk_photo and not existing.get("photo_url_custom"):
                update_fields["photo_url"] = vk_photo

            # Аналогично Telegram — пытаемся проставить username, если у user'а его нет
            if vk_profile.get("screen_name") and not existing.get("username"):
                safe_username, conflict_username = await resolve_safe_username(
                    db, vk_profile.get("screen_name"), exclude_uid=existing["uid"]
                )
                if safe_username:
                    update_fields["username"] = safe_username
                    conflict_username = None

            await db.users.update_one(
                {"uid": existing["uid"]},
                {
                    "$set": update_fields,
                    "$addToSet": {"auth_providers": "vk"},
                },
            )
            user_doc = await db.users.find_one({"uid": existing["uid"]})
        else:
            safe_username, conflict_username = await resolve_safe_username(
                db, vk_profile.get("screen_name")
            )
            if conflict_username:
                logger.info(
                    f"ℹ️ VK screen_name '{conflict_username}' занят — создаём аккаунт без username."
                )

            user_doc = await _create_new_user(
                db,
                vk_id=vk_id_str,
                first_name=vk_profile.get("first_name"),
                last_name=vk_profile.get("last_name"),
                username=safe_username,
                photo_url=vk_profile.get("photo_200"),
                primary_auth="vk",
                registration_step=2,
            )
            is_new = True
            # 🔗 P4: Обработка referral_code для нового VK-пользователя
            await _process_referral_for_new_user(
                db, referral_code=req.referral_code, user_doc=user_doc, request=request,
            )

        await _log_auth_event(
            db, event_type=("register_vk" if is_new else "login_vk"),
            uid=user_doc["uid"], provider="vk", success=True, request=request,
        )
        return await _issue_token(
            db, user_doc, is_new=is_new,
            suggested_username_taken=conflict_username, request=request, provider="vk",
        )

    # ============= QR LOGIN =============

    @router.post("/login/qr/init", response_model=QRInitResponse)
    async def qr_init(request: Request):
        """Инициирует QR-login сессию.

        Возвращает qr_token + expires_at. Сайт показывает QR, опрашивает /status
        каждые 2 сек. Авторизованное устройство сканирует QR и вызывает /confirm.
        """
        # Stage 7: B-02 — rate limit по IP и User-Agent
        client_ip = get_client_ip(request)
        ua = request.headers.get("User-Agent", "")[:500]

        ip_max, ip_win = _RATE_LIMITS["qr_init_ip"]
        if not check_rate_limit(client_ip, "qr_init_ip", ip_max, ip_win):
            await _log_auth_event(
                db, event_type="qr_init", success=False, request=request,
                extra={"reason": "rate_limited_ip"},
            )
            raise HTTPException(
                status_code=429,
                detail="Слишком много QR-запросов с этого IP. Попробуйте позже.",
            )
        ua_max, ua_win = _RATE_LIMITS["qr_init_ua"]
        if ua and not check_rate_limit(ua, "qr_init_ua", ua_max, ua_win):
            raise HTTPException(
                status_code=429,
                detail="Слишком много QR-запросов от этого клиента. Попробуйте позже.",
            )

        qr_token = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=QR_SESSION_TTL_MINUTES)

        ip = client_ip

        await db.auth_qr_sessions.insert_one({
            "id": str(uuid.uuid4()),
            "qr_token": qr_token,
            "status": "pending",
            "user_agent": ua,
            "ip_address": ip,
            "confirmed_uid": None,
            "issued_token": None,
            "issued_at": None,
            "created_at": now,
            "expires_at": expires_at,
        })

        return QRInitResponse(
            qr_token=qr_token,
            qr_url=f"qr-login:{qr_token}",
            expires_at=expires_at,
            status="pending",
        )

    @router.get("/login/qr/{qr_token}/status", response_model=QRStatusResponse)
    async def qr_status(qr_token: str, request: Request):
        """Проверяет статус QR-сессии.

        Поведение:
          - pending → возвращаем status=pending.
          - confirmed → выдаём JWT и переводим в consumed (с сохранением токена).
          - consumed (≤ 30 сек назад) → ОТДАЁМ тот же токен повторно
            (защита от потери ответа на стороне клиента).
          - consumed (> 30 сек) или expired → возвращаем expired.
          - истекло время → переводим в expired.
        """
        # Stage 7: B-02 — rate limit на polling (для защиты от DDoS)
        client_ip = get_client_ip(request)
        ip_max, ip_win = _RATE_LIMITS["qr_status_ip"]
        if not check_rate_limit(client_ip, "qr_status_ip", ip_max, ip_win):
            raise HTTPException(
                status_code=429,
                detail="Слишком частые запросы QR status. Снизьте частоту polling.",
            )

        session = await db.auth_qr_sessions.find_one({"qr_token": qr_token})
        if not session:
            raise HTTPException(status_code=404, detail="QR-сессия не найдена")

        now = datetime.now(timezone.utc)
        expires_at = session.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        status = session.get("status", "pending")

        # Pending + истёк TTL → expired
        if status == "pending" and expires_at and now > expires_at:
            await db.auth_qr_sessions.update_one(
                {"qr_token": qr_token},
                {"$set": {"status": "expired"}},
            )
            return QRStatusResponse(status="expired", expires_at=expires_at)

        # Подтверждённая сессия — выдаём токен
        if status == "confirmed" and session.get("confirmed_uid"):
            user_doc = await db.users.find_one({"uid": session["confirmed_uid"]})
            if user_doc:
                token = create_jwt(
                    uid=user_doc["uid"],
                    telegram_id=effective_tid_for_user(user_doc),
                    providers=user_doc.get("auth_providers", []),
                )
                await db.auth_qr_sessions.update_one(
                    {"qr_token": qr_token},
                    {"$set": {
                        "status": "consumed",
                        "issued_token": token,
                        "issued_at": now,
                    }},
                )
                await _update_last_login(db, user_doc["uid"])
                return QRStatusResponse(
                    status="confirmed",
                    access_token=token,
                    user=_user_to_public(user_doc, include_email=True),
                    expires_at=expires_at,
                )

        # Consumed с grace-периодом — повторно отдаём тот же токен
        if status == "consumed":
            issued_at = session.get("issued_at")
            if issued_at and issued_at.tzinfo is None:
                issued_at = issued_at.replace(tzinfo=timezone.utc)
            if (
                issued_at
                and (now - issued_at).total_seconds() <= QR_CONSUMED_GRACE_SECONDS
                and session.get("issued_token")
                and session.get("confirmed_uid")
            ):
                user_doc = await db.users.find_one({"uid": session["confirmed_uid"]})
                if user_doc:
                    return QRStatusResponse(
                        status="confirmed",
                        access_token=session["issued_token"],
                        user=_user_to_public(user_doc, include_email=True),
                        expires_at=expires_at,
                    )
            # Grace истёк
            return QRStatusResponse(status="expired", expires_at=expires_at)

        return QRStatusResponse(status=status, expires_at=expires_at)

    @router.post("/login/qr/{qr_token}/confirm")
    async def qr_confirm(
        qr_token: str,
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Авторизованное устройство подтверждает QR-сессию.

        Stage 7: B-02+B-03 — добавлен rate-limit + атомарный claim через
        find_one_and_update (защита от race condition при одновременных confirm).
        """
        uid = current_user["sub"]

        # Stage 7: B-02 — rate limit по uid
        rl_max, rl_win = _RATE_LIMITS["qr_confirm_uid"]
        if not check_rate_limit(uid, "qr_confirm_uid", rl_max, rl_win):
            raise HTTPException(
                status_code=429,
                detail="Слишком много QR-подтверждений. Попробуйте позже.",
            )

        now = datetime.now(timezone.utc)

        # Stage 7: B-03 — атомарный claim: обновляем только если сессия
        # ещё pending и не истекла. Так исключается race condition между
        # двумя параллельными confirm-запросами.
        claimed = await db.auth_qr_sessions.find_one_and_update(
            {
                "qr_token": qr_token,
                "status": "pending",
                "expires_at": {"$gt": now},
            },
            {
                "$set": {
                    "status": "confirmed",
                    "confirmed_uid": uid,
                    "confirmed_at": now,
                    "confirmed_ip": get_client_ip(request),
                    "confirmed_ua": request.headers.get("User-Agent", "")[:500],
                }
            },
            return_document=False,
        )

        if not claimed:
            # Сессия не найдена ИЛИ не pending ИЛИ истекла — выясним точную причину
            existing = await db.auth_qr_sessions.find_one({"qr_token": qr_token})
            if not existing:
                raise HTTPException(status_code=404, detail="QR-сессия не найдена")
            existing_expires = existing.get("expires_at")
            if existing_expires and existing_expires.tzinfo is None:
                existing_expires = existing_expires.replace(tzinfo=timezone.utc)
            if existing_expires and existing_expires < now:
                raise HTTPException(status_code=410, detail="QR-сессия истекла")
            raise HTTPException(
                status_code=409,
                detail=f"QR-сессия уже в статусе {existing.get('status')}",
            )

        await _log_auth_event(
            db, event_type="qr_confirm", uid=uid,
            provider="qr", success=True, request=request,
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
    async def logout(
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Logout — клиент удаляет JWT. Логируем для audit."""
        await _log_auth_event(
            db, event_type="logout", uid=current_user["sub"],
            success=True, request=request,
        )
        return {"success": True, "message": "Logged out. Delete the token on client side."}

    # ============= Link Email =============

    def _enforce_link_rate_limit(uid: str) -> None:
        """Stage 7: B-02 — common rate-limit для всех link/unlink endpoints."""
        rl_max, rl_win = _RATE_LIMITS["link_provider_uid"]
        if not check_rate_limit(uid, "link_provider_uid", rl_max, rl_win):
            raise HTTPException(
                status_code=429,
                detail="Слишком много попыток привязки/отвязки. Попробуйте позже.",
            )

    @router.post("/link/email")
    async def link_email(
        req: RegisterEmailRequest,
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Привязать email+пароль к существующему аккаунту."""
        _enforce_link_rate_limit(current_user["sub"])
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
        await _log_auth_event(
            db, event_type="link_email", uid=user_doc["uid"],
            provider="email", success=True, request=request,
        )
        return {"success": True, "message": "Email привязан"}

    # ============= Link Telegram (общий helper для widget+webapp) =============

    async def _do_link_telegram(
        user_doc: dict,
        tg_id: int,
        request: Request,
        source: str,  # "widget" или "webapp"
    ) -> dict:
        """Обновляет users + переносит user_settings(pseudo_tid → real_tid)."""
        # 🐛 P1-FIX: приведение типов, т.к. Mongo может хранить int64/str.
        try:
            tg_id_int = int(tg_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Некорректный telegram_id")

        current_tid_raw = user_doc.get("telegram_id")
        try:
            current_tid_int = int(current_tid_raw) if current_tid_raw is not None else None
        except (TypeError, ValueError):
            current_tid_int = None

        # Идемпотентность (с нормализацией типов)
        if current_tid_int is not None and current_tid_int == tg_id_int:
            return {"success": True, "message": "Telegram уже привязан", "telegram_id": tg_id_int}

        if current_tid_int is not None and current_tid_int != tg_id_int:
            raise HTTPException(
                status_code=409,
                detail="К вашему аккаунту уже привязан другой Telegram. Сначала отвяжите текущий.",
            )

        # Не занят ли tg_id другим аккаунтом
        other = await db.users.find_one(
            {"telegram_id": tg_id_int, "uid": {"$ne": user_doc["uid"]}},
            {"uid": 1},
        )
        if other:
            raise HTTPException(
                status_code=409,
                detail="Этот Telegram уже привязан к другому аккаунту.",
            )

        now = datetime.now(timezone.utc)
        await db.users.update_one(
            {"uid": user_doc["uid"]},
            {
                "$set": {"telegram_id": tg_id_int, "updated_at": now},
                "$addToSet": {"auth_providers": "telegram"},
            },
        )

        # 🔥 КРИТИЧЕСКИ ВАЖНО: переносим user_settings с pseudo_tid на real_tid.
        old_tid = pseudo_tid_from_uid(user_doc["uid"])  # текущий ключ user_settings
        await _remap_user_settings_tid(db, user_doc["uid"], old_tid, tg_id_int)

        await _log_auth_event(
            db, event_type=f"link_telegram_{source}", uid=user_doc["uid"],
            provider="telegram", success=True, request=request,
        )
        logger.info(f"🔗 Manual link ({source}): uid={user_doc['uid']} ← telegram_id={tg_id_int}")

        updated = await db.users.find_one({"uid": user_doc["uid"]})
        return {
            "success": True,
            "message": "Telegram успешно привязан",
            "user": _user_to_public(updated, include_email=True).model_dump(mode="json"),
        }

    @router.post("/link/telegram")
    async def link_telegram(
        req: LinkTelegramRequest,
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        _enforce_link_rate_limit(current_user["sub"])  # Stage 7: B-02
        data = req.model_dump(exclude_none=True)
        if not verify_telegram_login_widget_hash(data):
            raise HTTPException(status_code=401, detail="Невалидная подпись Telegram")

        user_doc = await db.users.find_one({"uid": current_user["sub"]})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        return await _do_link_telegram(user_doc, req.id, request, source="widget")

    @router.post("/link/telegram-webapp")
    async def link_telegram_webapp(
        req: LinkTelegramWebAppRequest,
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        _enforce_link_rate_limit(current_user["sub"])  # Stage 7: B-02
        parsed = verify_telegram_webapp_init_data(req.init_data)
        if not parsed or not parsed.get("user"):
            raise HTTPException(status_code=401, detail="Невалидные данные Telegram WebApp")

        tg_user = parsed["user"]
        tg_id = tg_user.get("id")
        if not tg_id:
            raise HTTPException(status_code=400, detail="user.id отсутствует в initData")

        user_doc = await db.users.find_one({"uid": current_user["sub"]})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        return await _do_link_telegram(user_doc, tg_id, request, source="webapp")

    # ============= Link VK =============

    @router.post("/link/vk")
    async def link_vk(
        req: LinkVKRequest,
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Привязать VK ID к текущему аккаунту (через OAuth code)."""
        _enforce_link_rate_limit(current_user["sub"])  # Stage 7: B-02
        if not VK_APP_ID or not VK_CLIENT_SECRET:
            raise HTTPException(status_code=500, detail="VK OAuth не сконфигурирован")

        user_doc = await db.users.find_one({"uid": current_user["sub"]})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        redirect_uri = req.redirect_uri or VK_REDIRECT_URI
        if not redirect_uri:
            raise HTTPException(status_code=400, detail="redirect_uri обязателен")

        _access_token, vk_id_str, _vk_profile = await _vk_exchange_code(
            code=req.code,
            redirect_uri=redirect_uri,
            device_id=req.device_id,
            code_verifier=req.code_verifier,
            state=req.state,
        )

        # Идемпотентность
        if user_doc.get("vk_id") == vk_id_str:
            return {"success": True, "message": "VK уже привязан", "vk_id": vk_id_str}

        if user_doc.get("vk_id") and user_doc["vk_id"] != vk_id_str:
            raise HTTPException(
                status_code=409,
                detail="К вашему аккаунту уже привязан другой VK. Сначала отвяжите текущий.",
            )

        other = await db.users.find_one(
            {"vk_id": vk_id_str, "uid": {"$ne": user_doc["uid"]}},
            {"uid": 1},
        )
        if other:
            raise HTTPException(
                status_code=409,
                detail="Этот VK уже привязан к другому аккаунту.",
            )

        now = datetime.now(timezone.utc)
        await db.users.update_one(
            {"uid": user_doc["uid"]},
            {
                "$set": {"vk_id": vk_id_str, "updated_at": now},
                "$addToSet": {"auth_providers": "vk"},
            },
        )

        await _log_auth_event(
            db, event_type="link_vk", uid=user_doc["uid"],
            provider="vk", success=True, request=request,
        )
        logger.info(f"🔗 Manual link: uid={user_doc['uid']} ← vk_id={vk_id_str}")

        updated = await db.users.find_one({"uid": user_doc["uid"]})
        return {
            "success": True,
            "message": "VK успешно привязан",
            "user": _user_to_public(updated, include_email=True).model_dump(mode="json"),
        }

    # ============= Unlink provider =============

    @router.delete("/link/{provider}")
    async def unlink_provider(
        provider: str,
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Отвязать провайдер от аккаунта.

        Безопасность:
          - Нельзя отвязать последний оставшийся способ входа.
          - При отвязке primary_auth — переключаемся на провайдер согласно
            детерминированному приоритету (email > telegram > vk).
        """
        _enforce_link_rate_limit(current_user["sub"])  # Stage 7: B-02
        provider = provider.strip().lower()
        if provider not in PROVIDERS:
            raise HTTPException(
                status_code=400,
                detail=f"Провайдер должен быть: {', '.join(PROVIDERS)}",
            )

        user_doc = await db.users.find_one({"uid": current_user["sub"]})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        current_providers: set = set(user_doc.get("auth_providers") or [])
        # Реально активные провайдеры (по фактическим ID в документе)
        active: set = set()
        if user_doc.get("email") and user_doc.get("password_hash"):
            active.add("email")
        if user_doc.get("telegram_id"):
            active.add("telegram")
        if user_doc.get("vk_id"):
            active.add("vk")

        if provider not in active:
            # 🐛 P1-FIX: возвращаем 404 вместо тихого 200, чтобы клиент знал
            # что провайдер не был привязан (корректное поведение REST).
            raise HTTPException(
                status_code=404,
                detail=f"Провайдер {provider} не был привязан к вашему аккаунту",
            )

        remaining = active - {provider}
        if not remaining:
            raise HTTPException(
                status_code=409,
                detail="Нельзя отвязать последний способ входа. "
                       "Сначала привяжите другой провайдер.",
            )

        set_none: Dict[str, Any] = {}
        if provider == "email":
            set_none = {"email": None, "password_hash": None}
        elif provider == "telegram":
            set_none = {"telegram_id": None}
        elif provider == "vk":
            set_none = {"vk_id": None}

        update_doc: Dict[str, Any] = {
            "$set": {**set_none, "updated_at": datetime.now(timezone.utc)},
            "$pull": {"auth_providers": provider},
        }
        if user_doc.get("primary_auth") == provider:
            new_primary = choose_primary_auth(remaining)
            update_doc["$set"]["primary_auth"] = new_primary

        await db.users.update_one({"uid": user_doc["uid"]}, update_doc)

        # Если отвязали Telegram → user_settings.telegram_id остался реальным,
        # но user больше не имеет реального tg_id. Переносим user_settings обратно
        # на pseudo_tid, чтобы сохранить совместимость.
        if provider == "telegram" and user_doc.get("telegram_id"):
            new_pseudo = pseudo_tid_from_uid(user_doc["uid"])
            await _remap_user_settings_tid(
                db, user_doc["uid"],
                old_tid=user_doc["telegram_id"],
                new_tid=new_pseudo,
            )

        await _log_auth_event(
            db, event_type="unlink_provider", uid=user_doc["uid"],
            provider=provider, success=True, request=request,
            extra={"remaining": sorted(remaining)},
        )
        logger.info(
            f"🔓 Provider unlinked: uid={user_doc['uid']} provider={provider} "
            f"remaining={sorted(remaining)}"
        )

        updated = await db.users.find_one({"uid": user_doc["uid"]})
        return {
            "success": True,
            "message": f"{provider} отвязан",
            "user": _user_to_public(updated, include_email=True).model_dump(mode="json"),
        }

    # ============= Username check =============

    @router.get("/check-username/{username}", response_model=UsernameCheckResponse)
    async def check_username(
        username: str,
        request: Request,
        current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    ):
        # Stage 7: B-02 — rate-limit для anti-enumeration атак
        client_ip = get_client_ip(request)
        ip_max, ip_win = _RATE_LIMITS["check_username_ip"]
        if not check_rate_limit(client_ip, "check_username_ip", ip_max, ip_win):
            raise HTTPException(
                status_code=429,
                detail="Слишком много запросов. Попробуйте позже.",
            )
        if current_user:
            uid_max, uid_win = _RATE_LIMITS["check_username_uid"]
            if not check_rate_limit(current_user["sub"], "check_username_uid", uid_max, uid_win):
                raise HTTPException(
                    status_code=429,
                    detail="Слишком много проверок username. Попробуйте позже.",
                )

        normalized = normalize_username(username)
        if not normalized:
            raw = (username or "").strip()
            if len(raw) < 3 or len(raw) > 32:
                reason = "Длина должна быть 3-32 символа"
            elif raw.lower() in RESERVED_USERNAMES:
                reason = "Зарезервировано"
            else:
                reason = "Только a-z, 0-9, _"
            return UsernameCheckResponse(
                username=username, available=False, reason=reason
            )

        query: Dict[str, Any] = {
            "username": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}
        }
        if current_user:
            query["uid"] = {"$ne": current_user["sub"]}

        existing = await db.users.find_one(query, {"_id": 1})
        if existing:
            return UsernameCheckResponse(username=username, available=False, reason="Занято")

        return UsernameCheckResponse(username=username, available=True)

    # ============= Profile step =============

    @router.patch("/profile-step", response_model=UserPublic)
    async def update_profile_step(
        req: UpdateProfileStepRequest,
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        # Stage 7: B-02 — rate limit по uid
        uid = current_user["sub"]
        rl_max, rl_win = _RATE_LIMITS["profile_step_uid"]
        if not check_rate_limit(uid, "profile_step_uid", rl_max, rl_win):
            raise HTTPException(
                status_code=429,
                detail="Слишком много обновлений профиля. Попробуйте позже.",
            )

        user_doc = await db.users.find_one({"uid": uid})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        update_data = req.model_dump(exclude_unset=True, exclude_none=True)
        complete_step = update_data.pop("complete_step", None)

        # Stage 7: B-11 — удаляем пустые строки из текстовых полей, чтобы
        # фронт не затирал корректные значения отправкой пустых input.
        TEXT_FIELDS = {
            "username", "first_name", "last_name",
            "facultet_id", "facultet_name", "level_id", "form_code",
            "kurs", "group_id", "group_name",
        }
        for field in list(update_data.keys()):
            if field in TEXT_FIELDS and isinstance(update_data[field], str):
                stripped = update_data[field].strip()
                if stripped == "":
                    # Stage 7: B-23 — для username пустая строка = явный unset
                    # (чтобы юзер мог убрать публичный username)
                    if field == "username":
                        update_data[field] = None
                    else:
                        del update_data[field]
                else:
                    update_data[field] = stripped

        if "username" in update_data:
            raw_username = update_data["username"]
            # Stage 7: B-23 — None = explicit unset
            if raw_username is None:
                # Явный сброс username — разрешено
                pass
            else:
                username = normalize_username(raw_username)
                if not username:
                    stripped = (raw_username or "").strip()
                    if stripped.lower() in RESERVED_USERNAMES:
                        raise HTTPException(status_code=400, detail="Username зарезервирован")
                    raise HTTPException(
                        status_code=400,
                        detail="Username: 3-32 символа, только a-z, 0-9, _",
                    )
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

        if complete_step is not None:
            # Явная карта переходов вместо запутанной тернарной логики
            update_data["registration_step"] = _STEP_TRANSITIONS.get(complete_step, 0)

        try:
            await db.users.update_one(
                {"uid": user_doc["uid"]},
                {"$set": update_data},
            )
        except DuplicateKeyError:
            raise HTTPException(status_code=409, detail="Username занят")

        # Зеркало в user_settings — effective_tid реальный либо pseudo
        effective_tid = effective_tid_for_user(user_doc)

        if effective_tid is not None:
            mirror = {k: v for k, v in update_data.items() if k in (
                "first_name", "last_name", "username",
                "facultet_id", "facultet_name", "level_id", "form_code",
                "kurs", "group_id", "group_name",
            )}
            if mirror:
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
        """Публичная конфигурация для frontend."""
        return {
            "telegram_bot_username": get_telegram_bot_username(),
            "vk_app_id": VK_APP_ID,
            "vk_redirect_uri_default": VK_REDIRECT_URI,
            "env": ENV,
            "qr_login_ttl_minutes": QR_SESSION_TTL_MINUTES,
            "features": {
                "email_verification": True,
                "password_reset": True,
                "sessions_management": True,
                "qr_login": True,
                "vk_login": bool(VK_APP_ID and VK_CLIENT_SECRET),
                "telegram_login": True,
                "email_smtp_configured": is_email_configured(),
            },
        }

    # ============= 🔐 PASSWORD MANAGEMENT (P2) =============

    @router.post("/password/change", response_model=GenericSuccessResponse)
    async def change_password(
        req: ChangePasswordRequest,
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Сменить пароль (требует старый пароль). Отзывает все остальные сессии."""
        uid = current_user["sub"]
        rl_max, rl_win = _RATE_LIMITS["change_password_uid"]
        if not check_rate_limit(uid, "change_password_uid", rl_max, rl_win):
            raise HTTPException(status_code=429, detail="Слишком много попыток. Попробуйте позже.")

        user_doc = await db.users.find_one({"uid": uid})
        if not user_doc or not user_doc.get("is_active", True):
            raise HTTPException(status_code=404, detail="Аккаунт не найден")
        if not user_doc.get("password_hash"):
            # У пользователя ещё нет пароля (зашёл через Telegram/VK). Пусть
            # использует "Забыли пароль?" — это добавит пароль и привяжет email.
            raise HTTPException(
                status_code=400,
                detail="У вас ещё нет пароля. Установите его через «Забыли пароль?» с привязанным email.",
            )
        if not verify_password(req.old_password, user_doc["password_hash"]):
            await _log_auth_event(
                db, event_type="change_password", uid=uid, success=False,
                request=request, extra={"reason": "wrong_old_password"},
            )
            raise HTTPException(status_code=401, detail="Текущий пароль неверен")

        try:
            new_hash = hash_password(req.new_password)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Отклоняем если новый совпадает со старым
        if verify_password(req.new_password, user_doc["password_hash"]):
            raise HTTPException(
                status_code=400,
                detail="Новый пароль не должен совпадать с текущим",
            )

        await db.users.update_one(
            {"uid": uid},
            {"$set": {
                "password_hash": new_hash,
                "password_changed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        # Отозвать все ДРУГИЕ сессии (текущая остаётся)
        current_jti = current_user.get("jti")
        revoked_count = await revoke_all_sessions(db, uid=uid, except_jti=current_jti)

        await _log_auth_event(
            db, event_type="change_password", uid=uid, success=True,
            request=request, extra={"revoked_sessions": revoked_count},
        )
        # Уведомление по email (если привязан)
        if user_doc.get("email"):
            try:
                name = user_doc.get("first_name") or ""
                subj, html, text = template_password_changed(
                    user_name=name, ip=get_client_ip(request),
                )
                await send_email(user_doc["email"], subj, html, text)
            except Exception as e:
                logger.warning(f"password_changed email failed: {e}")
        return GenericSuccessResponse(
            success=True,
            message=f"Пароль изменён. Отозвано других сессий: {revoked_count}",
        )

    @router.post("/password/forgot", response_model=GenericSuccessResponse)
    async def forgot_password(req: ForgotPasswordRequest, request: Request):
        """Отправляет ссылку для сброса пароля.

        🔐 Privacy: всегда возвращаем success (даже если email не зарегистрирован),
        чтобы не давать enumeration-атакам понять, какие email есть в системе.
        """
        client_ip = get_client_ip(request)
        email_norm = req.email.strip().lower()

        # Двойной rate-limit: per-IP + per-email (анти-спам на чужой email)
        ip_max, ip_win = _RATE_LIMITS["forgot_password_ip"]
        em_max, em_win = _RATE_LIMITS["forgot_password_email"]
        if not check_rate_limit(client_ip, "forgot_password_ip", ip_max, ip_win):
            raise HTTPException(status_code=429, detail="Слишком много запросов с этого IP.")
        if not check_rate_limit(email_norm, "forgot_password_email", em_max, em_win):
            # Молча возвращаем success (privacy) — atak видит 200 даже при лимите
            logger.warning(f"forgot_password: per-email rate limit hit for {email_norm}")
            return GenericSuccessResponse(
                success=True,
                message="Если email зарегистрирован — мы отправили инструкцию.",
            )

        user_doc = await db.users.find_one({"email": email_norm, "is_active": True})
        if user_doc:
            # Генерируем токен, храним ХЭШ, ссылку шлём по email с plain-токеном
            raw = new_secure_token(32)
            token_hash = hash_token(raw)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=_PASSWORD_RESET_TTL_MIN)
            # Делаем ранее выпущенные reset-токены неактивными
            await db.auth_tokens.update_many(
                {"uid": user_doc["uid"], "purpose": "password_reset", "used_at": None},
                {"$set": {"used_at": datetime.now(timezone.utc), "invalidated": True}},
            )
            await db.auth_tokens.insert_one({
                "id": str(uuid.uuid4()),
                "uid": user_doc["uid"],
                "purpose": "password_reset",
                "token_hash": token_hash,
                "created_at": datetime.now(timezone.utc),
                "expires_at": expires_at,
                "used_at": None,
                "ip": client_ip,
                "ua": (request.headers.get("User-Agent", "") or "")[:300],
            })

            base = (EMAIL_PUBLIC_BASE_URL or "").rstrip("/")
            reset_url = f"{base}/reset-password?token={raw}"
            subj, html, text = template_password_reset(
                reset_url=reset_url,
                user_name=user_doc.get("first_name") or "",
            )
            await send_email(user_doc["email"], subj, html, text)
            await _log_auth_event(
                db, event_type="forgot_password", uid=user_doc["uid"],
                success=True, request=request,
            )
        else:
            # Не существует — всё равно "success", но логируем для аудита
            await _log_auth_event(
                db, event_type="forgot_password", success=False,
                request=request, extra={"reason": "unknown_email", "email": email_norm[:50]},
            )

        return GenericSuccessResponse(
            success=True,
            message="Если email зарегистрирован — мы отправили инструкцию.",
        )

    @router.post("/password/reset", response_model=AuthTokenResponse)
    async def reset_password(req: ResetPasswordRequest, request: Request):
        """Сбросить пароль по токену из email. Возвращает access_token (авто-логин)."""
        client_ip = get_client_ip(request)
        rl_max, rl_win = _RATE_LIMITS["reset_password_ip"]
        if not check_rate_limit(client_ip, "reset_password_ip", rl_max, rl_win):
            raise HTTPException(status_code=429, detail="Слишком много попыток.")

        token_hash = hash_token(req.token)
        now = datetime.now(timezone.utc)
        token_doc = await db.auth_tokens.find_one({
            "purpose": "password_reset",
            "token_hash": token_hash,
            "used_at": None,
            "expires_at": {"$gt": now},
        })
        if not token_doc:
            await _log_auth_event(
                db, event_type="reset_password", success=False,
                request=request, extra={"reason": "invalid_or_expired"},
            )
            raise HTTPException(status_code=400, detail="Ссылка недействительна или истекла.")

        user_doc = await db.users.find_one({"uid": token_doc["uid"], "is_active": True})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Аккаунт не найден")

        try:
            new_hash = hash_password(req.new_password)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Транзакция: пометить токен использованным + обновить пароль + revoke all sessions
        await db.auth_tokens.update_one(
            {"_id": token_doc["_id"]},
            {"$set": {"used_at": now, "used_ip": client_ip}},
        )
        await db.users.update_one(
            {"uid": user_doc["uid"]},
            {"$set": {
                "password_hash": new_hash,
                "password_changed_at": now,
                "updated_at": now,
                # Email считаем подтверждённым (владелец получил ссылку по email)
                "email_verified": True,
                # Убеждаемся что email есть в auth_providers
            }, "$addToSet": {"auth_providers": "email"}},
        )
        # Отзываем ВСЕ прежние сессии (безопасность)
        revoked_count = await revoke_all_sessions(db, uid=user_doc["uid"])

        user_doc = await db.users.find_one({"uid": user_doc["uid"]})
        await _log_auth_event(
            db, event_type="reset_password", uid=user_doc["uid"],
            success=True, request=request, extra={"revoked_sessions": revoked_count},
        )
        # Email-нотификация о смене
        try:
            subj, html, text = template_password_changed(
                user_name=user_doc.get("first_name") or "",
                ip=client_ip,
            )
            await send_email(user_doc["email"], subj, html, text)
        except Exception as e:
            logger.warning(f"reset notification email failed: {e}")

        return await _issue_token(
            db, user_doc, is_new=False, request=request, provider="email",
        )

    # ============= ✉️ EMAIL VERIFICATION (P3) =============

    @router.post("/email/send-verification", response_model=GenericSuccessResponse)
    async def send_verification(
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Отправить письмо подтверждения email на текущий адрес."""
        uid = current_user["sub"]
        rl_max, rl_win = _RATE_LIMITS["send_verify_uid"]
        if not check_rate_limit(uid, "send_verify_uid", rl_max, rl_win):
            raise HTTPException(status_code=429, detail="Слишком часто. Попробуйте позже.")

        user_doc = await db.users.find_one({"uid": uid})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Аккаунт не найден")
        if not user_doc.get("email"):
            raise HTTPException(status_code=400, detail="Email не привязан к аккаунту")
        if user_doc.get("email_verified"):
            return GenericSuccessResponse(success=True, message="Email уже подтверждён")

        raw = new_secure_token(32)
        token_hash = hash_token(raw)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=_EMAIL_VERIFY_TTL_MIN)

        # Инвалидируем предыдущие verify-токены
        await db.auth_tokens.update_many(
            {"uid": uid, "purpose": "email_verify", "used_at": None},
            {"$set": {"used_at": datetime.now(timezone.utc), "invalidated": True}},
        )
        await db.auth_tokens.insert_one({
            "id": str(uuid.uuid4()),
            "uid": uid,
            "purpose": "email_verify",
            "token_hash": token_hash,
            "email": user_doc["email"],  # фиксируем email на момент выдачи
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at,
            "used_at": None,
        })
        base = (EMAIL_PUBLIC_BASE_URL or "").rstrip("/")
        verify_url = f"{base}/verify-email?token={raw}"
        subj, html, text = template_email_verification(
            verify_url=verify_url,
            user_name=user_doc.get("first_name") or "",
        )
        await send_email(user_doc["email"], subj, html, text)
        await _log_auth_event(
            db, event_type="send_verification", uid=uid, success=True, request=request,
        )
        return GenericSuccessResponse(
            success=True,
            message=f"Письмо отправлено на {user_doc['email']}. Проверьте почту.",
        )

    @router.post("/email/verify", response_model=GenericSuccessResponse)
    async def verify_email(
        req: VerifyEmailRequest,
        request: Request,
        current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    ):
        """Подтвердить email по токену (работает и для неавторизованного клиента)."""
        client_ip = get_client_ip(request)
        rl_max, rl_win = _RATE_LIMITS["verify_email_ip"]
        if not check_rate_limit(client_ip, "verify_email_ip", rl_max, rl_win):
            raise HTTPException(status_code=429, detail="Слишком много попыток.")

        token_hash = hash_token(req.token)
        now = datetime.now(timezone.utc)
        token_doc = await db.auth_tokens.find_one({
            "purpose": "email_verify",
            "token_hash": token_hash,
            "used_at": None,
            "expires_at": {"$gt": now},
        })
        if not token_doc:
            raise HTTPException(status_code=400, detail="Ссылка недействительна или истекла.")

        user_doc = await db.users.find_one({"uid": token_doc["uid"]})
        if not user_doc or not user_doc.get("is_active", True):
            raise HTTPException(status_code=404, detail="Аккаунт не найден")

        # Если email изменился после выдачи токена — инвалидируем
        if token_doc.get("email") and token_doc["email"] != user_doc.get("email"):
            await db.auth_tokens.update_one(
                {"_id": token_doc["_id"]},
                {"$set": {"used_at": now, "invalidated": True}},
            )
            raise HTTPException(status_code=400, detail="Email был изменён. Запросите новое письмо.")

        await db.auth_tokens.update_one(
            {"_id": token_doc["_id"]},
            {"$set": {"used_at": now, "used_ip": client_ip}},
        )
        await db.users.update_one(
            {"uid": user_doc["uid"]},
            {"$set": {"email_verified": True, "updated_at": now}},
        )
        await _log_auth_event(
            db, event_type="verify_email", uid=user_doc["uid"],
            success=True, request=request,
        )
        return GenericSuccessResponse(success=True, message="Email успешно подтверждён ✓")

    # ============= 🖥️ SESSIONS / DEVICES (P4) =============

    @router.get("/sessions", response_model=SessionsListResponse)
    async def get_sessions(
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Список активных сессий текущего пользователя."""
        uid = current_user["sub"]
        current_jti = current_user.get("jti")
        raw_sessions = await list_user_sessions(db, uid=uid, current_jti=current_jti)
        sessions: List[SessionInfo] = []
        for s in raw_sessions:
            try:
                sessions.append(SessionInfo(
                    jti=s.get("jti", ""),
                    created_at=s.get("created_at"),
                    last_active_at=s.get("last_active_at"),
                    expires_at=s.get("expires_at"),
                    ip=s.get("ip"),
                    user_agent=s.get("user_agent"),
                    device_label=s.get("device_label"),
                    provider=s.get("provider"),
                    is_current=s.get("is_current", False),
                ))
            except Exception as e:
                logger.warning(f"session parse failed: {e}")
        return SessionsListResponse(sessions=sessions, total=len(sessions))

    @router.delete("/sessions/{jti}", response_model=GenericSuccessResponse)
    async def revoke_session_endpoint(
        jti: str,
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Отозвать конкретную сессию (logout с конкретного устройства)."""
        uid = current_user["sub"]
        if not jti or len(jti) > 64:
            raise HTTPException(status_code=400, detail="Некорректный jti")
        ok = await revoke_session(db, uid=uid, jti=jti)
        if not ok:
            # Не нашли активную сессию с таким jti
            raise HTTPException(status_code=404, detail="Сессия не найдена или уже отозвана")
        await _log_auth_event(
            db, event_type="revoke_session", uid=uid, success=True,
            request=request, extra={"revoked_jti": jti[:24]},
        )
        is_current = current_user.get("jti") == jti
        return GenericSuccessResponse(
            success=True,
            message="Сессия завершена" + (" (текущая — требуется повторный вход)" if is_current else ""),
        )

    @router.post("/logout", response_model=GenericSuccessResponse)
    async def logout(
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Logout — отзывает ТЕКУЩУЮ сессию."""
        uid = current_user["sub"]
        jti = current_user.get("jti")
        if jti:
            await revoke_session(db, uid=uid, jti=jti)
            await _log_auth_event(
                db, event_type="logout", uid=uid, success=True,
                request=request, extra={"jti": jti[:24]},
            )
        return GenericSuccessResponse(success=True, message="Вы вышли из системы")

    @router.post("/logout-all", response_model=GenericSuccessResponse)
    async def logout_all(
        request: Request,
        keep_current: bool = True,
        current_user: Dict[str, Any] = Depends(get_current_user_required),
    ):
        """Logout со всех устройств. По умолчанию сохраняет текущую сессию."""
        uid = current_user["sub"]
        except_jti = current_user.get("jti") if keep_current else None
        count = await revoke_all_sessions(db, uid=uid, except_jti=except_jti)
        await _log_auth_event(
            db, event_type="logout_all", uid=uid, success=True,
            request=request, extra={"revoked": count, "keep_current": keep_current},
        )
        return GenericSuccessResponse(
            success=True,
            message=(
                f"Отозвано сессий: {count}."
                + ("" if keep_current else " Ваша текущая сессия тоже отозвана — войдите заново.")
            ),
        )

    return router
