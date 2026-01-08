# Техническая документация: Парсер личного кабинета РУДН (lk.rudn.ru)

**Дата исследования:** 2025-01-08  
**Статус:** Готово к разработке  
**Тестовый аккаунт:** kasymovakamilla228@gmail.com (гостевой)

---

## 1. Архитектура авторизации

### 1.1 OAuth 2.0 Flow

Личный кабинет РУДН использует **OAuth 2.0** авторизацию через единый сервис **RUDN ID** (`id.rudn.ru`).

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  lk.rudn.ru │────▶│ id.rudn.ru  │────▶│ mobapp-api  │
│             │     │  (OAuth)    │     │  .rudn.ru   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │   1. Redirect     │   3. Token        │
       │◀──────────────────│   Exchange        │
       │                   │                   │
       │   2. Login Form   │                   │
       │   + Credentials   │                   │
       └───────────────────┘                   │
                                               │
       4. Redirect back with session ◀─────────┘
```

### 1.2 OAuth параметры

**Начальный URL авторизации:**
```
https://id.rudn.ru/sign-in?client_id=b0db4756-9468-4a9e-b399-17b546b6ea88&redirect_uri=https://mobapp-api.rudn.ru/token-rudn-id&response_type=code
```

| Параметр | Значение |
|----------|----------|
| `client_id` | `b0db4756-9468-4a9e-b399-17b546b6ea88` |
| `redirect_uri` | `https://mobapp-api.rudn.ru/token-rudn-id` |
| `response_type` | `code` |

### 1.3 Процесс авторизации (пошагово)

1. **Шаг 1:** Переход на `lk.rudn.ru` → редирект на OAuth страницу
2. **Шаг 2:** Отображается welcome-страница RUDN ID с кнопкой "Продолжить"
3. **Шаг 3:** После клика на "Продолжить" → форма логина
4. **Шаг 4:** Ввод email + пароль → клик "Войти"
5. **Шаг 5:** Редирект обратно на `lk.rudn.ru` с установленной сессией

---

## 2. Структура страниц

### 2.1 Основные URL

| Страница | URL | Описание |
|----------|-----|----------|
| Главная | `https://lk.rudn.ru/` | Дашборд с новостями |
| Персональные данные | `https://lk.rudn.ru/profile` | ФИО, дата рождения, контакты |
| Расписание | `https://lk.rudn.ru/schedule` | Расписание занятий (для студентов) |
| Мои документы | `https://lk.rudn.ru/documents` | Загруженные документы |
| Настройки | `https://lk.rudn.ru/settings` | Настройки профиля |

### 2.2 Меню профиля (dropdown)

При клике на имя пользователя в правом верхнем углу открывается меню:
- Персональные данные (`/profile`)
- Кадровые операции
- Е-диплом
- Настройки
- Выйти

---

## 3. Структура персональных данных

### 3.1 Доступные поля на странице `/profile`

```json
{
  "full_name": "Касымова Камилла Алишеровна",
  "last_name": "Касымова",
  "first_name": "Камилла", 
  "patronymic": "Алишеровна",
  "birth_date": "06.12.2007",
  "gender": "Женский",
  "phone": "+7 952 759 92 85",
  "email": "kasymovakamilla228@gmail.com",
  "citizenship": null
}
```

### 3.2 Дополнительные поля (для полных аккаунтов студентов)

⚠️ **Важно:** Тестовый аккаунт является **гостевым** (упрощённая учётная запись). Для полных студенческих аккаунтов доступны:

```json
{
  "student_id": "1032XXXXXX",
  "faculty": "Факультет физико-математических и естественных наук",
  "faculty_id": "XX",
  "group_name": "НПМбд-01-23",
  "group_id": "XXXX",
  "course": 2,
  "level": "Бакалавриат",
  "form": "Очная",
  "speciality": "Прикладная математика и информатика"
}
```

