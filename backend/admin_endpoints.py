
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
