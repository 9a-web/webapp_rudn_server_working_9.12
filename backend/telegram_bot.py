"""
Telegram Bot для RUDN Schedule
Обрабатывает команду /start и открывает Web App
"""

import os
import logging
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

# Подключение к MongoDB
mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обработчик команды /start
    - Проверяет наличие пользователя в БД
    - Создает нового пользователя при первом запуске
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
    
    logger.info(f"Команда /start от пользователя: {telegram_id} (@{username})")
    
    try:
        # Проверяем, существует ли пользователь в БД
        existing_user = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        if not existing_user:
            # Создаем нового пользователя
            new_user = {
                "telegram_id": telegram_id,
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "created_at": datetime.utcnow(),
                "last_activity": datetime.utcnow(),
                "notifications_enabled": False,
                "notification_time": 10
            }
            
            await db.user_settings.insert_one(new_user)
            logger.info(f"✅ Создан новый пользователь: {telegram_id} (@{username})")
            
            # Приветственное сообщение для нового пользователя
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

Рад снова тебя видеть в <b>RUDN Schedule</b>! 

🎯 Готов продолжить управлять своим расписанием?

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
    
    # Регистрируем обработчик команды /start
    application.add_handler(CommandHandler("start", start_command))
    
    logger.info("✅ Бот успешно запущен и готов к работе!")
    
    # Запускаем бота
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
