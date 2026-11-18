
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session


# =========================
# DATABASE CONNECTION TEST
# =========================

def test_postgresql_connection(test_db_engine):
    with test_db_engine.connect() as connection:
        database_name = connection.execute(
            text("SELECT current_database()")
        ).scalar_one()

    assert database_name == "calendar_test"


# =========================
# CREATE TASK TEST
# =========================

def test_create_task(cleanup_tasks, test_db_engine):
    from app import database
    from app.routers import tasks
    from app.main import app

    # Ensure API uses the test database
    assert database.engine.url.database == "calendar_test"
    assert tasks.engine.url.database == "calendar_test"

    payload = {
        "title": "Integration test task",
        "description": "Created by pytest",
        "start": "2026-11-18T12:00:00+00:00",
        "end": "2026-11-18T13:00:00+00:00",
        "color": "#6366f1",
        "completed": False
    }

    with TestClient(app) as client:
        response = client.post(
            "/api/tasks",
            json=payload
        )

    assert response.status_code == 201

    data = response.json()

    # Register task for automatic cleanup
    cleanup_tasks.append(data["id"])

    # Validate API response
    task_id = UUID(data["id"])

    assert data["title"] == payload["title"]
    assert data["description"] == payload["description"]
    assert data["color"] == payload["color"]
    assert data["completed"] is False

    # Verify actual record in PostgreSQL
    with Session(test_db_engine) as session:
        saved_task = session.execute(
            text("""
                SELECT title, description, color, completed
                FROM tasks
                WHERE id = :id
            """),
            {"id": task_id}
        ).one()

    assert saved_task.title == payload["title"]
    assert saved_task.description == payload["description"]
    assert saved_task.color == payload["color"]
    assert saved_task.completed is False


# =========================
# FULL CRUD INTEGRATION TEST
# =========================

def test_task_crud(cleanup_tasks):
    from app import database
    from app.routers import tasks
    from app.main import app

    # Ensure API uses the test database
    assert database.engine.url.database == "calendar_test"
    assert tasks.engine.url.database == "calendar_test"

    payload = {
        "title": "CRUD test task",
        "description": "Original description",
        "start": "2026-11-18T12:00:00+00:00",
        "end": "2026-11-18T13:00:00+00:00",
        "color": "#6366f1",
        "completed": False
    }

    with TestClient(app) as client:

        # =========================
        # CREATE
        # =========================

        response = client.post(
            "/api/tasks",
            json=payload
        )

        assert response.status_code == 201

        task_id = response.json()["id"]

        # Register task for cleanup
        cleanup_tasks.append(task_id)

        # =========================
        # READ
        # =========================

        response = client.get(
            f"/api/tasks/{task_id}"
        )

        assert response.status_code == 200
        assert response.json()["title"] == "CRUD test task"

        # =========================
        # UPDATE
        # =========================

        updated_payload = {
            **payload,
            "title": "Updated CRUD task",
            "completed": True
        }

        response = client.put(
            f"/api/tasks/{task_id}",
            json=updated_payload
        )

        assert response.status_code == 200
        assert response.json()["title"] == "Updated CRUD task"
        assert response.json()["completed"] is True

        # =========================
        # VERIFY UPDATE
        # =========================

        response = client.get(
            f"/api/tasks/{task_id}"
        )

        assert response.status_code == 200
        assert response.json()["title"] == "Updated CRUD task"
        assert response.json()["completed"] is True

        # =========================
        # DELETE
        # =========================

        response = client.delete(
            f"/api/tasks/{task_id}"
        )

        assert response.status_code == 204

        # =========================
        # VERIFY DELETION
        # =========================

        response = client.get(
            f"/api/tasks/{task_id}"
        )

        assert response.status_code == 404