### 3.3 HTML-селекторы полей

```css
/* Форма персональных данных */
input[placeholder*="Фамилия"], input[name="lastName"]
input[placeholder*="Имя"], input[name="firstName"]  
input[placeholder*="Отчество"], input[name="patronymic"]
input[placeholder*="Дата рождения"], input[name="birthDate"]
input[placeholder*="Телефон"], input[name="phone"]
input[placeholder*="почта"], input[name="email"]

/* Dropdown пола */
select[name="gender"], div[class*="select"]

/* Для студенческих данных - поиск по тексту */
:text("Группа"), :text("Факультет"), :text("Курс")
```

---

## 4. Пример кода парсера (Python)

### 4.1 Зависимости

```python
# requirements.txt additions
playwright==1.40.0
cryptography==41.0.0
```

### 4.2 Класс парсера

```python
# backend/rudn_lk_parser.py

import asyncio
import os
from typing import Optional, Dict, Any
from playwright.async_api import async_playwright, Browser, Page
from cryptography.fernet import Fernet
import base64
import hashlib

class RUDNLKParser:
    """Парсер личного кабинета РУДН (lk.rudn.ru)"""
    
    # OAuth параметры
    OAUTH_URL = "https://id.rudn.ru/sign-in"
    CLIENT_ID = "b0db4756-9468-4a9e-b399-17b546b6ea88"
    REDIRECT_URI = "https://mobapp-api.rudn.ru/token-rudn-id"
    
    LK_BASE_URL = "https://lk.rudn.ru"
    PROFILE_URL = f"{LK_BASE_URL}/profile"
    
    def __init__(self, encryption_key: Optional[str] = None):
        """
        Инициализация парсера
        
        Args:
            encryption_key: Ключ для шифрования паролей (из .env)
        """
        self.encryption_key = encryption_key or os.getenv("LK_ENCRYPTION_KEY")
        if self.encryption_key:
            # Создаём Fernet ключ из строки
            key = hashlib.sha256(self.encryption_key.encode()).digest()
            self.fernet = Fernet(base64.urlsafe_b64encode(key))
        else:
            self.fernet = None
        
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
    
    def encrypt_password(self, password: str) -> str:
        """Шифрование пароля для хранения в БД"""
        if not self.fernet:
            raise ValueError("Encryption key not configured")
        return self.fernet.encrypt(password.encode()).decode()
    
    def decrypt_password(self, encrypted: str) -> str:
        """Расшифровка пароля из БД"""
        if not self.fernet:
            raise ValueError("Encryption key not configured")
        return self.fernet.decrypt(encrypted.encode()).decode()
    
    async def __aenter__(self):
        """Async context manager entry"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.page = await self.browser.new_page()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.browser:
            await self.browser.close()
    
    async def login(self, email: str, password: str) -> bool:
        """
        Авторизация в личном кабинете РУДН
        
        Args:
            email: Email или логин пользователя
            password: Пароль (незашифрованный)
            
        Returns:
            True если авторизация успешна
        """
        if not self.page:
            raise RuntimeError("Parser not initialized. Use async with.")
        
        try:
            # Шаг 1: Переход на OAuth страницу
            oauth_url = (
                f"{self.OAUTH_URL}?"
                f"client_id={self.CLIENT_ID}&"
                f"redirect_uri={self.REDIRECT_URI}&"
                f"response_type=code"
            )
            await self.page.goto(oauth_url)
            await self.page.wait_for_load_state("networkidle")
            
            # Шаг 2: Клик на "Продолжить" (если есть)
            try:
                continue_btn = self.page.locator('button:has-text("Продолжить")')
                if await continue_btn.count() > 0:
                    await continue_btn.click()
                    await self.page.wait_for_timeout(2000)
            except Exception:
                pass  # Кнопки может не быть
            
            # Шаг 3: Заполнение формы логина
            email_field = self.page.locator('input').first
            await email_field.fill(email)
            
            password_field = self.page.locator('input').nth(1)
            await password_field.fill(password)
            
            # Шаг 4: Клик "Войти"
            await self.page.click('button:has-text("Войти")')
            await self.page.wait_for_timeout(5000)
            await self.page.wait_for_load_state("networkidle")
            
            # Проверка успешности авторизации
            current_url = self.page.url
            return "lk.rudn.ru" in current_url
            
        except Exception as e:
            print(f"Login error: {e}")
            return False
    
    async def get_personal_data(self) -> Optional[Dict[str, Any]]:
        """
        Получение персональных данных из профиля
        
        Returns:
            Словарь с персональными данными или None
        """
        if not self.page:
            raise RuntimeError("Parser not initialized")
        
        try:
            # Переход на страницу профиля через меню
            # Клик на имя пользователя (dropdown)
            user_menu = self.page.locator('[class*="header"] >> text=/[А-Яа-я]+\\s+[А-Я]\\./')
            if await user_menu.count() > 0:
                await user_menu.click()
                await self.page.wait_for_timeout(1000)
            
            # Клик на "Персональные данные"
            await self.page.click('a:has-text("Персональные данные")')
            await self.page.wait_for_timeout(3000)
            await self.page.wait_for_load_state("networkidle")
            
            # Парсинг данных
            data = {}
            
            # ФИО из заголовка
            full_name_elem = self.page.locator('h1, h2, [class*="name"]').first
            if await full_name_elem.count() > 0:
                data["full_name"] = await full_name_elem.inner_text()
            
            # Поля формы
            inputs = await self.page.locator('input').all()
            for inp in inputs:
                placeholder = await inp.get_attribute('placeholder') or ""
                value = await inp.input_value()
                
                if "Фамилия" in placeholder:
                    data["last_name"] = value
                elif "Имя" in placeholder and "Отчество" not in placeholder:
                    data["first_name"] = value
                elif "Отчество" in placeholder:
                    data["patronymic"] = value
                elif "рождения" in placeholder.lower():
                    data["birth_date"] = value
                elif "Телефон" in placeholder:
                    data["phone"] = value
                elif "почта" in placeholder.lower():
                    data["email"] = value
            
            # Пол (может быть в select или div)
            gender_elem = self.page.locator('text=Женский, text=Мужской').first
            if await gender_elem.count() > 0:
                data["gender"] = await gender_elem.inner_text()
            
            # Данные студента (для полных аккаунтов)
            await self._parse_student_data(data)
            
            return data if data else None
            
        except Exception as e:
            print(f"Error getting personal data: {e}")
            return None
    
    async def _parse_student_data(self, data: Dict[str, Any]):
        """Парсинг студенческих данных (группа, факультет, курс)"""
        try:
            page_text = await self.page.locator('body').inner_text()
            
            # Поиск паттернов в тексте страницы
            import re
            
            # Группа (например: НПМбд-01-23)
            group_match = re.search(r'([А-Яа-я]{2,4}[бмБМ][дзДЗ]-\d{2}-\d{2})', page_text)
            if group_match:
                data["group_name"] = group_match.group(1)
            
            # Курс
            course_match = re.search(r'(\d)\s*курс', page_text, re.IGNORECASE)
            if course_match:
                data["course"] = int(course_match.group(1))
            
            # Факультет
            faculty_patterns = [
                r'Факультет\s+([^\n,]+)',
                r'Институт\s+([^\n,]+)',
            ]
            for pattern in faculty_patterns:
                faculty_match = re.search(pattern, page_text)
                if faculty_match:
                    data["faculty"] = faculty_match.group(1).strip()
                    break
                    
        except Exception as e:
            print(f"Error parsing student data: {e}")


# Пример использования
async def example_usage():
    async with RUDNLKParser() as parser:
        success = await parser.login(
            email="kasymovakamilla228@gmail.com",
            password="Kaskas06120700!"
        )
        
        if success:
            data = await parser.get_personal_data()
            print(f"Personal data: {data}")
        else:
            print("Login failed")


if __name__ == "__main__":
    asyncio.run(example_usage())
```

