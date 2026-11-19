
import os
from unittest.mock import MagicMock

import pytest

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://test:test@localhost:5432/testdb",
)
os.environ.setdefault("SMTP_HOST", "localhost")
os.environ.setdefault("SMTP_PORT", "1025")
os.environ.setdefault(
    "SMTP_FROM_EMAIL",
    "noreply@dailyflow.local",
)

from fastapi.testclient import TestClient

from app import main
from app.session_auth import get_current_user


client = TestClient(main.app)


@pytest.fixture
def authenticated_client():
    """
    Simulate an authenticated user without
    creating a real database session.
    """

    mock_user = MagicMock()
    mock_user.id = "00000000-0000-0000-0000-000000000001"
    mock_user.is_active = True
    mock_user.is_admin = False

    main.app.dependency_overrides[get_current_user] = (
        lambda: mock_user
    )

    with TestClient(main.app) as test_client:
        yield test_client

    main.app.dependency_overrides.pop(
        get_current_user,
        None,
    )


def test_health(monkeypatch):
    mock_engine = MagicMock()
    monkeypatch.setattr(main, "engine", mock_engine)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    mock_engine.connect.return_value.__enter__.return_value.exec_driver_sql.assert_called_once_with(
        "SELECT 1"
    )


def test_invalid_task_dates(authenticated_client):
    payload = {
        "title": "Test task",
        "description": "",
        "start": "2026-11-17T12:00:00+00:00",
        "end": "2026-11-17T11:00:00+00:00",
        "color": "#6366f1",
        "completed": False,
    }

    response = authenticated_client.post(
        "/api/tasks",
        json=payload,
        headers={
            "Origin": "http://localhost:3000",
        },
    )

    assert response.status_code == 422


def test_invalid_task_color(authenticated_client):
    payload = {
        "title": "Test task",
        "start": "2026-11-17T12:00:00+00:00",
        "end": "2026-11-17T13:00:00+00:00",
        "color": "red",
    }

    response = authenticated_client.post(
        "/api/tasks",
        json=payload,
        headers={
            "Origin": "http://localhost:3000",
        },
    )

    assert response.status_code == 422


def test_invalid_task_id(authenticated_client):
    response = authenticated_client.get(
        "/api/tasks/not-a-uuid"
    )

    assert response.status_code == 422


def test_unauthenticated_task_access():
    """
    Unauthenticated users must not access tasks.
    """

    response = client.get("/api/tasks")

    assert response.status_code == 401


def test_csrf_protection():
    """
    Requests without a valid Origin must be rejected.
    """

    response = client.post(
        "/api/tasks",
        json={
            "title": "Test task",
        },
    )

    assert response.status_code == 403
