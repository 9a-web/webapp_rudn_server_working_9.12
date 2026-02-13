#!/bin/bash
#
# MongoDB Watchdog — скрипт для автоматического перезапуска MongoDB
# Установите в cron: */1 * * * * /app/scripts/mongodb_watchdog.sh >> /var/log/mongodb_watchdog.log 2>&1
#
# Как установить:
#   chmod +x /app/scripts/mongodb_watchdog.sh
#   crontab -e
#   # Добавьте строку:
#   */1 * * * * /app/scripts/mongodb_watchdog.sh >> /var/log/mongodb_watchdog.log 2>&1
#

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
MONGO_HOST="localhost"
MONGO_PORT="27017"
MAX_RETRIES=3
LOG_PREFIX="[MongoDB Watchdog $TIMESTAMP]"

# Функция проверки MongoDB
check_mongo() {
    mongosh --host "$MONGO_HOST" --port "$MONGO_PORT" --eval "db.adminCommand('ping')" --quiet 2>/dev/null
    return $?
}

# Функция перезапуска MongoDB
restart_mongo() {
    echo "$LOG_PREFIX Attempting to restart MongoDB..."
    
    # Пробуем через systemctl
    if command -v systemctl &> /dev/null; then
        sudo systemctl restart mongod 2>/dev/null && {
            echo "$LOG_PREFIX MongoDB restarted via systemctl"
            return 0
        }
    fi
    
    # Пробуем через supervisorctl
    if command -v supervisorctl &> /dev/null; then
        sudo supervisorctl restart mongodb 2>/dev/null && {
            echo "$LOG_PREFIX MongoDB restarted via supervisorctl"
            return 0
        }
    fi
    
    # Пробуем через service
    if command -v service &> /dev/null; then
        sudo service mongod restart 2>/dev/null && {
            echo "$LOG_PREFIX MongoDB restarted via service command"
            return 0
        }
    fi
    
    echo "$LOG_PREFIX ERROR: Could not restart MongoDB via any known method"
    return 1
}

# Основная логика
if check_mongo; then
    # MongoDB работает нормально — ничего не делаем
    exit 0
fi

echo "$LOG_PREFIX WARNING: MongoDB is not responding on $MONGO_HOST:$MONGO_PORT"

# Пробуем перезапустить
for i in $(seq 1 $MAX_RETRIES); do
    restart_mongo
    sleep 5
    
    if check_mongo; then
        echo "$LOG_PREFIX SUCCESS: MongoDB is back online after restart (attempt $i/$MAX_RETRIES)"
        
        # Отправляем уведомление (опционально, через Telegram)
        # BOT_TOKEN="your_bot_token"
        # CHAT_ID="your_chat_id"
        # curl -s "https://api.telegram.org/bot$BOT_TOKEN/sendMessage?chat_id=$CHAT_ID&text=✅ MongoDB восстановлена после перезапуска (попытка $i)"
        
        exit 0
    fi
    
    echo "$LOG_PREFIX Restart attempt $i/$MAX_RETRIES failed, retrying..."
done

echo "$LOG_PREFIX CRITICAL: MongoDB could not be restored after $MAX_RETRIES attempts!"
echo "$LOG_PREFIX Check disk space: $(df -h / | tail -1)"
echo "$LOG_PREFIX Check MongoDB logs: journalctl -u mongod -n 50 --no-pager"

# Отправляем критическое уведомление (опционально)
# curl -s "https://api.telegram.org/bot$BOT_TOKEN/sendMessage?chat_id=$CHAT_ID&text=🔴 CRITICAL: MongoDB не удалось восстановить после $MAX_RETRIES попыток!"

exit 1
