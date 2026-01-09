# backend/rudn_lk_parser.py
"""
Парсер личного кабинета РУДН (lk.rudn.ru)
OAuth 2.0 авторизация через RUDN ID (id.rudn.ru)
"""

import asyncio
import os
import re
import logging
from typing import Optional, Dict, Any
from playwright.async_api import async_playwright, Browser, Page, Playwright
from cryptography.fernet import Fernet
import base64
import hashlib

logger = logging.getLogger(__name__)


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
        
        self._playwright: Optional[Playwright] = None
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
        self._playwright = await async_playwright().start()
        self.browser = await self._playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        self.page = await self.browser.new_page()
        # Устанавливаем user-agent для лучшей совместимости
        await self.page.set_extra_http_headers({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
        if self._playwright:
            await self._playwright.stop()
    
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
            logger.info(f"Начало авторизации для {email}")
            
            # Шаг 1: Переход на OAuth страницу
            oauth_url = (
                f"{self.OAUTH_URL}?"
                f"client_id={self.CLIENT_ID}&"
                f"redirect_uri={self.REDIRECT_URI}&"
                f"response_type=code"
            )
            
            logger.debug(f"Переход на OAuth URL: {oauth_url}")
            await self.page.goto(oauth_url, wait_until="networkidle", timeout=60000)
            await self.page.wait_for_timeout(3000)
            
            logger.debug(f"Текущий URL: {self.page.url}")
            
            # Шаг 2: Клик на "Продолжить" (если есть welcome-страница)
            try:
                continue_btn = self.page.locator('button:has-text("Продолжить")')
                if await continue_btn.count() > 0:
                    logger.debug("Найдена кнопка 'Продолжить', кликаем")
                    await continue_btn.click()
                    await self.page.wait_for_timeout(5000)
                    await self.page.wait_for_load_state("networkidle", timeout=30000)
                    logger.debug(f"URL после клика Продолжить: {self.page.url}")
            except Exception as e:
                logger.debug(f"Кнопка 'Продолжить' не найдена или ошибка: {e}")
            
            # Шаг 3: Заполнение формы логина
            logger.debug("Заполнение формы логина")
            
            # Ищем поля ввода с обновленными селекторами
            # id.rudn.ru использует класс .loginNameInput для email
            email_selectors = [
                'input.loginNameInput',
                'input[placeholder*="почта"]',
                'input[placeholder*="телефон"]',
                'input[type="email"]',
                'input[type="text"]'
            ]
            
            email_field = None
            for selector in email_selectors:
                locator = self.page.locator(selector).first
                if await locator.count() > 0:
                    email_field = locator
                    logger.debug(f"Найдено поле email с селектором: {selector}")
                    break
            
            if not email_field:
                logger.error("Поле email не найдено!")
                return False
            
            await email_field.fill(email)
            await self.page.wait_for_timeout(500)
            
            # Поле пароля
            password_field = self.page.locator('input[type="password"]').first
            if await password_field.count() == 0:
                logger.error("Поле пароля не найдено!")
                return False
                
            await password_field.fill(password)
            await self.page.wait_for_timeout(500)
            
            # Шаг 4: Клик "Войти"
            logger.debug("Клик на кнопку 'Войти'")
            login_btn = self.page.locator('button:has-text("Войти")').first
            if await login_btn.count() == 0:
                login_btn = self.page.locator('button[type="submit"]').first
            
            await login_btn.click()
            
            # Ожидаем редирект (может занять время)
            await self.page.wait_for_timeout(7000)
            
            try:
                await self.page.wait_for_load_state("networkidle", timeout=30000)
            except Exception:
                pass  # Может быть таймаут, но страница уже загружена
            
            # Проверка успешности авторизации
            current_url = self.page.url
            logger.info(f"Текущий URL после логина: {current_url}")
            
            # Проверяем, что мы на lk.rudn.ru
            if "lk.rudn.ru" in current_url:
                logger.info("Авторизация успешна - на lk.rudn.ru")
                return True
            
            # Проверяем на ошибки авторизации
            try:
                error_elem = self.page.locator('[class*="error"], [class*="Error"], :text("неверн")')
                if await error_elem.count() > 0:
                    error_text = await error_elem.first.inner_text()
                    logger.error(f"Ошибка авторизации: {error_text}")
                    return False
            except Exception:
                pass
            
            # Если URL содержит id.rudn.ru, возможно еще идет редирект
            if "id.rudn.ru" in current_url:
                logger.warning("Остались на id.rudn.ru - возможно неверные данные")
                return False
            
            return False
            
        except Exception as e:
            logger.error(f"Login error: {e}")
            import traceback
            logger.error(traceback.format_exc())
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
            logger.info("Получение персональных данных")
            
            # Переход на страницу профиля
            # Сначала пробуем через меню
            try:
                # Клик на имя пользователя (dropdown)
                user_menu = self.page.locator('[class*="header"] [class*="user"], [class*="profile"], [class*="avatar"]').first
                if await user_menu.count() > 0:
                    await user_menu.click()
                    await self.page.wait_for_timeout(1000)
                
                # Клик на "Персональные данные"
                personal_link = self.page.locator('a:has-text("Персональные данные"), a[href="/profile"]').first
                if await personal_link.count() > 0:
                    await personal_link.click()
                    await self.page.wait_for_timeout(3000)
            except Exception as e:
                logger.debug(f"Не удалось перейти через меню, пробуем прямой URL: {e}")
                await self.page.goto(self.PROFILE_URL, wait_until="networkidle", timeout=30000)
            
            await self.page.wait_for_load_state("networkidle")
            await self.page.wait_for_timeout(2000)
            
            # Парсинг данных
            data = {}
            
            # Поля формы (парсим сначала для сборки ФИО)
            inputs = await self.page.locator('input').all()
            for inp in inputs:
                try:
                    placeholder = await inp.get_attribute('placeholder') or ""
                    name_attr = await inp.get_attribute('name') or ""
                    value = await inp.input_value()
                    
                    if not value:
                        continue
                    
                    if "Фамилия" in placeholder or "lastName" in name_attr:
                        data["last_name"] = value
                    elif ("Имя" in placeholder or "firstName" in name_attr) and "Отчество" not in placeholder:
                        data["first_name"] = value
                    elif "Отчество" in placeholder or "patronymic" in name_attr:
                        data["patronymic"] = value
                    elif "рождения" in placeholder.lower() or "birthDate" in name_attr:
                        data["birth_date"] = value
                    elif "Телефон" in placeholder or "phone" in name_attr:
                        data["phone"] = value
                    elif "почта" in placeholder.lower() or "email" in name_attr:
                        data["email"] = value
                except Exception as e:
                    logger.debug(f"Ошибка парсинга input: {e}")
            
            # Пол (может быть в select или div)
            try:
                gender_elem = self.page.locator(':text("Женский"), :text("Мужской")').first
                if await gender_elem.count() > 0:
                    gender = await gender_elem.inner_text()
                    if "Женский" in gender:
                        data["gender"] = "Женский"
                    elif "Мужской" in gender:
                        data["gender"] = "Мужской"
            except Exception:
                pass
            
            # Данные студента (для полных аккаунтов)
            await self._parse_student_data(data)
            
            logger.info(f"Получены данные: {list(data.keys())}")
            return data if data else None
            
        except Exception as e:
            logger.error(f"Error getting personal data: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None
    
    async def _parse_student_data(self, data: Dict[str, Any]):
        """Парсинг студенческих данных (группа, факультет, курс)"""
        try:
            page_text = await self.page.locator('body').inner_text()
            
            # Группа (например: НПМбд-01-23, ИВТбд-02-22)
            group_patterns = [
                r'([А-Яа-я]{2,6}[бмБМ][дзДЗвВ]-\d{2}-\d{2})',  # НПМбд-01-23
                r'([А-Яа-я]{2,6}-\d{2}-\d{2})',  # ИВТ-01-23
            ]
            for pattern in group_patterns:
                group_match = re.search(pattern, page_text)
                if group_match:
                    data["group_name"] = group_match.group(1)
                    break
            
            # Курс
            course_match = re.search(r'(\d)\s*курс', page_text, re.IGNORECASE)
            if course_match:
                data["course"] = int(course_match.group(1))
            
            # Факультет
            faculty_patterns = [
                r'Факультет\s+([^\n,]+)',
                r'Институт\s+([^\n,]+)',
                r'Академия\s+([^\n,]+)',
            ]
            for pattern in faculty_patterns:
                faculty_match = re.search(pattern, page_text)
                if faculty_match:
                    data["faculty"] = faculty_match.group(1).strip()
                    break
            
            # Уровень образования
            level_patterns = ['Бакалавриат', 'Магистратура', 'Аспирантура', 'Специалитет']
            for level in level_patterns:
                if level.lower() in page_text.lower():
                    data["level"] = level
                    break
            
            # Форма обучения
            form_patterns = [('Очная', 'Очная'), ('Очно-заочная', 'Очно-заочная'), ('Заочная', 'Заочная')]
            for pattern, form_name in form_patterns:
                if pattern.lower() in page_text.lower():
                    data["form"] = form_name
                    break
                    
        except Exception as e:
            logger.error(f"Error parsing student data: {e}")


async def test_parser():
    """Тестовая функция для проверки парсера"""
    async with RUDNLKParser() as parser:
        success = await parser.login(
            email="kasymovakamilla228@gmail.com",
            password="Kaskas06120700!"
        )
        
        if success:
            print("✅ Авторизация успешна!")
            data = await parser.get_personal_data()
            print(f"📋 Персональные данные: {data}")
        else:
            print("❌ Ошибка авторизации")


if __name__ == "__main__":
    asyncio.run(test_parser())
