
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.routers.tasks import router as tasks_router


# =========================
# FASTAPI APPLICATION
# =========================

app = FastAPI(
    title="DailyFlow API",
    version="1.0.0"
)


# =========================
# CORS CONFIGURATION
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"]
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
