"""
Улучшенный планировщик уведомлений с pre-scheduling подходом
Версия 2.0 - Двухуровневая архитектура для точной и эффективной доставки уведомлений
"""

import logging
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError
from notifications import get_notification_service

logger = logging.getLogger(__name__)

# Московское время
MOSCOW_TZ = pytz.timezone('Europe/Moscow')

# Константы
MAX_RETRY_ATTEMPTS = 3
RETRY_INTERVALS = [1, 3, 5]  # минуты между попытками


class NotificationSchedulerV2:
    """
    Улучшенный планировщик уведомлений
    
    Архитектура:
    - Уровень 1: Daily Planner - создает расписание на день (06:00)
    - Уровень 2: Notification Executor - отправляет по расписанию (точное время)
    - Уровень 3: Retry Handler - повторяет неудачные попытки
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        """
        Инициализация планировщика
        
        Args:
            db: База данных MongoDB
        """
        self.db = db
        self.scheduler = AsyncIOScheduler(timezone=MOSCOW_TZ)
        self.notification_service = get_notification_service()
        self.scheduled_jobs = {}  # Храним созданные задачи для управления
    
    def start(self):
        """Запустить планировщик"""
        
        # === УРОВЕНЬ 1: Daily Planner ===
        # Подготовка расписания уведомлений на день (каждый день в 06:00)
        self.scheduler.add_job(
            self.prepare_daily_schedule,
            trigger=CronTrigger(hour=6, minute=0, timezone=MOSCOW_TZ),
            id='daily_planner',
            name='Prepare daily notification schedule',
            replace_existing=True
        )
        
        # Также запускаем при старте приложения для текущего дня
        self.scheduler.add_job(
            self.prepare_daily_schedule,
            trigger=DateTrigger(run_date=datetime.now(MOSCOW_TZ) + timedelta(seconds=5)),
            id='initial_planner',
            name='Initial daily schedule preparation',
            replace_existing=True
        )
        
        # === УРОВЕНЬ 3: Retry Handler ===
        # Проверка и повтор неудачных уведомлений (каждые 2 минуты)
        self.scheduler.add_job(
            self.retry_failed_notifications,
            trigger=CronTrigger(minute='*/2', timezone=MOSCOW_TZ),
            id='retry_handler',
            name='Retry failed notifications',
            replace_existing=True
        )
        
        # === MAINTENANCE ===
        # Очистка старых записей (раз в день в 02:00)
        self.scheduler.add_job(
            self.cleanup_old_records,
            trigger=CronTrigger(hour=2, minute=0, timezone=MOSCOW_TZ),
            id='cleanup_records',
            name='Cleanup old notification records',
            replace_existing=True
        )
        
        # Сброс дневных счетчиков задач (00:00)
        self.scheduler.add_job(
            self.reset_daily_task_counters,
            trigger=CronTrigger(hour=0, minute=0, timezone=MOSCOW_TZ),
            id='reset_daily_tasks',
            name='Reset daily task counters',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("✅ Notification Scheduler V2 started successfully")
        logger.info("📅 Daily planner will run at 06:00 Moscow time")
        logger.info("🔄 Retry handler checks every 2 minutes")
    
    def stop(self):
        """Остановить планировщик"""
        self.scheduler.shutdown(wait=False)
        logger.info("🛑 Notification Scheduler V2 stopped")
    
    # ============================================================================
    # УРОВЕНЬ 1: DAILY PLANNER - Подготовка расписания на день
    # ============================================================================
    
    async def prepare_daily_schedule(self):
        """
        Подготовить расписание уведомлений на текущий день
        OPTIMIZED: Batch processing for scalability (chunks of 50 users)
        """
        try:
            now = datetime.now(MOSCOW_TZ)
            today = now.strftime('%Y-%m-%d')
            current_day = now.strftime('%A')
            
            logger.info(f"📅 Starting daily schedule preparation for {today} (Optimized)")
            
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
            
            # Определяем номер недели
            week_number = self._get_week_number(now)
            
            # Используем курсор вместо загрузки всех пользователей сразу
            cursor = self.db.user_settings.find({
                "notifications_enabled": True,
                "group_id": {"$exists": True, "$ne": None}
            })
            
            total_notifications_created = 0
            total_jobs_scheduled = 0
            processed_users = 0
            
            # Параметры пакетной обработки
            batch_size = 50
            batch_tasks = []
            
            async for user in cursor:
                # Добавляем задачу в пакет
                task = self._prepare_user_schedule(
                    user, 
                    russian_day, 
                    week_number, 
                    today, 
                    now
                )
                batch_tasks.append(task)
                
                # Если пакет заполнен, обрабатываем его параллельно
                if len(batch_tasks) >= batch_size:
                    results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                    
                    for res in results:
                        if isinstance(res, tuple):
                            created, scheduled = res
                            total_notifications_created += created
                            total_jobs_scheduled += scheduled
                        elif isinstance(res, Exception):
                            logger.error(f"Error in batch processing: {res}")
                    
                    processed_users += len(batch_tasks)
                    batch_tasks = []
                    
                    # Небольшая пауза, чтобы не блокировать event loop полностью
                    await asyncio.sleep(0.01)
            
            # Обрабатываем остаток
            if batch_tasks:
                results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                for res in results:
                    if isinstance(res, tuple):
                        created, scheduled = res
                        total_notifications_created += created
                        total_jobs_scheduled += scheduled
                    elif isinstance(res, Exception):
                        logger.error(f"Error in final batch processing: {res}")
                processed_users += len(batch_tasks)
            
            logger.info(
                f"✅ Daily schedule prepared for {processed_users} users: "
                f"{total_notifications_created} notifications created, "
                f"{total_jobs_scheduled} jobs scheduled"
            )
        
        except Exception as e:
            logger.error(f"❌ Error preparing daily schedule: {e}", exc_info=True)
    
    async def _prepare_user_schedule(
        self,
        user: Dict,
        day: str,
        week_number: int,
        today: str,
        now: datetime
    ) -> tuple[int, int]:
        """
        Подготовить расписание уведомлений для конкретного пользователя
        
        Args:
            user: Данные пользователя
            day: День недели (на русском)
            week_number: Номер недели (1 или 2)
            today: Сегодняшняя дата (YYYY-MM-DD)
            now: Текущее время с timezone
            
        Returns:
            (количество созданных уведомлений, количество запланированных задач)
        """
        try:
            telegram_id = user['telegram_id']
            notification_time = user.get('notification_time', 10)
            
            # Получаем расписание из кэша
            # Важно: expires_at хранится в UTC, поэтому сравниваем с UTC
            utc_now = datetime.utcnow()
            cached_schedule = await self.db.schedule_cache.find_one({
                "group_id": user.get('group_id'),
                "week_number": week_number,
                "expires_at": {"$gt": utc_now}
            })
            
            if not cached_schedule:
                logger.debug(f"No cached schedule for user {telegram_id}")
                return 0, 0
            
            events = cached_schedule.get('events', [])
            today_classes = [e for e in events if e.get('day') == day]
            
            if not today_classes:
                logger.debug(f"No classes today for user {telegram_id}")
                return 0, 0
            
            logger.info(f"📚 User {telegram_id} has {len(today_classes)} classes today")
            
            notifications_created = 0
            jobs_scheduled = 0
            
            for class_event in today_classes:
                created, scheduled = await self._create_scheduled_notification(
                    telegram_id,
                    class_event,
                    notification_time,
                    today,
                    now
                )
                notifications_created += created
                jobs_scheduled += scheduled
            
            return notifications_created, jobs_scheduled
        
        except Exception as e:
            logger.error(f"Error preparing schedule for user {user.get('telegram_id')}: {e}")
            return 0, 0
    
    async def _create_scheduled_notification(
        self,
        telegram_id: int,
        class_event: Dict,
        notification_time: int,
        today: str,
        now: datetime
    ) -> tuple[int, int]:
        """
        Создать запись о запланированном уведомлении и задачу в scheduler
        
        Args:
            telegram_id: ID пользователя
            class_event: Информация о паре
            notification_time: За сколько минут уведомлять
            today: Дата (YYYY-MM-DD)
            now: Текущее время
            
        Returns:
            (1, 1) если успешно создано, (0, 0) если нет
        """
        try:
            # Парсим время начала пары
            time_str = class_event.get('time', '')
            if not time_str or '-' not in time_str:
                return 0, 0
            
            start_time_str = time_str.split('-')[0].strip()
            try:
                start_hour, start_minute = map(int, start_time_str.split(':'))
            except (ValueError, AttributeError):
                logger.error(f"Failed to parse time: {start_time_str}")
                return 0, 0
            
            # Создаем datetime для начала пары
            class_start_time = now.replace(
                hour=start_hour,
                minute=start_minute,
                second=0,
                microsecond=0
            )
            
            # Вычисляем время отправки уведомления
            notification_datetime = class_start_time - timedelta(minutes=notification_time)
            
            # Пропускаем, если время уже прошло (с запасом 1 минута)
            if notification_datetime < now - timedelta(minutes=1):
                logger.debug(
                    f"Skipping past notification: {notification_datetime.strftime('%H:%M')} "
                    f"< {now.strftime('%H:%M')}"
                )
                return 0, 0
            
            # Создаем уникальный ID и ключ
            notification_id = str(uuid.uuid4())
            notification_key = f"{telegram_id}_{class_event.get('discipline')}_{start_time_str}_{today}"
            
            # Проверяем, не создано ли уже уведомление
            existing = await self.db.scheduled_notifications.find_one({
                "notification_key": notification_key
            })
            
            if existing:
                logger.debug(f"Notification already scheduled: {notification_key}")
                return 0, 0
            
            # Создаем запись в БД
            notification_doc = {
                "id": notification_id,
                "notification_key": notification_key,
                "telegram_id": telegram_id,
                "date": today,
                "class_info": {
                    "discipline": class_event.get('discipline', 'Unknown'),
                    "time": time_str,
                    "teacher": class_event.get('teacher', ''),
                    "auditory": class_event.get('auditory', ''),
                    "lessonType": class_event.get('lessonType', '')
                },
                "scheduled_time": notification_datetime.replace(tzinfo=None),
                "notification_time_minutes": notification_time,
                "status": "pending",
                "attempts": 0,
                "last_attempt_at": None,
                "error_message": None,
                "created_at": now.replace(tzinfo=None),
                "sent_at": None
            }
            
            try:
                await self.db.scheduled_notifications.insert_one(notification_doc)
                logger.debug(f"✅ Created notification: {notification_key}")
            except DuplicateKeyError:
                logger.debug(f"Duplicate notification key: {notification_key}")
                return 0, 0
            
            # Создаем задачу в APScheduler для точного времени
            job_id = f"notify_{notification_id}"
            
            try:
                self.scheduler.add_job(
                    self.send_notification,
                    trigger=DateTrigger(run_date=notification_datetime),
                    args=[notification_id],
                    id=job_id,
                    name=f"Notify {telegram_id} at {notification_datetime.strftime('%H:%M')}",
                    replace_existing=True
                )
                
                self.scheduled_jobs[notification_id] = job_id
                
                logger.info(
                    f"📅 Scheduled notification for user {telegram_id}: "
                    f"{class_event.get('discipline')} at {notification_datetime.strftime('%H:%M')}"
                )
                
                return 1, 1
            
            except Exception as job_error:
                logger.error(f"Failed to schedule job: {job_error}")
                # Обновляем статус в БД
                await self.db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"status": "failed", "error_message": str(job_error)}}
                )
                return 1, 0
        
        except Exception as e:
            logger.error(f"Error creating scheduled notification: {e}", exc_info=True)
            return 0, 0
    
    # ============================================================================
    # УРОВЕНЬ 2: NOTIFICATION EXECUTOR - Отправка уведомлений
    # ============================================================================
    
    async def send_notification(self, notification_id: str):
        """
        Отправить уведомление по ID
        
        Args:
            notification_id: ID запланированного уведомления
        """
        try:
            # Получаем данные уведомления из БД
            notification = await self.db.scheduled_notifications.find_one({
                "id": notification_id
            })
            
            if not notification:
                logger.error(f"Notification {notification_id} not found in DB")
                return
            
            # Проверяем статус
            if notification['status'] != 'pending':
                logger.debug(f"Notification {notification_id} already processed: {notification['status']}")
                return
            
            telegram_id = notification['telegram_id']
            class_info = notification['class_info']
            minutes_before = notification['notification_time_minutes']
            
            logger.info(
                f"📤 Sending notification to {telegram_id}: "
                f"{class_info['discipline']} at {class_info['time']}"
            )
            
            # Обновляем попытку
            await self.db.scheduled_notifications.update_one(
                {"id": notification_id},
                {
                    "$set": {"last_attempt_at": datetime.utcnow()},
                    "$inc": {"attempts": 1}
                }
            )
            
            # Отправляем уведомление
            success = await self.notification_service.send_class_notification(
                telegram_id=telegram_id,
                class_info=class_info,
                minutes_before=minutes_before
            )
            
            # Обновляем статус
            if success:
                now_utc = datetime.utcnow()
                await self.db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {
                        "$set": {
                            "status": "sent",
                            "sent_at": now_utc
                        }
                    }
                )
                
                # === HISTORY: Сохраняем в вечную историю ===
                try:
                    history_item = {
                        "id": str(uuid.uuid4()),
                        "telegram_id": telegram_id,
                        "title": class_info['discipline'],
                        "message": f"{class_info['lessonType']} • {class_info['time']} • {class_info['auditory']}",
                        "sent_at": now_utc,
                        "read": False
                    }
                    await self.db.notification_history.insert_one(history_item)
                except Exception as hist_e:
                    logger.error(f"Failed to save notification history: {hist_e}")
                # ===========================================

                logger.info(f"✅ Notification {notification_id} sent successfully")
            else:
                await self.db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {
                        "$set": {
                            "status": "failed",
                            "error_message": "Failed to send via Telegram API"
                        }
                    }
                )
                logger.warning(f"⚠️ Notification {notification_id} failed to send")
        
        except Exception as e:
            logger.error(f"Error sending notification {notification_id}: {e}", exc_info=True)
            
            # Обновляем статус на failed
            try:
                await self.db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {
                        "$set": {
                            "status": "failed",
                            "error_message": str(e)
                        }
                    }
                )
            except Exception as update_error:
                logger.error(f"Failed to update notification status: {update_error}")
    
    # ============================================================================
    # УРОВЕНЬ 3: RETRY HANDLER - Повтор неудачных уведомлений
    # ============================================================================
    
    async def retry_failed_notifications(self):
        """
        Найти и повторить неудачные уведомления
        
        Логика:
        - Ищем уведомления со статусом 'failed'
        - Проверяем количество попыток (максимум 3)
        - Проверяем интервал с последней попытки (1, 3, 5 минут)
        - Повторяем отправку
        """
        try:
            now = datetime.utcnow()
            
            # Находим неудачные уведомления с попытками < MAX_RETRY_ATTEMPTS
            failed_notifications = await self.db.scheduled_notifications.find({
                "status": "failed",
                "attempts": {"$lt": MAX_RETRY_ATTEMPTS},
                "date": datetime.now(MOSCOW_TZ).strftime('%Y-%m-%d')  # Только сегодняшние
            }).to_list(None)
            
            if not failed_notifications:
                return
            
            logger.info(f"🔄 Found {len(failed_notifications)} failed notifications to retry")
            
            for notification in failed_notifications:
                await self._retry_notification(notification, now)
        
        except Exception as e:
            logger.error(f"Error in retry handler: {e}", exc_info=True)
    
    async def _retry_notification(self, notification: Dict, now: datetime):
        """
        Повторить отправку конкретного уведомления
        
        Args:
            notification: Данные уведомления
            now: Текущее время
        """
        try:
            notification_id = notification['id']
            attempts = notification['attempts']
            last_attempt_at = notification.get('last_attempt_at')
            
            # Определяем интервал для текущей попытки
            retry_interval = RETRY_INTERVALS[min(attempts, len(RETRY_INTERVALS) - 1)]
            
            # Проверяем, прошло ли достаточно времени с последней попытки
            if last_attempt_at:
                time_since_last = (now - last_attempt_at).total_seconds() / 60
                if time_since_last < retry_interval:
                    logger.debug(
                        f"Not enough time passed for retry {notification_id}: "
                        f"{time_since_last:.1f} < {retry_interval} min"
                    )
                    return
            
            # Обновляем статус на pending для повторной попытки
            await self.db.scheduled_notifications.update_one(
                {"id": notification_id},
                {"$set": {"status": "pending"}}
            )
            
            logger.info(
                f"🔄 Retrying notification {notification_id} "
                f"(attempt {attempts + 1}/{MAX_RETRY_ATTEMPTS})"
            )
            
            # Отправляем
            await self.send_notification(notification_id)
        
        except Exception as e:
            logger.error(f"Error retrying notification: {e}", exc_info=True)
    
    # ============================================================================
    # MAINTENANCE - Очистка и сброс
    # ============================================================================
    
    async def cleanup_old_records(self):
        """
        Очистить старые записи из БД
        - scheduled_notifications старше 7 дней
        - sent_notifications старше expires_at (старая система)
        """
        try:
            now = datetime.utcnow()
            cutoff_date = (datetime.now(MOSCOW_TZ) - timedelta(days=7)).strftime('%Y-%m-%d')
            
            # Очистка scheduled_notifications
            result1 = await self.db.scheduled_notifications.delete_many({
                "date": {"$lt": cutoff_date}
            })
            
            # Очистка sent_notifications (старая система)
            result2 = await self.db.sent_notifications.delete_many({
                "expires_at": {"$lt": now}
            })
            
            total_deleted = result1.deleted_count + result2.deleted_count
            
            if total_deleted > 0:
                logger.info(f"🧹 Cleaned up {total_deleted} old notification records")
        
        except Exception as e:
            logger.error(f"Error cleaning up records: {e}", exc_info=True)
    
    async def reset_daily_task_counters(self):
        """
        Сбросить дневные счетчики выполненных задач
        Вызывается каждый день в 00:00
        """
        try:
            today = datetime.now(MOSCOW_TZ).strftime("%Y-%m-%d")
            
            result = await self.db.user_stats.update_many(
                {},
                {
                    "$set": {
                        "tasks_completed_today": 0,
                        "last_daily_reset": today,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            logger.info(f"🔄 Reset daily task counters for {result.modified_count} users")
        
        except Exception as e:
            logger.error(f"Error resetting daily task counters: {e}", exc_info=True)
    
    # ============================================================================
    # UTILS
    # ============================================================================
    
    def _get_week_number(self, date: datetime) -> int:
        """
        Определить номер недели (1 или 2)
        
        Args:
            date: Дата для проверки
            
        Returns:
            1 для нечетных недель, 2 для четных
        """
        iso_year, iso_week, iso_weekday = date.isocalendar()
        return 1 if iso_week % 2 == 1 else 2
    
    # ============================================================================
    # API для управления уведомлениями
    # ============================================================================
    
    async def cancel_notification(self, notification_id: str) -> bool:
        """
        Отменить запланированное уведомление
        
        Args:
            notification_id: ID уведомления
            
        Returns:
            True если успешно отменено
        """
        try:
            # Обновляем статус в БД
            result = await self.db.scheduled_notifications.update_one(
                {"id": notification_id, "status": "pending"},
                {"$set": {"status": "cancelled"}}
            )
            
            if result.modified_count == 0:
                return False
            
            # Удаляем задачу из scheduler
            job_id = self.scheduled_jobs.get(notification_id)
            if job_id:
                try:
                    self.scheduler.remove_job(job_id)
                    del self.scheduled_jobs[notification_id]
                except Exception:
                    pass
            
            logger.info(f"🚫 Notification {notification_id} cancelled")
            return True
        
        except Exception as e:
            logger.error(f"Error cancelling notification: {e}")
            return False
    
    async def get_notification_stats(self, date: Optional[str] = None) -> Dict:
        """
        Получить статистику уведомлений за день
        
        Args:
            date: Дата в формате YYYY-MM-DD (по умолчанию - сегодня)
            
        Returns:
            Словарь со статистикой
        """
        try:
            if not date:
                date = datetime.now(MOSCOW_TZ).strftime('%Y-%m-%d')
            
            pipeline = [
                {"$match": {"date": date}},
                {
                    "$group": {
                        "_id": "$status",
                        "count": {"$sum": 1}
                    }
                }
            ]
            
            results = await self.db.scheduled_notifications.aggregate(pipeline).to_list(None)
            
            stats = {
                "date": date,
                "total": 0,
                "pending": 0,
                "sent": 0,
                "failed": 0,
                "cancelled": 0
            }
            
            for result in results:
                status = result['_id']
                count = result['count']
                stats[status] = count
                stats['total'] += count
            
            return stats
        
        except Exception as e:
            logger.error(f"Error getting notification stats: {e}")
            return {}

    async def schedule_user_notifications(self, telegram_id: int) -> Dict:
        """
        Принудительно запланировать уведомления для конкретного пользователя на сегодня
        (Вызывать при изменении настроек или расписания)
        
        Args:
            telegram_id: ID пользователя
            
        Returns:
            Словарь с результатами {created, scheduled}
        """
        try:
            now = datetime.now(MOSCOW_TZ)
            today = now.strftime('%Y-%m-%d')
            current_day = now.strftime('%A')
            
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
            
            # Определяем номер недели
            week_number = self._get_week_number(now)
            
            # Получаем данные пользователя
            user = await self.db.user_settings.find_one({"telegram_id": telegram_id})
            if not user:
                logger.warning(f"User {telegram_id} not found for scheduling")
                return {"created": 0, "scheduled": 0}
            
            if not user.get("notifications_enabled"):
                logger.info(f"Notifications disabled for user {telegram_id}, skipping")
                return {"created": 0, "scheduled": 0}
            
            logger.info(f"🔄 Force scheduling notifications for user {telegram_id}")
            
            created, scheduled = await self._prepare_user_schedule(
                user, 
                russian_day, 
                week_number, 
                today, 
                now
            )
            
            return {"created": created, "scheduled": scheduled}
            
        except Exception as e:
            logger.error(f"Error scheduling user notifications: {e}", exc_info=True)
            return {"created": 0, "scheduled": 0}


# Глобальный экземпляр планировщика
scheduler_v2_instance = None


def get_scheduler_v2(db: AsyncIOMotorDatabase) -> NotificationSchedulerV2:
    """Получить глобальный экземпляр планировщика V2"""
    global scheduler_v2_instance
    
    if scheduler_v2_instance is None:
        scheduler_v2_instance = NotificationSchedulerV2(db)
    
    return scheduler_v2_instance
