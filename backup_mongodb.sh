#!/bin/bash

# Скрипт для создания бэкапа MongoDB базы данных rudn_schedule
# Автор: Emergent AI Agent
# Дата: $(date +%Y-%m-%d)

set -e  # Остановка при ошибке

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  MongoDB Backup Script для rudn_schedule${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Параметры
DB_NAME="test_database"
MONGO_URI="mongodb://localhost:27017"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/app/backups"
BACKUP_NAME="test_database_backup_${TIMESTAMP}"

# Создание директории для бэкапов
mkdir -p ${BACKUP_DIR}

echo -e "${BLUE}[1/4]${NC} Проверка подключения к MongoDB..."
if mongosh ${MONGO_URI}/${DB_NAME} --quiet --eval "db.stats()" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Подключение успешно\n"
else
    echo -e "${RED}✗${NC} Ошибка подключения к MongoDB"
    exit 1
fi

# Получение статистики базы
echo -e "${BLUE}[2/4]${NC} Статистика базы данных:"
mongosh ${MONGO_URI}/${DB_NAME} --quiet --eval "
    var stats = db.stats();
    print('  Коллекций: ' + stats.collections);
    print('  Документов: ' + stats.objects);
    print('  Размер данных: ' + (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB');
    print('  Размер на диске: ' + (stats.storageSize / 1024 / 1024).toFixed(2) + ' MB');
"
echo ""

# Создание бэкапа через mongodump (бинарный формат)
echo -e "${BLUE}[3/4]${NC} Создание бинарного бэкапа (mongodump)..."
mongodump --uri="${MONGO_URI}" --db=${DB_NAME} --out=${BACKUP_DIR}/${BACKUP_NAME}_binary --quiet
echo -e "${GREEN}✓${NC} Бинарный бэкап создан: ${BACKUP_DIR}/${BACKUP_NAME}_binary\n"

# Создание бэкапа в JSON формате (для каждой коллекции)
echo -e "${BLUE}[4/4]${NC} Создание JSON бэкапа..."
JSON_DIR="${BACKUP_DIR}/${BACKUP_NAME}_json"
mkdir -p ${JSON_DIR}

# Получаем список коллекций и экспортируем каждую
COLLECTIONS=$(mongosh ${MONGO_URI}/${DB_NAME} --quiet --eval "db.getCollectionNames().join(' ')")

if [ -z "$COLLECTIONS" ] || [ "$COLLECTIONS" == "" ]; then
    echo -e "${RED}  Коллекции не найдены${NC}"
else
    for collection in $COLLECTIONS; do
        echo -e "  Экспорт коллекции: ${collection}..."
        mongoexport --uri="${MONGO_URI}" --db=${DB_NAME} --collection=${collection} \
                    --out=${JSON_DIR}/${collection}.json --jsonArray --quiet
        
        # Подсчет документов
        count=$(mongosh ${MONGO_URI}/${DB_NAME} --quiet --eval "db.${collection}.countDocuments()")
        echo -e "  ${GREEN}✓${NC} ${collection}: ${count} документов"
    done
fi
echo ""

# Создание архива
echo -e "${BLUE}[Архивация]${NC} Создание tar.gz архива..."
cd ${BACKUP_DIR}
tar -czf ${BACKUP_NAME}.tar.gz ${BACKUP_NAME}_binary ${BACKUP_NAME}_json
ARCHIVE_SIZE=$(du -h ${BACKUP_NAME}.tar.gz | cut -f1)
echo -e "${GREEN}✓${NC} Архив создан: ${BACKUP_NAME}.tar.gz (${ARCHIVE_SIZE})\n"

# Очистка временных файлов (опционально)
# rm -rf ${BACKUP_NAME}_binary ${BACKUP_NAME}_json

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Бэкап успешно создан!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "📁 Расположение файлов:"
echo -e "  • Архив:         ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo -e "  • Бинарный:      ${BACKUP_DIR}/${BACKUP_NAME}_binary/"
echo -e "  • JSON:          ${BACKUP_DIR}/${BACKUP_NAME}_json/"
echo -e "\n💡 Для восстановления бэкапа используйте:"
echo -e "   mongorestore --uri='${MONGO_URI}' --db=${DB_NAME} ${BACKUP_DIR}/${BACKUP_NAME}_binary/${DB_NAME}/"
echo -e "\n📥 Чтобы скачать архив, используйте:"
echo -e "   cat ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz | base64"
echo -e "   (скопируйте вывод и декодируйте на локальной машине)\n"
