#!/bin/bash

# 🚀 Быстрый деплой для rudn-schedule.ru
# Время: ~30-60 секунд

set -e  # Остановка при ошибке

echo "🚀 Начинаем деплой..."
START_TIME=$(date +%s)

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd /var/www/rudn-schedule.ru

# 1️⃣ Git pull
echo -e "${BLUE}📥 Обновление кода...${NC}"
git pull origin main

# 2️⃣ Backend
echo -e "${BLUE}🔧 Обновление Backend...${NC}"
cd backend
source venv/bin/activate

# Только если requirements.txt изменился
if git diff HEAD@{1} HEAD --name-only | grep -q "requirements.txt"; then
    echo "   📦 Устанавливаю новые зависимости..."
    pip install -r requirements.txt --quiet
fi

sudo systemctl restart rudn-schedule-backend
echo -e "${GREEN}   ✅ Backend перезапущен${NC}"

# 3️⃣ Frontend
echo -e "${BLUE}🎨 Сборка Frontend...${NC}"
cd ../frontend

# Только если package.json изменился
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
    echo "   📦 Устанавливаю новые зависимости..."
    yarn install --frozen-lockfile --silent
fi

# Быстрая сборка (20-30 секунд)
yarn build

# Установка прав
sudo chown -R www-data:www-data build/
sudo chmod -R 755 build/

echo -e "${GREEN}   ✅ Frontend собран${NC}"

# 4️⃣ Nginx
echo -e "${BLUE}🌐 Перезагрузка Nginx...${NC}"
sudo nginx -t
sudo systemctl reload nginx
echo -e "${GREEN}   ✅ Nginx перезагружен${NC}"

# ⏱️ Время выполнения
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${GREEN}✅ Деплой завершён успешно!${NC}"
echo -e "${YELLOW}⏱️  Время: ${DURATION} секунд${NC}"
echo ""
echo "🔗 Сайт: https://rudn-schedule.ru"
echo "🔗 API: https://rudn-schedule.ru/api/faculties"
echo ""

# Проверка размера сборки
BUILD_SIZE=$(du -sh build/ | cut -f1)
echo -e "${BLUE}📦 Размер сборки: ${BUILD_SIZE}${NC}"

# Проверка статуса
if curl -sf https://rudn-schedule.ru > /dev/null; then
    echo -e "${GREEN}✅ Сайт доступен${NC}"
else
    echo -e "${YELLOW}⚠️  Сайт недоступен, проверьте логи${NC}"
fi

if curl -sf https://rudn-schedule.ru/api/faculties > /dev/null; then
    echo -e "${GREEN}✅ API работает${NC}"
else
    echo -e "${YELLOW}⚠️  API недоступен, проверьте backend${NC}"
fi
