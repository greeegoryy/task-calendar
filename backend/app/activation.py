import hashlib
import secrets
from datetime import datetime, timedelta, timezone


ACTIVATION_TOKEN_TTL = timedelta(hours=24)


def generate_activation_token() -> str:
    """Generate a cryptographically secure activation token."""
    return secrets.token_urlsafe(32)


def hash_activation_token(token: str) -> str:
    """Generate a SHA-256 hash of the activation token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_activation_expiry() -> datetime:
    """Return the token expiration timestamp in UTC."""
    return datetime.now(timezone.utc) + ACTIVATION_TOKEN_TTL