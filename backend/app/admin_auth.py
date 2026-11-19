
from fastapi import Depends, HTTPException, status

from app.models.user import User
from app.session_auth import get_current_user


def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Allow access only to authenticated administrators.
    """

    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required.",
        )

    return current_user
