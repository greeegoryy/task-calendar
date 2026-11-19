
from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.user_session import UserSession
from app.session_security import hash_session_token


SESSION_COOKIE_NAME = "dailyflow_session"


def get_current_user(
    dailyflow_session: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    """
    Validate the session cookie and return
    the authenticated user.
    """

    if not dailyflow_session:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated.",
        )

    token_hash = hash_session_token(dailyflow_session)

    session = db.scalar(
        select(UserSession).where(
            UserSession.token_hash == token_hash,
            UserSession.expires_at > datetime.now(timezone.utc),
            UserSession.revoked_at.is_(None),
        )
    )

    if session is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session.",
        )

    user = db.get(User, session.user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated.",
        )

    return user
