#!/bin/bash

# ============================================
# RUDN Schedule Server Diagnostic Script
# ============================================

# Цвета для вывода
RED='33[0;31m'
GREEN='33[0;32m'
YELLOW='33[1;33m'
BLUE='33[0;34m'
NC='33[0m' # No Color

# Функция для красивого вывода заголовков
print_header() {
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Начало диагностики
echo -e "${GREEN}"
echo "╔════════════════════════════════════════╗"
echo "║   RUDN Schedule Server Diagnostic     ║"
echo "║           Version 1.0                 ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================
# 1. ОБЩАЯ ИНФОРМАЦИЯ О СИСТЕМЕ
# ============================================
print_header "1. ОБЩАЯ ИНФОРМАЦИЯ О СИСТЕМЕ"

echo "--- Операционная система ---"
cat /etc/os-release | grep -E "PRETTY_NAME|VERSION"

echo -e "\n--- Свободное место на диске ---"
df -h | grep -E "Filesystem|/$|/home"

echo -e "\n--- Использование памяти ---"
free -h

echo -e "\n--- Текущий пользователь и директория ---"
echo "Пользователь: $(whoami)"
echo "Текущая директория: $(pwd)"

# ============================================
# 2. ПОИСК ПРОЕКТА
# ============================================
print_header "2. ПОИСК ПРОЕКТА RUDN SCHEDULE"

echo "Ищем проект в /var/www и /home..."
PROJECT_PATH=""

# Поиск по package.json в frontend
FOUND_PATHS=$(find /var/www /home -name "package.json" -path "*/frontend/*" 2>/dev/null | head -5)

if [ -n "$FOUND_PATHS" ]; then
    echo "$FOUND_PATHS" | while read path; do
        PROJECT_DIR=$(dirname "$(dirname "$path")")
        echo "Найден проект: $PROJECT_DIR"
        
        # Проверяем, есть ли там backend
        if [ -d "$PROJECT_DIR/backend" ] && [ -d "$PROJECT_DIR/frontend" ]; then
            print_success "Полная структура проекта найдена: $PROJECT_DIR"
            PROJECT_PATH="$PROJECT_DIR"
        fi
    done
    
    # Берем первый найденный путь
    PROJECT_PATH=$(echo "$FOUND_PATHS" | head -1 | xargs dirname | xargs dirname)
else
    print_error "Проект не найден в стандартных директориях"
    echo "Попробуйте указать путь вручную: export PROJECT_PATH=/path/to/project"
fi

# Если путь найден, используем его
if [ -n "$PROJECT_PATH" ] && [ -d "$PROJECT_PATH" ]; then
    echo -e "\n${GREEN}📁 Рабочая директория проекта: $PROJECT_PATH${NC}"
    cd "$PROJECT_PATH" || exit 1
else
    print_warning "Автоматический поиск не удался. Попробуем /var/www/rudn-schedule.ru"
    PROJECT_PATH="/var/www/rudn-schedule.ru"
    if [ -d "$PROJECT_PATH" ]; then
        cd "$PROJECT_PATH" || exit 1
    else
        print_error "Директория $PROJECT_PATH не существует"
        echo "Укажите путь к проекту вручную и запустите скрипт из этой директории"
        exit 1
    fi
fi

# ============================================
# 3. СТРУКТУРА ПРОЕКТА
# ============================================
print_header "3. СТРУКТУРА ПРОЕКТА"

echo "--- Содержимое корневой директории ---"
ls -lah

echo -e "\n--- Структура проекта (2 уровня) ---"
if command -v tree &> /dev/null; then
    tree -L 2 -a -I 'node_modules|venv|.git|build|dist'
else
    find . -maxdepth 2 -type d | grep -v -E "node_modules|venv|\.git|build|dist" | sort
fi

echo -e "\n--- Размеры директорий ---"
du -h --max-depth=1 2>/dev/null | sort -h | tail -10

# ============================================
# 4. ПРОВЕРКА ВАЖНЫХ ФАЙЛОВ
# ============================================
print_header "4. ПРОВЕРКА ВАЖНЫХ ФАЙЛОВ"

check_file() {
    if [ -f "$1" ]; then
        print_success "$1 существует ($(stat -f%z "$1" 2>/dev/null || stat -c%s "$1") байт)"
    else
        print_error "$1 НЕ найден"
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        print_success "$1 существует"
    else
        print_error "$1 НЕ найден"
    fi
}

check_file "frontend/package.json"
check_file "backend/requirements.txt"
check_file "frontend/.env"
check_file "backend/.env"
check_dir "backend/venv"
check_dir "frontend/node_modules"
check_dir "frontend/build"

# ============================================
# 5. СОДЕРЖИМОЕ КОНФИГУРАЦИОННЫХ ФАЙЛОВ
# ============================================
print_header "5. КОНФИГУРАЦИОННЫЕ ФАЙЛЫ"

if [ -f "frontend/package.json" ]; then
    echo "--- frontend/package.json (dependencies) ---"
    cat frontend/package.json | grep -A 20 '"dependencies"' | head -25
    echo ""
    cat frontend/package.json | grep -A 10 '"scripts"' | head -15
fi

if [ -f "backend/requirements.txt" ]; then
    echo -e "\n--- backend/requirements.txt ---"
    cat backend/requirements.txt
fi

if [ -f "frontend/.env" ]; then
    echo -e "\n--- frontend/.env (БЕЗ секретных значений) ---"
    cat frontend/.env | sed 's/=.*/=***/'
fi

if [ -f "backend/.env" ]; then
    echo -e "\n--- backend/.env (БЕЗ секретных значений) ---"
    cat backend/.env | sed 's/=.*/=***/'
fi

# ============================================
# 6. УСТАНОВЛЕННОЕ ПО
# ============================================
print_header "6. УСТАНОВЛЕННОЕ ПО И ВЕРСИИ"

check_command() {
    if command -v $1 &> /dev/null; then
        VERSION=$($1 $2 2>&1 | head -1)
        print_success "$1: $VERSION"
    else
        print_error "$1 не установлен"
    fi
}

check_command "node" "--version"
check_command "npm" "--version"
check_command "yarn" "--version"
check_command "python3" "--version"
check_command "python3.11" "--version"
check_command "pip3" "--version"
check_command "mongod" "--version"
check_command "nginx" "-v"
check_command "git" "--version"

# ============================================
# 7. СТАТУС СЕРВИСОВ
# ============================================
print_header "7. СТАТУС СЕРВИСОВ"

check_service() {
    if systemctl list-units --full --all | grep -q "$1.service"; then
        if systemctl is-active --quiet $1; then
            STATUS=$(systemctl is-active $1)
            print_success "Сервис $1: $STATUS"
        else
            STATUS=$(systemctl is-active $1)
            print_error "Сервис $1: $STATUS"
        fi
        
        echo "  └─ Последние 5 строк логов:"
        sudo journalctl -u $1 -n 5 --no-pager 2>/dev/null | sed 's/^/     /'
        echo ""
    else
        print_warning "Сервис $1 не найден в systemd"
    fi
}

check_service "mongod"
check_service "mongodb"
check_service "rudn-backend"
check_service "rudn-frontend"
check_service "rudn-schedule-backend"
check_service "rudn-schedule-frontend"
check_service "backend"
check_service "frontend"
check_service "nginx"

echo -e "\n--- Все сервисы с 'rudn' в названии ---"
systemctl list-units --type=service --all | grep -i rudn || echo "Нет сервисов с 'rudn' в названии"

# ============================================
# 8. ЗАПУЩЕННЫЕ ПРОЦЕССЫ
# ============================================
print_header "8. ЗАПУЩЕННЫЕ ПРОЦЕССЫ"

echo "--- Node.js процессы ---"
ps aux | grep -E "[n]ode|[y]arn" | grep -v grep || echo "Node.js процессы не найдены"

echo -e "\n--- Python/Uvicorn процессы ---"
ps aux | grep -E "[p]ython|[u]vicorn" | grep -v grep || echo "Python процессы не найдены"

echo -e "\n--- MongoDB процессы ---"
ps aux | grep -E "[m]ongod" | grep -v grep || echo "MongoDB процессы не найдены"

# ============================================
# 9. СЕТЕВЫЕ ПОРТЫ
# ============================================
print_header "9. ЗАНЯТЫЕ ПОРТЫ"

echo "Проверяем порты: 3000 (frontend), 8001 (backend), 27017 (mongodb), 80 (http), 443 (https)"
echo ""

if command -v netstat &> /dev/null; then
    sudo netstat -tlnp | grep -E ":(3000|8001|27017|80|443)" | awk '{print $4, $7}' || echo "Нет активных соединений на этих портах"
elif command -v ss &> /dev/null; then
    sudo ss -tlnp | grep -E ":(3000|8001|27017|80|443)" | awk '{print $4, $6}' || echo "Нет активных соединений на этих портах"
else
    print_error "netstat и ss не установлены"
fi

# ============================================
# 10. КОНФИГУРАЦИЯ NGINX
# ============================================
print_header "10. КОНФИГУРАЦИЯ NGINX"

if command -v nginx &> /dev/null; then
    echo "--- Доступные сайты ---"
    ls -la /etc/nginx/sites-available/ 2>/dev/null || print_error "Директория sites-available не найдена"
    
    echo -e "\n--- Включенные сайты ---"
    ls -la /etc/nginx/sites-enabled/ 2>/dev/null || print_error "Директория sites-enabled не найдена"
    
    echo -e "\n--- Конфигурация rudn-schedule ---"
    if [ -f "/etc/nginx/sites-available/rudn-schedule" ]; then
        cat /etc/nginx/sites-available/rudn-schedule
    elif [ -f "/etc/nginx/sites-available/rudn-schedule.ru" ]; then
        cat /etc/nginx/sites-available/rudn-schedule.ru
    else
        print_error "Конфигурация rudn-schedule не найдена"
    fi
    
    echo -e "\n--- Проверка синтаксиса Nginx ---"
    sudo nginx -t 2>&1
else
    print_error "Nginx не установлен"
fi

# ============================================
# 11. ПРОВЕРКА ДОСТУПНОСТИ
# ============================================
print_header "11. ПРОВЕРКА ДОСТУПНОСТИ"

echo "--- Локальные порты ---"
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000 2>/dev/null && echo " - Frontend (localhost:3000)" || print_error "Frontend (localhost:3000) недоступен"
echo ""
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:8001/api/faculties 2>/dev/null && echo " - Backend (localhost:8001)" || print_error "Backend (localhost:8001) недоступен"
echo ""

echo -e "\n--- Внешний домен ---"
curl -s -o /dev/null -w "HTTP %{http_code}" http://rudn-schedule.ru 2>/dev/null && echo " - http://rudn-schedule.ru" || print_error "http://rudn-schedule.ru недоступен"
echo ""
curl -s -o /dev/null -w "HTTP %{http_code}" https://rudn-schedule.ru 2>/dev/null && echo " - https://rudn-schedule.ru (SSL)" || print_error "https://rudn-schedule.ru недоступен"
echo ""

# ============================================
# 12. ЛОГИ ОШИБОК
# ============================================
print_header "12. ПОСЛЕДНИЕ ОШИБКИ ИЗ ЛОГОВ"

echo "--- Nginx Error Log (последние 20 строк) ---"
sudo tail -n 20 /var/log/nginx/error.log 2>/dev/null || print_warning "Лог не найден"

echo -e "\n--- Системные ошибки (последний час) ---"
sudo journalctl -p err --since "1 hour ago" --no-pager -n 20 2>/dev/null || print_warning "Логи не доступны"

# ============================================
# 13. УСТАНОВЛЕННЫЕ ЗАВИСИМОСТИ
# ============================================
print_header "13. УСТАНОВЛЕННЫЕ ЗАВИСИМОСТИ"

if [ -d "frontend/node_modules" ]; then
    echo "--- Frontend node_modules ---"
    du -sh frontend/node_modules
    echo -e "\nОсновные пакеты:"
    cd frontend && yarn list --depth=0 2>/dev/null | head -n 15 && cd ..
else
    print_error "frontend/node_modules не найден - зависимости не установлены"
fi

echo -e "\n--- Backend Python packages ---"
if [ -d "venv" ]; then
    source venv/bin/activate 2>/dev/null
    pip list 2>/dev/null | head -n 20
    deactivate 2>/dev/null
elif [ -d "backend/venv" ]; then
    source backend/venv/bin/activate 2>/dev/null
    pip list 2>/dev/null | head -n 20
    deactivate 2>/dev/null
else
    print_error "Python venv не найден - зависимости не установлены"
fi

# ============================================
# ИТОГОВАЯ СВОДКА
# ============================================
print_header "14. ИТОГОВАЯ СВОДКА"

echo "📋 Краткая сводка состояния системы:"
echo ""

# Подсчет проблем
ISSUES=0

[ ! -d "frontend/node_modules" ] && echo "⚠️  Frontend зависимости не установлены" && ISSUES=$((ISSUES+1))
[ ! -d "venv" ] && [ ! -d "backend/venv" ] && echo "⚠️  Backend зависимости не установлены" && ISSUES=$((ISSUES+1))
! systemctl is-active --quiet mongod 2>/dev/null && ! systemctl is-active --quiet mongodb 2>/dev/null && echo "⚠️  MongoDB не запущен" && ISSUES=$((ISSUES+1))
! systemctl is-active --quiet nginx 2>/dev/null && echo "⚠️  Nginx не запущен" && ISSUES=$((ISSUES+1))

if [ $ISSUES -eq 0 ]; then
    print_success "Серьезных проблем не обнаружено!"
else
    print_warning "Обнаружено проблем: $ISSUES"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Диагностика завершена!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Результаты сохранены в текущей директории."
echo "Для сохранения в файл запустите:"
echo "  ./diagnose_server.sh > diagnostic_report.txt 2>&1"
echo ""
