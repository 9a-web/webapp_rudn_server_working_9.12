"""
Telegram Bot для RUDN Schedule
Обрабатывает команду /start и открывает Web App
"""

import os
import logging
import asyncio
import signal
from telegram import Update, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup, Bot
from telegram.ext import Application, CommandHandler, ContextTypes, CallbackQueryHandler
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
import io
import math

# Загрузка переменных окружения
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Импорт конфигурации с выбором токена по ENV
from config import get_telegram_bot_token, ENV, is_test_environment
from auth_utils import is_real_telegram_user, is_pseudo_tid
from services.delivery import notify_user as _notify_user, safe_send_telegram

# Получение переменных окружения
TELEGRAM_BOT_TOKEN = get_telegram_bot_token()
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")
WEB_APP_URL = "https://rudn-schedule.ru"

# Логируем текущее окружение
logger.info(f"🚀 Telegram Bot запущен в режиме: {'TEST' if is_test_environment() else 'PRODUCTION'}")

# ID администраторов (могут использовать команду /users и /clear_db)
from config import ADMIN_TELEGRAM_IDS as ADMIN_IDS  # единый источник правды

# Пароль для очистки базы данных (храним в переменной окружения или здесь)
DB_CLEAR_PASSWORD = os.getenv("DB_CLEAR_PASSWORD", "RUDN_CLEAR_2025")

# Подключение к MongoDB
mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

# Словарь для хранения состояния ожидания подтверждения
clear_db_pending = {}


async def create_referral_connections(referred_id: int, referrer_id: int):
    """
    Создаёт связи реферала со всеми вышестоящими в цепочке (до 3 уровней)
    """
    import uuid
    connections = []
    current_referrer_id = referrer_id
    level = 1
    
    # Проходим по цепочке вверх максимум 3 уровня
    while current_referrer_id and level <= 3:
        # Создаём связь
        connection = {
            "id": str(uuid.uuid4()),
            "referrer_telegram_id": current_referrer_id,
            "referred_telegram_id": referred_id,
            "level": level,
            "created_at": datetime.utcnow(),
            "points_earned": 0
        }
        connections.append(connection)
        
        # Ищем следующего в цепочке
        current_referrer = await db.user_settings.find_one({"telegram_id": current_referrer_id})
        if current_referrer and current_referrer.get("referred_by"):
            current_referrer_id = current_referrer.get("referred_by")
            level += 1
        else:
            break
    
    # Сохраняем все связи
    if connections:
        await db.referral_connections.insert_many(connections)
        logger.info(f"✅ Создано {len(connections)} реферальных связей для пользователя {referred_id}")
    
    return connections


