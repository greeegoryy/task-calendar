
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.csrf import check_csrf
from app.database import engine
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.tasks import router as tasks_router


# =========================
# FASTAPI APPLICATION
# =========================

app = FastAPI(
    title="DailyFlow API",
    version="1.0.0"
)


# =========================
# CSRF PROTECTION
# =========================

@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    try:
        check_csrf(request)
    except HTTPException as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    return await call_next(request)


# =========================
# CORS CONFIGURATION
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Content-Type",
        "X-CSRF-Token",
    ],
)


# =========================
# HEALTH CHECK
# =========================

@app.get("/health")
def health():
    with engine.connect() as conn:
        conn.exec_driver_sql("SELECT 1")

    return {"status": "ok"}


# =========================
# API ROUTERS
# =========================

app.include_router(tasks_router)
app.include_router(auth_router)
app.include_router(admin_router)
