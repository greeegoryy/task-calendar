
import logging
import os
import smtplib

from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    HTTPException,
    Response,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.activation import (
    generate_activation_token,
    get_activation_expiry,
    hash_activation_token,
)
from app.database import get_db
from app.email_service import send_activation_email
from app.models.activation_token import ActivationToken
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.auth import (
    ActivateAccountInput,
    ActivateAccountResponse,
    LoginInput,
    LoginResponse,
    RegisterInput,
    RegisterResponse,
    UserOut,
)
from app.security import hash_password, verify_password
from app.session_auth import get_current_user
from app.session_security import (
    SESSION_TTL,
    generate_session_token,
    get_session_expiry,
    hash_session_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

REGISTER_MESSAGE = (
    "If the email address is eligible, "
    "an activation link will be sent."
)

LOGIN_ERROR = "Invalid email or password."

SESSION_COOKIE_NAME = "dailyflow_session"


# =========================
# REGISTRATION
# =========================

@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=202,
)
def register(
    payload: RegisterInput,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()
    first_name = payload.first_name.strip()

    if not first_name:
        return RegisterResponse(message=REGISTER_MESSAGE)

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user is not None:
        return RegisterResponse(message=REGISTER_MESSAGE)

    user = User(
        first_name=first_name,
        email=email,
        password_hash=None,
        is_active=False,
        is_admin=False,
    )

    token = generate_activation_token()

    try:
        db.add(user)
        db.flush()

        activation_token = ActivationToken(
            user_id=user.id,
            token_hash=hash_activation_token(token),
            expires_at=get_activation_expiry(),
        )

        db.add(activation_token)
        db.commit()

    except IntegrityError:
        db.rollback()
        return RegisterResponse(message=REGISTER_MESSAGE)

    try:
        send_activation_email(
            recipient_email=email,
            activation_token=token,
        )
        logger.info(
            "Activation email accepted by SMTP server."
        )

    except (smtplib.SMTPException, OSError):
        logger.exception(
            "Activation email delivery failed."
        )

    return RegisterResponse(message=REGISTER_MESSAGE)


# =========================
# ACCOUNT ACTIVATION
# =========================

@router.post(
    "/activate",
    response_model=ActivateAccountResponse,
)
def activate_account(
    payload: ActivateAccountInput,
    db: Session = Depends(get_db),
):
    token_hash = hash_activation_token(payload.token)

    activation_token = db.scalar(
        select(ActivationToken)
        .where(ActivationToken.token_hash == token_hash)
        .with_for_update()
    )

    if activation_token is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired activation token.",
        )

    now = datetime.now(timezone.utc)

    if activation_token.expires_at <= now:
        db.delete(activation_token)
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired activation token.",
        )

    user = db.scalar(
        select(User)
        .where(User.id == activation_token.user_id)
        .with_for_update()
    )

    if user is None or user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired activation token.",
        )

    user.password_hash = hash_password(payload.password)
    user.is_active = True

    db.delete(activation_token)
    db.commit()

    return ActivateAccountResponse(
        message="Account activated successfully."
    )


# =========================
# LOGIN + AUDIT
# =========================

@router.post(
    "/login",
    response_model=LoginResponse,
)
def login(
    payload: LoginInput,
    response: Response,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if (
        user is None
        or not user.is_active
        or user.password_hash is None
    ):
        raise HTTPException(
            status_code=401,
            detail=LOGIN_ERROR,
        )

    if not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail=LOGIN_ERROR,
        )

    session_token = generate_session_token()

    session = UserSession(
        user_id=user.id,
        token_hash=hash_session_token(session_token),
        expires_at=get_session_expiry(),
    )

    db.add(session)

    # Flush generates the session UUID before commit.
    db.flush()

    audit_log = AuditLog(
        user_id=user.id,
        action="LOGIN_SUCCESS",
        resource_type="session",
        resource_id=session.id,
        details={
            "result": "success",
        },
    )

    db.add(audit_log)

    # Session and audit event are saved atomically.
    db.commit()

    cookie_secure = os.getenv(
        "COOKIE_SECURE",
        "true",
    ).lower() == "true"

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )

    return LoginResponse(
        message="Logged in successfully."
    )


# =========================
# CURRENT USER
# =========================

@router.get(
    "/me",
    response_model=UserOut,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


# =========================
# LOGOUT + AUDIT
# =========================

@router.post("/logout")
def logout(
    response: Response,
    dailyflow_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if dailyflow_session:
        token_hash = hash_session_token(dailyflow_session)

        session = db.scalar(
            select(UserSession)
            .where(
                UserSession.token_hash == token_hash,
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > datetime.now(timezone.utc),
            )
            .with_for_update()
        )

        if session is not None:
            session.revoked_at = datetime.now(timezone.utc)

            audit_log = AuditLog(
                user_id=session.user_id,
                action="LOGOUT",
                resource_type="session",
                resource_id=session.id,
                details={
                    "result": "success",
                },
            )

            db.add(audit_log)

            # Revocation and audit event are committed together.
            db.commit()

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        secure=os.getenv(
            "COOKIE_SECURE",
            "true",
        ).lower() == "true",
        httponly=True,
        samesite="lax",
    )

    return {"message": "Logged out successfully."}