### 4.3 Модель данных (Pydantic)

```python
# Добавить в backend/models.py

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date

class LKCredentials(BaseModel):
    """Учётные данные для ЛК РУДН"""
    email: EmailStr
    encrypted_password: str  # Зашифрованный пароль
    
class LKPersonalData(BaseModel):
    """Персональные данные из ЛК РУДН"""
    full_name: Optional[str] = None
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    patronymic: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    citizenship: Optional[str] = None
    
    # Студенческие данные (для полных аккаунтов)
    student_id: Optional[str] = None
    faculty: Optional[str] = None
    faculty_id: Optional[str] = None
    group_name: Optional[str] = None
    group_id: Optional[str] = None
    course: Optional[int] = None
    level: Optional[str] = None  # Бакалавриат/Магистратура
    form: Optional[str] = None   # Очная/Заочная
    speciality: Optional[str] = None

class UserLKSettings(BaseModel):
    """Настройки ЛК пользователя в нашей БД"""
    telegram_id: int
    lk_email: Optional[EmailStr] = None
    lk_password_encrypted: Optional[str] = None
    lk_connected: bool = False
    lk_last_sync: Optional[str] = None
    lk_personal_data: Optional[LKPersonalData] = None
```

### 4.4 API Endpoints

```python
# Добавить в backend/server.py

from fastapi import HTTPException
from typing import Optional

# POST /api/lk/connect - Подключение ЛК
@api_router.post("/lk/connect")
async def connect_lk(
    telegram_id: int,
    email: str,
    password: str
):
    """
    Подключение личного кабинета РУДН к аккаунту пользователя
    """
    parser = RUDNLKParser()
    
    try:
        async with parser:
            # Проверяем авторизацию
            success = await parser.login(email, password)
            
            if not success:
                raise HTTPException(
                    status_code=401, 
                    detail="Неверный логин или пароль ЛК РУДН"
                )
            
            # Получаем персональные данные
            personal_data = await parser.get_personal_data()
            
            # Шифруем пароль для хранения
            encrypted_password = parser.encrypt_password(password)
            
            # Сохраняем в БД
            await db.user_settings.update_one(
                {"telegram_id": telegram_id},
                {
                    "$set": {
                        "lk_email": email,
                        "lk_password_encrypted": encrypted_password,
                        "lk_connected": True,
                        "lk_last_sync": datetime.utcnow().isoformat(),
                        "lk_personal_data": personal_data
                    }
                },
                upsert=True
            )
            
            return {
                "success": True,
                "message": "ЛК РУДН успешно подключен",
                "personal_data": personal_data
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# GET /api/lk/data/{telegram_id} - Получение данных из ЛК
@api_router.get("/lk/data/{telegram_id}")
async def get_lk_data(telegram_id: int, refresh: bool = False):
    """
    Получение данных из ЛК РУДН
    
    Args:
        telegram_id: ID пользователя Telegram
        refresh: Обновить данные с сайта (иначе из кэша)
    """
    user = await db.user_settings.find_one({"telegram_id": telegram_id})
    
    if not user or not user.get("lk_connected"):
        raise HTTPException(
            status_code=404, 
            detail="ЛК РУДН не подключен"
        )
    
    if not refresh and user.get("lk_personal_data"):
        return {
            "personal_data": user["lk_personal_data"],
            "last_sync": user.get("lk_last_sync"),
            "cached": True
        }
    
    # Обновляем данные с сайта
    parser = RUDNLKParser()
    
    try:
        async with parser:
            password = parser.decrypt_password(user["lk_password_encrypted"])
            success = await parser.login(user["lk_email"], password)
            
            if not success:
                # Пароль изменился
                await db.user_settings.update_one(
                    {"telegram_id": telegram_id},
                    {"$set": {"lk_connected": False}}
                )
                raise HTTPException(
                    status_code=401, 
                    detail="Сессия ЛК истекла. Переподключите аккаунт."
                )
            
            personal_data = await parser.get_personal_data()
            
            # Обновляем кэш
            await db.user_settings.update_one(
                {"telegram_id": telegram_id},
                {
                    "$set": {
                        "lk_last_sync": datetime.utcnow().isoformat(),
                        "lk_personal_data": personal_data
                    }
                }
            )
            
            return {
                "personal_data": personal_data,
                "last_sync": datetime.utcnow().isoformat(),
                "cached": False
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# DELETE /api/lk/disconnect/{telegram_id} - Отключение ЛК
@api_router.delete("/lk/disconnect/{telegram_id}")
async def disconnect_lk(telegram_id: int):
    """Отключение ЛК РУДН от аккаунта"""
    result = await db.user_settings.update_one(
        {"telegram_id": telegram_id},
        {
            "$unset": {
                "lk_email": "",
                "lk_password_encrypted": "",
                "lk_personal_data": ""
            },
            "$set": {
                "lk_connected": False
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return {"success": True, "message": "ЛК РУДН отключен"}
```

