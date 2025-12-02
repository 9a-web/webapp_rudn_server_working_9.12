"""
Модуль для работы с Telegram Bot API и отправки уведомлений
"""

import os
import logging
from typing import Optional
from datetime import datetime, timedelta
from telegram import Bot
from telegram.error import TelegramError
from config import get_telegram_bot_token, is_test_environment

logger = logging.getLogger(__name__)


class TelegramNotificationService:
    """Сервис для отправки уведомлений через Telegram Bot"""
    
    def __init__(self, bot_token: str):
        """
        Инициализация сервиса
        
        Args:
            bot_token: Токен Telegram бота
        """
        self.bot = Bot(token=bot_token)
        self.bot_token = bot_token
    
    async def send_class_notification(
        self,
        telegram_id: int,
        class_info: dict,
        minutes_before: int
    ) -> bool:
        """
        Отправить уведомление о начале пары
        
        Args:
            telegram_id: ID пользователя в Telegram
            class_info: Информация о паре (discipline, time, teacher, auditory)
            minutes_before: За сколько минут до начала отправлено уведомление
            
        Returns:
            True если уведомление отправлено успешно
        """
        try:
            # Формируем текст сообщения
            message = self._format_class_notification(class_info, minutes_before)
            
            # Отправляем сообщение
            await self.bot.send_message(
                chat_id=telegram_id,
                text=message,
                parse_mode='HTML'
            )
            
            logger.info(f"Notification sent to {telegram_id} for class: {class_info.get('discipline')}")
            return True
            
        except TelegramError as e:
            logger.error(f"Failed to send notification to {telegram_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending notification: {e}")
            return False
    
    def _format_class_notification(self, class_info: dict, minutes_before: int) -> str:
        """
        Форматировать текст уведомления о паре
        
        Args:
            class_info: Информация о паре
            minutes_before: За сколько минут уведомление
            
        Returns:
            Отформатированный текст сообщения
        """
        discipline = class_info.get('discipline', 'Пара')
        time = class_info.get('time', '')
        teacher = class_info.get('teacher', '')
        auditory = class_info.get('auditory', '')
        lesson_type = class_info.get('lessonType', '')
        
        # Определяем эмодзи в зависимости от типа занятия
        emoji_map = {
            'Лекция': '📚',
            'Практика': '✏️',
            'Лабораторная': '🔬',
            'Семинар': '💬',
        }
        emoji = emoji_map.get(lesson_type, '🔔')
        
        # Формируем сообщение
        message = f"{emoji} <b>Напоминание о паре</b>\n\n"
        message += f"<b>{discipline}</b>\n"
        
        if lesson_type:
            message += f"Тип: {lesson_type}\n"
        
        if time:
            message += f"⏰ Время: {time}\n"
        
        if teacher:
            message += f"👨‍🏫 Преподаватель: {teacher}\n"
        
        if auditory:
            message += f"📍 Аудитория: {auditory}\n"
        
        message += f"\n⏱ Начало через {minutes_before} минут"
        
        return message
    
    async def send_test_notification(self, telegram_id: int) -> bool:
        """
        Отправить тестовое уведомление
        
        Args:
            telegram_id: ID пользователя в Telegram
            
        Returns:
            True если уведомление отправлено успешно
        """
        try:
            message = "✅ <b>Уведомления включены!</b>\n\n"
            message += "Вы будете получать напоминания о предстоящих парах.\n"
            message += "Настройте время уведомлений в настройках приложения."
            
            await self.bot.send_message(
                chat_id=telegram_id,
                text=message,
                parse_mode='HTML'
            )
            
            logger.info(f"Test notification sent to {telegram_id}")
            return True
            
        except TelegramError as e:
            logger.error(f"Failed to send test notification to {telegram_id}: {e}")
            return False


# Глобальный экземпляр сервиса
notification_service: Optional[TelegramNotificationService] = None


def get_notification_service() -> TelegramNotificationService:
    """Получить глобальный экземпляр сервиса уведомлений"""
    global notification_service
    
    if notification_service is None:
        bot_token = get_telegram_bot_token()
        if not bot_token:
            raise ValueError("Токен бота не настроен! Проверьте TELEGRAM_BOT_TOKEN и TEST_TELEGRAM_BOT_TOKEN в .env файле")
        
        env_mode = "TEST" if is_test_environment() else "PRODUCTION"
        logger.info(f"🔔 Инициализация сервиса уведомлений в режиме {env_mode}")
        notification_service = TelegramNotificationService(bot_token)
    
    return notification_service
