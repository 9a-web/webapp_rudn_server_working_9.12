"""
Standalone-тест SMTP отправки.
Запуск:  cd /app/backend && python test_smtp_send.py <to_email>
"""
import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# Подгружаем .env из /app/backend/.env
load_dotenv(Path(__file__).parent / ".env")

from email_service import send_email, is_email_configured, template_password_reset, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM, SMTP_FROM_NAME, SMTP_USE_TLS


async def main() -> None:
    to = sys.argv[1] if len(sys.argv) > 1 else "noreply@rudn-schedule.ru"

    print("=" * 60)
    print("SMTP configuration:")
    print(f"  HOST        = {SMTP_HOST}")
    print(f"  PORT        = {SMTP_PORT}")
    print(f"  USER        = {SMTP_USER}")
    print(f"  FROM        = {SMTP_FROM}")
    print(f"  FROM_NAME   = {SMTP_FROM_NAME}")
    print(f"  USE_TLS     = {SMTP_USE_TLS}  (false = direct SSL on 465)")
    print(f"  is_email_configured = {is_email_configured()}")
    print("=" * 60)
    print(f"→ Отправляю тестовое письмо на {to} ...")

    subj, html, text = template_password_reset(
        reset_url="https://rudn-schedule.ru/reset?token=TEST_TOKEN_123",
        user_name="Test User",
    )
    # Маркер, что это тест
    subj = "[TEST] " + subj
    ok = await send_email(to, subj, html, text)
    print(f"send_email returned: {ok}")


if __name__ == "__main__":
    asyncio.run(main())
