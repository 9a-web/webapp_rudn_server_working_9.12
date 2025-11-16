"""
Telegram Bot для RUDN Schedule
Обрабатывает команду /start и открывает Web App
"""

import os
import logging
import asyncio
import signal
from telegram import Update, WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from datetime import datetime

# Загрузка переменных окружения
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Получение переменных окружения
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "test_database")
WEB_APP_URL = "https://rudn-schedule.ru"

# ID администраторов (могут использовать команду /users и /clear_db)
ADMIN_IDS = [765963392, 1311283832]

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
    Отправляет уведомления всем участникам комнаты и новому участнику о вступлении
    """
    if not room_data or not room_data.get("is_new_member"):
        return
    
    room = room_data["room"]
    room_name = room.get("name", "комнату")
    participants = room.get("participants", [])
    
    # Отправляем уведомление новому участнику
    try:
        new_member_message = f"""🎉 <b>Добро пожаловать в комнату!</b>

📋 Комната: <b>{room_name}</b>
👥 Участников: {len(participants)}

✅ Вы успешно присоединились к командной комнате для совместного выполнения задач!

<i>Откройте приложение, чтобы увидеть задачи комнаты 👇</i>"""
        
        await bot.send_message(
            chat_id=new_user_id,
            text=new_member_message,
            parse_mode='HTML'
        )
        logger.info(f"✅ Отправлено уведомление новому участнику {new_user_id}")
    except Exception as e:
        logger.warning(f"⚠️ Не удалось отправить уведомление новому участнику {new_user_id}: {e}")
    
    # Отправляем уведомления всем существующим участникам (кроме нового)
    for participant in participants:
        participant_id = participant.get("telegram_id")
        
        # Пропускаем нового участника
        if participant_id == new_user_id:
            continue
        
        try:
            existing_member_message = f"""👋 <b>Новый участник в комнате!</b>

📋 Комната: <b>{room_name}</b>
✨ К команде присоединился: <b>{new_user_name}</b>
👥 Всего участников: {len(participants)}

<i>Продолжайте выполнять задачи вместе! 💪</i>"""
            
            await bot.send_message(
                chat_id=participant_id,
                text=existing_member_message,
                parse_mode='HTML'
            )
            logger.info(f"✅ Отправлено уведомление участнику {participant_id}")
        except Exception as e:
            logger.warning(f"⚠️ Не удалось отправить уведомление участнику {participant_id}: {e}")


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обработчик команды /start
    - Проверяет наличие пользователя в БД
    - Создает нового пользователя при первом запуске
    - Обрабатывает реферальные ссылки (ref_CODE)
    - Обрабатывает приглашения в комнаты (room_{token}_ref_{user_id})
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
                    
                    # Уведомляем пригласившего (опционально)
                    try:
                        from telegram import Bot
                        bot = Bot(token=TELEGRAM_BOT_TOKEN)
                        referrer_name = f"{first_name} {last_name}".strip()
                        await bot.send_message(
                            chat_id=referrer_id,
                            text=f"🎉 Отличные новости!\n\n<b>{referrer_name}</b> присоединился по вашей реферальной ссылке!\n\n💰 Вы получили <b>{bonus_points} баллов</b>",
                            parse_mode='HTML'
                        )
                    except Exception as e:
                        logger.warning(f"Не удалось отправить уведомление пригласившему: {e}")
                else:
                    logger.warning(f"⚠️ Реферальный код {referral_code} не найден или некорректен")
            
            await db.user_settings.insert_one(new_user)
            logger.info(f"✅ Создан новый пользователь: {telegram_id} (@{username})")
            
            # Приветственное сообщение для нового пользователя
            if referral_code and new_user.get("referred_by"):
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
            welcome_text = f"""👋 С возвращением, {first_name}!

Рад снова тебя видеть в <b>RUDN Go</b>! 

<i>Открой приложение и продолжай работу! 👇</i>"""
        
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


async def users_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обработчик команды /users
    Показывает список всех пользователей (только для администраторов)
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
        # Получаем всех пользователей из БД
        users_cursor = db.user_settings.find().sort("created_at", -1)
        users_list = await users_cursor.to_list(length=None)
        
        if not users_list:
            await update.message.reply_text("📭 Пользователей в базе данных пока нет.")
            return
        
        # Формируем сообщение со списком пользователей
        message_parts = [f"👥 <b>Список пользователей</b> ({len(users_list)} чел.)\n"]
        
        for idx, user_data in enumerate(users_list, 1):
            telegram_id = user_data.get('telegram_id', 'N/A')
            username = user_data.get('username', 'нет')
            first_name = user_data.get('first_name', '')
            last_name = user_data.get('last_name', '')
            full_name = f"{first_name} {last_name}".strip() or "Нет имени"
            
            group_name = user_data.get('group_name', 'Не выбрана')
            created_at = user_data.get('created_at')
            last_activity = user_data.get('last_activity')
            
            # Форматируем дату регистрации
            if created_at:
                if isinstance(created_at, str):
                    from datetime import datetime as dt
                    created_at = dt.fromisoformat(created_at.replace('Z', '+00:00'))
                date_str = created_at.strftime("%d.%m.%Y")
            else:
                date_str = "N/A"
            
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
                    activity_str = f"{time_diff.days} дн. назад"
                else:
                    activity_str = last_activity.strftime("%d.%m.%Y")
            else:
                activity_str = "N/A"
            
            user_line = f"\n{idx}. <b>{full_name}</b> (@{username})\n"
            user_line += f"   ID: <code>{telegram_id}</code>\n"
            user_line += f"   Группа: {group_name}\n"
            user_line += f"   Регистрация: {date_str}\n"
            user_line += f"   Активность: {activity_str}\n"
            
            message_parts.append(user_line)
        
        # Telegram ограничивает сообщения 4096 символами
        # Разбиваем на несколько сообщений если нужно
        full_message = "".join(message_parts)
        
        if len(full_message) <= 4096:
            await update.message.reply_text(full_message, parse_mode='HTML')
        else:
            # Разбиваем на части
            current_message = message_parts[0]  # Заголовок
            
            for part in message_parts[1:]:
                if len(current_message) + len(part) <= 4000:
                    current_message += part
                else:
                    await update.message.reply_text(current_message, parse_mode='HTML')
                    current_message = part
            
            # Отправляем последнюю часть
            if current_message:
                await update.message.reply_text(current_message, parse_mode='HTML')
        
        logger.info(f"✅ Отправлен список из {len(users_list)} пользователей администратору {telegram_id}")
        
    except Exception as e:
        logger.error(f"❌ Ошибка при обработке /users: {e}", exc_info=True)
        await update.message.reply_text(
            "❌ Произошла ошибка при получении списка пользователей."
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
        logger.error("❌ TELEGRAM_BOT_TOKEN не найден в .env файле!")
        return
    
    logger.info(f"🤖 Запуск Telegram бота...")
    logger.info(f"📍 Web App URL: {WEB_APP_URL}")
    logger.info(f"💾 MongoDB: {MONGO_URL}")
    logger.info(f"🗄 Database: {DB_NAME}")
    
    # Создаем приложение
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    
    # Регистрируем обработчики команд
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("users", users_command))
    application.add_handler(CommandHandler("clear_db", clear_db_command))
    
    logger.info("✅ Бот успешно запущен и готов к работе!")
    logger.info("📝 Доступные команды: /start, /users (только для админов), /clear_db (только для админов)")
    
    # Запускаем бота (эта функция блокирует поток)
    application.run_polling(
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=True  # Игнорируем старые обновления
    )


if __name__ == '__main__':
    main()
