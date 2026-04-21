# 🚀 Шпаргалка по бэкапу MongoDB

## Быстрые команды

### Создать бэкап
```bash
# API экспорт (самый простой)
./download_backup.sh

# Полный бэкап (бинарный + JSON + архив)
./backup_mongodb.sh

# Только JSON
./export_json.sh
```

### Статистика базы
```bash
curl -s "http://localhost:8001/api/backup/stats" | python3 -m json.tool
```

### Восстановить
```bash
./restore_mongodb.sh /app/backups/BACKUP_NAME_binary/rudn_schedule
```

### Скачать на локальный ПК
```bash
# 1. Создать бэкап
./download_backup.sh

# 2. Закодировать
cat /app/api_backups/database_backup_*.json | base64 > backup.txt

# 3. Скопировать содержимое backup.txt

# 4. На локальном ПК:
cat backup.txt | base64 -d > backup.json
```

## API Endpoints

```bash
# Статистика
GET http://localhost:8001/api/backup/stats

# Полный экспорт
GET http://localhost:8001/api/export/database

# Отдельная коллекция
GET http://localhost:8001/api/export/collection/{collection_name}
```

Доступные коллекции:
- `user_settings`
- `user_stats`
- `user_achievements`
- `tasks`
- `rooms`
- `room_participants`
- `group_tasks`

## Полезные команды MongoDB

```bash
# Статистика
mongosh mongodb://localhost:27017/rudn_schedule --eval "db.stats()"

# Коллекции
mongosh mongodb://localhost:27017/rudn_schedule --eval "db.getCollectionNames()"

# Количество документов
mongosh mongodb://localhost:27017/rudn_schedule --eval "db.user_settings.countDocuments()"

# Первый документ
mongosh mongodb://localhost:27017/rudn_schedule --eval "db.user_settings.findOne()"
```

## Структура директорий

```
/app/
├── backups/              # MongoDB бинарные бэкапы + архивы
├── api_backups/          # JSON бэкапы через API
├── exports/              # JSON экспорты коллекций
├── backup_mongodb.sh     # Полный бэкап
├── export_json.sh        # JSON экспорт
├── download_backup.sh    # API экспорт
├── restore_mongodb.sh    # Восстановление
└── README_BACKUP.md      # Полная документация
```

## Быстрый старт

```bash
# 1. Создать бэкап
./download_backup.sh

# 2. Посмотреть созданные файлы
ls -lh /app/api_backups/

# 3. Если нужно скачать - использовать base64
cat /app/api_backups/database_backup_*.json | base64
```

---

**Подробная документация:** [README_BACKUP.md](./README_BACKUP.md)
