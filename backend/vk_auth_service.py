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
            
            # Определяем auth_code для vkaudiotoken:
            # - 'GET_CODE' (по умолчанию) - запросить отправку SMS
            # - <код> - передать введённый пользователем код
            auth_code = two_fa_code if two_fa_code else 'GET_CODE'
            
            if two_fa_code:
                logger.info(f"Using 2FA code: {two_fa_code[:2]}****")
            
            # Получаем токен Kate Mobile
            # ВАЖНО: auth_code - это третий позиционный аргумент!
            result = get_kate_token(login, password, auth_code)
            
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
            
        except TokenException as e:
            logger.error(f"VK TokenException: code={e.code}, extra={e.extra}")
            
            # TWOFA_REQ = 4 - требуется 2FA
            if e.code == TokenException.TWOFA_REQ:
                extra = e.extra or {}
                phone_mask = extra.get('phone_mask', '')
                validation_sid = extra.get('validation_sid', '')
                validation_type = extra.get('validation_type', 'sms')
                
                # Формируем понятное сообщение с маской телефона
                if phone_mask:
                    message = f"Код подтверждения отправлен на {phone_mask}"
                else:
                    message = "Требуется код подтверждения (2FA)"
                
                logger.info(f"2FA required: phone_mask={phone_mask}, validation_type={validation_type}")
                
                raise VKAuthError(
                    message=message,
                    error_code="need_2fa",
                    needs_2fa=True,
                    twofa_data={
                        "phone_mask": phone_mask,
                        "validation_sid": validation_sid,
                        "validation_type": validation_type
                    }
                )
            
            # TWOFA_ERR = 5 - ошибка 2FA (неверный код)
            if e.code == TokenException.TWOFA_ERR:
                raise VKAuthError(
                    message="Неверный код подтверждения. Проверьте код и попробуйте снова.",
                    error_code="invalid_2fa_code",
                    needs_2fa=True  # Остаёмся в режиме ввода кода
                )
            
            # REGISTRATION_ERROR = 0
            if e.code == TokenException.REGISTRATION_ERROR:
                raise VKAuthError(
                    message="Ошибка регистрации устройства. Попробуйте позже.",
                    error_code="registration_error"
                )
            
            # TOKEN_NOT_RECEIVED = 2 - не удалось получить токен
            if e.code == TokenException.TOKEN_NOT_RECEIVED:
                extra = e.extra or {}
                error_desc = extra.get('error_description', extra.get('error', 'Unknown'))
                
                # Проверяем конкретные ошибки
                if 'invalid_client' in str(error_desc).lower():
                    raise VKAuthError("Неверный логин или пароль", "invalid_credentials")
                if 'captcha' in str(error_desc).lower():
                    captcha_data = self._parse_captcha_from_extra(extra)
                    raise VKAuthError("Требуется ввод капчи", "need_captcha", captcha_data=captcha_data)
                
                raise VKAuthError(f"Ошибка авторизации: {error_desc}", "token_error")
            
            # Остальные ошибки
            raise VKAuthError(f"Ошибка авторизации VK: {str(e)}", "unknown_error")
            
        except Exception as e:
            error_msg = str(e).lower()
            logger.error(f"VK auth error: {e}")
            
            # Проверяем тип ошибки по тексту (fallback)
            if "need_validation" in error_msg or "two factor" in error_msg:
                raise VKAuthError(
                    "Требуется код подтверждения (2FA)",
                    "need_2fa",
                    needs_2fa=True
                )
            
            if "captcha" in error_msg:
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
        """Получение user_id через VK API (async)"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://api.vk.com/method/users.get",
                    params={"access_token": token, "v": "5.131"},
                    headers={"User-Agent": KATE_USER_AGENT},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    data = await resp.json()
            
            if "response" in data and len(data["response"]) > 0:
                return data["response"][0]["id"]
            
            return 0
        except Exception as e:
            logger.error(f"Error getting user_id: {e}")
            return 0
    
    def _parse_captcha_error(self, error: str) -> Optional[dict]:
        """Парсинг данных капчи из строки ошибки"""
        captcha_data = {}
        
        import re
        sid_match = re.search(r'captcha_sid["\']?\s*[:=]\s*["\']?(\d+)', error)
        img_match = re.search(r'captcha_img["\']?\s*[:=]\s*["\']?(https?://[^\s"\']+)', error)
        
        if sid_match:
            captcha_data['sid'] = sid_match.group(1)
        if img_match:
            captcha_data['img'] = img_match.group(1)
        
        return captcha_data if captcha_data else None
    
    def _parse_captcha_from_extra(self, extra: dict) -> Optional[dict]:
        """Парсинг данных капчи из extra TokenException"""
        if not extra:
            return None
        
        captcha_data = {}
        
        if 'captcha_sid' in extra:
            captcha_data['sid'] = extra['captcha_sid']
        if 'captcha_img' in extra:
            captcha_data['img'] = extra['captcha_img']
        
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
