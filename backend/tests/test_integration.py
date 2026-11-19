
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

def test_create_task(
    authenticated_client,
    test_db_engine,
    test_user_session,
):
    from app import database

    # Ensure the application and test fixture use
    # the isolated PostgreSQL test database.
    assert database.engine.url.database == "calendar_test"
    assert test_db_engine.url.database == "calendar_test"

    payload = {
        "title": "Integration test task",
        "description": "Created by pytest",
        "start": "2026-11-18T12:00:00+00:00",
        "end": "2026-11-18T13:00:00+00:00",
        "color": "#6366f1",
        "completed": False,
    }

    response = authenticated_client.post(
        "/api/tasks",
        json=payload,
    )

    assert response.status_code == 201, response.text

    data = response.json()
    task_id = UUID(data["id"])

    assert data["title"] == payload["title"]
    assert data["description"] == payload["description"]
    assert data["color"] == payload["color"]
    assert data["completed"] is False

    # Verify that the task was saved in PostgreSQL.
    with Session(test_db_engine) as session:
        saved_task = session.execute(
            text("""
                SELECT
                    title,
                    description,
                    color,
                    completed,
                    user_id
                FROM tasks
                WHERE id = :id
            """),
            {"id": task_id},
        ).one()

    assert saved_task.title == payload["title"]
    assert saved_task.description == payload["description"]
    assert saved_task.color == payload["color"]
    assert saved_task.completed is False
    assert saved_task.user_id == test_user_session["user_id"]

    # Verify that an audit event was recorded.
    with Session(test_db_engine) as session:
        audit_count = session.execute(
            text("""
                SELECT COUNT(*)
                FROM audit_logs
                WHERE user_id = :user_id
                  AND resource_id = :task_id
                  AND action = 'TASK_CREATED'
            """),
            {
                "user_id": test_user_session["user_id"],
                "task_id": task_id,
            },
        ).scalar_one()

    assert audit_count == 1


# =========================
# FULL CRUD INTEGRATION TEST
# =========================

def test_task_crud(
    authenticated_client,
    test_db_engine,
    test_user_session,
):
    from app import database

    assert database.engine.url.database == "calendar_test"
    assert test_db_engine.url.database == "calendar_test"

    payload = {
        "title": "CRUD test task",
        "description": "Original description",
        "start": "2026-11-18T12:00:00+00:00",
        "end": "2026-11-18T13:00:00+00:00",
        "color": "#6366f1",
        "completed": False,
    }

    # CREATE
    response = authenticated_client.post(
        "/api/tasks",
        json=payload,
    )

    assert response.status_code == 201, response.text

    task_id = UUID(response.json()["id"])

    # READ
    response = authenticated_client.get(
        f"/api/tasks/{task_id}"
    )

    assert response.status_code == 200, response.text
    assert response.json()["title"] == "CRUD test task"

    # UPDATE
    updated_payload = {
        **payload,
        "title": "Updated CRUD task",
        "completed": True,
    }

    response = authenticated_client.put(
        f"/api/tasks/{task_id}",
        json=updated_payload,
    )

    assert response.status_code == 200, response.text
    assert response.json()["title"] == "Updated CRUD task"
    assert response.json()["completed"] is True

    # VERIFY UPDATE
    response = authenticated_client.get(
        f"/api/tasks/{task_id}"
    )

    assert response.status_code == 200, response.text
    assert response.json()["title"] == "Updated CRUD task"
    assert response.json()["completed"] is True

    # DELETE
    response = authenticated_client.delete(
        f"/api/tasks/{task_id}"
    )

    assert response.status_code == 204, response.text

    # VERIFY DELETION
    response = authenticated_client.get(
        f"/api/tasks/{task_id}"
    )

    assert response.status_code == 404

    # VERIFY DATABASE
    with Session(test_db_engine) as session:
        remaining_tasks = session.execute(
            text("""
                SELECT COUNT(*)
                FROM tasks
                WHERE id = :task_id
            """),
            {"task_id": task_id},
        ).scalar_one()

        audit_actions = session.execute(
            text("""
                SELECT action
                FROM audit_logs
                WHERE user_id = :user_id
                  AND resource_id = :task_id
            """),
            {
                "user_id": test_user_session["user_id"],
                "task_id": task_id,
            },
        ).scalars().all()

    assert remaining_tasks == 0

    assert sorted(audit_actions) == [
        "TASK_CREATED",
        "TASK_DELETED",
        "TASK_UPDATED",
    ]


# =========================
# UNAUTHENTICATED ACCESS TEST
# =========================

def test_unauthenticated_access():
    from app.main import app

    with TestClient(app) as client:
        response = client.get("/api/tasks")

    assert response.status_code == 401
