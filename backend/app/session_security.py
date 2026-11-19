
import hashlib
import secrets

from datetime import datetime, timedelta, timezone


# Session lifetime: 7 days
SESSION_TTL = timedelta(days=7)


def generate_session_token() -> str:
    """
    Generate a cryptographically secure random
    session token.
    """
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    """
    Generate a SHA-256 hash of the session token.
    Only the hash will be stored in PostgreSQL.
    """
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def get_session_expiry() -> datetime:
    """
    Return the session expiration timestamp
    in UTC.
    """
    return datetime.now(timezone.utc) + SESSION_TTL
