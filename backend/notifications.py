"""
Модуль для работы с Telegram Bot API и отправки уведомлений.

P2 (Iteration: cross-platform fixes):
  ── Унифицирован return-контракт `send_class_notification` / `send_test_notification` /
     `send_message` — теперь они отличают `доставлено пользователю` (delivered_to_user)
     от «упало на TG, нужен retry» (requires_retry). См. services.delivery.DeliveryResult.
  ── Убран `from server import db` внутри методов: теперь db передаётся через init.
     Это устраняет circular-import риск и упрощает тестирование.
  ── `send_message` теперь делегирует в `delivery.notify_user` — единый канал отправки,
     in-app fallback автоматически работает для VK/Email-юзеров (pseudo_tid).
  ── `send_test_notification` использует priority=HIGH (тестовое уведомление о подключении
     не должно теряться).
"""

from __future__ import annotations

import logging
from typing import Optional

from telegram import Bot
from telegram.error import TelegramError

from config import get_telegram_bot_token, is_test_environment
from services.delivery import (
    DeliveryResult,
    MessagePriority,
    notify_user as _notify_user,
)

logger = logging.getLogger(__name__)


class TelegramNotificationService:
    """Сервис для отправки уведомлений через Telegram Bot.

    Cross-platform aware: все методы корректно работают и для real-TG юзеров,
    и для pseudo_tid (VK/Email) — последние получают только in-app, без TG-push.
    """

    def __init__(self, bot_token: str, db=None):
        """
        Args:
            bot_token: Токен Telegram бота
            db: AsyncIOMotorDatabase — для delivery-операций (in-app, retry).
                Может быть None на момент init, тогда устанавливается через `attach_db`.
        """
        self.bot = Bot(token=bot_token)
        self.bot_token = bot_token
        self._db = db

    def attach_db(self, db) -> None:
        """Поздняя инжекция db (для случая, когда сервис создан до соединения с Mongo)."""
        self._db = db

    @property
    def db(self):
        """Lazy fallback — если db не был передан явно, тянем из server. Хрупко, но совместимо."""
        if self._db is not None:
            return self._db
        # Fallback на старое поведение (для совместимости со старым кодом)
        from server import db as _server_db  # noqa: WPS433 (circular workaround)
        return _server_db

    # ──────────────────────────────────────────────────────────────────────
    #  Уведомления о парах
    # ──────────────────────────────────────────────────────────────────────

    async def send_class_notification(
        self,
        telegram_id: int,
        class_info: dict,
        minutes_before: int,
    ) -> bool:
        """Отправить уведомление о начале пары.

        Returns:
            True если уведомление действительно «дошло до пользователя»:
              — Для real-TG юзера: TG-push успешен (in-app — бонус)
              — Для pseudo-tid (VK/Email): in-app создан

            False если ничего не доставлено ИЛИ TG-push упал у real-TG юзера
            (в этом случае scheduler пометит уведомление как failed и запустит retry).

            ⚠️ Ранее метод возвращал True, если был создан in-app, даже если TG-push
            у real-TG юзера упал — это маскировало реальные ошибки. ИСПРАВЛЕНО.
        """
        try:
            message = self._format_class_notification(class_info, minutes_before)
            discipline = class_info.get("discipline", "Пара")
            title = (
                f"⏰ Через {minutes_before} мин: {discipline}"
                if minutes_before > 0
                else f"🔴 Пара началась: {discipline}"
            )

            result: DeliveryResult = await _notify_user(
                self.db,
                self.bot,
                telegram_id=telegram_id,
                title=title,
                message=self._format_class_notification_inapp(class_info, minutes_before),
                emoji="⏰",
                type="class_starting",
                category="study",
                priority=MessagePriority.HIGH,
                data={
                    "discipline": class_info.get("discipline"),
                    "auditory": class_info.get("auditory"),
                    "teacher": class_info.get("teacher"),
                    "lesson_type": class_info.get("lessonType"),
                    "minutes_before": minutes_before,
                },
                telegram_text=message,
                telegram_parse_mode="HTML",
                log_ctx="class_reminder",
            )

            self._log_delivery_result(result, telegram_id, kind="class_reminder", extra=discipline)

            # P2 fix: возвращаем delivered_to_user (а не OR логику).
            # Это позволит scheduler корректно ретраить TG-fail для real-TG юзеров.
            return result.delivered_to_user

        except TelegramError as e:
            logger.error(f"[notifications] TelegramError class notif tid={telegram_id}: {e}")
            return False
        except Exception as e:  # noqa: BLE001
            logger.error(
                f"[notifications] Unexpected error class notif tid={telegram_id}: {e}",
                exc_info=True,
            )
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
        """Форматировать HTML-текст уведомления о паре (для Telegram)."""
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

        lines = [
            '<tg-emoji emoji-id="5816934234882839927">⏰</tg-emoji>  <b>Напоминание о паре</b>',
            urgency,
        ]

        discipline_line = f'<tg-emoji emoji-id="5375163339154399459">🎓</tg-emoji>  {discipline}'
        if lesson_type:
            discipline_line += f' ({lesson_type})'
        lines.append(discipline_line)

        if teacher:
            lines.append(f'<tg-emoji emoji-id="5373039692574893940">👨\u200d🏫</tg-emoji> {teacher}')
        if auditory:
            lines.append(f'<tg-emoji emoji-id="5391032818111363540">📍</tg-emoji>  {auditory}')
        if group_name:
            lines.append(f'<tg-emoji emoji-id="5372926953978341366">👥</tg-emoji>  {group_name}')

        return "\n".join(lines)

    # ──────────────────────────────────────────────────────────────────────
    #  Тестовое уведомление
    # ──────────────────────────────────────────────────────────────────────

    async def send_test_notification(self, telegram_id: int) -> bool:
        """Отправить тестовое уведомление «Уведомления подключены».

        P2: priority=HIGH (юзер только что включил уведомления — пропуск недопустим).
        """
        try:
            tg_text = (
                '<tg-emoji emoji-id="5458603043203327669">🔔</tg-emoji>  <b>Уведомления подключены!</b>\n'
                '<tg-emoji emoji-id="5206607081334906820">✨</tg-emoji> Отлично — теперь вы не пропустите ни одной пары.\n'
                '<tg-emoji emoji-id="5422439311196834318">💡</tg-emoji> <i>Время уведомлений можно изменить в настройках приложения.</i>'
            )

            result: DeliveryResult = await _notify_user(
                self.db,
                self.bot,
                telegram_id=telegram_id,
                title="Уведомления подключены!",
                message="Отлично — теперь вы не пропустите ни одной пары. Время уведомлений можно изменить в настройках.",
                emoji="🔔",
                type="announcement",
                category="system",
                priority=MessagePriority.HIGH,  # ← bump до HIGH
                telegram_text=tg_text,
                log_ctx="test_notification",
            )

            self._log_delivery_result(result, telegram_id, kind="test_notif")
            return result.delivered_to_user

        except TelegramError as e:
            logger.error(f"[notifications] TelegramError test notif tid={telegram_id}: {e}")
            return False
        except Exception as e:  # noqa: BLE001
            logger.error(
                f"[notifications] Unexpected error test notif tid={telegram_id}: {e}",
                exc_info=True,
            )
            return False

    # ──────────────────────────────────────────────────────────────────────
    #  Произвольное сообщение (теперь cross-platform aware)
    # ──────────────────────────────────────────────────────────────────────

    async def send_message(
        self,
        telegram_id: int,
        text: str,
        parse_mode: str = "HTML",
        *,
        title: Optional[str] = None,
        category: str = "system",
        priority: MessagePriority = MessagePriority.NORMAL,
        emoji: str = "🔔",
        also_in_app: bool = True,
    ) -> bool:
        """Отправить произвольное сообщение пользователю.

        P2 fix: теперь делегирует в `notify_user`, который:
          — для real-TG юзера: пытается TG-push, in-app тоже создаётся (если also_in_app)
          — для pseudo-tid юзера: только in-app (TG-push корректно скипнут, без ошибки)

        Backward-compat: сохранена сигнатура (telegram_id, text, parse_mode).
        Дополнительные параметры опциональны.

        Args:
            telegram_id: ID пользователя (real TG или pseudo_tid)
            text: Текст сообщения (HTML, если parse_mode='HTML')
            parse_mode: 'HTML' или 'Markdown'
            title: Опционально — заголовок для in-app (если None, генерируется из первых слов)
            category: Категория in-app уведомления
            priority: Приоритет
            emoji: Эмодзи для in-app карточки
            also_in_app: Если False — только TG-push, без in-app (legacy mode)

        Returns:
            True если доставлено хоть как-то (TG для real, in-app для pseudo).
        """
        try:
            # Если also_in_app=False (legacy режим) — старая логика, чистый TG
            if not also_in_app:
                from auth_utils import is_real_telegram_user, is_pseudo_tid
                if not is_real_telegram_user(telegram_id):
                    logger.debug(
                        f"🟡 Skip arbitrary TG push: tid={telegram_id} "
                        f"reason={'pseudo_tid' if is_pseudo_tid(telegram_id) else 'no_tid'}"
                    )
                    return False
                # Прямой вызов через safe_send_telegram (с таймаутом, circuit breaker)
                from services.delivery import safe_send_telegram
                return await safe_send_telegram(
                    self.bot,
                    telegram_id,
                    text=text,
                    parse_mode=parse_mode,
                    method="message",
                    log_ctx="send_message_legacy",
                )

            # Нормальный режим: in-app + TG (через delivery.notify_user)
            # Генерим title из первой строки text, если не передан
            if not title:
                first_line = (text or "").split("\n", 1)[0].strip()
                # Убираем HTML-теги из title для in-app
                import re
                clean_title = re.sub(r"<[^>]+>", "", first_line)
                title = clean_title[:150] or "Уведомление"

            # in-app message — plain-text версия (убираем HTML-теги)
            import re
            plain_message = re.sub(r"<[^>]+>", "", text or "").strip()

            result: DeliveryResult = await _notify_user(
                self.db,
                self.bot,
                telegram_id=telegram_id,
                title=title,
                message=plain_message,
                emoji=emoji,
                type="announcement",
                category=category,
                priority=priority,
                telegram_text=text,
                telegram_parse_mode=parse_mode,
                log_ctx="send_message",
            )
            self._log_delivery_result(result, telegram_id, kind="send_message")
            return result.delivered_to_user

        except TelegramError as e:
            logger.error(f"[notifications] TelegramError send_message tid={telegram_id}: {e}")
            return False
        except Exception as e:  # noqa: BLE001
            logger.error(
                f"[notifications] Unexpected error send_message tid={telegram_id}: {e}",
                exc_info=True,
            )
            return False

    # ──────────────────────────────────────────────────────────────────────
    #  Helpers
    # ──────────────────────────────────────────────────────────────────────

    def _log_delivery_result(
        self,
        result: DeliveryResult,
        telegram_id: int,
        *,
        kind: str,
        extra: str = "",
    ) -> None:
        """Унифицированное логирование delivery-результата."""
        extra_str = f" {extra}" if extra else ""
        if result.telegram_sent and result.in_app_id:
            logger.info(
                f"📨 {kind} delivered TG+in-app tid={telegram_id}{extra_str}"
            )
        elif result.telegram_sent:
            logger.info(f"📨 {kind} delivered TG only tid={telegram_id}{extra_str}")
        elif result.in_app_id:
            reason = result.telegram_skipped_reason or "-"
            if result.user_has_real_telegram:
                # Real-TG юзер, но TG упал — это потенциальная проблема
                logger.warning(
                    f"⚠️ {kind} in-app only (TG failed) tid={telegram_id}{extra_str} "
                    f"reason={reason}"
                )
            else:
                # pseudo-tid: ожидаемое поведение
                logger.info(
                    f"📬 {kind} in-app only tid={telegram_id}{extra_str} "
                    f"reason={reason}"
                )
        else:
            logger.error(
                f"❌ {kind} NOT delivered tid={telegram_id}{extra_str} "
                f"errors={result.errors}"
            )


# Глобальный экземпляр сервиса
notification_service: Optional[TelegramNotificationService] = None


def get_notification_service() -> TelegramNotificationService:
    """Получить глобальный экземпляр сервиса уведомлений."""
    global notification_service

    if notification_service is None:
        bot_token = get_telegram_bot_token()
        if not bot_token:
            raise ValueError(
                "Токен бота не настроен! Проверьте TELEGRAM_BOT_TOKEN и "
                "TEST_TELEGRAM_BOT_TOKEN в .env файле"
            )

        env_mode = "TEST" if is_test_environment() else "PRODUCTION"
        logger.info(f"🔔 Инициализация сервиса уведомлений в режиме {env_mode}")
        notification_service = TelegramNotificationService(bot_token)

    return notification_service


def init_notification_service_with_db(db) -> TelegramNotificationService:
    """Инициализировать сервис с явным db (избегаем circular import).

    Вызывается из server.py на старте, после создания db.
    """
    svc = get_notification_service()
    svc.attach_db(db)
    return svc
