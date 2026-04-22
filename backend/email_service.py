"""
📧 Email Service — SMTP отправка писем (password reset, email verification, ...).

Дизайн:
- Реальная отправка через `aiosmtplib` с STARTTLS/SSL.
- Если SMTP_* переменные не заданы — работает в режиме LOG_ONLY:
  письма пишутся в `/app/logs/emails.log` и в stdout. Это позволяет
  тестировать flow без реального SMTP и показывать токен в DEV.

ENV-переменные (все опциональные — fallback к LOG_ONLY):
- SMTP_HOST        (e.g. smtp.yandex.ru, smtp.gmail.com)
- SMTP_PORT        (465 для SSL, 587 для STARTTLS)
- SMTP_USER        (логин для auth, обычно email)
- SMTP_PASSWORD    (пароль приложения)
- SMTP_FROM        (email отправителя, по умолчанию SMTP_USER)
- SMTP_FROM_NAME   (человекочитаемое имя, по умолчанию "RUDN Go")
- SMTP_USE_TLS     ("true" = STARTTLS, "false" = SSL on 465)
- SMTP_TIMEOUT     (секунды, default 15)
"""

from __future__ import annotations

import os
import logging
import ssl
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional

try:
    import aiosmtplib  # type: ignore
    _HAS_AIOSMTPLIB = True
except ImportError:
    _HAS_AIOSMTPLIB = False

logger = logging.getLogger(__name__)

# ==================== КОНФИГ ====================

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587") or "587")
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "").strip() or SMTP_USER
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "RUDN Go").strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes", "on")
SMTP_TIMEOUT = int(os.getenv("SMTP_TIMEOUT", "15") or "15")

# public base URL для ссылок в письмах
PUBLIC_BASE_URL = (
    os.getenv("PUBLIC_BASE_URL", "").strip()
    or os.getenv("REACT_APP_BACKEND_URL", "").strip()
    or "https://rudn-schedule.ru"
).rstrip("/")

LOG_DIR = Path("/app/logs")
EMAIL_LOG_FILE = LOG_DIR / "emails.log"


def _smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD and SMTP_FROM)


def is_email_configured() -> bool:
    """Публичный флаг: True = реальная отправка; False = LOG_ONLY."""
    return _HAS_AIOSMTPLIB and _smtp_configured()


def _log_email_to_file(to_email: str, subject: str, body_text: str, body_html: Optional[str]) -> None:
    """Запись письма в файл + stdout в dev-режиме."""
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(timezone.utc).isoformat()
        sep = "=" * 72
        entry = (
            f"\n{sep}\n[{ts}] TO: {to_email}\nSUBJECT: {subject}\n{sep}\n"
            f"{body_text}\n"
            f"--- HTML ---\n{body_html or '(none)'}\n{sep}\n"
        )
        with EMAIL_LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(entry)
        logger.warning(
            f"📧 [LOG_ONLY] Email для {to_email} записан в {EMAIL_LOG_FILE} "
            f"(SMTP не настроен — задайте SMTP_* в backend/.env)"
        )
    except Exception as e:
        logger.error(f"Failed to log email to file: {e}")