---

## 5. Схема БД

### 5.1 Расширение коллекции `user_settings`

```javascript
// Новые поля в user_settings
{
  telegram_id: 123456789,
  // ... существующие поля ...
  
  // Данные ЛК РУДН
  lk_email: "student@gmail.com",
  lk_password_encrypted: "gAAAAA...",  // AES-256 зашифрованный
  lk_connected: true,
  lk_last_sync: "2025-01-08T19:56:00Z",
  lk_personal_data: {
    full_name: "Касымова Камилла Алишеровна",
    last_name: "Касымова",
    first_name: "Камилла",
    patronymic: "Алишеровна",
    birth_date: "06.12.2007",
    gender: "Женский",
    phone: "+7 952 759 92 85",
    email: "kasymovakamilla228@gmail.com",
    // Для студентов:
    group_name: "НПМбд-01-23",
    faculty: "Факультет физико-математических наук",
    course: 2
  }
}
```

### 5.2 Индексы

```javascript
db.user_settings.createIndex({ "lk_email": 1 }, { sparse: true })
db.user_settings.createIndex({ "lk_connected": 1 })
```

---

## 6. Безопасность

### 6.1 Шифрование паролей

```python
# .env
LK_ENCRYPTION_KEY="your-secret-encryption-key-32chars"

# Алгоритм: AES-256 через Fernet (cryptography library)
# Ключ: SHA-256 hash от LK_ENCRYPTION_KEY
```

