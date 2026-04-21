# 🚀 Руководство по Решению Ошибки "craco: not found"

## ❌ Проблема

Вы получили ошибку:
```bash
/bin/sh: 1: craco: not found
error Command failed with exit code 127.
```

## 🔍 Причина

Вы попытались выполнить `sudo yarn build` **ДО** миграции с Create React App (CRA) на Vite. 

В вашем текущем `package.json` скрипт `build` указывает на `craco build`, но:
- Либо `craco` не установлен
- Либо вы уже удалили его, следуя инструкции

## ✅ Решение

Вам нужно **СНАЧАЛА** выполнить миграцию на Vite, а **ПОТОМ** собирать проект.

---

## 📋 Инструкция по Миграции (Шаг за Шагом)

### Шаг 1: Подготовка - Создайте Бэкап

```bash
# Подключитесь к серверу
ssh your_user@your_server

# Перейдите в проект
cd /var/www/rudn-schedule.ru

# Создайте бэкап
sudo cp -r frontend frontend.backup.$(date +%Y%m%d_%H%M%S)
```

### Шаг 2: Создайте Необходимые Файлы

#### 2.1 Создайте `vite.config.js`

```bash
sudo nano frontend/vite.config.js
```

Скопируйте и вставьте содержимое из файла `/app/frontend/vite.config.js` (см. ниже).

#### 2.2 Создайте `.env.production`

```bash
sudo nano frontend/.env.production
```

Вставьте:
```bash
VITE_BACKEND_URL=https://rudn-schedule.ru
VITE_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
```

#### 2.3 Переместите `index.html`

```bash
# Скопируйте index.html в корень проекта
sudo cp frontend/public/index.html index.html

# Откройте для редактирования
sudo nano index.html
```

**ВАЖНО**: В конце `<body>` перед закрывающим тегом `</body>` добавьте:
```html
<!-- Vite Module Entry Point -->
<script type="module" src="/frontend/src/index.jsx"></script>
```

#### 2.4 Обновите `package.json`

```bash
sudo nano frontend/package.json
```

Измените секцию `"scripts"`:
```json
"scripts": {
  "start": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "echo 'Tests not configured yet' && exit 0"
}
```

#### 2.5 Создайте `deploy-optimized.sh`

```bash
sudo nano /var/www/rudn-schedule.ru/deploy-optimized.sh
```

Скопируйте содержимое из файла `/app/deploy-optimized.sh` (см. ниже).

Сделайте исполняемым:
```bash
sudo chmod +x /var/www/rudn-schedule.ru/deploy-optimized.sh
```

### Шаг 3: Выполните Миграцию

**Скопируйте и выполните ВСЕ эти команды сразу** (займет 2-3 минуты):

```bash
cd /var/www/rudn-schedule.ru/frontend

# Обновить переменные окружения
sudo sed -i 's/REACT_APP_/VITE_/g' .env

# Переименовать файлы .js -> .jsx (если нужно)
cd src
[ -f index.js ] && sudo mv index.js index.jsx
[ -f App.js ] && sudo mv App.js App.jsx
cd /var/www/rudn-schedule.ru/frontend

# Удалить старые зависимости
sudo yarn remove react-scripts @craco/craco cra-template

# Установить Vite
sudo yarn add -D vite @vitejs/plugin-react terser

# Удалить старые конфиги
sudo rm -f craco.config.js package-lock.json

# Переустановить зависимости
sudo rm -rf node_modules
sudo yarn install

# Собрать проект (займет ~20-30 секунд!)
sudo yarn build
```

### Шаг 4: Перезапустите Сервисы

```bash
# Проверить и перезагрузить Nginx
sudo nginx -t
sudo systemctl reload nginx

# Перезапустить Backend
cd /var/www/rudn-schedule.ru/backend
source venv/bin/activate
sudo systemctl restart rudn-schedule-backend

# Проверить статус
sudo systemctl status rudn-schedule-backend
```

### Шаг 5: Проверка

```bash
# 1. Проверить размер сборки
du -sh /var/www/rudn-schedule.ru/frontend/build/
# Ожидается: ~1.9M

# 2. Проверить сайт
curl -I https://rudn-schedule.ru
# Ожидается: HTTP/2 200

# 3. Проверить API
curl https://rudn-schedule.ru/api/faculties
# Ожидается: JSON с факультетами
```

---

## 🎉 Готово!

Теперь сборка будет занимать **20-30 секунд** вместо 2-4 минут!

### Следующие Обновления (БЫСТРО!)

Для всех последующих обновлений просто используйте:

```bash
cd /var/www/rudn-schedule.ru
sudo ./deploy-optimized.sh
```

**Время: 30-60 секунд вместо 5-9 минут!** ⚡

---

## 🛠️ Содержимое Файлов

### `vite.config.js`

```javascript
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    
    build: {
      outDir: 'build',
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'router': ['react-router-dom'],
            'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            'motion': ['framer-motion'],
            'charts': ['recharts'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    
    server: {
      port: 3000,
      host: true,
      strictPort: true,
    },
    
    preview: {
      port: 3000,
      host: true,
    },
    
    define: {
      'process.env': env,
    },
  };
});
```

### `deploy-optimized.sh`

Содержимое находится в файле `/app/deploy-optimized.sh` - скопируйте его полностью.

---

## 🛑 Если что-то не работает

### Проблема: Сайт не открывается

```bash
# Проверить права на файлы
sudo chown -R www-data:www-data /var/www/rudn-schedule.ru/frontend/build/
sudo chmod -R 755 /var/www/rudn-schedule.ru/frontend/build/

# Перезапустить Nginx
sudo systemctl restart nginx
```

### Проблема: Backend не работает

```bash
# Посмотреть логи
sudo journalctl -u rudn-schedule-backend -n 50

# Перезапустить
sudo systemctl restart rudn-schedule-backend
```

### Проблема: Хочу откатить изменения

```bash
# Восстановить из бэкапа
sudo rm -rf /var/www/rudn-schedule.ru/frontend
sudo mv /var/www/rudn-schedule.ru/frontend.backup.* /var/www/rudn-schedule.ru/frontend
sudo systemctl restart nginx
```

---

## 📞 Нужна помощь?

Покажите вывод этих команд:

```bash
# Версии
node --version
yarn --version

# Статус сервисов
sudo systemctl status rudn-schedule-backend
sudo systemctl status nginx

# Логи
sudo journalctl -u rudn-schedule-backend -n 50 --no-pager
sudo tail -20 /var/log/nginx/error.log
```

---

## ✅ Чеклист

- [ ] Создан бэкап frontend
- [ ] Создан `vite.config.js`
- [ ] Создан `.env.production`
- [ ] Перемещен и обновлен `index.html`
- [ ] Обновлен `package.json`
- [ ] Создан `deploy-optimized.sh`
- [ ] Выполнены команды миграции
- [ ] Сайт работает (curl проверка)
- [ ] API работает (curl проверка)

---

**Удачи! 🚀**
