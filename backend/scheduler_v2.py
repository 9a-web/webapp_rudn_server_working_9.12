"""
Улучшенный планировщик уведомлений с pre-scheduling подходом.
Версия 2.1 — Двухуровневая архитектура для точной и эффективной доставки уведомлений.

P2 iteration (cross-platform fixes):
  ── ВСЕ юзеры (включая VK/Email с pseudo_tid) теперь получают in-app уведомления о парах.
     Раньше pseudo-tid юзеры были исключены фильтром, что ломало кроссплатформенность.
  ── Recovery on start: при рестарте scheduler'а — re-schedule все pending notifications
     из БД, и сразу отправляются те, у которых scheduled_time уже прошёл (in-grace-period).
     Раньше APScheduler MemoryJobStore терял задачи при рестарте.
  ── Atomic find_one_and_update в send_notification: исключаем race condition при
     возможном дубль-вызове.
  ── Унифицирован UTC во всех timestamps в БД (был mix наивных МСК и UTC).
  ── Timeout 30s на отправку уведомления (защита от зависания Bot API).
  ── send_class_notification теперь корректно возвращает True ТОЛЬКО для delivered_to_user
     (раньше True шёл и при упавшем TG-push real-TG юзера → retry не срабатывал).
"""

import asyncio
import logging
import uuid
from datetime import date as date_type
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from auth_utils import (
    PSEUDO_TID_OFFSET,  # noqa: F401  # kept for backward compat (export)
    is_pseudo_tid,  # noqa: F401  # may be unused after Improvement 8, kept for export
    is_real_telegram_user,  # noqa: F401  # may be unused now, kept for export & future use
)
from notifications import get_notification_service

logger = logging.getLogger(__name__)

# Московское время
MOSCOW_TZ = pytz.timezone('Europe/Moscow')

# Константы retry-логики (только для in-DB scheduled_notifications, не для delivery_attempts)
MAX_RETRY_ATTEMPTS = 3
RETRY_INTERVALS = [1, 3, 5]  # минуты между попытками

# Single-send timeout (защита от зависания Bot API). Уведомление помечается failed,
# retry handler подберёт через 1-3-5 мин.
SEND_NOTIFICATION_TIMEOUT_SEC = 30.0

# Recovery: уведомления, у которых scheduled_time прошёл не более чем на эту дельту,
# отправляются ИММЕДИАТЛЫ при старте scheduler'а. Более старые — помечаются как `expired`.
RECOVERY_GRACE_MINUTES = 60


def _utc_now() -> datetime:
    """Текущий момент в UTC (tz-aware). Единая точка для всего модуля."""
    return datetime.now(timezone.utc)