### 6.2 Рекомендации

1. **Никогда** не логировать пароли в открытом виде
2. Использовать HTTPS для всех запросов
3. Хранить `LK_ENCRYPTION_KEY` только в `.env`
4. Регулярно менять encryption key (с миграцией данных)
5. Ограничить частоту запросов к ЛК (rate limiting)

---

## 7. Ограничения

### 7.1 Гостевые аккаунты

- Тестовый аккаунт является **гостевым**
- Гостевые аккаунты НЕ имеют данных о группе, факультете, курсе
- Для полного парсинга нужен **студенческий аккаунт**

### 7.2 Технические ограничения

| Ограничение | Описание |
|-------------|----------|
| Rate limit | Не более 10 запросов в минуту на пользователя |
| Session timeout | Сессия истекает через ~30 минут |
| CAPTCHA | Может появиться при частых запросах |
| 2FA | Некоторые аккаунты могут требовать 2FA |

### 7.3 TODO для полной реализации

- [ ] Тестирование со студенческим аккаунтом (не гостевым)
- [ ] Парсинг расписания из ЛК
- [ ] Обработка CAPTCHA
- [ ] Поддержка 2FA
- [ ] Автоматическая синхронизация по расписанию

---

## 8. Frontend компонент

### 8.1 React компонент для подключения ЛК

