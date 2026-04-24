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
from services.delivery import notify_user as _notify_user

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
        Отправить уведомление о начале пары.

        P1 (instrUIDprofile.md): вместо простого skip для pseudo_tid (VK/Email)
        идёт через MessageDeliveryService — in-app создаётся для всех, TG-push
        только для real telegram_id.

        Args:
            telegram_id: ID пользователя (real TG или pseudo_tid)
            class_info: Информация о паре (discipline, time, teacher, auditory)
            minutes_before: За сколько минут до начала отправлено уведомление

        Returns:
            True если было доставлено хоть по одному каналу (in-app или TG).
        """
        try:
            # Импорт db здесь — избегаем циклов (notifications.py грузится рано)
            from server import db

            message = self._format_class_notification(class_info, minutes_before)

            discipline = class_info.get("discipline", "Пара")
            title = f"⏰ Через {minutes_before} мин: {discipline}" if minutes_before > 0 else f"🔴 Пара началась: {discipline}"

            result = await _notify_user(
                db,
                self.bot,
                telegram_id=telegram_id,
                title=title,
                message=self._format_class_notification_inapp(class_info, minutes_before),
                emoji="⏰",
                type="class_starting",
                category="study",
                priority="high",
                data={
                    "discipline": class_info.get("discipline"),
                    "auditory": class_info.get("auditory"),
                    "teacher": class_info.get("teacher"),
                    "lesson_type": class_info.get("lessonType"),
                    "minutes_before": minutes_before,
                },
                # Для Telegram используем форматированный HTML из существующего шаблона
                telegram_text=message,
                telegram_parse_mode="HTML",
                log_ctx="class_reminder",
            )

            delivered = result["telegram_sent"] or (result["in_app_id"] is not None)
            if result["telegram_sent"]:
                logger.info(
                    f"📨 Class reminder delivered TG+in-app tid={telegram_id} "
                    f"({class_info.get('discipline')})"
                )
            elif result["in_app_id"]:
                logger.info(
                    f"📬 Class reminder delivered in-app only tid={telegram_id} "
                    f"(reason={result['telegram_skipped_reason']})"
                )
            return delivered

        except TelegramError as e:
            logger.error(f"Failed to send class notification to {telegram_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending class notification: {e}", exc_info=True)
            return False

    def _format_class_notification_inapp(self, class_info: dict, minutes_before: int) -> str:
        """Короткая (plain-text) версия сообщения о паре — для in-app карточки."""
        parts = []
        if minutes_before <= 5:
            parts.append(f"🔴 Бегом! Пара через {minutes_before} мин")
        elif minutes_before <= 15:
            parts.append(f"🟡 Скоро начало — через {minutes_before} мин")
        else:
            parts.append(f"🟢 Через {minutes_before} мин")
        if class_info.get("auditory"):
            parts.append(f"📍 {class_info['auditory']}")
        if class_info.get("teacher"):
            parts.append(f"👨‍🏫 {class_info['teacher']}")
        return " • ".join(parts)
    
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
        Отправить тестовое уведомление (P1: через delivery).
        """
        try:
            from server import db

            tg_text = (
                '<tg-emoji emoji-id="5458603043203327669">🔔</tg-emoji>  <b>Уведомления подключены!</b>\n'
                '<tg-emoji emoji-id="5206607081334906820">✨</tg-emoji> Отлично — теперь вы не пропустите ни одной пары.\n'
                '<tg-emoji emoji-id="5422439311196834318">💡</tg-emoji> <i>Время уведомлений можно изменить в настройках приложения.</i>'
            )

            result = await _notify_user(
                db,
                self.bot,
                telegram_id=telegram_id,
                title="Уведомления подключены!",
                message="Отлично — теперь вы не пропустите ни одной пары. Время уведомлений можно изменить в настройках.",
                emoji="🔔",
                type="announcement",
                category="system",
                priority="normal",
                telegram_text=tg_text,
                log_ctx="test_notification",
            )
            delivered = result["telegram_sent"] or (result["in_app_id"] is not None)
            logger.info(
                f"🧪 Test notification delivered tid={telegram_id} "
                f"tg={result['telegram_sent']} in_app={bool(result['in_app_id'])}"
            )
            return delivered

        except TelegramError as e:
            logger.error(f"Failed to send test notification to {telegram_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending test notification: {e}", exc_info=True)
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
