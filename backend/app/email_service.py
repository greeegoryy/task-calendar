
import os
import ssl
import smtplib

from email.message import EmailMessage
from urllib.parse import urlencode


SMTP_HOST = os.environ["SMTP_HOST"]
SMTP_PORT = int(os.environ["SMTP_PORT"])
SMTP_FROM_EMAIL = os.environ["SMTP_FROM_EMAIL"]

SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

APP_BASE_URL = os.getenv(
    "APP_BASE_URL",
    "http://localhost:3000",
).rstrip("/")


def send_activation_email(
    recipient_email: str,
    activation_token: str,
) -> None:
    query = urlencode({"token": activation_token})

    activation_link = (
        f"{APP_BASE_URL}/activate?{query}"
    )

    message = EmailMessage()
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = recipient_email
    message["Subject"] = "DailyFlow - Activate your account"

    message.set_content(
        "Hello!\n\n"
        "Welcome to DailyFlow.\n\n"
        "To activate your account, open the following link:\n\n"
        f"{activation_link}\n\n"
        "This link expires in 24 hours.\n\n"
        "If you did not register for DailyFlow, "
        "you can ignore this message.\n\n"
        "DailyFlow Team"
    )

    with smtplib.SMTP(
        SMTP_HOST,
        SMTP_PORT,
        timeout=15,
    ) as smtp:

        if SMTP_USERNAME or SMTP_PASSWORD:
            if not SMTP_USERNAME or not SMTP_PASSWORD:
                raise ValueError("Incomplete SMTP credentials")

            smtp.ehlo()
            smtp.starttls(
                context=ssl.create_default_context()
            )
            smtp.ehlo()

            smtp.login(
                SMTP_USERNAME,
                SMTP_PASSWORD,
            )

        smtp.send_message(message)
