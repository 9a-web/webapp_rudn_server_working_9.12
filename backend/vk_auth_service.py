"""
VK Auth Service - Сервис авторизации VK для получения Kate Mobile токена

Позволяет пользователям авторизоваться через логин/пароль VK
и получить токен с доступом к аудио API.

Flow авторизации с 2FA:
1. Пользователь вводит логин и пароль
2. Вызываем get_kate_token(login, password) с auth_code='GET_CODE' (по умолчанию)
   - Это добавляет force_sms=1 в запрос, VK пытается отправить SMS
3. Если требуется 2FA - получаем TokenException с кодом TWOFA_REQ
   - В extra содержится validation_sid, phone_mask и т.д.
4. Возвращаем пользователю needs_2fa=True с phone_mask
5. Пользователь вводит код из SMS
6. Вызываем get_kate_token(login, password, auth_code=code)
   - auth_code - это третий позиционный аргумент!
7. Получаем токен
"""
import logging
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
from vkaudiotoken import get_kate_token, get_vk_official_token, TwoFAHelper, TokenException
import requests

logger = logging.getLogger(__name__)

# User-Agent для Kate Mobile
KATE_USER_AGENT = "KateMobileAndroid/93 lite-530 (Android 10; SDK 29; arm64-v8a; Xiaomi Redmi Note 8 Pro; ru)"


class VKAuthError(Exception):
    """Ошибка авторизации VK"""
    def __init__(self, message: str, error_code: str = "auth_error", needs_2fa: bool = False, 
                 captcha_data: dict = None, twofa_data: dict = None):
        self.message = message
        self.error_code = error_code
        self.needs_2fa = needs_2fa
        self.captcha_data = captcha_data
        self.twofa_data = twofa_data  # Данные о 2FA: phone_mask, validation_sid и т.д.
        super().__init__(message)


