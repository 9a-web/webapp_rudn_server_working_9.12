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

# Маппинг обычных эмоджи → анимированные custom_emoji_id (Telegram animated emoji)
ANIMATED_EMOJI_MAP = {
    # AnimatedEmoji pack
    "👨‍🏫": "5170580663727817398",
    "🎉": "5170162552956519052",
    "🤝": "5172412845236683692",
    "🔥": "5170202955713872686",
    "💪": "5170288395498291855",
    "👋": "5170203290721321766",
    "❤️": "4918315793956995793",
    "👍": "5172639207193051720",
    "💜": "5170311012796072606",
    "😊": "5170541265992811339",
    "🥳": "5172632361015182081",
    # RestrictedEmoji pack
    "👤": "5373012449597335010",
    "👥": "5372926953978341366",
    "🎓": "5375163339154399459",
    "💫": "5469741319330996757",
    "✨": "5472164874886846699",
    "🏆": "5409008750893734809",
    "🏠": "5465226866321268133",
    "⏰": "5413704112220949842",
    "💡": "5472146462362048818",
    "🔬": "5379679518740978720",
    "🎊": "5435933711893797296",
    "💌": "5472019095106886003",
    "📖": "5226512880362332956",
    "📝": "5334882760735598374",
    "✏️": "5334673106202010226",
    "❌": "5465665476971471368",
    "✅": "5427009714745517609",
    "🎵": "5188621441926438751",
    "🎶": "5188705588925702510",
    "🔔": "5242628160297641831",
    "📣": "5469903029144657419",
    "💬": "5465300082628763143",
}


def animate_emoji(text: str) -> str:
    """
    Заменяет обычные эмоджи на анимированные custom emoji (tg-emoji) для Telegram HTML.
    Если эмоджи нет в маппинге — оставляет как есть.
    """
    result = text
    for emoji, emoji_id in ANIMATED_EMOJI_MAP.items():
        if emoji in result:
            result = result.replace(emoji, f'<tg-emoji emoji-id="{emoji_id}">{emoji}</tg-emoji>')
    return result


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
        lines.append("")
        lines.append(urgency)
        lines.append("")
        
        lines.append(f'<tg-emoji emoji-id="5375163339154399459">🎓</tg-emoji>  <b>{discipline}</b>')
        if lesson_type:
            lines.append(f'      <i>({lesson_type})</i>')
        
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
            message = (
                '<tg-emoji emoji-id="5458603043203327669">🔔</tg-emoji>  <b>Уведомления подключены!</b>\n'
                '\n'
                '<tg-emoji emoji-id="5206607081334906820">✨</tg-emoji> Отлично — теперь вы не пропустите ни одной пары.\n'
                '\n'
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
            # Заменяем обычные эмоджи на анимированные
            animated_text = animate_emoji(text)
            await self.bot.send_message(
                chat_id=telegram_id,
                text=animated_text,
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
