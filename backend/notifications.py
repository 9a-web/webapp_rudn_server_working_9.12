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
from auth_utils import is_real_telegram_user, is_pseudo_tid

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
            # 🛡 P0-guard: не шлём в pseudo_tid (VK/Email юзеры без real TG)
            if not is_real_telegram_user(telegram_id):
                logger.info(
                    f"🟡 Skip class notification: tid={telegram_id} "
                    f"reason={'pseudo_tid' if is_pseudo_tid(telegram_id) else 'no_tid'}"
                )
                return False

            # Формируем текст сообщения (уже содержит tg-emoji теги)
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
        teacher = class_info.get('teacher', '')
        auditory = class_info.get('auditory', '')
        lesson_type = class_info.get('lessonType', '')
        group_name = class_info.get('group_name', '')

        # Выбираем фразу по времени до начала
        if minutes_before <= 5:
            urgency = '<tg-emoji emoji-id="5274099962655816924">🔴</tg-emoji> <b>Бегом! Пара вот-вот начнётся!</b>'
        elif minutes_before <= 15:
            urgency = f'<tg-emoji emoji-id="5274099962655816924">🟡</tg-emoji> <b>Скоро начало!</b> Через <b>{minutes_before} мин</b>'
        else:
            urgency = f'<tg-emoji emoji-id="5274099962655816924">🟢</tg-emoji> <b>Через {minutes_before} мин</b> — есть время собраться'
        
        # Собираем сообщение
        lines = []
        lines.append('<tg-emoji emoji-id="5816934234882839927">⏰</tg-emoji>  <b>Напоминание о паре</b>')
        lines.append(urgency)
        
        discipline_line = f'<tg-emoji emoji-id="5375163339154399459">🎓</tg-emoji>  {discipline}'
        if lesson_type:
            discipline_line += f' ({lesson_type})'
        lines.append(discipline_line)
        
        if teacher:
            lines.append(f'<tg-emoji emoji-id="5373039692574893940">👨‍🏫</tg-emoji> {teacher}')
        
        if auditory:
            lines.append(f'<tg-emoji emoji-id="5391032818111363540">📍</tg-emoji>  {auditory}')
        
        if group_name:
            lines.append(f'<tg-emoji emoji-id="5372926953978341366">👥</tg-emoji>  {group_name}')
        
        return "\n".join(lines)
    
    async def send_test_notification(self, telegram_id: int) -> bool:
        """
        Отправить тестовое уведомление
        """
        try:
            # 🛡 P0-guard
            if not is_real_telegram_user(telegram_id):
                logger.info(
                    f"🟡 Skip test notification: tid={telegram_id} "
                    f"reason={'pseudo_tid' if is_pseudo_tid(telegram_id) else 'no_tid'}"
                )
                return False

            message = (
                '<tg-emoji emoji-id="5458603043203327669">🔔</tg-emoji>  <b>Уведомления подключены!</b>\n'
                '<tg-emoji emoji-id="5206607081334906820">✨</tg-emoji> Отлично — теперь вы не пропустите ни одной пары.\n'
                '<tg-emoji emoji-id="5422439311196834318">💡</tg-emoji> <i>Время уведомлений можно изменить в настройках приложения.</i>'
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
            # 🛡 P0-guard
            if not is_real_telegram_user(telegram_id):
                logger.info(
                    f"🟡 Skip arbitrary push: tid={telegram_id} "
                    f"reason={'pseudo_tid' if is_pseudo_tid(telegram_id) else 'no_tid'}"
                )
                return False

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
