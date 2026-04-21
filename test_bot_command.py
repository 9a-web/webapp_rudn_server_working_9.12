#!/usr/bin/env python3
"""
Скрипт для тестирования команды /clear_db через Telegram Bot API
"""
import os
import asyncio
from dotenv import load_dotenv
from telegram import Bot

# Загрузка переменных окружения
load_dotenv('/app/backend/.env')

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ADMIN_ID = 765963392  # Ваш telegram ID

async def test_bot():
    """Проверка, что бот отвечает"""
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    
    try:
        # Получаем информацию о боте
        bot_info = await bot.get_me()
        print(f"✅ Бот активен: @{bot_info.username}")
        print(f"   ID: {bot_info.id}")
        print(f"   Имя: {bot_info.first_name}")
        
        # Получаем последние обновления
        updates = await bot.get_updates(limit=10)
        print(f"\n📨 Последние {len(updates)} обновлений:")
        for update in updates[-5:]:
            if update.message:
                print(f"   - От: {update.message.from_user.id} (@{update.message.from_user.username})")
                print(f"     Текст: {update.message.text}")
                print(f"     Дата: {update.message.date}")
        
        # Отправляем тестовое сообщение админу
        # await bot.send_message(
        #     chat_id=ADMIN_ID,
        #     text="🤖 Тест: Бот работает! Попробуйте команду /clear_db"
        # )
        # print(f"\n✅ Тестовое сообщение отправлено администратору {ADMIN_ID}")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(test_bot())