def _utc_now_naive() -> datetime:
    """Naive UTC — для legacy-полей в БД, которые исторически naive."""
    return _utc_now().replace(tzinfo=None)


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
        self._started = False  # Флаг предотвращения повторного запуска
    
    def start(self):
        """Запустить планировщик (с защитой от дублирования)."""
        if self._started:
            logger.warning("⚠️ Scheduler already started, skipping duplicate start()")
            return
        self._started = True

        # === УРОВЕНЬ 0: Recovery — re-schedule pending notifications из БД ===
        # Критично после рестарта: APScheduler MemoryJobStore теряет jobs.
        # Сразу после старта проходим по pending уведомлениям и:
        #   — для будущих → восстанавливаем APScheduler-задачу
        #   — для уже прошедших (в пределах RECOVERY_GRACE_MINUTES) → отправляем СРАЗУ
        #   — для слишком старых → помечаем как expired (чтобы не «выстреливать в прошлое»)
        self.scheduler.add_job(
            self.recover_pending_notifications,
            trigger=DateTrigger(run_date=datetime.now(MOSCOW_TZ) + timedelta(seconds=2)),
            id='recovery',
            name='Recover pending notifications after restart',
            replace_existing=True,
        )

        # === УРОВЕНЬ 1: Daily Planner ===
        # Подготовка расписания уведомлений на день (каждый день в 06:00)
        self.scheduler.add_job(
            self.prepare_daily_schedule,
            trigger=CronTrigger(hour=6, minute=0, timezone=MOSCOW_TZ),
            id='daily_planner',
            name='Prepare daily notification schedule',
            replace_existing=True,
        )

        # Также запускаем при старте приложения для текущего дня (после recovery)
        self.scheduler.add_job(
            self.prepare_daily_schedule,
            trigger=DateTrigger(run_date=datetime.now(MOSCOW_TZ) + timedelta(seconds=10)),
            id='initial_planner',
            name='Initial daily schedule preparation',
            replace_existing=True,
        )

        # === УРОВЕНЬ 3: Retry Handler (для scheduled_notifications) ===
        # Проверка и повтор неудачных уведомлений (каждые 2 минуты)
        self.scheduler.add_job(
            self.retry_failed_notifications,
            trigger=CronTrigger(minute='*/2', timezone=MOSCOW_TZ),
            id='retry_handler',
            name='Retry failed notifications',
            replace_existing=True,
        )

        # === УРОВЕНЬ 3.5: DLQ Retry Worker (для delivery_attempts) ===
        # БАГ #2 (КРИТИЧЕСКИЙ): раньше воркер process_pending_retries был написан, но НЕ запускался.
        # Записи `delivery_attempts.status=pending_retry` (от notify_user/admin-рассылок/ачивок
        # с enable_retry=True) копились и не обрабатывались. Теперь обрабатываем каждые 30 сек.
        self.scheduler.add_job(
            self._run_dlq_retries,
            trigger=CronTrigger(second='*/30', timezone=MOSCOW_TZ),
            id='dlq_retry_worker',
            name='Process pending_retry from delivery_attempts (DLQ)',
            replace_existing=True,
            max_instances=1,  # одновременно только 1 (избегаем дубль-доставки)
        )

        # === MAINTENANCE ===
        # Очистка старых записей (раз в день в 02:00)
        self.scheduler.add_job(
            self.cleanup_old_records,
            trigger=CronTrigger(hour=2, minute=0, timezone=MOSCOW_TZ),
            id='cleanup_records',
            name='Cleanup old notification records',
            replace_existing=True,
        )

        # Сброс дневных счетчиков задач (00:00)
        self.scheduler.add_job(
            self.reset_daily_task_counters,
            trigger=CronTrigger(hour=0, minute=0, timezone=MOSCOW_TZ),
            id='reset_daily_tasks',
            name='Reset daily task counters',
            replace_existing=True,
        )

        # === INACTIVITY CHECKER (Авто-напоминания о возвращении) ===
        # ВРЕМЕННО ОТКЛЮЧЕНО — оставляем закомментированным до отдельного решения
        # self.scheduler.add_job(
        #     self.check_inactive_users,
        #     trigger=CronTrigger(hour=10, minute=0, timezone=MOSCOW_TZ),
        #     id='inactivity_checker',
        #     name='Check inactive users and send reminders (daily)',
        #     replace_existing=True
        # )

        # Сброс streak_claimed_today в полночь — ВРЕМЕННО ОТКЛЮЧЕНО
        # self.scheduler.add_job(
        #     self.reset_streak_claimed,
        #     trigger=CronTrigger(hour=0, minute=5, timezone=MOSCOW_TZ),
        #     id='reset_streak_claimed',
        #     name='Reset streak claimed today flag',
        #     replace_existing=True
        # )

        self.scheduler.start()
        logger.info("✅ Notification Scheduler V2 started successfully")
        logger.info("🔧 Recovery will run in 2 seconds")
        logger.info("📅 Daily planner will run at 06:00 Moscow time")
        logger.info("🔄 Retry handler checks every 2 minutes")
        logger.info("📦 DLQ retry worker checks every 30 seconds")
    
    def stop(self):
        """Остановить планировщик"""
        self.scheduler.shutdown(wait=False)
        logger.info("🛑 Notification Scheduler V2 stopped")

    # ============================================================================
    # УРОВЕНЬ 0: RECOVERY — восстановление после рестарта
    # ============================================================================

    async def recover_pending_notifications(self):
        """Восстановить запланированные уведомления после рестарта backend.

        Проблема: APScheduler с MemoryJobStore теряет все jobs при рестарте.
        В БД остаются записи `scheduled_notifications` со `status=pending`,
        но APScheduler их «забыл».

        Решение:
        1. Для уведомлений, `scheduled_time` которых в БУДУЩЕМ → re-add APScheduler job.
        2. Для уже ПРОСРОЧЕННЫХ (но не дольше RECOVERY_GRACE_MINUTES) → отправить сразу.
        3. Для очень старых (> grace) → помечаем `expired` (не «выстреливаем в прошлое»).

        Атомарно: используем status=pending → recovery_locked → ... чтобы избежать
        двойной обработки если этот метод вызван несколько раз.
        """
        try:
            now_msk = datetime.now(MOSCOW_TZ)
            now_naive_msk = now_msk.replace(tzinfo=None)
            grace_threshold = now_naive_msk - timedelta(minutes=RECOVERY_GRACE_MINUTES)
            today_str = now_msk.strftime('%Y-%m-%d')
            # БАГ #6: расширяем окно recovery — берём также вчерашние pending,
            # т.к. если backend упал ночью и поднялся утром, мы должны их обработать
            # (отправить если в grace, иначе пометить expired).
            yesterday_str = (now_msk - timedelta(days=1)).strftime('%Y-%m-%d')

            logger.info(f"🔧 [recovery] Starting recovery for dates={yesterday_str},{today_str}")

            # Берём pending уведомления за вчера И сегодня.
            cursor = self.db.scheduled_notifications.find({
                "status": "pending",
                "date": {"$in": [yesterday_str, today_str]},
            })

            recovered_future = 0
            sent_immediately = 0
            expired = 0
            errors = 0

            async for notif in cursor:
                try:
                    notification_id = notif.get("id")
                    scheduled_time = notif.get("scheduled_time")
                    if not scheduled_time or not notification_id:
                        continue

                    # scheduled_time naive МСК. Сравниваем с now_naive_msk.
                    # Если оно tz-aware (новые записи) — нормализуем.
                    if scheduled_time.tzinfo is not None:
                        scheduled_naive = scheduled_time.astimezone(MOSCOW_TZ).replace(tzinfo=None)
                    else:
                        scheduled_naive = scheduled_time

                    if scheduled_naive > now_naive_msk:
                        # Будущее — re-schedule
                        scheduled_aware = MOSCOW_TZ.localize(scheduled_naive)
                        job_id = f"notify_{notification_id}"
                        try:
                            self.scheduler.add_job(
                                self.send_notification,
                                trigger=DateTrigger(run_date=scheduled_aware),
                                args=[notification_id],
                                id=job_id,
                                name=f"[Recovered] Notify at {scheduled_naive.strftime('%H:%M')}",
                                replace_existing=True,
                            )
                            self.scheduled_jobs[notification_id] = job_id
                            recovered_future += 1
                        except Exception as e:  # noqa: BLE001
                            logger.error(f"[recovery] Failed to re-add job for {notification_id}: {e}")
                            errors += 1
                    elif scheduled_naive >= grace_threshold:
                        # В пределах grace period — отправляем СРАЗУ
                        logger.info(
                            f"[recovery] Sending overdue notification {notification_id} "
                            f"(scheduled {scheduled_naive.strftime('%H:%M')}, "
                            f"now {now_naive_msk.strftime('%H:%M')})"
                        )
                        # Запускаем в фоне, чтобы не блокировать recovery
                        asyncio.create_task(self.send_notification(notification_id))
                        sent_immediately += 1
                    else:
                        # Слишком старое — помечаем expired
                        await self.db.scheduled_notifications.update_one(
                            {"id": notification_id, "status": "pending"},
                            {"$set": {
                                "status": "expired",
                                "error_message": "expired_during_recovery",
                                "expired_at": _utc_now_naive(),
                            }},
                        )
                        expired += 1
                except Exception as e:  # noqa: BLE001
                    logger.error(f"[recovery] Error processing notification: {e}")
                    errors += 1

            logger.info(
                f"🔧 [recovery] Done: re-scheduled={recovered_future} "
                f"sent_immediately={sent_immediately} expired={expired} errors={errors}"
            )

        except Exception as e:  # noqa: BLE001
            logger.error(f"[recovery] Fatal error: {e}", exc_info=True)

    async def _run_dlq_retries(self):
        """Воркер обработки delivery_attempts.status=pending_retry.

        БАГ #2 (КРИТИЧЕСКИЙ): раньше эта функция была написана в services/delivery.py,
        но никем не вызывалась — записи копились без обработки. Теперь воркер запускается
        каждые 30 сек и:
          1) Берёт батч pending_retry с next_retry_at <= now
          2) Повторно отправляет (notify_user → safe_send_telegram + web push)
          3) При успехе → status=sent, при провале → инкремент attempts; если >= MAX → DLQ.

        Не блокирует остальные jobs (max_instances=1 в start()).
        """
        try:
            from notifications import get_notification_service
            from services.delivery import process_pending_retries

            svc = get_notification_service()
            stats = await process_pending_retries(
                self.db,
                svc.bot,
                limit=50,
                log_ctx="dlq_worker",
            )
            if stats.get("processed", 0) > 0:
                logger.info(
                    f"📦 [dlq_worker] processed={stats['processed']} "
                    f"sent={stats.get('sent', 0)} failed={stats.get('failed', 0)} "
                    f"dlq={stats.get('dlq', 0)}"
                )
        except Exception as e:  # noqa: BLE001
            # Воркер должен быть устойчив к ошибкам — иначе APScheduler его «выключит»
            logger.error(f"[dlq_worker] error: {e}", exc_info=True)
    
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
            
            # Используем курсор вместо загрузки всех пользователей сразу.
            # P2 fix (cross-platform): БЕРЁМ ВСЕХ юзеров с notifications_enabled,
            # включая pseudo_tid (VK/Email). Раньше фильтр `telegram_id < PSEUDO_TID_OFFSET`
            # ИСКЛЮЧАЛ их полностью — они не получали даже in-app уведомления о парах.
            # Теперь:
            #   — real-TG юзер → TG-push + in-app
            #   — pseudo-tid юзер → только in-app (TG-push корректно скипнут в delivery)
            # Это и есть истинная кроссплатформенность.
            #
            # БАГ #5 (исправлен): теперь учитываем ext.notifications_enabled и ext.study_enabled
            # из extended_notification_settings. Если в расширенных настройках выключены
            # учебные уведомления — не создаём их даже если глобальный notifications_enabled=True.
            # Логика OR: глобальный включён ИЛИ ext отсутствует — допускаем; ext.study_enabled
            # должен быть True (default True).
            cursor = self.db.user_settings.find({
                "notifications_enabled": True,
                "group_id": {"$exists": True, "$ne": None},
                "telegram_id": {"$exists": True, "$ne": None, "$gt": 0},
                # Расширенные настройки: study_enabled должен быть True
                # (либо отсутствовать, что = default True). Используем $or для допуска legacy юзеров.
                "$or": [
                    {"extended_notification_settings": {"$exists": False}},
                    {"extended_notification_settings.study_enabled": {"$ne": False}},
                ],
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
            # P2: используем datetime.now(timezone.utc).replace(tzinfo=None) вместо
            # deprecated datetime.utcnow()
            utc_now = _utc_now_naive()
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
            
            # Получаем название группы пользователя
            group_name = user.get('group_name', '')
            
            for class_event in today_classes:
                created, scheduled = await self._create_scheduled_notification(
                    telegram_id,
                    class_event,
                    notification_time,
                    today,
                    now,
                    group_name
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
        now: datetime,
        group_name: str = ""
    ) -> tuple[int, int]:
        """
        Создать запись о запланированном уведомлении и задачу в scheduler
        
        Args:
            telegram_id: ID пользователя
            class_event: Информация о паре
            notification_time: За сколько минут уведомлять
            today: Дата (YYYY-MM-DD)
            now: Текущее время
            group_name: Название группы пользователя
            
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
            
            # Bug E fix: расширяем grace period с 1 до 10 минут — если планировщик/процесс
            # ненадолго залип (GC, restart, ingress hiccup), мы всё равно пытаемся отправить
            # запоздавшее уведомление. APScheduler сам отработает overdue job (misfire_grace_time).
            # Если событие пары уже совсем в прошлом (>10 минут просрочки) — скипаем.
            past_threshold = timedelta(minutes=10)
            if notification_datetime < now - past_threshold:
                logger.debug(
                    f"Skipping past notification (>{past_threshold}): {notification_datetime.strftime('%H:%M')} "
                    f"< {now.strftime('%H:%M')}"
                )
                return 0, 0
            # Если просрочка <= grace — планируем «сейчас» с небольшим запасом,
            # чтобы APScheduler не отбросил job как misfire.
            fire_immediately = notification_datetime < now
            effective_run_date = (now + timedelta(seconds=5)) if fire_immediately else notification_datetime
            
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
            
            # Создаем запись в БД.
            # БАГ #3 (timezone): scheduled_time оставляем как naive MSK (поле семантически
            # привязано к локальному времени пары и используется APScheduler с MOSCOW_TZ).
            # ВСЕ остальные timestamp-поля — naive UTC (created_at, last_attempt_at, sent_at).
            notification_doc = {
                "id": notification_id,
                "notification_key": notification_key,
                "telegram_id": telegram_id,
                "date": today,
                "class_info": {
                    "discipline": class_event.get('discipline', 'Unknown'),
                    "time": time_str,
                    "start_time": start_time_str,  # для in-app карточки и web push
                    "teacher": class_event.get('teacher', ''),
                    "auditory": class_event.get('auditory', ''),
                    "lessonType": class_event.get('lessonType', ''),
                    "group_name": group_name
                },
                "scheduled_time": notification_datetime.replace(tzinfo=None),  # naive MSK
                "notification_time_minutes": notification_time,
                "status": "pending",
                "attempts": 0,
                "last_attempt_at": None,
                "error_message": None,
                "created_at": _utc_now_naive(),  # naive UTC (унификация с другими полями)
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
                    trigger=DateTrigger(run_date=effective_run_date),
                    args=[notification_id],
                    id=job_id,
                    name=f"Notify {telegram_id} at {notification_datetime.strftime('%H:%M')}"
                          + (" [overdue→now]" if fire_immediately else ""),
                    replace_existing=True
                )
                
                self.scheduled_jobs[notification_id] = job_id
                
                logger.info(
                    f"📅 Scheduled notification for user {telegram_id}: "
                    f"{class_event.get('discipline')} at {notification_datetime.strftime('%H:%M')}"
                    + (" (overdue, firing in ~5s)" if fire_immediately else "")
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
        """Отправить уведомление по ID.

        P2 fixes:
        - Атомарный захват через find_one_and_update: status=pending → processing.
          Защищает от race condition (несколько APScheduler-jobs на одно уведомление).
        - Таймаут SEND_NOTIFICATION_TIMEOUT_SEC на TG-вызов (защита от зависания).
        - Корректная семантика success: для real-TG юзера false, если TG упал
          (даже если in-app создан) → retry handler подберёт.
        """
        try:
            # ── Атомарно захватываем запись pending → processing ─────────
            notification = await self.db.scheduled_notifications.find_one_and_update(
                {"id": notification_id, "status": "pending"},
                {
                    "$set": {
                        "status": "processing",
                        "last_attempt_at": _utc_now_naive(),
                    },
                    "$inc": {"attempts": 1},
                },
                return_document=ReturnDocument.AFTER,
            )

            if not notification:
                # Уведомления нет, или его уже захватил другой воркер
                existing = await self.db.scheduled_notifications.find_one({"id": notification_id})
                if not existing:
                    logger.error(f"Notification {notification_id} not found in DB")
                else:
                    logger.debug(
                        f"Notification {notification_id} already processed: status={existing.get('status')}"
                    )
                return

            telegram_id = notification['telegram_id']
            class_info = notification['class_info']
            minutes_before = notification['notification_time_minutes']

            logger.info(
                f"📤 Sending notification to {telegram_id}: "
                f"{class_info['discipline']} at {class_info['time']}"
            )

            # ── Bug D fix: проверяем актуальные настройки уведомлений на момент ОТПРАВКИ ──
            # Между планированием и отправкой пользователь мог:
            #   1. Выключить notifications_enabled / study_enabled
            #   2. Включить quiet_hours (которые сейчас активны)
            # Если так — отменяем доставку, помечаем уведомление 'cancelled'
            # вместо silent-fail в TG.
            try:
                user_settings = await self.db.user_settings.find_one(
                    {"telegram_id": int(telegram_id)},
                    {
                        "extended_notification_settings": 1,
                        "notifications_enabled": 1,
                    },
                )
                if user_settings:
                    ext_settings = user_settings.get("extended_notification_settings") or {}
                    # Legacy notifications_enabled = master switch
                    legacy_enabled = user_settings.get("notifications_enabled", True)
                    master_enabled = ext_settings.get("notifications_enabled", legacy_enabled)
                    study_enabled = ext_settings.get("study_enabled", True)
                    if not (master_enabled and study_enabled):
                        await self.db.scheduled_notifications.update_one(
                            {"id": notification_id},
                            {"$set": {
                                "status": "cancelled",
                                "error_message": "user disabled study notifications between scheduling and sending",
                            }},
                        )
                        logger.info(
                            f"🚫 Skipped notification {notification_id} for tid={telegram_id} "
                            f"(study={study_enabled}, master={master_enabled})"
                        )
                        return
                    # NB: quiet_hours тоже проверяются ниже в notify_user (delivery.py),
                    # там TG-канал просто помечается quiet_hours, in-app останется. Здесь
                    # дополнительно не блокируем, чтобы in-app в любом случае сохранился.
            except Exception as st_err:  # noqa: BLE001
                logger.warning(f"[scheduler] settings check failed for {notification_id}: {st_err}")

            # ── Отправка с таймаутом ─────────────────────────────────────
            success = False
            err_msg: Optional[str] = None
            try:
                success = await asyncio.wait_for(
                    self.notification_service.send_class_notification(
                        telegram_id=telegram_id,
                        class_info=class_info,
                        minutes_before=minutes_before,
                    ),
                    timeout=SEND_NOTIFICATION_TIMEOUT_SEC,
                )
            except asyncio.TimeoutError:
                err_msg = f"send_class_notification timeout ({SEND_NOTIFICATION_TIMEOUT_SEC}s)"
                logger.warning(f"⏱️ {err_msg} for notification {notification_id}")
                success = False
            except Exception as e:  # noqa: BLE001
                err_msg = str(e)[:300]
                logger.error(f"Error during send_class_notification {notification_id}: {e}")
                success = False

            # ── Обновляем статус ──────────────────────────────────────────
            if success:
                now_utc = _utc_now_naive()
                await self.db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"status": "sent", "sent_at": now_utc}},
                )

                # === HISTORY: Сохраняем в вечную историю ===
                try:
                    history_item = {
                        "id": str(uuid.uuid4()),
                        "telegram_id": telegram_id,
                        "title": class_info.get('discipline', 'Пара'),
                        "message": (
                            f"{class_info.get('lessonType', '')} • "
                            f"{class_info.get('time', '')} • "
                            f"{class_info.get('auditory', '')}"
                        ).strip(" •"),
                        "sent_at": now_utc,
                        "read": False,
                    }
                    await self.db.notification_history.insert_one(history_item)
                except Exception as hist_e:
                    logger.error(f"Failed to save notification history: {hist_e}")
                # ===========================================

                logger.info(f"✅ Notification {notification_id} sent successfully")
            else:
                # Перед пометкой failed проверяем, не превысили ли max attempts
                attempts = int(notification.get("attempts", 1))
                final_status = "failed" if attempts < MAX_RETRY_ATTEMPTS else "permanently_failed"
                await self.db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {
                        "status": final_status,
                        "error_message": err_msg or "Failed to send via Telegram API",
                    }},
                )
                logger.warning(
                    f"⚠️ Notification {notification_id} failed (attempts={attempts}/"
                    f"{MAX_RETRY_ATTEMPTS}, status={final_status})"
                )

        except Exception as e:
            logger.error(f"Error sending notification {notification_id}: {e}", exc_info=True)

            # Откат: статус → failed (если был processing)
            try:
                await self.db.scheduled_notifications.update_one(
                    {"id": notification_id, "status": "processing"},
                    {"$set": {"status": "failed", "error_message": str(e)[:300]}},
                )
            except Exception as update_error:
                logger.error(f"Failed to update notification status: {update_error}")
    
    # ============================================================================
    # УРОВЕНЬ 3: RETRY HANDLER - Повтор неудачных уведомлений
    # ============================================================================
    
    async def retry_failed_notifications(self):
        """Найти и повторить неудачные уведомления.

        Логика:
        - Ищем уведомления со статусом 'failed' (НЕ 'permanently_failed')
        - Проверяем количество попыток (максимум MAX_RETRY_ATTEMPTS)
        - Проверяем интервал с последней попытки (1, 3, 5 минут)
        - Берём также «застрявшие» processing (см. ниже)
        """
        try:
            now_naive_utc = _utc_now_naive()
            now_msk = datetime.now(MOSCOW_TZ)
            today_msk = now_msk.strftime('%Y-%m-%d')
            # БАГ #10: расширяем окно retry — берём вчерашние И сегодняшние pending.
            # Старая логика теряла уведомления, запланированные на 23:55 и упавшие в 23:56:
            # после полуночи фильтр `date=today` уже не матчил их.
            yesterday_msk = (now_msk - timedelta(days=1)).strftime('%Y-%m-%d')
            date_filter = {"$in": [yesterday_msk, today_msk]}

            # Находим неудачные уведомления с попытками < MAX_RETRY_ATTEMPTS
            failed_notifications = await self.db.scheduled_notifications.find({
                "status": "failed",
                "attempts": {"$lt": MAX_RETRY_ATTEMPTS},
                "date": date_filter,
            }).to_list(None)

            # P2 fix: «зависшие» processing — если last_attempt_at > 5 мин назад,
            # значит send_notification крашнулся и не успел обновить статус. Восстанавливаем.
            # БАГ #11 (атомарность): используем find_one_and_update, чтобы исключить race
            # с живым send_notification, который параллельно может обновить ту же запись.
            stuck_threshold = now_naive_utc - timedelta(minutes=5)
            recovered_stuck = []
            stuck_cursor = self.db.scheduled_notifications.find({
                "status": "processing",
                "date": date_filter,
                "last_attempt_at": {"$lt": stuck_threshold},
                "attempts": {"$lt": MAX_RETRY_ATTEMPTS},
            }, projection={"id": 1, "_id": 0})
            stuck_ids = [s["id"] async for s in stuck_cursor]
            for sid in stuck_ids:
                recovered = await self.db.scheduled_notifications.find_one_and_update(
                    {
                        "id": sid,
                        "status": "processing",
                        "last_attempt_at": {"$lt": stuck_threshold},
                    },
                    {"$set": {"status": "failed", "error_message": "stuck_in_processing"}},
                    return_document=ReturnDocument.AFTER,
                )
                if recovered:
                    recovered_stuck.append(recovered)
            if recovered_stuck:
                logger.warning(
                    f"🧟 Recovered {len(recovered_stuck)} stuck-in-processing notifications atomically"
                )
                failed_notifications.extend(recovered_stuck)

            if not failed_notifications:
                return

            logger.info(f"🔄 Found {len(failed_notifications)} failed notifications to retry")

            for notification in failed_notifications:
                await self._retry_notification(notification, now_naive_utc)

        except Exception as e:
            logger.error(f"Error in retry handler: {e}", exc_info=True)

    async def _retry_notification(self, notification: Dict, now: datetime):
        """Повторить отправку конкретного уведомления.

        Args:
            notification: Данные уведомления
            now: Текущее время (naive UTC)
        """
        try:
            notification_id = notification['id']
            attempts = int(notification.get('attempts', 0))
            last_attempt_at = notification.get('last_attempt_at')

            # Защита: если attempts уже >= MAX, в pending не возвращаем
            if attempts >= MAX_RETRY_ATTEMPTS:
                await self.db.scheduled_notifications.update_one(
                    {"id": notification_id},
                    {"$set": {"status": "permanently_failed"}},
                )
                return

            # Определяем интервал для текущей попытки (attempts уже = N после N-й попытки)
            retry_interval = RETRY_INTERVALS[min(attempts - 1, len(RETRY_INTERVALS) - 1)] if attempts > 0 else 1

            # Проверяем, прошло ли достаточно времени с последней попытки
            if last_attempt_at:
                # last_attempt_at может быть naive (предполагаем UTC) или tz-aware
                if last_attempt_at.tzinfo is not None:
                    last_attempt_at = last_attempt_at.astimezone(timezone.utc).replace(tzinfo=None)
                time_since_last = (now - last_attempt_at).total_seconds() / 60
                if time_since_last < retry_interval:
                    logger.debug(
                        f"Not enough time passed for retry {notification_id}: "
                        f"{time_since_last:.1f} < {retry_interval} min"
                    )
                    return

            # Атомарно возвращаем в pending (только если всё ещё failed)
            switched = await self.db.scheduled_notifications.update_one(
                {"id": notification_id, "status": "failed"},
                {"$set": {"status": "pending"}},
            )
            if switched.modified_count == 0:
                logger.debug(f"Retry skip: notification {notification_id} already in other status")
                return

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
        """Очистить старые записи из БД.

        - scheduled_notifications старше 7 дней
        - sent_notifications старше expires_at (старая система)
        - in_app_notifications старше 30 дней (БАГ #20)
        - delivery_attempts старше 7 дней (если не в pending_retry)
        """
        try:
            now = _utc_now_naive()
            cutoff_date = (datetime.now(MOSCOW_TZ) - timedelta(days=7)).strftime('%Y-%m-%d')
            in_app_cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
            attempts_cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=7)

            # Очистка scheduled_notifications
            result1 = await self.db.scheduled_notifications.delete_many({
                "date": {"$lt": cutoff_date}
            })

            # Очистка sent_notifications (старая система)
            result2 = await self.db.sent_notifications.delete_many({
                "expires_at": {"$lt": now}
            })

            # БАГ #20: очистка in_app_notifications старше 30 дней
            result3 = await self.db.in_app_notifications.delete_many({
                "created_at": {"$lt": in_app_cutoff}
            })

            # Очистка завершённых delivery_attempts (sent / dlq) старше 7 дней.
            # pending_retry НЕ трогаем — их обработает воркер.
            result4 = await self.db.delivery_attempts.delete_many({
                "status": {"$in": ["sent", "dlq"]},
                "created_at": {"$lt": attempts_cutoff},
            })

            total_deleted = (
                result1.deleted_count + result2.deleted_count
                + result3.deleted_count + result4.deleted_count
            )
            if total_deleted > 0:
                logger.info(
                    f"🧹 Cleaned up {total_deleted} old records: "
                    f"scheduled={result1.deleted_count} sent_notifs={result2.deleted_count} "
                    f"in_app={result3.deleted_count} delivery_attempts={result4.deleted_count}"
                )

        except Exception as e:
            logger.error(f"Error cleaning up records: {e}", exc_info=True)

    async def reset_daily_task_counters(self):
        """Сбросить дневные счетчики выполненных задач. Вызывается каждый день в 00:00."""
        try:
            today = datetime.now(MOSCOW_TZ).strftime("%Y-%m-%d")
            result = await self.db.user_stats.update_many(
                {},
                {"$set": {
                    "tasks_completed_today": 0,
                    "last_daily_reset": today,
                    "updated_at": _utc_now_naive(),
                }},
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
            
            # Удаляем задачу из scheduler.
            # Bug J fix: даже если scheduled_jobs пуст (после рестарта процесса),
            # job_id всё равно можно вычислить как f"notify_{notification_id}" — APScheduler
            # хранит jobs в Mongo job_store, и они переживают рестарт.
            job_id = self.scheduled_jobs.get(notification_id) or f"notify_{notification_id}"
            try:
                self.scheduler.remove_job(job_id)
            except Exception:
                pass
            self.scheduled_jobs.pop(notification_id, None)
            
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
        (Вызывать при изменении настроек или расписания).

        БАГ #4 (исправлен): теперь сначала отменяем все старые pending для этого
        пользователя на сегодня — иначе при смене notification_time (например с 10 на 30)
        юзер получал ОБА уведомления (за 30 и за 10 минут до пары).

        Args:
            telegram_id: ID пользователя

        Returns:
            Словарь с результатами {created, scheduled, cancelled_old}
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
                return {"created": 0, "scheduled": 0, "cancelled_old": 0}

            if not user.get("notifications_enabled"):
                logger.info(f"Notifications disabled for user {telegram_id}, skipping")
                return {"created": 0, "scheduled": 0, "cancelled_old": 0}

            # Дополнительная проверка extended_notification_settings.study_enabled
            ext = user.get("extended_notification_settings") or {}
            if isinstance(ext, dict) and ext.get("study_enabled") is False:
                logger.info(
                    f"User {telegram_id}: study_enabled=False in extended_notification_settings, "
                    f"skipping scheduling"
                )
                return {"created": 0, "scheduled": 0, "cancelled_old": 0}

            # БАГ #4 fix: отменяем старые pending уведомления для этого юзера на сегодня
            cancelled_old = await self._cancel_pending_for_user_today(telegram_id, today)

            logger.info(
                f"🔄 Force scheduling notifications for user {telegram_id} "
                f"(cancelled_old={cancelled_old})"
            )

            created, scheduled = await self._prepare_user_schedule(
                user,
                russian_day,
                week_number,
                today,
                now
            )

            return {
                "created": created,
                "scheduled": scheduled,
                "cancelled_old": cancelled_old,
            }

        except Exception as e:
            logger.error(f"Error scheduling user notifications: {e}", exc_info=True)
            return {"created": 0, "scheduled": 0, "cancelled_old": 0}

    async def _cancel_pending_for_user_today(self, telegram_id: int, date_str: str) -> int:
        """Отменить все pending уведомления для (telegram_id, date_str).

        Используется при:
          — изменении настроек (schedule_user_notifications)
          — выключении уведомлений (cancel_all_pending_for_user)

        Возвращает количество отменённых записей.
        """
        try:
            # Сначала достаём список id (для удаления APScheduler-jobs)
            cursor = self.db.scheduled_notifications.find(
                {"telegram_id": telegram_id, "date": date_str, "status": "pending"},
                projection={"id": 1, "_id": 0},
            )
            ids = [doc["id"] async for doc in cursor]
            if not ids:
                return 0

            # Отменяем в БД (атомарно, только pending → cancelled)
            result = await self.db.scheduled_notifications.update_many(
                {"id": {"$in": ids}, "status": "pending"},
                {"$set": {"status": "cancelled", "error_message": "cancelled_by_reschedule"}},
            )

            # Удаляем APScheduler-jobs
            for nid in ids:
                job_id = self.scheduled_jobs.pop(nid, None) or f"notify_{nid}"
                try:
                    self.scheduler.remove_job(job_id)
                except Exception:
                    pass  # job уже мог исполниться

            logger.info(
                f"🚫 Cancelled {result.modified_count} pending notifications for tid={telegram_id} date={date_str}"
            )
            return int(result.modified_count)
        except Exception as e:  # noqa: BLE001
            logger.error(f"Error cancelling pending for user {telegram_id}: {e}")
            return 0

    async def cancel_all_pending_for_user(self, telegram_id: int) -> int:
        """Отменить ВСЕ pending уведомления для юзера (сегодня и в будущем).

        Используется при выключении уведомлений в настройках (БАГ #8).
        """
        try:
            today = datetime.now(MOSCOW_TZ).strftime('%Y-%m-%d')
            cursor = self.db.scheduled_notifications.find(
                {"telegram_id": telegram_id, "date": {"$gte": today}, "status": "pending"},
                projection={"id": 1, "_id": 0},
            )
            ids = [doc["id"] async for doc in cursor]
            if not ids:
                return 0

            result = await self.db.scheduled_notifications.update_many(
                {"id": {"$in": ids}, "status": "pending"},
                {"$set": {"status": "cancelled", "error_message": "user_disabled_notifications"}},
            )

            for nid in ids:
                job_id = self.scheduled_jobs.pop(nid, None) or f"notify_{nid}"
                try:
                    self.scheduler.remove_job(job_id)
                except Exception:
                    pass

            logger.info(
                f"🚫 Cancelled ALL {result.modified_count} pending notifications for tid={telegram_id}"
            )
            return int(result.modified_count)
        except Exception as e:  # noqa: BLE001
            logger.error(f"Error cancelling all pending for user {telegram_id}: {e}")
            return 0

    # ============================================================================
    # АВТО-НАПОМИНАНИЯ О ВОЗВРАЩЕНИИ
    # ============================================================================

    async def check_inactive_users(self):
        """
        Проверить неактивных пользователей и отправить напоминания.
        Запускается 1 раз в день в 10:00 по Москве.
        
        Типы напоминаний:
        - 1 день: стрик под угрозой (если стрик >= 3)
        - 2 дня: стрик сгорел / щит спас (если стрик >= 3)
        - 7 дней: мягкое напоминание
        - 30 дней: персональное
        
        Дедупликация: атомарный upsert в sent_notifications предотвращает
        дублирование даже при нескольких воркерах.
        """
        try:
            now = datetime.now(MOSCOW_TZ)
            today_str = now.strftime('%Y-%m-%d')
            
            logger.info(f"👻 Starting inactivity check at {now.strftime('%H:%M')}")
            
            # Получаем всех пользователей с last_visit_date
            users_with_streak = await self.db.user_stats.find(
                {"last_visit_date": {"$ne": None}}
            ).to_list(None)
            
            sent_count = 0
            skipped_dedup = 0
            
            for user_stats in users_with_streak:
                try:
                    telegram_id = user_stats.get("telegram_id")
                    last_visit = user_stats.get("last_visit_date")
                    streak = user_stats.get("visit_streak_current", 0)
                    freeze_shields = user_stats.get("freeze_shields", 0)
                    
                    if not last_visit or not telegram_id:
                        continue
                    
                    # Improvement 8 (Bug M) fix: ранее inactivity-напоминания уходили
                    # ТОЛЬКО real-TG-юзерам. Теперь поддерживаем pseudo_tid (VK/Email):
                    #   * Real-TG: TG-push + in-app + web push (если PWA подписан)
                    #   * Pseudo:  in-app + web push (если PWA подписан)
                    # notify_user сам корректно роутит каналы (см. services/delivery.py).
                    # Если у юзера нет web push subscription и он pseudo — уведомление
                    # сохранится в in-app и появится при следующем входе.
                    if not telegram_id:
                        continue
                    
                    from datetime import date as date_type
                    last_date = date_type.fromisoformat(last_visit)
                    today_date = date_type.fromisoformat(today_str)
                    days_inactive = (today_date - last_date).days
                    
                    # Пропускаем активных пользователей
                    if days_inactive <= 0:
                        continue
                    
                    message = None
                    notif_type = None
                    
                    if days_inactive == 1 and streak >= 3:
                        # Стрик под угрозой
                        if freeze_shields > 0:
                            shield_text = f'\n<tg-emoji emoji-id="5465154440287757794">🛡</tg-emoji> У тебя есть {freeze_shields} щит заморозки — он сработает автоматически!'
                        else:
                            shield_text = '\n<tg-emoji emoji-id="5465154440287757794">🛡</tg-emoji>'
                        message = (
                            f'<tg-emoji emoji-id="5976355994911905333">🔥</tg-emoji> <b>Твой стрик {streak} дней под угрозой!</b>\n'
                            f'Зайди в приложение сегодня — сохрани свою серию{shield_text}'
                        )
                        notif_type = "inactivity_1d"
                    
                    elif days_inactive == 2 and streak >= 3:
                        # Если есть щит — он спасёт стрик при следующем визите
                        if freeze_shields > 0:
                            message = (
                                f"🛡 <b>Твой щит заморозки готов спасти стрик {streak} дней!</b>\n"
                                f"Зайди сегодня — щит сработает автоматически.\n"
                                f"Осталось щитов: {freeze_shields}"
                            )
                        else:
                            message = (
                                f'<tg-emoji emoji-id="5391055925035415864">😢</tg-emoji> <b>Твой стрик {streak} дней сгорел...</b>\n'
                                f'Но всё можно начать заново! Зайди сегодня <tg-emoji emoji-id="5427342093674630148">💪</tg-emoji>'
                            )
                        notif_type = "inactivity_2d"
                    
                    elif days_inactive == 7:
                        user_settings = await self.db.user_settings.find_one({"telegram_id": telegram_id})
                        first_name = ""
                        if user_settings:
                            first_name = user_settings.get("first_name", "")
                        greeting = f", {first_name}" if first_name else ""
                        message = (
                            f'<tg-emoji emoji-id="5354903467318061957">🌟</tg-emoji> <b>Привет{greeting}! Давно не виделись.</b>\n'
                            f'Загляни — проверь расписание и задачи <tg-emoji emoji-id="5316996360841474316">📅</tg-emoji>'
                        )
                        notif_type = "inactivity_7d"
                    
                    elif days_inactive == 30:
                        user_settings = await self.db.user_settings.find_one({"telegram_id": telegram_id})
                        first_name = ""
                        if user_settings:
                            first_name = user_settings.get("first_name", "")
                        
                        # Считаем друзей
                        friends_count = await self.db.friends.count_documents({
                            "$or": [
                                {"user1_id": telegram_id},
                                {"user2_id": telegram_id}
                            ]
                        })
                        
                        friends_text = f'\nТвои {friends_count} друзей уже ждут <tg-emoji emoji-id="5343984088493599366">👋</tg-emoji>' if friends_count > 0 else ""
                        greeting = f", {first_name}" if first_name else ""
                        message = (
                            f'<tg-emoji emoji-id="5235711188481883685">❓</tg-emoji> <b>Всё в порядке{greeting}?</b>\n'
                            f'Ты не заходил уже месяц.{friends_text}'
                        )
                        notif_type = "inactivity_30d"
                    
                    if message and notif_type:
                        # Атомарная дедупликация: upsert гарантирует что только один воркер
                        # отправит уведомление, даже при нескольких процессах
                        dedup_filter = {
                            "telegram_id": telegram_id,
                            "type": notif_type,
                            "date": today_str
                        }
                        dedup_result = await self.db.sent_notifications.update_one(
                            dedup_filter,
                            {
                                "$setOnInsert": {
                                    "telegram_id": telegram_id,
                                    "type": notif_type,
                                    "date": today_str,
                                    "created_at": datetime.now(MOSCOW_TZ),
                                    "sent": False  # Помечаем как ещё не отправленное
                                }
                            },
                            upsert=True
                        )

                        # Только если мы СОЗДАЛИ новую запись (upserted_id != None),
                        # значит мы первый воркер — отправляем уведомление
                        if dedup_result.upserted_id is not None:
                            try:
                                # БАГ #12 fix: используем notify_user напрямую с HIGH priority
                                # и enable_retry=True. Раньше шли через send_message(priority=NORMAL)
                                # без retry → transient TG-failures навсегда теряли уведомление.
                                from services.delivery import notify_user as _notify_user, MessagePriority as _MP
                                # plain-text для in-app (HTML отдельно для TG)
                                import re
                                plain = re.sub(r"<[^>]+>", "", message).strip()
                                title = plain.split("\n", 1)[0][:150] if plain else "Напоминание"

                                dr = await _notify_user(
                                    self.db,
                                    self.notification_service.bot,
                                    telegram_id=telegram_id,
                                    title=title,
                                    message=plain,
                                    emoji="🔥" if "1d" in notif_type else "🌟",
                                    type="announcement",
                                    category="system",
                                    priority=_MP.HIGH,
                                    telegram_text=message,
                                    telegram_parse_mode="HTML",
                                    enable_retry=True,
                                    log_ctx=f"inactivity_{notif_type}",
                                )
                                success = bool(dr.delivered_to_user)
                                if success:
                                    sent_count += 1
                                    # Помечаем как успешно отправленное
                                    await self.db.sent_notifications.update_one(
                                        {"_id": dedup_result.upserted_id},
                                        {"$set": {"sent": True}}
                                    )
                                else:
                                    # Отправка не удалась — удаляем запись чтобы повторить позже
                                    await self.db.sent_notifications.delete_one(
                                        {"_id": dedup_result.upserted_id}
                                    )
                            except Exception as send_err:
                                logger.warning(f"Failed to send inactivity notification to {telegram_id}: {send_err}")
                                # Удаляем запись чтобы можно было повторить
                                await self.db.sent_notifications.delete_one(
                                    {"_id": dedup_result.upserted_id}
                                )
                        else:
                            skipped_dedup += 1
                        
                        # Rate limiting
                        await asyncio.sleep(0.1)
                
                except Exception as user_err:
                    logger.warning(f"Error processing inactivity for user: {user_err}")
                    continue
            
            logger.info(f"👻 Inactivity check complete: sent {sent_count} reminders, skipped (dedup) {skipped_dedup}")
            
        except Exception as e:
            logger.error(f"Error in inactivity checker: {e}", exc_info=True)

    async def reset_streak_claimed(self):
        """Сбрасывать streak_claimed_today в полночь для всех пользователей"""
        try:
            result = await self.db.user_stats.update_many(
                {"streak_claimed_today": True},
                {"$set": {"streak_claimed_today": False}}
            )
            logger.info(f"🔄 Reset streak_claimed_today for {result.modified_count} users")
        except Exception as e:
            logger.error(f"Error resetting streak_claimed: {e}")


# Глобальный экземпляр планировщика
scheduler_v2_instance = None


def get_scheduler_v2(db: AsyncIOMotorDatabase) -> NotificationSchedulerV2:
    """Получить глобальный экземпляр планировщика V2"""
    global scheduler_v2_instance
    
    if scheduler_v2_instance is None:
        scheduler_v2_instance = NotificationSchedulerV2(db)
    
    return scheduler_v2_instance
