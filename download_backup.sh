#!/bin/bash

# Скрипт для скачивания бэкапа через API
# Использование: ./download_backup.sh

BACKEND_URL="https://class-progress-1.preview.emergentagent.com"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="/app/api_backups"
OUTPUT_FILE="${OUTPUT_DIR}/database_backup_${TIMESTAMP}.json"

echo "📥 Скачивание бэкапа базы данных через API"
echo "==========================================="
echo ""

# Создание директории
mkdir -p ${OUTPUT_DIR}

# Проверка статистики
echo "[1/3] Получение статистики базы данных..."
curl -s "${BACKEND_URL}/api/backup/stats" | python3 -m json.tool
echo ""

# Скачивание полного бэкапа
echo "[2/3] Скачивание полной базы данных..."
curl -s "${BACKEND_URL}/api/export/database" -o "${OUTPUT_FILE}"

if [ $? -eq 0 ]; then
    echo "✅ Бэкап успешно скачан!"
    echo ""
    
    # Показываем информацию о файле
    SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
    echo "[3/3] Информация о файле:"
    echo "  📁 Файл: ${OUTPUT_FILE}"
    echo "  💾 Размер: ${SIZE}"
    echo ""
    
    # Показываем статистику из файла
    echo "📊 Содержимое бэкапа:"
    python3 -c "
import json
with open('${OUTPUT_FILE}', 'r') as f:
    data = json.load(f)
    print(f\"  • Дата экспорта: {data['export_date']}\")
    print(f\"  • Всего коллекций: {data['total_collections']}\")
    print(f\"  • Всего документов: {data['total_documents']}\")
    print(\"\\n  Детали по коллекциям:\")
    for name, info in data['collections'].items():
        print(f\"    - {name}: {info['count']} документов\")
" 2>/dev/null || echo "  (не удалось распарсить JSON)"
    
    echo ""
    echo "💡 Файл можно скачать на локальный компьютер:"
    echo "   cat ${OUTPUT_FILE} | base64"
    echo ""
    
else
    echo "❌ Ошибка при скачивании бэкапа"
    exit 1
fi

# Список всех скачанных бэкапов
echo "📚 Все бэкапы в ${OUTPUT_DIR}:"
ls -lh ${OUTPUT_DIR}/*.json 2>/dev/null || echo "  (нет предыдущих бэкапов)"