class VKAuthService:
    """Сервис авторизации VK"""
    
    def __init__(self):
        self._pending_2fa = {}  # Хранение сессий, ожидающих 2FA
    
    async def authenticate(
        self, 
        login: str, 
        password: str,
        two_fa_code: Optional[str] = None,
        captcha_key: Optional[str] = None,
        captcha_sid: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Авторизация через VK и получение Kate Mobile токена.
        
        Args:
            login: Телефон, email или логин VK
            password: Пароль от аккаунта VK
            two_fa_code: Код двухфакторной аутентификации (если требуется)
            captcha_key: Ответ на капчу (если требуется)
            captcha_sid: ID капчи (если требуется)
        
        Returns:
            Dict с token, user_id, user_agent
        
        Raises:
            VKAuthError: При ошибке авторизации
        """
        try:
            logger.info(f"Attempting VK auth for login: {login[:3]}***")
            
            # Формируем kwargs для vkaudiotoken
            kwargs = {}
            
            if two_fa_code:
                kwargs['code'] = two_fa_code
                logger.info("Using 2FA code")
            
            if captcha_key and captcha_sid:
                kwargs['captcha_key'] = captcha_key
                kwargs['captcha_sid'] = captcha_sid
                logger.info("Using captcha solution")
            
            # Получаем токен Kate Mobile
            result = get_kate_token(login, password, **kwargs)
            
            if not result or 'token' not in result:
                raise VKAuthError("Не удалось получить токен", "token_error")
            
            token = result['token']
            user_agent = result.get('user_agent', KATE_USER_AGENT)
            
            # Получаем user_id через API VK
            user_id = await self._get_user_id(token)
            
            logger.info(f"VK auth successful for user_id: {user_id}")
            
            return {
                "token": token,
                "user_id": user_id,
                "user_agent": user_agent,
                "authenticated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            error_msg = str(e).lower()
            logger.error(f"VK auth error: {e}")
            
            # Проверяем тип ошибки
            if "need_validation" in error_msg or "2fa" in error_msg or "code" in error_msg:
                raise VKAuthError(
                    "Требуется код подтверждения (2FA)",
                    "need_2fa",
                    needs_2fa=True
                )
            
            if "captcha" in error_msg:
                # Парсим данные капчи из ошибки
                captcha_data = self._parse_captcha_error(str(e))
                raise VKAuthError(
                    "Требуется ввод капчи",
                    "need_captcha",
                    captcha_data=captcha_data
                )
            
            if "invalid" in error_msg or "password" in error_msg or "wrong" in error_msg:
                raise VKAuthError(
                    "Неверный логин или пароль",
                    "invalid_credentials"
                )
            
            if "blocked" in error_msg or "ban" in error_msg:
                raise VKAuthError(
                    "Аккаунт заблокирован",
                    "account_blocked"
                )
            
            if "flood" in error_msg or "too many" in error_msg:
                raise VKAuthError(
                    "Слишком много попыток. Попробуйте позже",
                    "rate_limit"
                )
            
            raise VKAuthError(f"Ошибка авторизации: {str(e)}", "unknown_error")
    
    async def _get_user_id(self, token: str) -> int:
        """Получение user_id через VK API"""
        try:
            response = requests.get(
                "https://api.vk.com/method/users.get",
                params={
                    "access_token": token,
                    "v": "5.131"
                },
                headers={"User-Agent": KATE_USER_AGENT},
                timeout=10
            )
            data = response.json()
            
            if "response" in data and len(data["response"]) > 0:
                return data["response"][0]["id"]
            
            return 0
        except Exception as e:
            logger.error(f"Error getting user_id: {e}")
            return 0
    
    def _parse_captcha_error(self, error: str) -> Optional[dict]:
        """Парсинг данных капчи из ошибки"""
        # Попытка извлечь captcha_sid и captcha_img из сообщения об ошибке
        captcha_data = {}
        
        import re
        sid_match = re.search(r'captcha_sid["\']?\s*[:=]\s*["\']?(\d+)', error)
        img_match = re.search(r'captcha_img["\']?\s*[:=]\s*["\']?(https?://[^\s"\']+)', error)
        
        if sid_match:
            captcha_data['sid'] = sid_match.group(1)
        if img_match:
            captcha_data['img'] = img_match.group(1)
        
        return captcha_data if captcha_data else None
    
    async def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Проверка валидности токена VK.
        
        Returns:
            Dict с информацией о пользователе или ошибкой
        """
        try:
            response = requests.get(
                "https://api.vk.com/method/users.get",
                params={
                    "access_token": token,
                    "fields": "photo_100,first_name,last_name",
                    "v": "5.131"
                },
                headers={"User-Agent": KATE_USER_AGENT},
                timeout=10
            )
            data = response.json()
            
            if "error" in data:
                error = data["error"]
                return {
                    "valid": False,
                    "error": error.get("error_msg", "Unknown error"),
                    "error_code": error.get("error_code", 0)
                }
            
            if "response" in data and len(data["response"]) > 0:
                user = data["response"][0]
                return {
                    "valid": True,
                    "user_id": user.get("id"),
                    "first_name": user.get("first_name"),
                    "last_name": user.get("last_name"),
                    "photo": user.get("photo_100")
                }
            
            return {"valid": False, "error": "Empty response"}
            
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            return {"valid": False, "error": str(e)}
    
    async def test_audio_access(self, token: str) -> Dict[str, Any]:
        """
        Проверка доступа токена к аудио API.
        
        Returns:
            Dict с результатом проверки
        """
        try:
            response = requests.get(
                "https://api.vk.com/method/audio.get",
                params={
                    "access_token": token,
                    "count": 1,
                    "v": "5.131"
                },
                headers={"User-Agent": KATE_USER_AGENT},
                timeout=10
            )
            data = response.json()
            
            if "error" in data:
                error = data["error"]
                error_code = error.get("error_code", 0)
                
                # Error 15 = Access denied (нет доступа к аудио)
                if error_code == 15:
                    return {
                        "has_access": False,
                        "error": "Токен не имеет доступа к аудио API",
                        "suggestion": "Используйте токен от Kate Mobile или VK Admin"
                    }
                
                return {
                    "has_access": False,
                    "error": error.get("error_msg", "Unknown error")
                }
            
            return {
                "has_access": True,
                "audio_count": data.get("response", {}).get("count", 0)
            }
            
        except Exception as e:
            logger.error(f"Audio access test error: {e}")
            return {"has_access": False, "error": str(e)}


# Singleton instance
vk_auth_service = VKAuthService()
