# 🔄 Руководство по восстановлению базы данных test_database

## ✅ Что уже сделано

1. ✅ Изменено название базы данных с `rudn_schedule` на `test_database` во всех файлах:
   - `/app/backend/.env` - основной конфиг
   - `/app/backup_mongodb.sh` - скрипт бэкапа
   - `/app/restore_mongodb.sh` - скрипт восстановления
   - `/app/export_json.sh` - скрипт экспорта
   - `/app/test_notification_duplication_fix.py` - тестовый файл

2. ✅ Backend перезапущен и подключен к базе `test_database`

3. ✅ Созданы все необходимые коллекции с индексами:
   - `user_settings` (telegram_id: unique)
   - `user_stats` (telegram_id: unique)
   - `user_achievements` (telegram_id + achievement_id: unique)
   - `tasks` (telegram_id, created_at)
   - `rooms` (creator_id, invite_token: unique)
   - `room_participants` (room_id + telegram_id: unique)
   - `group_tasks` (room_id, creator_id)
   - `sent_notifications` (telegram_id + lesson_id + notification_date: unique)

---

## 📥 Как восстановить данные из продакшн-сервера

### Вариант 1: Через mongodump/mongorestore (рекомендуется)

**На продакшн-сервере:**
```bash
# Создать бэкап
mongodump --uri="mongodb://localhost:27017" --db=test_database --out=/tmp/backup

# Создать архив
cd /tmp
tar -czf test_database_backup.tar.gz backup/

# Скачать на локальный компьютер
# (используйте scp, sftp или другой способ)
```

**На этом сервере:**
```bash
# Загрузить архив в /app/backups/
# Распаковать
cd /app/backups
tar -xzf test_database_backup.tar.gz

# Восстановить
mongorestore --uri="mongodb://localhost:27017" --db=test_database --drop backup/test_database/

# Проверить
mongosh test_database --eval "db.stats()"
```

---

### Вариант 2: Через JSON экспорт каждой коллекции

**На продакшн-сервере:**
```bash
# Экспорт всех коллекций
mongoexport --uri="mongodb://localhost:27017" --db=test_database --collection=user_settings --out=user_settings.json --jsonArray
mongoexport --uri="mongodb://localhost:27017" --db=test_database --collection=user_stats --out=user_stats.json --jsonArray
mongoexport --uri="mongodb://localhost:27017" --db=test_database --collection=user_achievements --out=user_achievements.json --jsonArray
mongoexport --uri="mongodb://localhost:27017" --db=test_database --collection=tasks --out=tasks.json --jsonArray
mongoexport --uri="mongodb://localhost:27017" --db=test_database --collection=rooms --out=rooms.json --jsonArray
mongoexport --uri="mongodb://localhost:27017" --db=test_database --collection=room_participants --out=room_participants.json --jsonArray
mongoexport --uri="mongodb://localhost:27017" --db=test_database --collection=group_tasks --out=group_tasks.json --jsonArray
```

**На этом сервере:**
```bash
# Импорт коллекций (загрузите JSON файлы в /app/backups/)
cd /app/backups
mongoimport --uri="mongodb://localhost:27017" --db=test_database --collection=user_settings --file=user_settings.json --jsonArray
mongoimport --uri="mongodb://localhost:27017" --db=test_database --collection=user_stats --file=user_stats.json --jsonArray
mongoimport --uri="mongodb://localhost:27017" --db=test_database --collection=user_achievements --file=user_achievements.json --jsonArray
mongoimport --uri="mongodb://localhost:27017" --db=test_database --collection=tasks --file=tasks.json --jsonArray
mongoimport --uri="mongodb://localhost:27017" --db=test_database --collection=rooms --file=rooms.json --jsonArray
mongoimport --uri="mongodb://localhost:27017" --db=test_database --collection=room_participants --file=room_participants.json --jsonArray
mongoimport --uri="mongodb://localhost:27017" --db=test_database --collection=group_tasks --file=group_tasks.json --jsonArray
```

---

### Вариант 3: Через API бэкап (если есть running backend на продакшн)

**На продакшн-сервере:**
```bash
# Создать бэкап через API
curl -o database_backup.json http://localhost:8001/api/export/database

# Скачать файл на локальный компьютер
```

**На этом сервере:**
```bash
# Загрузить database_backup.json в /app/backups/
# Создать скрипт для импорта (скоро будет создан)
```

---

## 🧪 Создать тестовые данные (для разработки)

Если нужны тестовые данные для проверки работы приложения:

```bash
cd /app
python3 add_demo_admin_data.py
```

⚠️ **Внимание:** Этот скрипт создаст 20 демо-пользователей с задачами и статистикой.

---

## ✅ Проверка после восстановления

```bash
# Проверить коллекции и количество документов
mongosh test_database --eval "
    db.getCollectionNames().forEach(function(col) {
        print(col + ': ' + db[col].countDocuments() + ' docs');
    });
"

# Проверить API
curl http://localhost:8001/api/ 

# Проверить статистику через API
curl http://localhost:8001/api/backup/stats | python3 -m json.tool

# Перезапустить backend
sudo supervisorctl restart backend
```

---

## 📊 Текущее состояние

```
База данных: test_database
Статус: ✅ Инициализирована, структура готова
Коллекций: 8
Документов: 0 (база пустая, ждет восстановления данных)
Backend: ✅ Запущен и подключен
```

---

## 🆘 Помощь

Если возникли проблемы:

1. Проверьте логи backend:
   ```bash
   tail -f /var/log/supervisor/backend.*.log
   ```

2. Проверьте подключение к MongoDB:
   ```bash
   mongosh test_database --eval "db.stats()"
   ```

3. Проверьте переменные окружения:
   ```bash
   cat /app/backend/.env | grep DB_NAME
   ```
