#!/bin/bash

echo "🔧 Финальная настройка RUDN Schedule..."

cd /var/www/rudn-schedule.ru/frontend || exit 1

# Проверка и сборка build
if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    echo "📦 Сборка frontend..."
    yarn build
else
    echo "✅ Директория build существует"
fi

echo ""
echo "📁 Содержимое build:"
ls -lh build/ | head -10

# Исправление прав
echo ""
echo "🔧 Установка правильных прав доступа..."
sudo chown -R www-data:www-data build/
sudo chmod -R 755 build/
sudo find build -type f -exec chmod 644 {} \;
sudo chmod 755 /var/www/rudn-schedule.ru
sudo chmod 755 /var/www/rudn-schedule.ru/frontend

# Проверка конфигурации Nginx
echo ""
echo "📝 Конфигурация Nginx:"
cat /etc/nginx/sites-available/rudn-schedule.ru | grep "root"

# Перезагрузка Nginx
echo ""
echo "🔄 Перезагрузка Nginx..."
sudo nginx -t && sudo systemctl reload nginx

# Проверка
echo ""
echo "🎯 Проверка доступности сайта:"
curl -I https://rudn-schedule.ru 2>&1 | grep -E "HTTP|Location"

echo ""
echo "✅ Готово! Откройте https://rudn-schedule.ru в браузере"
