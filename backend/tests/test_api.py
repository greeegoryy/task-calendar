
import os
from unittest.mock import MagicMock

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://test:test@localhost:5432/testdb"
)

from fastapi.testclient import TestClient
from app import main

client = TestClient(main.app)


def test_health(monkeypatch):
    mock_engine = MagicMock()
    monkeypatch.setattr(main, "engine", mock_engine)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    mock_engine.connect.return_value.__enter__.return_value.exec_driver_sql.assert_called_once_with(
        "SELECT 1"
    )


def test_invalid_task_dates():
    payload = {
        "title": "Test task",
        "description": "",
        "start": "2026-11-17T12:00:00+00:00",
        "end": "2026-11-17T11:00:00+00:00",
        "color": "#6366f1",
        "completed": False
    }

    response = client.post("/api/tasks", json=payload)

    assert response.status_code == 422


def test_invalid_task_color():
    payload = {
        "title": "Test task",
        "start": "2026-11-17T12:00:00+00:00",
        "end": "2026-11-17T13:00:00+00:00",
        "color": "red"
    }

    response = client.post("/api/tasks", json=payload)

    assert response.status_code == 422


def test_invalid_task_id():
    response = client.get("/api/tasks/not-a-uuid")

    assert response.status_code == 422
