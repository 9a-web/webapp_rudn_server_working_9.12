#!/bin/bash

echo "🔧 Исправление RUDN Schedule..."

# 1. Переход в проект
cd /var/www/rudn-schedule.ru || exit 1
echo "✅ В корневой директории"

# 2. Установка frontend зависимостей
echo "📦 Установка frontend зависимостей..."
cd frontend
rm -rf node_modules package-lock.json
yarn install

# 3. Сборка frontend
echo "🏗️ Сборка frontend..."
yarn build

# 4. Проверка сборки
if [ -d "build" ]; then
    echo "✅ Frontend собран успешно"
    ls -lh build/
else
    echo "❌ Ошибка: директория build не создана"
    exit 1
fi

# 5. Исправление Nginx конфигурации
echo "🔧 Исправление Nginx..."
sudo sed -i 's|/var/www/rudn-schedule.ru/frontend/dist|/var/www/rudn-schedule.ru/frontend/build|g' /etc/nginx/sites-available/rudn-schedule.ru

# 6. Проверка и перезагрузка Nginx
echo "🔄 Перезагрузка Nginx..."
sudo nginx -t && sudo systemctl reload nginx

# 7. Проверка backend
cd ../backend
if [ -d "venv" ]; then
    echo "✅ Backend venv найден"
    source venv/bin/activate
    pip install -q -r requirements.txt
    deactivate
else
    echo "⚠️ Backend venv не найден, создаём..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
fi

# 8. Перезапуск backend
echo "🔄 Перезапуск backend..."
sudo systemctl restart rudn-schedule-backend

# 9. Проверка
echo ""
echo "🎉 Проверка результатов:"
echo ""
echo "Backend API:"
curl -s http://localhost:8001/api/faculties | head -c 100
echo ""
echo ""
echo "Frontend файлы:"
ls -lh /var/www/rudn-schedule.ru/frontend/build/ | head -5
echo ""
echo "Сайт:"
curl -I https://rudn-schedule.ru 2>&1 | grep "HTTP"

echo ""
echo "✅ Готово! Проверьте https://rudn-schedule.ru в браузере"
