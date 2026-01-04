
class PlannerSyncRequest(BaseModel):
    """Запрос на синхронизацию расписания в планировщик"""
    telegram_id: int
    date: str  # YYYY-MM-DD
    events: List[ScheduleEvent]
