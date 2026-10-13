import asyncio
import smtplib
import ssl
from email.message import EmailMessage

from toptrainers_api.core.config import settings


def send_smtp(recipient: str, subject: str, html: str) -> None:
    smtp_host, smtp_user, smtp_password, smtp_from = (
        settings.smtp_host,
        settings.smtp_username,
        settings.smtp_password,
        settings.smtp_from_email,
    )
    if not smtp_host or not smtp_user or not smtp_password or not smtp_from:
        raise RuntimeError("SMTP is not configured")
    message = EmailMessage()
    message["From"] = smtp_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content("Откройте письмо в почтовом клиенте с поддержкой HTML.")
    message.add_alternative(html, subtype="html")
    if settings.smtp_use_starttls:
        with smtplib.SMTP(smtp_host, settings.smtp_port, timeout=15) as client:
            client.starttls(context=ssl.create_default_context())
            client.login(smtp_user, smtp_password)
            client.send_message(message)
    else:
        with smtplib.SMTP_SSL(smtp_host, settings.smtp_port, timeout=15) as client:
            client.login(smtp_user, smtp_password)
            client.send_message(message)


async def send_email(recipient: str, subject: str, html: str) -> None:
    await asyncio.to_thread(send_smtp, recipient, subject, html)
