# Test Credentials for RUDN Schedule App

Stage 3 не создаёт никаких seed-аккаунтов заранее. Testing агент должен создавать тестовых пользователей сам через POST /api/auth/register/email.

Пример последовательности:
- Регистрация: POST /api/auth/register/email { email: "test_stage3_{random}@test.com", password: "test123456", first_name: "Test" }
- Получить token из ответа → класть в Authorization: Bearer {token}
- Логин повторный: POST /api/auth/login/email { email, password }
- /api/auth/me возвращает UserPublic с uid (9-digit numeric)

Для rate-limit теста регистрируйте 6+ пользователей быстро подряд с разными email — на 6-м должен вернуть 429.