async def send_email(
    to_email: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> bool:
    """Отправка письма. Возвращает True при успехе (или при успешном LOG_ONLY).

    При любой ошибке — логирует и возвращает False, НЕ бросая исключений,
    чтобы не ломать auth-flow (пользователь должен увидеть 200 даже если
    почта недоступна — из соображений приватности при forgot-password).
    """
    if not to_email or "@" not in to_email:
        logger.error(f"Invalid email: {to_email!r}")
        return False

    text_body = text or _html_to_text(html)

    # DEV mode
    if not is_email_configured():
        _log_email_to_file(to_email, subject, text_body, html)
        return True

    # Реальная отправка
    try:
        msg = EmailMessage()
        msg["From"] = formataddr((SMTP_FROM_NAME, SMTP_FROM))
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(text_body)
        msg.add_alternative(html, subtype="html")

        tls_ctx = ssl.create_default_context()
        if SMTP_USE_TLS:
            # STARTTLS (обычно 587)
            await aiosmtplib.send(  # type: ignore
                msg,
                hostname=SMTP_HOST,
                port=SMTP_PORT,
                start_tls=True,
                tls_context=tls_ctx,
                username=SMTP_USER,
                password=SMTP_PASSWORD,
                timeout=SMTP_TIMEOUT,
            )
        else:
            # Прямой SSL (обычно 465)
            await aiosmtplib.send(  # type: ignore
                msg,
                hostname=SMTP_HOST,
                port=SMTP_PORT,
                use_tls=True,
                tls_context=tls_ctx,
                username=SMTP_USER,
                password=SMTP_PASSWORD,
                timeout=SMTP_TIMEOUT,
            )
        logger.info(f"📧 Email отправлен: {to_email} / {subject}")
        return True
    except Exception as e:
        logger.error(f"📧 Email send failed to {to_email}: {e}", exc_info=True)
        # Всё равно пишем в лог-файл для отладки
        _log_email_to_file(to_email, f"[FAILED] {subject}", text_body, html)
        return False


def _html_to_text(html: str) -> str:
    """Очень простой HTML→text (для multipart/alternative fallback)."""
    import re
    text = re.sub(r"<br\s*/?>", "\n", html)
    text = re.sub(r"</p>", "\n\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    # decode basic entities
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    return text.strip()


# ==================== ШАБЛОНЫ ====================

def _base_template(body_html: str, preheader: str = "") -> str:
    """Обёртка-шаблон с брендингом."""
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RUDN Go</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">{preheader}</span>
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.05);overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:24px 32px;color:#fff;">
        <h1 style="margin:0;font-size:20px;font-weight:700;">🎓 RUDN Go</h1>
      </div>
      <div style="padding:32px;line-height:1.6;font-size:15px;color:#1a1a1a;">
        {body_html}
      </div>
      <div style="padding:16px 32px;background:#f9fafb;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
        Это автоматическое письмо. Если вы не запрашивали его — просто проигнорируйте.<br>
        © RUDN Go, {datetime.now().year}
      </div>
    </div>
  </div>
</body>
</html>"""


def template_password_reset(reset_url: str, user_name: str = "") -> tuple[str, str, str]:
    """Возвращает (subject, html, text)."""
    subject = "🔐 Сброс пароля — RUDN Go"
    greeting = f"Здравствуйте, {user_name}!" if user_name else "Здравствуйте!"
    body = f"""
        <p>{greeting}</p>
        <p>Вы запросили сброс пароля для аккаунта RUDN Go.</p>
        <p>Нажмите на кнопку ниже, чтобы задать новый пароль:</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="{reset_url}" style="display:inline-block;padding:14px 32px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">
            Сбросить пароль
          </a>
        </p>
        <p style="font-size:13px;color:#6b7280;">Ссылка действительна 30 минут. Если кнопка не работает, скопируйте адрес:</p>
        <p style="font-size:12px;color:#3b82f6;word-break:break-all;">{reset_url}</p>
        <p style="font-size:13px;color:#6b7280;margin-top:24px;">
          Если вы не запрашивали сброс — просто проигнорируйте это письмо. Ваш пароль не изменится.
        </p>
    """
    html = _base_template(body, preheader="Сброс пароля — ссылка действительна 30 минут")
    text = (
        f"{greeting}\n\n"
        f"Для сброса пароля перейдите по ссылке:\n{reset_url}\n\n"
        f"Ссылка действительна 30 минут.\n"
        f"Если вы не запрашивали сброс — проигнорируйте это письмо."
    )
    return subject, html, text


def template_email_verification(verify_url: str, user_name: str = "") -> tuple[str, str, str]:
    subject = "✉️ Подтвердите email — RUDN Go"
    greeting = f"Здравствуйте, {user_name}!" if user_name else "Здравствуйте!"
    body = f"""
        <p>{greeting}</p>
        <p>Подтвердите ваш email, чтобы активировать все функции аккаунта.</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="{verify_url}" style="display:inline-block;padding:14px 32px;background:#10b981;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">
            Подтвердить email
          </a>
        </p>
        <p style="font-size:13px;color:#6b7280;">Ссылка действительна 24 часа.</p>
        <p style="font-size:12px;color:#3b82f6;word-break:break-all;">{verify_url}</p>
    """
    html = _base_template(body, preheader="Подтверждение email")
    text = (
        f"{greeting}\n\n"
        f"Для подтверждения email перейдите по ссылке:\n{verify_url}\n\n"
        f"Ссылка действительна 24 часа."
    )
    return subject, html, text


def template_password_changed(user_name: str = "", ip: str = "") -> tuple[str, str, str]:
    subject = "🔐 Пароль изменён — RUDN Go"
    greeting = f"Здравствуйте, {user_name}!" if user_name else "Здравствуйте!"
    ip_line = f"<p style='font-size:13px;color:#6b7280;'>IP-адрес: <code>{ip}</code></p>" if ip else ""
    body = f"""
        <p>{greeting}</p>
        <p>✅ Пароль вашего аккаунта успешно изменён.</p>
        <p style="font-size:13px;color:#6b7280;">Время: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M UTC')}</p>
        {ip_line}
        <p style="margin-top:24px;color:#dc2626;"><strong>Не вы?</strong><br>
          Немедленно войдите и смените пароль снова, а также проверьте список активных сессий.
        </p>
    """
    html = _base_template(body, preheader="Ваш пароль был изменён")
    text = f"{greeting}\n\nПароль аккаунта был изменён. Если это не вы — смените пароль и проверьте сессии."
    return subject, html, text


__all__ = [
    "send_email",
    "is_email_configured",
    "template_password_reset",
    "template_email_verification",
    "template_password_changed",
    "PUBLIC_BASE_URL",
]
