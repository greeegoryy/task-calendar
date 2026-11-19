
import os
import smtplib
from email.message import EmailMessage


SMTP_HOST = os.environ["SMTP_HOST"]
SMTP_PORT = int(os.environ["SMTP_PORT"])
SMTP_FROM_EMAIL = os.environ["SMTP_FROM_EMAIL"]


def send_activation_email(
    recipient_email: str,
    activation_token: str,
) -> None:
    activation_link = (
        "http://localhost:3000/activate"
        f"?token={activation_token}"
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
        timeout=10,
    ) as smtp:
        smtp.send_message(message)
