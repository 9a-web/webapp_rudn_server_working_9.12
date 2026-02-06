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
        """
        discipline = class_info.get('discipline', 'Пара')
        time = class_info.get('time', '')
        teacher = class_info.get('teacher', '')
        auditory = class_info.get('auditory', '')
        lesson_type = class_info.get('lessonType', '')
        group_name = class_info.get('group_name', '')
        
        # Получаем текущее время в московском часовом поясе
        from datetime import timezone
        import pytz
        moscow_tz = pytz.timezone('Europe/Moscow')
        current_time = datetime.now(moscow_tz).strftime('%H:%M')
        
        # Иконка типа занятия
        type_icons = {
            'лекция': '🎓', 'лек': '🎓',
            'практика': '✏️', 'практ': '✏️', 'пр': '✏️',
            'семинар': '💬', 'сем': '💬',
            'лабораторная': '🔬', 'лаб': '🔬',
            'экзамен': '📋', 'зачет': '📋', 'зачёт': '📋',
        }
        type_icon = '📖'
        if lesson_type:
            for key, icon in type_icons.items():
                if key in lesson_type.lower():
                    type_icon = icon
                    break

        # Выбираем фразу по времени до начала
        if minutes_before <= 5:
            urgency = "🔴  <b>Бегом! Пара вот-вот начнётся!</b>"
        elif minutes_before <= 15:
            urgency = "🟡  <b>Скоро начало — пора выходить!</b>"
        else:
            urgency = f"🟢  <b>Через {minutes_before} мин — есть время собраться</b>"
        
        # Собираем красивое сообщение
        lines = []
        lines.append(f"⏰  <b>Напоминание о паре</b>")
        lines.append("")
        lines.append(urgency)
        lines.append("")
        lines.append("┌─────────────────────")
        
        if time:
            lines.append(f"│  🕐  <b>{time}</b>")
        
        lines.append(f"│  {type_icon}  <b>{discipline}</b>")
        
        if lesson_type:
            lines.append(f"│        <i>({lesson_type})</i>")
        
        if teacher:
            lines.append(f"│  👨‍🏫  {teacher}")
        
        if auditory:
            lines.append(f"│  📍  <b>{auditory}</b>")
        
        if group_name:
            lines.append(f"│  👥  {group_name}")
        
        lines.append("└─────────────────────")
        lines.append("")
        lines.append(f"🕐 Сейчас: <b>{current_time}</b> МСК")
        
        return "\n".join(lines)
    
    async def send_test_notification(self, telegram_id: int) -> bool:
        """
        Отправить тестовое уведомление
        """
        try:
            message = (
                "🔔  <b>Уведомления подключены!</b>\n"
                "\n"
                "Отлично — теперь вы не пропустите ни одной пары.\n"
                "\n"
                "┌─────────────────────\n"
                "│  ✅  Напоминания о парах\n"
                "│  ⏰  Настраиваемое время\n"
                "│  📍  Аудитории и преподаватели\n"
                "└─────────────────────\n"
                "\n"
                "💡 <i>Время уведомлений можно изменить\n"
                "в настройках приложения.</i>"
            )
            
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

    async def send_message(self, telegram_id: int, text: str, parse_mode: str = 'HTML') -> bool:
        """
        Отправить произвольное сообщение пользователю
        
        Args:
            telegram_id: ID пользователя в Telegram
            text: Текст сообщения
            parse_mode: Режим форматирования ('HTML' или 'Markdown')
            
        Returns:
            True если сообщение отправлено успешно
        """
        try:
            await self.bot.send_message(
                chat_id=telegram_id,
                text=text,
                parse_mode=parse_mode
            )
            
            logger.info(f"Message sent to {telegram_id}")
            return True
            
        except TelegramError as e:
            logger.error(f"Failed to send message to {telegram_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending message to {telegram_id}: {e}")
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
