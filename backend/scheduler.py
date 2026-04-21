"""
Планировщик задач для отправки уведомлений о парах
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError
from notifications import get_notification_service

logger = logging.getLogger(__name__)

# Московское время
MOSCOW_TZ = pytz.timezone('Europe/Moscow')


class NotificationScheduler:
    """Планировщик для проверки и отправки уведомлений"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        """
        Инициализация планировщика
        
        Args:
            db: База данных MongoDB
        """
        self.db = db
        self.scheduler = AsyncIOScheduler()
        self.notification_service = get_notification_service()
    
    def start(self):
        """Запустить планировщик"""
        # Проверяем уведомления каждые 5 минут (оптимизировано с 1 минуты)
        self.scheduler.add_job(
            self.check_and_send_notifications,
            trigger=IntervalTrigger(minutes=5),
            id='check_notifications',
            name='Check and send class notifications',
            replace_existing=True
        )
        
        # Очищаем старые записи уведомлений раз в 6 часов (оптимизировано с 1 часа)
        self.scheduler.add_job(
            self.cleanup_old_notifications,
            trigger=IntervalTrigger(hours=6),
            id='cleanup_notifications',
            name='Cleanup old notification records',
            replace_existing=True
        )
        
        # Сброс дневных счетчиков задач каждый день в 00:00 по московскому времени
        from apscheduler.triggers.cron import CronTrigger
        self.scheduler.add_job(
            self.reset_daily_task_counters,
            trigger=CronTrigger(hour=0, minute=0, timezone=MOSCOW_TZ),
            id='reset_daily_tasks',
            name='Reset daily task counters',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("Notification scheduler started (optimized intervals)")
    
    def stop(self):
        """Остановить планировщик"""
        self.scheduler.shutdown()
        logger.info("Notification scheduler stopped")
    
    async def check_and_send_notifications(self):
        """
        Проверить и отправить уведомления о предстоящих парах
        """
        try:
            # Получаем текущее время в московской зоне
            now = datetime.now(MOSCOW_TZ)
            current_day = now.strftime('%A')  # Название дня недели
            
            logger.debug(f"Checking for upcoming classes at {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            
            # Переводим день недели на русский
            day_mapping = {
                'Monday': 'Понедельник',
                'Tuesday': 'Вторник',
                'Wednesday': 'Среда',
                'Thursday': 'Четверг',
                'Friday': 'Пятница',
                'Saturday': 'Суббота',
                'Sunday': 'Воскресенье'
            }
            russian_day = day_mapping.get(current_day, current_day)
            
            # Определяем номер недели (1 или 2)
            week_number = self._get_week_number(now)
            
            # Получаем всех пользователей с включенными уведомлениями
            users = await self.db.user_settings.find({
                "notifications_enabled": True,
                "group_id": {"$exists": True, "$ne": None}
            }).to_list(None)
            
            logger.debug(f"Found {len(users)} users with notifications enabled")
            
            # Проверяем каждого пользователя
            for user in users:
                await self._check_user_classes(
                    user,
                    russian_day,
                    week_number,
                    now
                )
        
        except Exception as e:
            logger.error(f"Error in notification scheduler: {e}", exc_info=True)
    
    async def _check_user_classes(
        self,
        user: Dict,
        day: str,
        week_number: int,
        now: datetime
    ):
        """
        Проверить пары конкретного пользователя
        
        Args:
            user: Данные пользователя
            day: День недели (на русском)
            week_number: Номер недели (1 или 2)
            now: Текущая дата и время (с timezone)
        """
        try:
            telegram_id = user['telegram_id']
            notification_time = user.get('notification_time', 10)  # За сколько минут уведомлять
            
            logger.debug(f"Checking classes for user {telegram_id}, notification_time={notification_time} min")
            
            # Получаем расписание пользователя из кэша
            cached_schedule = await self.db.schedule_cache.find_one({
                "group_id": user.get('group_id'),
                "week_number": week_number,
                "expires_at": {"$gt": now.replace(tzinfo=None)}
            })
            
            if not cached_schedule:
                logger.debug(f"No cached schedule for user {telegram_id}, group_id={user.get('group_id')}")
                return
            
            events = cached_schedule.get('events', [])
            
            # Фильтруем пары на сегодня
            today_classes = [e for e in events if e.get('day') == day]
            
            logger.debug(f"Found {len(today_classes)} classes for user {telegram_id} on {day}")
            
            # Проверяем каждую пару
            for class_event in today_classes:
                await self._check_and_notify(
                    telegram_id,
                    class_event,
                    notification_time,
                    now
                )
        
        except Exception as e:
            logger.error(f"Error checking classes for user {user.get('telegram_id')}: {e}", exc_info=True)
    
    async def _check_and_notify(
        self,
        telegram_id: int,
        class_event: Dict,
        notification_time: int,
        now: datetime
    ):
        """
        Проверить и отправить уведомление о конкретной паре
        
        Args:
            telegram_id: ID пользователя в Telegram
            class_event: Событие (пара)
            notification_time: За сколько минут уведомлять (из настроек пользователя)
            now: Текущая дата и время (с timezone)
        """
        try:
            # Парсим время начала пары
            time_str = class_event.get('time', '')
            if not time_str or '-' not in time_str:
                logger.debug(f"Invalid time format: {time_str}")
                return
            
            start_time_str = time_str.split('-')[0].strip()
            try:
                start_hour, start_minute = map(int, start_time_str.split(':'))
            except (ValueError, AttributeError):
                logger.error(f"Failed to parse time: {start_time_str}")
                return
            
            # Создаем datetime для начала пары (сегодня, московское время)
            class_start_time = now.replace(
                hour=start_hour, 
                minute=start_minute, 
                second=0, 
                microsecond=0
            )
            
            # Вычисляем время, когда должно быть отправлено уведомление
            notification_datetime = class_start_time - timedelta(minutes=notification_time)
            
            # Вычисляем разницу в минутах между текущим временем и временем уведомления
            time_diff_seconds = (now - notification_datetime).total_seconds()
            time_diff_minutes = time_diff_seconds / 60
            
            # Уведомление должно быть отправлено если:
            # 1. Текущее время >= времени уведомления (с допуском 30 секунд)
            # 2. Текущее время < времени уведомления + 5.5 минуты (окно для отправки)
            # Увеличенное окно (5.5 мин) гарантирует доставку даже при задержках,
            # так как интервал проверки = 5 минут. Защита от дублирования работает через sent_notifications.
            if -0.5 <= time_diff_minutes < 5.5:
                discipline = class_event.get('discipline', 'Unknown')
                
                # Создаем уникальный ключ для предотвращения дублирования
                # Формат: telegram_id_дисциплина_время_дата
                today_date = now.strftime('%Y-%m-%d')
                notification_key = f"{telegram_id}_{discipline}_{start_time_str}_{today_date}"
                
                logger.debug(f"Time to notify! Checking key: {notification_key}, time_diff={time_diff_minutes:.2f} min")
                
                # Проверяем, не отправляли ли уже уведомление (защита от дублирования)
                sent_notification = await self.db.sent_notifications.find_one({
                    "notification_key": notification_key
                })
                
                if sent_notification:
                    logger.debug(f"Notification already sent: {notification_key}")
                    return
                
                logger.info(f"Sending notification to {telegram_id} for '{discipline}' at {start_time_str} ({notification_time} min before)")
                
                # Сначала создаем запись о попытке отправки уведомления
                # ВАЖНО: Создаем ДО отправки, чтобы избежать повторных попыток даже если отправка упадет с ошибкой
                try:
                    await self.db.sent_notifications.insert_one({
                        "notification_key": notification_key,
                        "telegram_id": telegram_id,
                        "class_discipline": discipline,
                        "class_time": time_str,
                        "notification_time_minutes": notification_time,
                        "sent_at": now.replace(tzinfo=None),
                        "date": today_date,
                        "success": None,  # Изначально None, обновим после отправки
                        "expires_at": now.replace(tzinfo=None) + timedelta(days=2)
                    })
                    logger.debug(f"Created sent_notifications record for {notification_key}")
                except DuplicateKeyError:
                    # Другой процесс/поток уже создал эту запись (защита от race condition)
                    logger.debug(f"Notification {notification_key} already being processed by another instance")
                    return
                except Exception as db_error:
                    # Если не можем создать запись - логируем и не продолжаем
                    logger.error(f"Failed to create sent_notifications record: {db_error}")
                    # Не продолжаем отправку, чтобы не было спама
                    return
                
                # Теперь отправляем уведомление
                success = await self.notification_service.send_class_notification(
                    telegram_id=telegram_id,
                    class_info=class_event,
                    minutes_before=notification_time
                )
                
                # Обновляем статус отправки в записи
                try:
                    await self.db.sent_notifications.update_one(
                        {"notification_key": notification_key},
                        {"$set": {"success": success}}
                    )
                except Exception as update_error:
                    logger.error(f"Failed to update notification status: {update_error}")
                
                if success:
                    logger.info(f"✅ Notification sent successfully to {telegram_id} for '{discipline}'")
                else:
                    logger.warning(f"⚠️ Failed to send notification to {telegram_id} for '{discipline}' (probably user hasn't started bot)")
            else:
                # Логируем только если разница небольшая (для отладки)
                if -5 <= time_diff_minutes < 5:
                    logger.debug(
                        f"Not time yet for {telegram_id}: class at {start_time_str}, "
                        f"notify at {notification_datetime.strftime('%H:%M')}, "
                        f"now {now.strftime('%H:%M')}, diff={time_diff_minutes:.2f} min"
                    )
        
        except Exception as e:
            logger.error(f"Error notifying about class: {e}", exc_info=True)
    
    def _get_week_number(self, date: datetime) -> int:
        """
        Определить номер недели (1 или 2) на основе календарной недели года
        
        В университетском расписании используется система "четная/нечетная неделя":
        - Неделя №1 (нечетная): 1-я, 3-я, 5-я... недели года
        - Неделя №2 (четная): 2-я, 4-я, 6-я... недели года
        
        Args:
            date: Дата для проверки
            
        Returns:
            1 для нечетных недель года, 2 для четных недель года
        """
        # Получаем номер недели в году по ISO 8601 стандарту
        # Возвращает (год, неделя, день_недели)
        iso_year, iso_week, iso_weekday = date.isocalendar()
        
        # Определяем четность недели
        # Нечетная неделя (1, 3, 5, 7, ...) → week_number = 1
        # Четная неделя (2, 4, 6, 8, ...) → week_number = 2
        if iso_week % 2 == 1:
            return 1  # Нечетная неделя
        else:
            return 2  # Четная неделя
    
    async def cleanup_old_notifications(self):
        """
        Очистить старые записи отправленных уведомлений из базы данных
        Удаляет записи старше expires_at
        """
        try:
            now = datetime.now(MOSCOW_TZ).replace(tzinfo=None)
            
            # Удаляем все уведомления, у которых истёк срок
            result = await self.db.sent_notifications.delete_many({
                "expires_at": {"$lt": now}
            })
            
            if result.deleted_count > 0:
                logger.info(f"Cleaned up {result.deleted_count} old notification records")
            else:
                logger.debug("No old notifications to clean up")
        
        except Exception as e:
            logger.error(f"Error cleaning up old notifications: {e}", exc_info=True)
    
    async def reset_daily_task_counters(self):
        """
        Сбросить дневные счетчики выполненных задач для всех пользователей
        Вызывается каждый день в 00:00
        """
        try:
            today = datetime.now(MOSCOW_TZ).strftime("%Y-%m-%d")
            
            # Сбрасываем tasks_completed_today для всех пользователей
            result = await self.db.user_stats.update_many(
                {},  # Все пользователи
                {
                    "$set": {
                        "tasks_completed_today": 0,
                        "last_daily_reset": today,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            logger.info(f"Reset daily task counters for {result.modified_count} users at {today}")
        
        except Exception as e:
            logger.error(f"Error resetting daily task counters: {e}", exc_info=True)


# Глобальный экземпляр планировщика
scheduler_instance = None


def get_scheduler(db: AsyncIOMotorDatabase) -> NotificationScheduler:
    """Получить глобальный экземпляр планировщика"""
    global scheduler_instance
    
    if scheduler_instance is None:
        scheduler_instance = NotificationScheduler(db)
    
    return scheduler_instance