async def award_referral_bonus(referrer_id: int, referred_id: int, points: int, level: int):
    """
    Начисляет бонусные баллы пригласившему за регистрацию реферала
    """
    try:
        # Обновляем статистику пригласившего
        stats = await db.user_stats.find_one({"telegram_id": referrer_id})
        
        if not stats:
            # Создаём статистику если её нет
            import uuid
            stats = {
                "id": str(uuid.uuid4()),
                "telegram_id": referrer_id,
                "total_points": points,
                "friends_invited": 1,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            await db.user_stats.insert_one(stats)
        else:
            # Обновляем существующую статистику
            await db.user_stats.update_one(
                {"telegram_id": referrer_id},
                {
                    "$inc": {
                        "total_points": points,
                        "friends_invited": 1
                    },
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
        
        # Обновляем заработанные баллы с рефералов в user_settings
        await db.user_settings.update_one(
            {"telegram_id": referrer_id},
            {"$inc": {"referral_points_earned": points}}
        )
        
        # Обновляем заработанные баллы в реферальной связи
        await db.referral_connections.update_one(
            {
                "referrer_telegram_id": referrer_id,
                "referred_telegram_id": referred_id,
                "level": level
            },
            {"$inc": {"points_earned": points}}
        )
        
        logger.info(f"💰 Начислено {points} баллов пользователю {referrer_id} за реферала {referred_id} (уровень {level})")
        
    except Exception as e:
        logger.error(f"❌ Ошибка при начислении бонуса: {e}", exc_info=True)


async def send_device_linked_notification(
    telegram_id: int,
    device_name: str,
    session_token: str,
    photo_url: str = None,
    first_name: str = None
):
    """
    Отправляет уведомление пользователю о подключении нового устройства.

    P1 (instrUIDprofile.md): in-app уведомление создаётся ВСЕГДА (для VK/Email
    юзеров — единственный канал). Для real TG дополнительно шлём фото-push
    с профилем и inline-кнопкой "Удалить сеанс".
    """
    try:
        # Формируем время в МСК
        import pytz
        moscow_tz = pytz.timezone('Europe/Moscow')
        moscow_time = datetime.now(moscow_tz).strftime('%H:%M')

        title = "🔗 Новое устройство подключено"
        message_text = (
            f'<tg-emoji emoji-id="5190422665311050410">🔗</tg-emoji>  Новое устройство подключено:\n'
            f'<tg-emoji emoji-id="5407025283456835913">📱</tg-emoji>  {device_name}\n'
            f'<tg-emoji emoji-id="5384611567125928766">🕐</tg-emoji>  {moscow_time} МСК\n'
            f'\n'
            f'<tg-emoji emoji-id="5283215386496488657">⚠️</tg-emoji> Если это были не вы — немедленно удалите этот сеанс кнопкой ниже.'
        )
        inapp_body = f"Устройство: {device_name} • {moscow_time} МСК. Если это не вы — удалите сеанс в настройках."

        # 1) In-app уведомление — всегда (VK/Email юзеры увидят здесь)
        try:
            from server import db
            await _notify_user(
                db,
                bot=None,               # TG-пуш отправим отдельно (с фото и кнопкой)
                telegram_id=telegram_id,
                title=title,
                message=inapp_body,
                emoji="🔐",
                type="announcement",
                category="system",
                priority="high",
                data={
                    "device_name": device_name,
                    "session_token_prefix": session_token[:32] if session_token else None,
                    "action": "revoke_session",
                },
                actions=[
                    {"id": "revoke", "label": "🗑️ Удалить сеанс", "type": "danger"},
                ],
                send_telegram=False,     # TG ниже — особенный (с фото)
                log_ctx="device_linked_inapp",
            )
        except Exception as e:
            logger.warning(f"⚠️ device_linked in-app failed tid={telegram_id}: {e}")

        # 2) Telegram-пуш (только real TG, с фото и кнопкой)
        if not is_real_telegram_user(telegram_id):
            logger.info(
                f"🟡 Skip device-linked TG push: tid={telegram_id} "
                f"reason={'pseudo_tid' if is_pseudo_tid(telegram_id) else 'no_tid'}"
            )
            return True   # in-app ушёл — считаем доставленным

        bot = Bot(token=TELEGRAM_BOT_TOKEN)

        # inline-кнопка "Удалить сеанс"
        keyboard = [
            [InlineKeyboardButton(
                text="🗑️ Удалить сеанс",
                callback_data=f"revoke_device_{session_token[:32]}"
            )]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        # Пытаемся получить фото профиля пользователя и отправить с ним
        # P1: через safe_send_telegram — guard + единый error-handling
        try:
            photos = await bot.get_user_profile_photos(telegram_id, limit=1)

            if photos.total_count > 0:
                photo = photos.photos[0][0]
                ok = await safe_send_telegram(
                    bot,
                    telegram_id,
                    photo=photo.file_id,
                    caption=message_text,
                    parse_mode='HTML',
                    reply_markup=reply_markup,
                    method="photo",
                    log_ctx="device_linked_photo",
                )
                if ok:
                    logger.info(f"📱 Уведомление об устройстве с фото отправлено: {telegram_id}")
                    return True
        except Exception as photo_err:
            logger.warning(f"⚠️ Не удалось получить фото профиля: {photo_err}")

        # Fallback: просто текст
        ok = await safe_send_telegram(
            bot,
            telegram_id,
            text=message_text,
            parse_mode='HTML',
            reply_markup=reply_markup,
            method="message",
            log_ctx="device_linked_text",
        )
        if ok:
            logger.info(f"📱 Уведомление об устройстве отправлено: {telegram_id}")
        return ok

    except Exception as e:
        logger.error(f"❌ Ошибка при отправке уведомления об устройстве: {e}", exc_info=True)
        return False


async def handle_revoke_device_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Обработчик inline-кнопки для удаления сеанса устройства
    """
    query = update.callback_query
    await query.answer()
    
    telegram_id = update.effective_user.id
    callback_data = query.data
    
    # Извлекаем session_token из callback_data
    # Формат: revoke_device_{session_token[:32]}
    if not callback_data.startswith("revoke_device_"):
        return
    
    session_token_prefix = callback_data.replace("revoke_device_", "")
    
    try:
        # Ищем сессию по началу токена и telegram_id
        session = await db.web_sessions.find_one({
            "session_token": {"$regex": f"^{session_token_prefix}"},
            "telegram_id": telegram_id
        })
        
        if not session:
            await query.edit_message_text(
                text='❌ <b>Сеанс не найден</b>\n\n<i>Возможно, он уже был удалён.</i>',
                parse_mode='HTML'
            )
            return
        
        full_session_token = session.get("session_token")
        
        # Отправляем WebSocket уведомление о revoke через HTTP API
        # Это работает потому что web_session_connections хранится в server.py
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"http://localhost:8001/api/web-sessions/{full_session_token}/notify-revoked",
                    timeout=5.0
                )
        except Exception as ws_err:
            logger.warning(f"⚠️ Не удалось отправить WS уведомление: {ws_err}")
        
        # Удаляем сеанс
        result = await db.web_sessions.delete_one({"_id": session["_id"]})
        
        if result.deleted_count > 0:
            device_name = session.get("device_name", "Неизвестное устройство")
            await query.edit_message_text(
                text=(
                    f'<b><tg-emoji emoji-id="5213466161286517919">✅</tg-emoji> Сеанс удалён</b>\n'
                    f'<tg-emoji emoji-id="5407025283456835913">📱</tg-emoji> {device_name}\n'
                    f'<i>Устройство отключено от вашего профиля.</i>'
                ),
                parse_mode='HTML'
            )
            logger.info(f"🗑️ Пользователь {telegram_id} удалил сеанс {session_token_prefix}...")
        else:
            await query.edit_message_text(
                text='❌ <b>Ошибка</b>\n\n<i>Не удалось удалить сеанс.</i>',
                parse_mode='HTML'
            )
            
    except Exception as e:
        logger.error(f"❌ Ошибка при удалении сеанса: {e}", exc_info=True)
        await query.edit_message_text(
            text='❌ <b>Произошла ошибка</b>\n\n<i>Попробуйте позже.</i>',
            parse_mode='HTML'
        )


async def join_user_to_room(telegram_id: int, username: str, first_name: str, invite_token: str, referrer_id: int) -> dict:
    """
    Добавляет пользователя в комнату по токену приглашения
    Возвращает информацию о комнате и участниках для отправки уведомлений
    """
    import uuid
    
    # Находим комнату по токену
    room_doc = await db.rooms.find_one({"invite_token": invite_token})
    
    if not room_doc:
        logger.warning(f"⚠️ Комната с токеном {invite_token} не найдена")
        return None
    
    # Проверяем, не является ли пользователь уже участником
    is_already_participant = any(
        p["telegram_id"] == telegram_id 
        for p in room_doc.get("participants", [])
    )
    
    if is_already_participant:
        logger.info(f"ℹ️ Пользователь {telegram_id} уже является участником комнаты {room_doc['room_id']}")
        return {
            "room": room_doc,
            "is_new_member": False,
            "referrer_id": referrer_id
        }
    
    # Добавляем нового участника
    new_participant = {
        "telegram_id": telegram_id,
        "username": username,
        "first_name": first_name,
        "joined_at": datetime.utcnow(),
        "role": "member",
        "referral_code": str(referrer_id) if referrer_id else None,
        "tasks_completed": 0,
        "tasks_created": 0,
        "last_activity": datetime.utcnow()
    }
    
    await db.rooms.update_one(
        {"invite_token": invite_token},
        {
            "$push": {"participants": new_participant},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Автоматически добавляем пользователя во все групповые задачи комнаты
    tasks_cursor = db.group_tasks.find({"room_id": room_doc["room_id"]})
    async for task_doc in tasks_cursor:
        # Проверяем, не является ли уже участником задачи
        is_task_participant = any(
            p["telegram_id"] == telegram_id 
            for p in task_doc.get("participants", [])
        )
        
        if not is_task_participant:
            task_participant = {
                "telegram_id": telegram_id,
                "username": username,
                "first_name": first_name,
                "role": "member"
            }
            
            await db.group_tasks.update_one(
                {"task_id": task_doc["task_id"]},
                {
                    "$push": {"participants": task_participant},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
    
    logger.info(f"✅ Пользователь {telegram_id} добавлен в комнату {room_doc['room_id']}")
    
    # Получаем обновленную комнату
    updated_room = await db.rooms.find_one({"invite_token": invite_token})
    
    return {
        "room": updated_room,
        "is_new_member": True,
        "referrer_id": referrer_id,
        "new_participant": new_participant
    }


async def send_room_join_notifications(bot, room_data: dict, new_user_name: str, new_user_id: int):
    """
    Отправляет уведомления всем участникам комнаты и новому участнику о вступлении.

    P1 (instrUIDprofile.md): для pseudo_tid (VK/Email) создаём in-app вместо
    silent-skip. Real TG юзеры получают и in-app, и bot-push.
    """
    if not room_data or not room_data.get("is_new_member"):
        return

    room = room_data["room"]
    room_name = room.get("name", "комнату")
    participants = room.get("participants", [])
    room_id = room.get("id") or room.get("_id")

    # Для in-app создания нужен db
    try:
        from server import db
    except Exception:
        db = None

    # 1. Приветствие новому участнику (in-app всегда + TG если real)
    new_member_tg = (
        f'<tg-emoji emoji-id="5264943697971132520">🎉</tg-emoji> <b>Добро пожаловать в комнату!</b>\n'
        f'\n'
        f'<tg-emoji emoji-id="5372926953978341366">👥</tg-emoji> Комната: <b>{room_name}</b>\n'
        f'<tg-emoji emoji-id="5372926953978341366">👥</tg-emoji> Участников: {len(participants)}\n'
        f'\n'
        f'<tg-emoji emoji-id="5213466161286517919">✅</tg-emoji> Вы успешно присоединились!\n'
        f'\n'
        f'<i>Откройте приложение, чтобы увидеть задачи комнаты</i>'
    )
    try:
        if db is not None:
            await _notify_user(
                db,
                bot,
                telegram_id=new_user_id,
                title=f"🎉 Добро пожаловать в «{room_name}»",
                message=f"Вы успешно присоединились к комнате. Участников: {len(participants)}.",
                emoji="🎉",
                type="room_invite",
                category="rooms",
                priority="normal",
                data={"room_id": room_id, "room_name": room_name, "kind": "welcome"},
                telegram_text=new_member_tg,
                log_ctx="room_welcome",
            )
            logger.info(f"✅ Room-welcome delivered uid/tid={new_user_id} (room={room_name})")
    except Exception as e:
        logger.warning(f"⚠️ room-welcome delivery failed for tid={new_user_id}: {e}")

    # 2. Уведомления существующим участникам (in-app всем + TG-push для real)
    for participant in participants:
        participant_id = participant.get("telegram_id")

        # Пропускаем нового участника
        if participant_id == new_user_id:
            continue

        existing_member_tg = (
            f'<tg-emoji emoji-id="5170203290721321766">👋</tg-emoji> <b>Новый участник в комнате!</b>\n'
            f'\n'
            f'<tg-emoji emoji-id="5372926953978341366">👥</tg-emoji> Комната: <b>{room_name}</b>\n'
            f'<tg-emoji emoji-id="5472164874886846699">✨</tg-emoji> К команде присоединился: <b>{new_user_name}</b>\n'
            f'<tg-emoji emoji-id="5372926953978341366">👥</tg-emoji> Всего участников: {len(participants)}'
        )
        try:
            if db is not None:
                await _notify_user(
                    db,
                    bot,
                    telegram_id=participant_id,
                    title=f"👋 Новый участник в «{room_name}»",
                    message=f"К команде присоединился {new_user_name}. Всего участников: {len(participants)}.",
                    emoji="👥",
                    type="room_member_joined",
                    category="rooms",
                    priority="normal",
                    data={"room_id": room_id, "room_name": room_name, "new_user_id": new_user_id, "new_user_name": new_user_name},
                    telegram_text=existing_member_tg,
                    log_ctx="room_new_member",
                )
        except Exception as e:
            logger.warning(f"⚠️ room-new-member delivery failed tid={participant_id}: {e}")



async def join_user_to_journal(telegram_id: int, username: str, first_name: str, invite_token: str) -> dict:
    """
    Добавляет пользователя в список ожидающих участников журнала
    """
    import uuid
    
    # Находим журнал по токену
    journal_doc = await db.attendance_journals.find_one({"invite_token": invite_token})
    
    if not journal_doc:
        logger.warning(f"⚠️ Журнал с токеном {invite_token} не найден")
        return None
    
    journal_id = journal_doc["journal_id"]
    
    # Проверяем, не является ли пользователь уже создателем
    if journal_doc.get("owner_id") == telegram_id:
        return {
            "journal": journal_doc,
            "status": "owner"
        }

    # Проверяем, не привязан ли уже студент к этому telegram_id
    linked_student = await db.journal_students.find_one({
        "journal_id": journal_id,
        "telegram_id": telegram_id
    })
    
    if linked_student:
        return {
            "journal": journal_doc,
            "status": "already_linked",
            "student": linked_student
        }
        
    # Проверяем, есть ли уже в ожидающих
    pending = await db.journal_pending_members.find_one({
        "journal_id": journal_id,
        "telegram_id": telegram_id
    })
    
    if pending:
        return {
            "journal": journal_doc,
            "status": "pending"
        }
        
    # Добавляем в ожидающие
    pending_member = {
        "id": str(uuid.uuid4()),
        "journal_id": journal_id,
        "telegram_id": telegram_id,
        "username": username,
        "first_name": first_name,
        "joined_at": datetime.utcnow(),
        "is_linked": False
    }
    
    await db.journal_pending_members.insert_one(pending_member)
    
    logger.info(f"✅ Пользователь {telegram_id} добавлен в ожидающие журнала {journal_id}")
    
    return {
        "journal": journal_doc,
        "status": "added_to_pending"
    }


async def join_user_to_journal_by_student_code(telegram_id: int, username: str, first_name: str, student_invite_code: str) -> dict:
    """
    Привязывает пользователя к конкретному студенту в журнале по персональной ссылке
    """
    # Находим студента по invite_code
    student = await db.journal_students.find_one({"invite_code": student_invite_code})
    
    if not student:
        logger.warning(f"⚠️ Студент с invite_code {student_invite_code} не найден")
        return None
    
    journal_id = student["journal_id"]
    
    # Находим журнал
    journal_doc = await db.attendance_journals.find_one({"journal_id": journal_id})
    
    if not journal_doc:
        logger.warning(f"⚠️ Журнал {journal_id} не найден")
        return None
    
    # Проверяем, не является ли пользователь владельцем
    if journal_doc.get("owner_id") == telegram_id:
        return {
            "journal": journal_doc,
            "student": student,
            "status": "owner"
        }
    
    # Проверяем, не занято ли уже место другим пользователем
    if student.get("is_linked") and student.get("telegram_id") != telegram_id:
        return {
            "journal": journal_doc,
            "student": student,
            "status": "occupied"
        }
    
    # Проверяем, не привязан ли уже этот пользователь к другому студенту
    existing_link = await db.journal_students.find_one({
        "journal_id": journal_id,
        "telegram_id": telegram_id,
        "is_linked": True
    })
    if existing_link and existing_link["id"] != student["id"]:
        return {
            "journal": journal_doc,
            "student": existing_link,
            "status": "already_linked_other"
        }
    
    # Если уже привязан к этому же студенту
    if student.get("is_linked") and student.get("telegram_id") == telegram_id:
        return {
            "journal": journal_doc,
            "student": student,
            "status": "already_linked"
        }
    
    # Привязываем пользователя к студенту
    await db.journal_students.update_one(
        {"id": student["id"]},
        {"$set": {
            "telegram_id": telegram_id,
            "username": username,
            "first_name": first_name,
            "is_linked": True,
            "linked_at": datetime.utcnow()
        }}
    )
    
    # Удаляем из pending если был там
    await db.journal_pending_members.delete_many({
        "journal_id": journal_id,
        "telegram_id": telegram_id
    })
    
    # Обновляем студента в локальной переменной для ответа
    student["telegram_id"] = telegram_id
    student["username"] = username
    student["first_name"] = first_name
    student["is_linked"] = True
    
    logger.info(f"✅ Пользователь {telegram_id} привязан к студенту '{student['full_name']}' в журнале {journal_id}")
    
    return {
        "journal": journal_doc,
        "student": student,
        "status": "linked"
    }


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обработчик команды /start
    - Проверяет наличие пользователя в БД
    - Создает нового пользователя при первом запуске
    - Обрабатывает реферальные ссылки (ref_CODE)
    - Обрабатывает приглашения в комнаты (room_{token}_ref_{user_id})
    - Обрабатывает приглашения в журнал (journal_{invite_token})
    - Обрабатывает персональные ссылки студентов (jstudent_{invite_code})
    - Отправляет приветственное сообщение
    - Добавляет кнопку для открытия Web App
    """
    user = update.effective_user
    
    if not user:
        logger.warning("Не удалось получить информацию о пользователе")
        return
    
    telegram_id = user.id
    username = user.username
    first_name = user.first_name or ""
    last_name = user.last_name or ""
    
    # Проверяем наличие параметров в команде /start
    referral_code = None
    room_invite_token = None
    room_referrer_id = None
    journal_invite_token = None
    student_invite_code = None  # Персональная ссылка студента
    
    if context.args and len(context.args) > 0:
        arg = context.args[0]
        
        # Проверяем на приглашение в комнату: room_{invite_token}_ref_{user_id}
        if arg.startswith("room_"):
            parts = arg.split("_")
            if len(parts) >= 4 and parts[2] == "ref":
                room_invite_token = parts[1]
                try:
                    room_referrer_id = int(parts[3])
                    logger.info(f"🏠 Обнаружено приглашение в комнату: token={room_invite_token}, referrer={room_referrer_id}")
                except ValueError:
                    logger.warning(f"⚠️ Некорректный ID пользователя в приглашении: {parts[3]}")
        
        # Проверяем на персональную ссылку студента: jstudent_{invite_code}
        elif arg.startswith("jstudent_"):
            student_invite_code = arg[9:]  # Убираем префикс "jstudent_"
            logger.info(f"👤 Обнаружена персональная ссылка студента: code={student_invite_code}")
        
        # Проверяем на приглашение в журнал: journal_{invite_token}
        elif arg.startswith("journal_"):
            journal_invite_token = arg[8:]  # Убираем префикс "journal_"
            logger.info(f"📚 Обнаружено приглашение в журнал: token={journal_invite_token}")

        # Проверяем на обычный реферальный код: ref_CODE
        elif arg.startswith("ref_"):
            referral_code = arg[4:]  # Убираем префикс "ref_"
            logger.info(f"🔗 Обнаружен реферальный код: {referral_code}")
    
    logger.info(f"Команда /start от пользователя: {telegram_id} (@{username})")
    
    try:
        # Проверяем, существует ли пользователь в БД
        existing_user = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        # Обрабатываем приглашение в комнату (если есть)
        room_join_data = None
        if room_invite_token:
            room_join_data = await join_user_to_room(
                telegram_id=telegram_id,
                username=username,
                first_name=first_name,
                invite_token=room_invite_token,
                referrer_id=room_referrer_id
            )
            
            if room_join_data and room_join_data.get("is_new_member"):
                # Отправляем уведомления всем участникам комнаты
                from telegram import Bot
                bot = Bot(token=TELEGRAM_BOT_TOKEN)
                await send_room_join_notifications(
                    bot=bot,
                    room_data=room_join_data,
                    new_user_name=first_name,
                    new_user_id=telegram_id
                )
        
        # Обрабатываем приглашение в журнал (если есть)
        journal_join_data = None
        if journal_invite_token:
            journal_join_data = await join_user_to_journal(
                telegram_id=telegram_id,
                username=username,
                first_name=first_name,
                invite_token=journal_invite_token
            )
        
        # Обрабатываем персональную ссылку студента (если есть)
        student_join_data = None
        if student_invite_code:
            student_join_data = await join_user_to_journal_by_student_code(
                telegram_id=telegram_id,
                username=username,
                first_name=first_name,
                student_invite_code=student_invite_code
            )
        
        if not existing_user:
            # Создаем нового пользователя
            import uuid
            new_user = {
                "id": str(uuid.uuid4()),
                "telegram_id": telegram_id,
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "last_activity": datetime.utcnow(),
                "notifications_enabled": False,
                "notification_time": 10,
                "referral_points_earned": 0
            }
            
            # Обрабатываем реферальный код если он есть
            if referral_code:
                # Ищем пользователя по реферальному коду
                referrer = await db.user_settings.find_one({"referral_code": referral_code})
                
                if referrer and referrer["telegram_id"] != telegram_id:
                    referrer_id = referrer["telegram_id"]
                    new_user["referred_by"] = referrer_id
                    logger.info(f"✅ Пользователь {telegram_id} приглашён пользователем {referrer_id}")
                    
                    # Создаём реферальные связи (до 3 уровней)
                    await create_referral_connections(telegram_id, referrer_id)
                    
                    # Начисляем бонус за приглашение (базовое количество баллов)
                    bonus_points = 100  # бонус за каждого нового реферала
                    await award_referral_bonus(referrer_id, telegram_id, bonus_points, 1)
                    
                    # Уведомляем пригласившего (P1: через delivery — in-app + TG)
                    try:
                        referrer_name = f"{first_name} {last_name}".strip()
                        tg_text = (
                            f'<tg-emoji emoji-id="5264943697971132520">🎉</tg-emoji>  <b>Новый реферал!</b>\n'
                            f'{referrer_name} присоединился по вашей пригласительной ссылке.\n'
                            f'<tg-emoji emoji-id="5325521342643064145">💰</tg-emoji> Начислено: <b>+{bonus_points} баллов</b>\n'
                            f'Приглашайте друзей — получайте бонусы!'
                        )
                        await _notify_user(
                            db,
                            bot=None,   # bot создаём внутри safe_send, но здесь пусть delivery сделает свой
                            telegram_id=referrer_id,
                            title="🎉 Новый реферал!",
                            message=f"{referrer_name} присоединился по вашей ссылке. Начислено +{bonus_points} баллов.",
                            emoji="💰",
                            type="announcement",
                            category="system",
                            priority="normal",
                            data={
                                "referred_telegram_id": telegram_id,
                                "referred_name": referrer_name,
                                "bonus_points": bonus_points,
                            },
                            telegram_text=tg_text,
                            log_ctx="referral_bonus",
                        )
                        # Если bot=None — delivery не отправил TG сам. Но referrer может
                        # быть real TG → используем safe_send_telegram (guarded).
                        if is_real_telegram_user(referrer_id):
                            from telegram import Bot
                            _bot = Bot(token=TELEGRAM_BOT_TOKEN)
                            await safe_send_telegram(
                                _bot,
                                referrer_id,
                                text=tg_text,
                                parse_mode="HTML",
                                log_ctx="referral_bonus_tg",
                            )
                    except Exception as e:
                        logger.warning(f"Не удалось отправить уведомление пригласившему: {e}")
                else:
                    logger.warning(f"⚠️ Реферальный код {referral_code} не найден или некорректен")
            
            await db.user_settings.insert_one(new_user)
            logger.info(f"✅ Создан новый пользователь: {telegram_id} (@{username})")
            
            # Приветственное сообщение для нового пользователя
            if room_join_data and room_join_data.get("room"):
                # Приветствие при присоединении к комнате
                room = room_join_data["room"]
                room_name = room.get("name", "комнату")
                welcome_text = f"""🎓 Привет, {first_name}! Добро пожаловать в <b>RUDN Go</b>!

🏠 Вы присоединились к комнате: <b>{room_name}</b>

🚀 <b>Твой персональный помощник в учебе и командной работе</b>

<i>Нажимай кнопку ниже, чтобы начать! 👇</i>"""
            elif journal_join_data and journal_join_data.get("journal"):
                # Приветствие при присоединении к журналу
                journal = journal_join_data["journal"]
                journal_name = journal.get("name", "Журнал")
                group_name = journal.get("group_name", "")
                
                status = journal_join_data.get("status")
                if status == "added_to_pending":
                    status_text = "⏳ Ваш запрос на вступление отправлен старосте."
                elif status == "already_linked":
                    status_text = "✅ Вы уже являетесь участником этого журнала."
                else:
                    status_text = "✅ Вы успешно присоединились!"

                welcome_text = f"""🎓 Привет, {first_name}! Добро пожаловать в <b>RUDN Go</b>!

📚 Вы перешли по ссылке в журнал: <b>{journal_name}</b> ({group_name})
{status_text}

🚀 <b>Твой персональный помощник в учебе</b>

<i>Нажимай кнопку ниже, чтобы начать! 👇</i>"""
            elif student_join_data and student_join_data.get("journal"):
                # Приветствие при присоединении по персональной ссылке студента
                journal = student_join_data["journal"]
                student = student_join_data.get("student", {})
                journal_name = journal.get("name", "Журнал")
                student_name = student.get("full_name", "")
                
                status = student_join_data.get("status")
                if status == "linked":
                    status_text = f"✅ Вы успешно привязаны как <b>{student_name}</b>!"
                elif status == "occupied":
                    status_text = f"❌ Место «{student_name}» уже занято другим пользователем."
                elif status == "already_linked":
                    status_text = f"✅ Вы уже привязаны как <b>{student_name}</b>."
                elif status == "already_linked_other":
                    status_text = f"ℹ️ Вы уже привязаны как <b>{student_name}</b> в этом журнале."
                elif status == "owner":
                    status_text = "👑 Вы являетесь старостой этого журнала."
                else:
                    status_text = "✅ Переход выполнен!"

                welcome_text = f"""🎓 Привет, {first_name}! Добро пожаловать в <b>RUDN Go</b>!

📚 Журнал: <b>{journal_name}</b>
{status_text}

🚀 <b>Твой персональный помощник в учебе</b>

<i>Нажимай кнопку ниже, чтобы начать! 👇</i>"""
            elif referral_code and new_user.get("referred_by"):
                referrer_info = await db.user_settings.find_one({"telegram_id": new_user["referred_by"]})
                referrer_name = referrer_info.get("first_name", "друг") if referrer_info else "друг"
                welcome_text = f"""🎓 Привет, {first_name}! Добро пожаловать в <b>RUDN Go</b>!

🎁 Вы присоединились по приглашению <b>{referrer_name}</b>!

🚀 <b>Твой персональный помощник в учебе</b>

<i>Нажимай кнопку ниже, чтобы начать! 👇</i>"""
            else:
                welcome_text = f"""🎓 Привет, {first_name}! Добро пожаловать в <b>RUDN Go</b>!

🚀 <b>Твой персональный помощник в учебе</b>

<i>Нажимай кнопку ниже, чтобы начать! 👇</i>"""
        else:
            # Обновляем время последней активности
            await db.user_settings.update_one(
                {"telegram_id": telegram_id},
                {"$set": {"last_activity": datetime.utcnow()}}
            )
            logger.info(f"♻️ Пользователь вернулся: {telegram_id} (@{username})")
            
            # Приветственное сообщение для вернувшегося пользователя
            if room_join_data and room_join_data.get("room"):
                # Если пользователь вернулся и присоединился к комнате
                room = room_join_data["room"]
                room_name = room.get("name", "комнату")
                if room_join_data.get("is_new_member"):
                    welcome_text = f"""👋 С возвращением, {first_name}!

🏠 Отличные новости! Вы присоединились к комнате: <b>{room_name}</b>

<i>Открой приложение, чтобы увидеть задачи комнаты! 👇</i>"""
                else:
                    welcome_text = f"""👋 С возвращением, {first_name}!

ℹ️ Вы уже являетесь участником комнаты <b>{room_name}</b>

<i>Открой приложение и продолжай работу! 👇</i>"""
            elif journal_join_data and journal_join_data.get("journal"):
                # Если пользователь вернулся и присоединился к журналу
                journal = journal_join_data["journal"]
                journal_name = journal.get("name", "Журнал")
                status = journal_join_data.get("status")
                
                if status == "added_to_pending":
                    welcome_text = f"""👋 С возвращением, {first_name}!

📚 Вы подали заявку на вступление в журнал <b>{journal_name}</b>.
⏳ Староста должен подтвердить вашу заявку.

<i>Открой приложение, чтобы проверить статус! 👇</i>"""
                elif status == "already_linked":
                    welcome_text = f"""👋 С возвращением, {first_name}!

ℹ️ Вы уже привязаны к журналу <b>{journal_name}</b>.

<i>Открой приложение и отмечай посещаемость! 👇</i>"""
                elif status == "owner":
                    welcome_text = f"""👋 С возвращением, {first_name}!

👑 Вы являетесь старостой журнала <b>{journal_name}</b>.

<i>Открой приложение для управления журналом! 👇</i>"""
                else:
                    welcome_text = f"""👋 С возвращением, {first_name}!

📚 Вы перешли в журнал <b>{journal_name}</b>.

<i>Открой приложение и продолжай работу! 👇</i>"""
            elif student_join_data and student_join_data.get("journal"):
                # Если пользователь вернулся и привязался по персональной ссылке
                journal = student_join_data["journal"]
                student = student_join_data.get("student", {})
                journal_name = journal.get("name", "Журнал")
                student_name = student.get("full_name", "")
                status = student_join_data.get("status")
                
                if status == "linked":
                    welcome_text = f"""👋 С возвращением, {first_name}!

📚 Журнал: <b>{journal_name}</b>
✅ Вы успешно привязаны как <b>{student_name}</b>!

<i>Открой приложение и отмечай посещаемость! 👇</i>"""
                elif status == "occupied":
                    welcome_text = f"""👋 С возвращением, {first_name}!

📚 Журнал: <b>{journal_name}</b>
❌ Место «{student_name}» уже занято другим пользователем.

<i>Обратитесь к старосте для решения вопроса. 👇</i>"""
                elif status == "already_linked":
                    welcome_text = f"""👋 С возвращением, {first_name}!

📚 Журнал: <b>{journal_name}</b>
ℹ️ Вы уже привязаны как <b>{student_name}</b>.

<i>Открой приложение и продолжай работу! 👇</i>"""
                elif status == "already_linked_other":
                    welcome_text = f"""👋 С возвращением, {first_name}!

📚 Журнал: <b>{journal_name}</b>
ℹ️ Вы уже привязаны как <b>{student_name}</b> в этом журнале.

<i>Открой приложение и продолжай работу! 👇</i>"""
                elif status == "owner":
                    welcome_text = f"""👋 С возвращением, {first_name}!

👑 Вы являетесь старостой журнала <b>{journal_name}</b>.

<i>Открой приложение для управления журналом! 👇</i>"""
                else:
                    welcome_text = f"""👋 С возвращением, {first_name}!

📚 Вы перешли в журнал <b>{journal_name}</b>.

<i>Открой приложение и продолжай работу! 👇</i>"""
            else:
                welcome_text = (
                    f'<tg-emoji emoji-id="5294461573677462235">👋</tg-emoji> <b>С возвращением, {first_name}!</b>\n'
                    f'Рады снова тебя видеть в RUDN Go! <tg-emoji emoji-id="5210718537563280622">🎓</tg-emoji>\n'
                    f'<i>Открой приложение и продолжай работу!</i> <tg-emoji emoji-id="5454354268280613996">👇</tg-emoji>'
                )
        
        # Создаем кнопку для открытия Web App
        keyboard = [
            [InlineKeyboardButton(
                text="📅 Открыть расписание",
                web_app=WebAppInfo(url=WEB_APP_URL)
            )]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        # Отправляем сообщение с кнопкой
        await update.message.reply_text(
            text=welcome_text,
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
        
        logger.info(f"✅ Отправлено приветствие пользователю {telegram_id}")
        
    except Exception as e:
        logger.error(f"❌ Ошибка при обработке /start: {e}", exc_info=True)
        await update.message.reply_text(
            "Произошла ошибка. Попробуйте позже или обратитесь в поддержку."
        )


def generate_users_table_image(users_data, page_num=1, total_pages=1):
    """
    Генерирует изображение таблицы с пользователями
    """
    # Настройки таблицы
    row_height = 45
    header_height = 50
    padding = 15
    col_widths = [60, 200, 150, 150, 120]  # №, Имя, Username, Группа, Активность
    total_width = sum(col_widths) + padding * 2
    
    # Вычисляем высоту изображения
    table_height = header_height + len(users_data) * row_height + padding * 2
    
    # Создаем изображение
    img = Image.new('RGB', (total_width, table_height), color='#1a1d29')
    draw = ImageDraw.Draw(img)
    
    # Пытаемся загрузить шрифт, если не получается - используем дефолтный
    try:
        font_header = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
        font_cell = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    except Exception:
        font_header = ImageFont.load_default()
        font_cell = ImageFont.load_default()
    
    # Рисуем заголовок таблицы
    y_offset = padding
    
    # Фон заголовка
    draw.rectangle(
        [(padding, y_offset), (total_width - padding, y_offset + header_height)],
        fill='#2d3142'
    )
    
    # Заголовки колонок
    headers = ['№', 'Имя', 'Username', 'Группа', 'Активность']
    x_offset = padding + 10
    
    for i, header in enumerate(headers):
        draw.text(
            (x_offset, y_offset + 15),
            header,
            fill='#ffffff',
            font=font_header
        )
        x_offset += col_widths[i]
    
    y_offset += header_height
    
    # Рисуем строки с данными
    for idx, user in enumerate(users_data):
        # Цвет фона строки (чередующийся)
        row_color = '#22242f' if idx % 2 == 0 else '#1a1d29'
        
        draw.rectangle(
            [(padding, y_offset), (total_width - padding, y_offset + row_height)],
            fill=row_color
        )
        
        # Данные строки
        row_data = [
            str(user['idx']),
            user['name'][:20] + '...' if len(user['name']) > 20 else user['name'],
            '@' + user['username'][:15] + '...' if len(user['username']) > 15 else '@' + user['username'],
            user['group'][:18] + '...' if len(user['group']) > 18 else user['group'],
            user['activity']
        ]
        
        x_offset = padding + 10
        
        for i, data in enumerate(row_data):
            draw.text(
                (x_offset, y_offset + 12),
                data,
                fill='#e0e0e0',
                font=font_cell
            )
            x_offset += col_widths[i]
        
        y_offset += row_height
    
    # Рисуем информацию о странице внизу если страниц больше одной
    if total_pages > 1:
        footer_text = f"Страница {page_num} из {total_pages}"
        draw.text(
            (total_width // 2 - 50, table_height - 25),
            footer_text,
            fill='#888888',
            font=font_cell
        )
    
    return img


async def users_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обработчик команды /users
    Показывает список всех пользователей в виде таблицы-изображения (только для администраторов)
    """
    user = update.effective_user
    
    if not user:
        logger.warning("Не удалось получить информацию о пользователе")
        return
    
    telegram_id = user.id
    
    # Проверка прав администратора
    if telegram_id not in ADMIN_IDS:
        logger.warning(f"Неавторизованная попытка использовать /users от {telegram_id} (@{user.username})")
        await update.message.reply_text(
            "❌ У вас нет прав для использования этой команды."
        )
        return
    
    logger.info(f"Команда /users от администратора: {telegram_id} (@{user.username})")
    
    try:
        # Отправляем сообщение о начале генерации
        status_message = await update.message.reply_text("⏳ Генерирую таблицу пользователей...")
        
        # Получаем всех пользователей из БД
        users_cursor = db.user_settings.find().sort("created_at", -1)
        users_list = await users_cursor.to_list(length=None)
        
        if not users_list:
            await status_message.edit_text("📭 Пользователей в базе данных пока нет.")
            return
        
        # Подготавливаем данные для таблицы
        table_data = []
        
        for idx, user_data in enumerate(users_list, 1):
            first_name = user_data.get('first_name', '')
            last_name = user_data.get('last_name', '')
            full_name = f"{first_name} {last_name}".strip() or "Нет имени"
            username = user_data.get('username', 'нет')
            group_name = user_data.get('group_name', 'Не выбрана')
            last_activity = user_data.get('last_activity')
            
            # Форматируем последнюю активность
            if last_activity:
                if isinstance(last_activity, str):
                    from datetime import datetime as dt
                    last_activity = dt.fromisoformat(last_activity.replace('Z', '+00:00'))
                
                time_diff = datetime.utcnow() - last_activity
                if time_diff.days == 0:
                    activity_str = "сегодня"
                elif time_diff.days == 1:
                    activity_str = "вчера"
                elif time_diff.days < 7:
                    activity_str = f"{time_diff.days}д назад"
                else:
                    activity_str = last_activity.strftime("%d.%m.%Y")
            else:
                activity_str = "N/A"
            
            table_data.append({
                'idx': idx,
                'name': full_name,
                'username': username,
                'group': group_name,
                'activity': activity_str
            })
        
        # Разбиваем на страницы (максимум 20 пользователей на изображение)
        users_per_page = 20
        total_pages = math.ceil(len(table_data) / users_per_page)
        
        # Генерируем и отправляем изображения
        for page_num in range(1, total_pages + 1):
            start_idx = (page_num - 1) * users_per_page
            end_idx = min(start_idx + users_per_page, len(table_data))
            page_data = table_data[start_idx:end_idx]
            
            # Генерируем изображение
            img = generate_users_table_image(page_data, page_num, total_pages)
            
            # Конвертируем в байты
            bio = io.BytesIO()
            bio.name = f'users_table_page_{page_num}.png'
            img.save(bio, 'PNG')
            bio.seek(0)
            
            # Отправляем изображение
            caption = f"👥 Список пользователей ({len(users_list)} чел.)"
            if total_pages > 1:
                caption += f" - Страница {page_num}/{total_pages}"
            
            await update.message.reply_photo(
                photo=bio,
                caption=caption
            )
            
            logger.info(f"✅ Отправлена страница {page_num}/{total_pages} таблицы пользователей")
        
        # Удаляем статусное сообщение
        await status_message.delete()
        
        logger.info(f"✅ Отправлен список из {len(users_list)} пользователей администратору {telegram_id}")
        
    except Exception as e:
        logger.error(f"❌ Ошибка при обработке /users: {e}", exc_info=True)
        await update.message.reply_text(
            "❌ Произошла ошибка при генерации таблицы пользователей."
        )


async def clear_db_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обработчик команды /clear_db
    Очищает всю базу данных (только для администраторов с паролем)
    Использование: /clear_db <пароль>
    """
    user = update.effective_user
    
    if not user:
        logger.warning("Не удалось получить информацию о пользователе")
        return
    
    telegram_id = user.id
    
    # Проверка прав администратора
    if telegram_id not in ADMIN_IDS:
        logger.warning(f"⛔️ Неавторизованная попытка использовать /clear_db от {telegram_id} (@{user.username})")
        await update.message.reply_text(
            "❌ У вас нет прав для использования этой команды."
        )
        return
    
    # Проверяем наличие пароля в аргументах
    if not context.args or len(context.args) == 0:
        await update.message.reply_text(
            "⚠️ <b>ВНИМАНИЕ: Опасная операция!</b>\n\n"
            "Команда /clear_db очистит <b>ВСЮ</b> базу данных.\n\n"
            "Для подтверждения используйте:\n"
            "<code>/clear_db &lt;пароль&gt;</code>\n\n"
            "🔐 Пароль должен быть известен только администратору.",
            parse_mode='HTML'
        )
        return
    
    # Получаем пароль из аргументов
    provided_password = " ".join(context.args)
    
    # Проверка пароля
    if provided_password != DB_CLEAR_PASSWORD:
        logger.warning(f"⛔️ Неверный пароль для /clear_db от {telegram_id} (@{user.username})")
        await update.message.reply_text(
            "❌ <b>Неверный пароль!</b>\n\n"
            "Доступ запрещён.",
            parse_mode='HTML'
        )
        return
    
    logger.warning(f"🚨 КРИТИЧЕСКАЯ ОПЕРАЦИЯ: Администратор {telegram_id} (@{user.username}) запросил очистку БД")
    
    try:
        await update.message.reply_text(
            "⏳ <b>Начинаю очистку базы данных...</b>",
            parse_mode='HTML'
        )
        
        # Список всех коллекций для очистки
        collections = [
            "user_settings",
            "user_stats",
            "user_achievements",
            "tasks",
            "rooms",
            "group_tasks",
            "group_task_invites",
            "group_task_comments",
            "schedule_cache",
            "sent_notifications",
            "status_checks"
        ]
        
        deleted_counts = {}
        total_deleted = 0
        
        # Очищаем каждую коллекцию
        for collection_name in collections:
            try:
                collection = db[collection_name]
                result = await collection.delete_many({})
                deleted_count = result.deleted_count
                deleted_counts[collection_name] = deleted_count
                total_deleted += deleted_count
                logger.info(f"✅ Коллекция '{collection_name}': удалено {deleted_count} документов")
            except Exception as e:
                logger.error(f"❌ Ошибка при очистке коллекции '{collection_name}': {e}")
                deleted_counts[collection_name] = f"Ошибка: {str(e)}"
        
        # Формируем отчёт
        report_lines = ["🗑 <b>База данных очищена!</b>\n"]
        report_lines.append(f"<b>Всего удалено:</b> {total_deleted} документов\n")
        report_lines.append("<b>Детали по коллекциям:</b>")
        
        for collection_name, count in deleted_counts.items():
            if isinstance(count, int):
                report_lines.append(f"  • {collection_name}: {count}")
            else:
                report_lines.append(f"  • {collection_name}: {count}")
        
        report = "\n".join(report_lines)
        
        await update.message.reply_text(report, parse_mode='HTML')
        
        logger.warning(f"🚨 БАЗА ДАННЫХ ОЧИЩЕНА администратором {telegram_id} (@{user.username})")
        logger.warning(f"📊 Удалено {total_deleted} документов из {len(collections)} коллекций")
        
    except Exception as e:
        logger.error(f"❌ Критическая ошибка при очистке БД: {e}", exc_info=True)
        await update.message.reply_text(
            "❌ <b>Произошла критическая ошибка при очистке базы данных!</b>\n\n"
            f"Ошибка: {str(e)}",
            parse_mode='HTML'
        )


def main() -> None:
    """Запуск бота"""
    
    if not TELEGRAM_BOT_TOKEN:
        logger.error("❌ Токен бота не найден! Проверьте TELEGRAM_BOT_TOKEN и TEST_TELEGRAM_BOT_TOKEN в .env файле!")
        return
    
    # Проверяем, не запущен ли бот в другом процессе или если это dev-окружение
    # В server.py бот запускается в фоновом режиме через get_notification_service
    # Поэтому здесь мы не должны запускать polling если этот скрипт импортируется или запускается вместе с server.py
    # Но этот файл запускается отдельно через Supervisor?
    
    env_mode = "TEST" if is_test_environment() else "PRODUCTION"
    logger.info(f"🤖 Запуск Telegram бота в режиме {env_mode}...")
    logger.info(f"📍 Web App URL: {WEB_APP_URL}")
    logger.info(f"💾 MongoDB: {MONGO_URL}")
    logger.info(f"🗄 Database: {DB_NAME}")
    
    # Создаем приложение
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    
    # Регистрируем обработчики команд
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("users", users_command))
    application.add_handler(CommandHandler("clear_db", clear_db_command))
    
    # Регистрируем обработчик callback_query для inline-кнопок
    application.add_handler(CallbackQueryHandler(handle_revoke_device_callback, pattern=r"^revoke_device_"))
    
    logger.info("✅ Бот успешно запущен и готов к работе!")
    logger.info("📝 Доступные команды: /start, /users (только для админов), /clear_db (только для админов)")
    
    # В режиме preview мы можем столкнуться с Conflict, если бот запущен где-то еще.
    # Мы попробуем запустить polling, но с обработкой ошибок.
    try:
        # Запускаем бота (эта функция блокирует поток)
        application.run_polling(
            allowed_updates=Update.ALL_TYPES,
            drop_pending_updates=True,  # Игнорируем старые обновления
            poll_interval=2.0 # Увеличиваем интервал для снижения нагрузки
        )
    except Exception as e:
        error_msg = str(e)
        if "Conflict" in error_msg:
             logger.error("❌ Ошибка Conflict: Бот уже запущен в другом месте. Polling отключен в этом процессе.")
             # В этом случае мы просто выходим, так как бот не может работать
             # Но если это supervisor, он попытается перезапустить. 
             # Поэтому лучше просто уснуть навсегда, чтобы процесс висел, но не падал
             import time
             while True:
                 time.sleep(3600)
        else:
            raise e


if __name__ == '__main__':
    main()
