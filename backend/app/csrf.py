
import os

from urllib.parse import urlsplit

from fastapi import HTTPException, Request


SAFE_METHODS = {
    "GET",
    "HEAD",
    "OPTIONS",
}

ALLOWED_ORIGINS = {
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000",
    ).split(",")
    if origin.strip()
}


def check_csrf(request: Request) -> None:
    """
    Validate the origin of state-changing requests.
    """

    if request.method in SAFE_METHODS:
        return

    origin = request.headers.get("origin")

    if origin:
        if origin in ALLOWED_ORIGINS:
            return

        raise HTTPException(
            status_code=403,
            detail="Forbidden origin.",
        )

    referer = request.headers.get("referer")

    if referer:
        parsed = urlsplit(referer)

        if parsed.scheme and parsed.netloc:
            referer_origin = (
                f"{parsed.scheme}://{parsed.netloc}"
            )

            if referer_origin in ALLOWED_ORIGINS:
                return

    raise HTTPException(
        status_code=403,
        detail="Origin verification failed.",
    )
