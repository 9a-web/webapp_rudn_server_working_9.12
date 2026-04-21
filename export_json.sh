#!/bin/bash

# Быстрый экспорт MongoDB в JSON формат
# Использование: ./export_json.sh

DB_NAME="test_database"
MONGO_URI="mongodb://localhost:27017"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_DIR="/app/exports/export_${TIMESTAMP}"

echo "📦 Экспорт базы данных ${DB_NAME}..."
echo ""

# Создание директории
mkdir -p ${EXPORT_DIR}

# Список коллекций
COLLECTIONS=$(mongosh ${MONGO_URI}/${DB_NAME} --quiet --eval "db.getCollectionNames().join(' ')" 2>/dev/null)

if [ -z "$COLLECTIONS" ] || [ "$COLLECTIONS" == "" ]; then
    echo "⚠️  База данных пустая или не найдена"
    exit 1
fi

echo "Найдено коллекций: $(echo $COLLECTIONS | wc -w)"
echo ""

# Экспорт каждой коллекции
for collection in $COLLECTIONS; do
    echo "→ Экспорт ${collection}..."
    mongoexport --uri="${MONGO_URI}" --db=${DB_NAME} --collection=${collection} \
                --out=${EXPORT_DIR}/${collection}.json --jsonArray --pretty 2>/dev/null
    
    count=$(wc -l < ${EXPORT_DIR}/${collection}.json)
    size=$(du -h ${EXPORT_DIR}/${collection}.json | cut -f1)
    echo "  ✓ ${collection}.json (${size})"
done

echo ""
echo "✅ Экспорт завершен!"
echo "📁 Файлы сохранены в: ${EXPORT_DIR}"
echo ""
echo "Список файлов:"
ls -lh ${EXPORT_DIR}