```jsx
// frontend/src/components/LKConnectionModal.jsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../services/api';

const LKConnectionModal = ({ isOpen, onClose, telegramId, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/lk/connect', {
        telegram_id: telegramId,
        email,
        password
      });

      setSuccess(true);
      if (onSuccess) {
        onSuccess(response.data.personal_data);
      }
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка подключения');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-800 rounded-2xl p-6 w-full max-w-md"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">
              Подключение ЛК РУДН
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={24} />
            </button>
          </div>

          {success ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-white text-lg">ЛК успешно подключен!</p>
            </div>
          ) : (
            <form onSubmit={handleConnect}>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">
                    Email или логин RUDN ID
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="your.email@gmail.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1 block">
                    Пароль
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-xl">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                  </div>
                )}

                <p className="text-gray-500 text-xs">
                  🔒 Ваш пароль будет зашифрован и храниться в безопасности.
                  Мы используем его только для получения данных из ЛК.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Подключение...
                    </>
                  ) : (
                    'Подключить ЛК'
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LKConnectionModal;
```

---

## 9. Тестирование

### 9.1 Тестовые данные

```python
TEST_CREDENTIALS = {
    "email": "kasymovakamilla228@gmail.com",
    "password": "Kaskas06120700!",
    "account_type": "guest",  # Гостевой аккаунт
    "expected_data": {
        "full_name": "Касымова Камилла Алишеровна",
        "last_name": "Касымова",
        "first_name": "Камилла",
        "patronymic": "Алишеровна",
        "birth_date": "06.12.2007",
        "phone": "+7 952 759 92 85"
    }
}
```

### 9.2 Unit тесты

```python
# tests/test_lk_parser.py

import pytest
from backend.rudn_lk_parser import RUDNLKParser

@pytest.mark.asyncio
async def test_login_success():
    async with RUDNLKParser() as parser:
        result = await parser.login(
            "kasymovakamilla228@gmail.com",
            "Kaskas06120700!"
        )
        assert result is True

@pytest.mark.asyncio
async def test_login_failure():
    async with RUDNLKParser() as parser:
        result = await parser.login(
            "wrong@email.com",
            "wrongpassword"
        )
        assert result is False

@pytest.mark.asyncio
async def test_get_personal_data():
    async with RUDNLKParser() as parser:
        await parser.login(
            "kasymovakamilla228@gmail.com",
            "Kaskas06120700!"
        )
        data = await parser.get_personal_data()
        
        assert data is not None
        assert data.get("last_name") == "Касымова"
        assert data.get("first_name") == "Камилла"
```

---

## 10. Заключение

Парсер личного кабинета РУДН готов к реализации. Основные компоненты:

1. ✅ OAuth авторизация через RUDN ID
2. ✅ Парсинг персональных данных
3. ✅ Шифрование паролей (AES-256)
4. ✅ API endpoints для интеграции
5. ✅ Frontend компонент

**Прогресс реализации:**
1. ✅ Установить зависимости (`playwright`, `cryptography`) - ГОТОВО
2. ✅ Добавить `LK_ENCRYPTION_KEY` в `.env` - ГОТОВО
3. ✅ Реализовать парсер в `backend/lk_parser.py` - ГОТОВО
4. ✅ Добавить модели в `models.py` - ГОТОВО
5. ✅ Добавить API endpoints в `server.py` - ГОТОВО
6. ✅ Создать frontend компонент `LKConnectionModal.jsx` - ГОТОВО
7. ✅ Добавить кнопку подключения ЛК в `ProfileModal.jsx` (Настройки) - ГОТОВО
8. ⬜ Протестировать со студенческим аккаунтом (не гостевым)
