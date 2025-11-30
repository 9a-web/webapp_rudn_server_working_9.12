@api_router.get("/admin/users-activity", response_model=List[UserActivityPoint])
async def get_users_activity(days: Optional[int] = 30):
    """
    Получить активность регистраций пользователей по дням
    """
    try:
        # Определяем временной диапазон
        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
        else:
            # Если не указано, берем все записи
            start_date = datetime(2020, 1, 1)
        
        # Агрегация по дням
        pipeline = [
            {
                "$match": {
                    "created_at": {"$gte": start_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$created_at"
                        }
                    },
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
        # Преобразуем результат
        activity = [
            UserActivityPoint(date=result["_id"], count=result["count"])
            for result in results
        ]
        
        return activity
    
    except Exception as e:
        logger.error(f"Ошибка при получении активности пользователей: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/hourly-activity", response_model=List[HourlyActivityPoint])
async def get_hourly_activity(days: Optional[int] = 30):
    """
    Получить активность пользователей по часам
    """
    try:
        # Определяем временной диапазон
        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
        else:
            start_date = datetime(2020, 1, 1)
        
        # Агрегация по часам (используем last_activity)
        pipeline = [
            {
                "$match": {
                    "last_activity": {"$gte": start_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$hour": "$last_activity"
                    },
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
        # Заполняем все часы (0-23)
        hourly_data = {i: 0 for i in range(24)}
        for result in results:
            hour = result["_id"]
            if hour is not None:
                hourly_data[hour] = result["count"]
        
        # Преобразуем результат
        activity = [
            HourlyActivityPoint(hour=f"{hour:02d}:00", count=count)
            for hour, count in hourly_data.items()
        ]
        
        return activity
    
    except Exception as e:
        logger.error(f"Ошибка при получении почасовой активности: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/weekly-activity", response_model=List[dict])
async def get_weekly_activity(days: Optional[int] = 30):
    """
    Получить активность пользователей по дням недели
    """
    try:
        # Определяем временной диапазон
        if days:
            start_date = datetime.utcnow() - timedelta(days=days)
        else:
            start_date = datetime(2020, 1, 1)
        
        # Агрегация по дням недели (используем last_activity)
        pipeline = [
            {
                "$match": {
                    "last_activity": {"$gte": start_date}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dayOfWeek": "$last_activity"
                    },
                    "count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
        # Маппинг дней недели (MongoDB: 1=Воскресенье, 2=Понедельник, ...)
        day_names = {
            1: "Вс",
            2: "Пн",
            3: "Вт",
            4: "Ср",
            5: "Чт",
            6: "Пт",
            7: "Сб"
        }
        
        # Заполняем все дни
        weekly_data = {day: 0 for day in range(1, 8)}
        for result in results:
            day = result["_id"]
            if day is not None:
                weekly_data[day] = result["count"]
        
        # Преобразуем результат (начинаем с понедельника)
        activity = []
        for day_num in [2, 3, 4, 5, 6, 7, 1]:  # Пн-Вс
            activity.append({
                "day": day_names[day_num],
                "count": weekly_data[day_num]
            })
        
        return activity
    
    except Exception as e:
        logger.error(f"Ошибка при получении недельной активности: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/feature-usage", response_model=FeatureUsageStats)
async def get_feature_usage(days: Optional[int] = None):
    """
    Получить статистику использования функций
    """
    try:
        # Определяем временной диапазон для новых пользователей
        if days:
            date_filter = {"created_at": {"$gte": datetime.utcnow() - timedelta(days=days)}}
        else:
            date_filter = {}
        
        # Получаем список telegram_id пользователей в заданном диапазоне
        if days:
            users_cursor = db.user_settings.find(date_filter, {"telegram_id": 1})
            users = await users_cursor.to_list(length=None)
            telegram_ids = [user["telegram_id"] for user in users]
            stats_filter = {"telegram_id": {"$in": telegram_ids}}
        else:
            stats_filter = {}
        
        # Агрегация статистики
        pipeline = [
            {"$match": stats_filter},
            {
                "$group": {
                    "_id": None,
                    "schedule_views": {"$sum": "$schedule_views"},
                    "analytics_views": {"$sum": "$analytics_views"},
                    "calendar_opens": {"$sum": "$calendar_opens"},
                    "notifications_configured": {"$sum": "$notifications_configured"},
                    "schedule_shares": {"$sum": "$schedule_shares"},
                    "tasks_created": {"$sum": {"$ifNull": ["$tasks_created", 0]}},
                    "achievements_earned": {"$sum": "$achievements_count"}
                }
            }
        ]
        
        results = await db.user_stats.aggregate(pipeline).to_list(length=None)
        
        if results:
            data = results[0]
            return FeatureUsageStats(
                schedule_views=data.get("schedule_views", 0),
                analytics_views=data.get("analytics_views", 0),
                calendar_opens=data.get("calendar_opens", 0),
                notifications_configured=data.get("notifications_configured", 0),
                schedule_shares=data.get("schedule_shares", 0),
                tasks_created=data.get("tasks_created", 0),
                achievements_earned=data.get("achievements_earned", 0)
            )
        else:
            # Возвращаем нули, если нет данных
            return FeatureUsageStats(
                schedule_views=0,
                analytics_views=0,
                calendar_opens=0,
                notifications_configured=0,
                schedule_shares=0,
                tasks_created=0,
                achievements_earned=0
            )
    
    except Exception as e:
        logger.error(f"Ошибка при получении статистики функций: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/top-users", response_model=List[TopUser])
async def get_top_users(
    metric: str = "points",
    limit: int = 10
):
    """
    Получить топ пользователей по заданной метрике
    """
    try:
        # Доступные метрики
        valid_metrics = {
            "points": "total_points",
            "achievements": "achievements_count",
            "tasks": "tasks_created",
            "schedule_views": "schedule_views"
        }
        
        if metric not in valid_metrics:
            raise HTTPException(
                status_code=400,
                detail=f"Недопустимая метрика. Доступные: {', '.join(valid_metrics.keys())}"
            )
        
        field_name = valid_metrics[metric]
        
        # Агрегация для получения топа
        pipeline = [
            {
                "$match": {
                    field_name: {"$gt": 0}
                }
            },
            {
                "$sort": {field_name: -1}
            },
            {
                "$limit": limit
            },
            {
                "$lookup": {
                    "from": "user_settings",
                    "localField": "telegram_id",
                    "foreignField": "telegram_id",
                    "as": "user_info"
                }
            },
            {
                "$unwind": "$user_info"
            },
            {
                "$project": {
                    "telegram_id": 1,
                    "value": f"${field_name}",
                    "username": "$user_info.username",
                    "first_name": "$user_info.first_name",
                    "group_name": "$user_info.group_name"
                }
            }
        ]
        
        results = await db.user_stats.aggregate(pipeline).to_list(length=None)
        
        # Преобразуем результат
        top_users = [
            TopUser(
                telegram_id=result["telegram_id"],
                value=result["value"],
                username=result.get("username"),
                first_name=result.get("first_name"),
                group_name=result.get("group_name")
            )
            for result in results
        ]
        
        return top_users
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении топа пользователей: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/faculty-stats")
async def get_faculty_stats():
    """
    Получить статистику по факультетам
    """
    try:
        # Агрегация по факультетам
        pipeline = [
            {
                "$match": {
                    "facultet_name": {"$ne": None, "$exists": True}
                }
            },
            {
                "$group": {
                    "_id": "$facultet_name",
                    "faculty_id_first": {"$first": "$facultet_id"},
                    "users_count": {"$sum": 1}
                }
            },
            {
                "$sort": {"users_count": -1}
            }
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
        # Преобразуем результат
        faculty_stats = [
            FacultyStats(
                faculty_name=result["_id"],
                faculty_id=result.get("faculty_id_first"),
                users_count=result["users_count"]
            )
            for result in results
        ]
        
        return faculty_stats
    
    except Exception as e:
        import traceback
        logger.error(f"Ошибка при получении статистики факультетов: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/course-stats", response_model=List[CourseStats])
async def get_course_stats():
    """
    Получить статистику по курсам
    """
    try:
        # Агрегация по курсам
        pipeline = [
            {
                "$match": {
                    "kurs": {"$ne": None, "$exists": True}
                }
            },
            {
                "$group": {
                    "_id": "$kurs",
                    "users_count": {"$sum": 1}
                }
            },
            {
                "$sort": {"_id": 1}
            }
        ]
        
        results = await db.user_settings.aggregate(pipeline).to_list(length=None)
        
        # Преобразуем результат
        course_stats = [
            CourseStats(
                course=result["_id"],
                users_count=result["users_count"]
            )
            for result in results
        ]
        
        return course_stats
    
    except Exception as e:
        logger.error(f"Ошибка при получении статистики курсов: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============ Экспорт/Импорт базы данных ============

@api_router.get("/export/database")
async def export_database():
    """
    Экспорт всей базы данных в JSON формате
    Возвращает все коллекции с данными
    """
    try:
        logger.info("Starting database export...")
        
        # Список коллекций для экспорта
        collections_to_export = [
            "user_settings",
            "user_stats",
            "user_achievements",
            "tasks",
            "rooms",
            "room_participants",
            "group_tasks"
        ]
        
        export_data = {
            "export_date": datetime.utcnow().isoformat(),
            "database": "rudn_schedule",
            "collections": {}
        }
        
        # Экспортируем каждую коллекцию
        for collection_name in collections_to_export:
            try:
                collection = db[collection_name]
                documents = await collection.find().to_list(length=None)
                
                # Конвертируем ObjectId и datetime в строки
                for doc in documents:
                    if '_id' in doc:
                        doc['_id'] = str(doc['_id'])
                    for key, value in doc.items():
                        if isinstance(value, datetime):
                            doc[key] = value.isoformat()
                
                export_data["collections"][collection_name] = {
                    "count": len(documents),
                    "data": documents
                }
                
                logger.info(f"Exported {len(documents)} documents from {collection_name}")
            
            except Exception as e:
                logger.error(f"Error exporting collection {collection_name}: {e}")
                export_data["collections"][collection_name] = {
                    "count": 0,
                    "data": [],
                    "error": str(e)
                }
        
        # Добавляем статистику
        total_documents = sum(
            col_data["count"] 
            for col_data in export_data["collections"].values()
        )
        export_data["total_documents"] = total_documents
        export_data["total_collections"] = len(collections_to_export)
        
        logger.info(f"Database export completed: {total_documents} documents from {len(collections_to_export)} collections")
        
        return JSONResponse(content=export_data)
    
    except Exception as e:
        logger.error(f"Error during database export: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@api_router.get("/export/collection/{collection_name}")
async def export_collection(collection_name: str):
    """
    Экспорт отдельной коллекции в JSON формате
    """
    try:
        allowed_collections = [
            "user_settings", "user_stats", "user_achievements",
            "tasks", "rooms", "room_participants", "group_tasks"
        ]
        
        if collection_name not in allowed_collections:
            raise HTTPException(
                status_code=400, 
                detail=f"Collection not allowed. Allowed: {', '.join(allowed_collections)}"
            )
        
        collection = db[collection_name]
        documents = await collection.find().to_list(length=None)
        
        # Конвертируем ObjectId и datetime в строки
        for doc in documents:
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
            for key, value in doc.items():
                if isinstance(value, datetime):
                    doc[key] = value.isoformat()
        
        export_data = {
            "collection": collection_name,
            "export_date": datetime.utcnow().isoformat(),
            "count": len(documents),
            "data": documents
        }
        
        logger.info(f"Exported {len(documents)} documents from {collection_name}")
        
        return JSONResponse(content=export_data)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting collection {collection_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/backup/stats")
async def backup_stats():
    """
    Получить статистику базы данных для бэкапа
    """
    try:
        collections = [
            "user_settings", "user_stats", "user_achievements",
            "tasks", "rooms", "room_participants", "group_tasks"
        ]
        
        stats = {
            "database": "rudn_schedule",
            "timestamp": datetime.utcnow().isoformat(),
            "collections": {}
        }
        
        total_size = 0
        total_documents = 0
        
        for collection_name in collections:
            collection = db[collection_name]
            count = await collection.count_documents({})
            
            stats["collections"][collection_name] = {
                "documents": count
            }
            
            total_documents += count
        
        stats["total_collections"] = len(collections)
        stats["total_documents"] = total_documents
        
        return stats
    
    except Exception as e:
        logger.error(f"Error getting backup stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# Include the router in the main app
app.include_router(api_router)


# ============ События жизненного цикла приложения ============

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске приложения"""
    logger.info("Starting RUDN Schedule API...")
    
    # Создаем индексы для коллекций
    try:
        # Уникальный индекс для sent_notifications (старая система)
        await db.sent_notifications.create_index(
            [("notification_key", 1)],
            unique=True,
            name="unique_notification_key"
        )
        
        # Индексы для новой системы scheduled_notifications
        await db.scheduled_notifications.create_index(
            [("notification_key", 1)],
            unique=True,
            name="unique_scheduled_notification_key"
        )
        await db.scheduled_notifications.create_index(
            [("telegram_id", 1), ("date", 1)],
            name="user_date_index"
        )
        await db.scheduled_notifications.create_index(
            [("status", 1), ("date", 1)],
            name="status_date_index"
        )
        await db.scheduled_notifications.create_index(
            [("scheduled_time", 1)],
            name="scheduled_time_index"
        )
        
        logger.info("✅ Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")
    
    # Запускаем НОВЫЙ планировщик уведомлений V2
    try:
        scheduler_v2 = get_scheduler_v2(db)
        scheduler_v2.start()
        logger.info("✅ Notification Scheduler V2 started successfully")
    except Exception as e:
        logger.error(f"❌ Failed to start notification scheduler V2: {e}")
        # Fallback на старую систему в случае ошибки
        try:
            logger.info("Attempting fallback to old scheduler...")
            scheduler = get_scheduler(db)
            scheduler.start()
            logger.info("⚠️ Fallback: Old notification scheduler started")
        except Exception as fallback_error:
            logger.error(f"❌ Fallback also failed: {fallback_error}")
    
    # Запускаем Telegram бота как background task
    try:
        global bot_application
        from telegram import Update
        from telegram.ext import Application, CommandHandler
        
        # Импортируем обработчики команд
        import sys
        sys.path.insert(0, '/app/backend')
        from telegram_bot import start_command, users_command, clear_db_command, TELEGRAM_BOT_TOKEN
        
        if TELEGRAM_BOT_TOKEN:
            # Создаем приложение бота
            bot_application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
            
            # Регистрируем обработчики
            bot_application.add_handler(CommandHandler("start", start_command))
            bot_application.add_handler(CommandHandler("users", users_command))
            bot_application.add_handler(CommandHandler("clear_db", clear_db_command))
            
            # Запускаем бота в фоне
            async def start_bot():
                await bot_application.initialize()
                await bot_application.start()
                await bot_application.updater.start_polling(
                    allowed_updates=Update.ALL_TYPES,
                    drop_pending_updates=True
                )
                logger.info("✅ Telegram bot polling started successfully")
            
            # Создаем background task
            asyncio.create_task(start_bot())
            logger.info("Telegram bot initialization started as background task")
        else:
            logger.warning("TELEGRAM_BOT_TOKEN not found, bot not started")
    except Exception as e:
        logger.error(f"Failed to start Telegram bot: {e}", exc_info=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    """Очистка ресурсов при остановке"""
    logger.info("Shutting down RUDN Schedule API...")
    
    # Останавливаем Telegram бота
    global bot_application
    if bot_application:
        try:
            logger.info("Stopping Telegram bot...")
            await bot_application.updater.stop()
            await bot_application.stop()
            await bot_application.shutdown()
            logger.info("Telegram bot stopped")
        except Exception as e:
            logger.error(f"Error stopping Telegram bot: {e}")
    
    # Останавливаем планировщик V2
    try:
        scheduler_v2 = get_scheduler_v2(db)
        scheduler_v2.stop()
        logger.info("✅ Notification Scheduler V2 stopped")
    except Exception as e:
        logger.error(f"Error stopping scheduler V2: {e}")
        # Пытаемся остановить старый планировщик на всякий случай
        try:
            scheduler = get_scheduler(db)
            scheduler.stop()
        except:
            pass
    
    # Закрываем подключение к БД
    client.close()
    logger.info("Database connection closed")

# ============ Admin Panel Endpoints ============

@api_router.get("/admin/stats", response_model=AdminStatsResponse)
async def get_admin_stats(days: Optional[int] = None):
    """Get general statistics for admin panel"""
    now = datetime.utcnow()
    start_date = None
    if days:
        start_date = now - timedelta(days=days)

    # Helper to apply date filter
    def date_filter(field_name="created_at"):
        return {field_name: {"$gte": start_date}} if start_date else {}

    # 1. Total Users
    total_users = await db.user_settings.count_documents(date_filter("created_at"))
    
    # 2. Active Users Today (using updated_at or last_activity from user_settings or user_stats)
    today_start = datetime(now.year, now.month, now.day)
    active_users_today = await db.user_settings.count_documents({"last_activity": {"$gte": today_start}})
    
    # 3. New Users Week
    week_ago = now - timedelta(days=7)
    new_users_week = await db.user_settings.count_documents({"created_at": {"$gte": week_ago}})
    
    # 4. Tasks
    total_tasks = await db.tasks.count_documents(date_filter("created_at"))
    total_completed_tasks = await db.tasks.count_documents({"completed": True, **date_filter("created_at")})
    
    # 5. Achievements (using user_achievements collection)
    total_achievements_earned = await db.user_achievements.count_documents(date_filter("earned_at"))
    
    # 6. Rooms
    total_rooms = await db.rooms.count_documents(date_filter("created_at"))

    return AdminStatsResponse(
        total_users=total_users,
        active_users_today=active_users_today,
        new_users_week=new_users_week,
        total_tasks=total_tasks,
        total_completed_tasks=total_completed_tasks,
        total_achievements_earned=total_achievements_earned,
        total_rooms=total_rooms
    )

@api_router.get("/admin/users-activity", response_model=List[UserActivityPoint])
async def get_users_activity(days: Optional[int] = 30):
    """Get user registration activity over time"""
    if not days:
        days = 30
        
    start_date = datetime.utcnow() - timedelta(days=days)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.user_settings.aggregate(pipeline).to_list(None)
    return [UserActivityPoint(date=r["_id"], count=r["count"]) for r in results]

@api_router.get("/admin/hourly-activity", response_model=List[HourlyActivityPoint])
async def get_hourly_activity(days: Optional[int] = 30):
    """Get activity distribution by hour of day (based on tasks creation)"""
    # We use tasks as a proxy for activity
    start_date = datetime.utcnow() - timedelta(days=days if days else 30)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {
            "$project": {
                "hour": {"$hour": "$created_at"}
            }
        },
        {
            "$group": {
                "_id": "$hour",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.tasks.aggregate(pipeline).to_list(None)
    
    # Fill missing hours
    hours_map = {r["_id"]: r["count"] for r in results}
    return [HourlyActivityPoint(hour=h, count=hours_map.get(h, 0)) for h in range(24)]

@api_router.get("/admin/weekly-activity")
async def get_weekly_activity(days: Optional[int] = 30):
    """Get activity distribution by day of week"""
    # Using tasks as proxy
    start_date = datetime.utcnow() - timedelta(days=days if days else 30)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {
            "$project": {
                # MongoDB $dayOfWeek: 1 (Sun) - 7 (Sat)
                "day": {"$dayOfWeek": "$created_at"}
            }
        },
        {
            "$group": {
                "_id": "$day",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.tasks.aggregate(pipeline).to_list(None)
    
    # Map 1-7 to Mon-Sun strings
    days_map = {
        1: "Вс", 2: "Пн", 3: "Вт", 4: "Ср", 5: "Чт", 6: "Пт", 7: "Сб"
    }
    
    data_map = {r["_id"]: r["count"] for r in results}
    
    # Order: Mon to Sun (2,3,4,5,6,7,1)
    ordered_keys = [2, 3, 4, 5, 6, 7, 1]
    
    return [
        {"day": days_map[k], "count": data_map.get(k, 0)}
        for k in ordered_keys
    ]

@api_router.get("/admin/feature-usage", response_model=FeatureUsageStats)
async def get_feature_usage(days: Optional[int] = None):
    """Get aggregated feature usage stats"""
    pipeline = [
        {
            "$group": {
                "_id": None,
                "schedule_views": {"$sum": "$schedule_views"},
                "analytics_views": {"$sum": "$analytics_views"},
                "calendar_opens": {"$sum": "$calendar_opens"},
                "notifications_configured": {"$sum": {"$cond": ["$notifications_configured", 1, 0]}},
                "schedule_shares": {"$sum": "$schedule_shares"},
                "tasks_created": {"$sum": "$tasks_created_total"},
                "achievements_earned": {"$sum": "$achievements_count"}
            }
        }
    ]
    
    result = await db.user_stats.aggregate(pipeline).to_list(1)
    if not result:
        return FeatureUsageStats(
            schedule_views=0, analytics_views=0, calendar_opens=0,
            notifications_configured=0, schedule_shares=0, tasks_created=0, achievements_earned=0
        )
        
    r = result[0]
    return FeatureUsageStats(
        schedule_views=r.get("schedule_views", 0),
        analytics_views=r.get("analytics_views", 0),
        calendar_opens=r.get("calendar_opens", 0),
        notifications_configured=r.get("notifications_configured", 0),
        schedule_shares=r.get("schedule_shares", 0),
        tasks_created=r.get("tasks_created", 0),
        achievements_earned=r.get("achievements_earned", 0)
    )

@api_router.get("/admin/top-users", response_model=List[TopUser])
async def get_top_users(metric: str = "points", limit: int = 10):
    """Get top users by metric"""
    sort_field = "total_points"
    if metric == "achievements":
        sort_field = "achievements_count"
        
    users_stats = await db.user_stats.find().sort(sort_field, -1).limit(limit).to_list(limit)
    
    result = []
    for stat in users_stats:
        telegram_id = stat["telegram_id"]
        # Fetch user details
        user_settings = await db.user_settings.find_one({"telegram_id": telegram_id})
        
        name = "Unknown"
        username = None
        group_name = None
        
        if user_settings:
            name = user_settings.get("first_name", "Unknown")
            username = user_settings.get("username")
            group_name = user_settings.get("group_name")
            
        result.append(TopUser(
            telegram_id=telegram_id,
            username=username,
            first_name=name,
            value=stat.get(sort_field, 0),
            group_name=group_name
        ))
        
    return result

@api_router.get("/admin/faculty-stats", response_model=List[FacultyStats])
async def get_faculty_stats():
    """Get user distribution by faculty"""
    pipeline = [
        {
            "$group": {
                "_id": "$facultet_name",
                "count": {"$sum": 1},
                "facultet_id": {"$first": "$facultet_id"}
            }
        },
        {"$sort": {"count": -1}}
    ]
    
    results = await db.user_settings.aggregate(pipeline).to_list(None)
    
    return [
        FacultyStats(
            faculty_name=r["_id"] or "Неизвестно",
            users_count=r["count"],
            faculty_id=r.get("facultet_id")
        )
        for r in results
    ]

@api_router.get("/admin/course-stats", response_model=List[CourseStats])
async def get_course_stats():
    """Get user distribution by course"""
    pipeline = [
        {
            "$group": {
                "_id": "$kurs",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.user_settings.aggregate(pipeline).to_list(None)
    
    return [
        CourseStats(
            course=str(r["_id"]) if r["_id"] else "Неизвестно",
            users_count=r["count"]
        )
        for r in results
    ]
