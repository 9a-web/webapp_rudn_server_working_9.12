#!/bin/bash

# Скрипт восстановления MongoDB из бэкапа
# Использование: ./restore_mongodb.sh /path/to/backup_folder

if [ $# -eq 0 ]; then
    echo "❌ Ошибка: не указан путь к бэкапу"
    echo "Использование: ./restore_mongodb.sh /path/to/backup_folder"
    echo ""
    echo "Примеры:"
    echo "  ./restore_mongodb.sh /app/backups/rudn_schedule_backup_20250122_150000_binary/rudn_schedule"
    echo ""
    echo "Доступные бэкапы:"
    ls -la /app/backups/ 2>/dev/null | grep "rudn_schedule" || echo "  (бэкапы не найдены)"
    exit 1
fi

BACKUP_PATH=$1
DB_NAME="test_database"
MONGO_URI="mongodb://localhost:27017"

echo "🔄 Восстановление MongoDB из бэкапа"
echo "========================================="
echo "База данных: ${DB_NAME}"
echo "Путь к бэкапу: ${BACKUP_PATH}"
echo ""

# Проверка существования бэкапа
if [ ! -d "$BACKUP_PATH" ]; then
    echo "❌ Ошибка: директория бэкапа не найдена: ${BACKUP_PATH}"
    exit 1
fi

# Предупреждение
read -p "⚠️  Это перезапишет существующую базу ${DB_NAME}. Продолжить? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено пользователем"
    exit 0
fi

# Восстановление
echo ""
echo "Восстановление данных..."
mongorestore --uri="${MONGO_URI}" --db=${DB_NAME} --drop ${BACKUP_PATH}

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Восстановление успешно завершено!"
    echo ""
    echo "Статистика восстановленной базы:"
    mongosh ${MONGO_URI}/${DB_NAME} --quiet --eval "
        var stats = db.stats();
        print('  Коллекций: ' + stats.collections);
        print('  Документов: ' + stats.objects);
        print('  Размер: ' + (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB');
    "
else
    echo ""
    echo "❌ Ошибка при восстановлении"
    exit 1
fi
