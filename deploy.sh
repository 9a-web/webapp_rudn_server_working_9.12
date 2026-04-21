#!/bin/bash

echo "🚀 Starting deployment..."

# Перейти в папку проекта
cd /var/www/rudn-schedule.ru

# Сохранить .env файлы (резервная копия)
echo "💾 Backing up .env files..."
cp backend/.env backend/.env.backup
cp frontend/.env frontend/.env.backup

# Получить изменения с GitHub
echo "📥 Pulling from GitHub..."
git pull origin main

# Восстановить .env если они были перезаписаны
if [ ! -f backend/.env ] || [ -z "$(cat backend/.env)" ]; then
    echo "⚠️  Restoring backend/.env from backup..."
    cp backend/.env.backup backend/.env
fi

if [ ! -f frontend/.env ] || [ -z "$(cat frontend/.env)" ]; then
    echo "⚠️  Restoring frontend/.env from backup..."
    cp frontend/.env.backup frontend/.env
fi

# Обновить Backend
echo "🔧 Updating Backend..."
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart rudn-schedule-backend

# Обновить Frontend
echo "🎨 Building Frontend..."
cd ../frontend
npm install
npm run build
rm -rf dist
mv build dist

# Перезагрузить Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

# Очистить резервные копии
rm -f backend/.env.backup frontend/.env.backup

# Проверка
echo "✅ Checking services..."
sudo systemctl status rudn-schedule-backend --no-pager
curl -s http://localhost:8001/api/

echo ""
echo "🎉 Deployment completed!"
echo "📝 .env files were preserved"
echo "Check: https://rudn-schedule.ru"
