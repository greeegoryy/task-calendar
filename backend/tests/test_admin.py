
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session


# =========================
# ADMIN TEST FIXTURES
# =========================

@pytest.fixture
def admin_accounts(test_db_engine):
    from app import database
    from app.models.user import User
    from app.models.user_session import UserSession
    from app.session_security import hash_session_token

    # Prevent accidental execution against another database.
    if (
        database.engine.url.database != "calendar_test"
        or test_db_engine.url.database != "calendar_test"
        or database.engine.url != test_db_engine.url
    ):
        raise RuntimeError(
            "Admin tests require an isolated calendar_test database"
        )

    accounts = {
        "admin": {
            "id": uuid4(),
            "token": uuid4().hex,
        },
        "user": {
            "id": uuid4(),
            "token": uuid4().hex,
        },
    }

    try:
        with Session(test_db_engine) as db:
            for role, account in accounts.items():
                user = User(
                    id=account["id"],
                    first_name=f"Test {role}",
                    email=f"{role}-{account['id']}@example.test",
                    password_hash=None,
                    is_active=True,
                    is_admin=(role == "admin"),
                )

                session = UserSession(
                    user_id=account["id"],
                    token_hash=hash_session_token(
                        account["token"]
                    ),
                    expires_at=(
                        datetime.now(timezone.utc)
                        + timedelta(hours=1)
                    ),
                )

                db.add(user)
                db.add(session)

            db.commit()

        yield accounts

    finally:
        params = {
            "admin_id": accounts["admin"]["id"],
            "user_id": accounts["user"]["id"],
        }

        with test_db_engine.begin() as connection:
            connection.execute(
                text("""
                    DELETE FROM audit_logs
                    WHERE user_id IN (:admin_id, :user_id)
                       OR resource_id IN (
                           SELECT id
                           FROM tasks
                           WHERE user_id IN (:admin_id, :user_id)
                       )
                """),
                params,
            )

            connection.execute(
                text("""
                    DELETE FROM tasks
                    WHERE user_id IN (:admin_id, :user_id)
                """),
                params,
            )

            connection.execute(
                text("""
                    DELETE FROM user_sessions
                    WHERE user_id IN (:admin_id, :user_id)
                """),
                params,
            )

            connection.execute(
                text("""
                    DELETE FROM users
                    WHERE id IN (:admin_id, :user_id)
                """),
                params,
            )


@pytest.fixture
def admin_client(admin_accounts):
    from app.main import app
    from app.session_auth import SESSION_COOKIE_NAME

    with TestClient(app) as client:
        client.cookies.set(
            SESSION_COOKIE_NAME,
            admin_accounts["admin"]["token"],
        )

        client.headers.update({
            "Origin": "http://localhost:3000",
        })

        yield client


@pytest.fixture
def regular_client(admin_accounts):
    from app.main import app
    from app.session_auth import SESSION_COOKIE_NAME

    with TestClient(app) as client:
        client.cookies.set(
            SESSION_COOKIE_NAME,
            admin_accounts["user"]["token"],
        )

        client.headers.update({
            "Origin": "http://localhost:3000",
        })

        yield client


@pytest.fixture
def task_payload():
    return {
        "title": f"Admin test task {uuid4().hex}",
        "description": "Created by admin integration tests",
        "start": "2026-11-20T12:00:15+00:00",
        "end": "2026-11-20T13:00:30+00:00",
        "color": "#6366f1",
        "completed": False,
    }


@pytest.fixture
def regular_user_task(regular_client, task_payload):
    response = regular_client.post(
        "/api/tasks",
        json=task_payload,
    )

    assert response.status_code == 201, response.text

    return response.json()


# =========================
# AUTHORIZATION TESTS
# =========================

ADMIN_ENDPOINTS = [
    "/api/admin/users",
    "/api/admin/tasks",
    "/api/admin/tasks/stats",
    "/api/admin/audit-logs",
]


@pytest.mark.parametrize("endpoint", ADMIN_ENDPOINTS)
def test_admin_requires_authentication(
    admin_accounts,
    endpoint,
):
    from app.main import app

    with TestClient(app) as client:
        response = client.get(endpoint)

    assert response.status_code == 401


@pytest.mark.parametrize("endpoint", ADMIN_ENDPOINTS)
def test_admin_requires_admin_role(
    regular_client,
    endpoint,
):
    response = regular_client.get(endpoint)

    assert response.status_code == 403


def test_regular_user_cannot_use_admin_mutations(
    regular_client,
    regular_user_task,
    task_payload,
    admin_accounts,
):
    task_id = regular_user_task["id"]

    response = regular_client.put(
        f"/api/admin/tasks/{task_id}",
        json=task_payload,
    )

    assert response.status_code == 403

    response = regular_client.delete(
        f"/api/admin/tasks/{task_id}"
    )

    assert response.status_code == 403

    response = regular_client.patch(
        f"/api/admin/users/{admin_accounts['user']['id']}/role",
        json={"is_admin": True},
    )

    assert response.status_code == 403

    # Ensure that the rejected operations changed nothing.
    response = regular_client.get(
        f"/api/tasks/{task_id}"
    )

    assert response.status_code == 200
    assert response.json() == regular_user_task


def test_admin_mutation_requires_csrf_origin(
    admin_client,
    regular_user_task,
    task_payload,
):
    admin_client.headers.pop("Origin", None)

    response = admin_client.put(
        f"/api/admin/tasks/{regular_user_task['id']}",
        json=task_payload,
    )

    assert response.status_code == 403


# =========================
# ADMIN USERS
# =========================

def test_admin_users_list(
    admin_client,
    admin_accounts,
):
    response = admin_client.get("/api/admin/users")

    assert response.status_code == 200, response.text

    users = {
        user["id"]: user
        for user in response.json()
    }

    admin = users[str(admin_accounts["admin"]["id"])]
    regular = users[str(admin_accounts["user"]["id"])]

    assert admin["is_admin"] is True
    assert regular["is_admin"] is False
    assert admin["is_active"] is True
    assert regular["is_active"] is True


# =========================
# ADMIN TASK LIST
# =========================

def test_admin_tasks_list(
    admin_client,
    regular_user_task,
    admin_accounts,
):
    response = admin_client.get(
        "/api/admin/tasks",
        params={
            "user_id": str(admin_accounts["user"]["id"]),
        },
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["total"] == 1

    task = data["items"][0]

    assert task["id"] == regular_user_task["id"]

    assert task["user_id"] == str(
        admin_accounts["user"]["id"]
    )

    assert task["user_first_name"] == "Test user"

    assert task["user_email"] == (
        f"user-{admin_accounts['user']['id']}@example.test"
    )


def test_admin_can_see_tasks_from_multiple_users(
    admin_client,
    regular_user_task,
    task_payload,
):
    response = admin_client.post(
        "/api/tasks",
        json=task_payload,
    )

    assert response.status_code == 201, response.text

    admin_task_id = response.json()["id"]

    response = admin_client.get(
        "/api/admin/tasks",
        params={"search": task_payload["title"]},
    )

    assert response.status_code == 200, response.text

    task_ids = {
        task["id"]
        for task in response.json()["items"]
    }

    assert admin_task_id in task_ids
    assert regular_user_task["id"] in task_ids
    assert response.json()["total"] == 2


# =========================
# ADMIN TASK STATISTICS
# =========================

def test_admin_tasks_stats(
    admin_client,
    regular_client,
    task_payload,
):
    response = admin_client.get(
        "/api/admin/tasks/stats"
    )

    assert response.status_code == 200

    before = response.json()

    response = regular_client.post(
        "/api/tasks",
        json=task_payload,
    )

    assert response.status_code == 201, response.text

    task_id = response.json()["id"]

    response = admin_client.get(
        "/api/admin/tasks/stats"
    )

    assert response.status_code == 200

    after_create = response.json()

    assert after_create["total"] == before["total"] + 1
    assert after_create["pending"] == before["pending"] + 1
    assert after_create["completed"] == before["completed"]

    response = admin_client.put(
        f"/api/admin/tasks/{task_id}",
        json={
            **task_payload,
            "completed": True,
        },
    )

    assert response.status_code == 200, response.text

    response = admin_client.get(
        "/api/admin/tasks/stats"
    )

    assert response.status_code == 200

    after_update = response.json()

    assert after_update["total"] == before["total"] + 1
    assert after_update["pending"] == before["pending"]
    assert after_update["completed"] == before["completed"] + 1

    response = admin_client.delete(
        f"/api/admin/tasks/{task_id}"
    )

    assert response.status_code == 204

    response = admin_client.get(
        "/api/admin/tasks/stats"
    )

    assert response.status_code == 200
    assert response.json() == before


# =========================
# FILTERING AND PAGINATION
# =========================

def test_admin_tasks_filters(
    admin_client,
    admin_accounts,
    regular_user_task,
    task_payload,
):
    owner_id = str(admin_accounts["user"]["id"])

    matching_filters = [
        {"search": task_payload["title"].upper()},
        {"completed": False},
        {"date_from": "2026-11-20T00:00:00+00:00"},
        {"date_to": "2026-11-21T00:00:00+00:00"},
    ]

    for filters in matching_filters:
        response = admin_client.get(
            "/api/admin/tasks",
            params={
                "user_id": owner_id,
                **filters,
            },
        )

        assert response.status_code == 200, response.text
        assert response.json()["total"] == 1

        assert response.json()["items"][0]["id"] == (
            regular_user_task["id"]
        )

    non_matching_filters = [
        {"search": uuid4().hex},
        {"completed": True},
        {"date_from": "2026-11-21T00:00:00+00:00"},
        {"date_to": "2026-11-20T12:00:15+00:00"},
    ]

    for filters in non_matching_filters:
        response = admin_client.get(
            "/api/admin/tasks",
            params={
                "user_id": owner_id,
                **filters,
            },
        )

        assert response.status_code == 200, response.text
        assert response.json()["total"] == 0
        assert response.json()["items"] == []


def test_admin_tasks_pagination(
    admin_client,
    regular_client,
    admin_accounts,
    task_payload,
):
    for index in range(3):
        response = regular_client.post(
            "/api/tasks",
            json={
                **task_payload,
                "title": f"Pagination task {index}",
            },
        )

        assert response.status_code == 201, response.text

    user_id = str(admin_accounts["user"]["id"])

    received_ids = []

    for offset in range(3):
        response = admin_client.get(
            "/api/admin/tasks",
            params={
                "user_id": user_id,
                "limit": 1,
                "offset": offset,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["total"] == 3
        assert data["limit"] == 1
        assert data["offset"] == offset
        assert len(data["items"]) == 1

        received_ids.append(data["items"][0]["id"])

    assert len(set(received_ids)) == 3

    response = admin_client.get(
        "/api/admin/tasks",
        params={
            "user_id": user_id,
            "limit": 1,
            "offset": 3,
        },
    )

    assert response.status_code == 200
    assert response.json()["items"] == []


# =========================
# UPDATE AND DELETE
# =========================

def test_admin_task_update(
    admin_client,
    regular_client,
    regular_user_task,
    task_payload,
    admin_accounts,
):
    task_id = regular_user_task["id"]

    updated_payload = {
        **task_payload,
        "title": "Updated by administrator",
        "completed": True,
    }

    response = admin_client.put(
        f"/api/admin/tasks/{task_id}",
        json=updated_payload,
    )

    assert response.status_code == 200, response.text

    updated_task = response.json()

    assert updated_task["title"] == updated_payload["title"]
    assert updated_task["completed"] is True

    assert updated_task["user_id"] == str(
        admin_accounts["user"]["id"]
    )

    # Ensure the owner can see the administrator's changes.
    response = regular_client.get(
        f"/api/tasks/{task_id}"
    )

    assert response.status_code == 200

    saved_task = response.json()

    assert saved_task["title"] == updated_payload["title"]
    assert saved_task["completed"] is True

    # Updating the title must not alter the original dates.
    assert saved_task["start"] == regular_user_task["start"]
    assert saved_task["end"] == regular_user_task["end"]


def test_admin_task_delete(
    admin_client,
    regular_client,
    regular_user_task,
    test_db_engine,
):
    task_id = regular_user_task["id"]

    response = admin_client.delete(
        f"/api/admin/tasks/{task_id}"
    )

    assert response.status_code == 204, response.text

    response = regular_client.get(
        f"/api/tasks/{task_id}"
    )

    assert response.status_code == 404

    with Session(test_db_engine) as db:
        remaining = db.execute(
            text("""
                SELECT COUNT(*)
                FROM tasks
                WHERE id = :task_id
            """),
            {"task_id": task_id},
        ).scalar_one()

    assert remaining == 0


# =========================
# AUDIT LOGS
# =========================

def test_admin_task_audit_logs(
    admin_client,
    admin_accounts,
    regular_user_task,
    task_payload,
    test_db_engine,
):
    task_id = regular_user_task["id"]

    response = admin_client.put(
        f"/api/admin/tasks/{task_id}",
        json={
            **task_payload,
            "title": "Audit test update",
            "completed": True,
        },
    )

    assert response.status_code == 200, response.text

    response = admin_client.delete(
        f"/api/admin/tasks/{task_id}"
    )

    assert response.status_code == 204

    with Session(test_db_engine) as db:
        actions = db.execute(
            text("""
                SELECT action
                FROM audit_logs
                WHERE user_id = :admin_id
                  AND resource_id = :task_id
            """),
            {
                "admin_id": admin_accounts["admin"]["id"],
                "task_id": task_id,
            },
        ).scalars().all()

    assert sorted(actions) == [
        "ADMIN_TASK_DELETED",
        "ADMIN_TASK_UPDATED",
    ]

    response = admin_client.get(
        "/api/admin/audit-logs",
        params={"limit": 100, "offset": 0},
    )

    assert response.status_code == 200, response.text

    events = [
        event
        for event in response.json()["items"]
        if event["resource_id"] == task_id
        and event["user_id"] == str(
            admin_accounts["admin"]["id"]
        )
    ]

    assert {event["action"] for event in events} == {
        "ADMIN_TASK_UPDATED",
        "ADMIN_TASK_DELETED",
    }


# =========================
# VALIDATION AND ERRORS
# =========================

def test_admin_task_not_found(
    admin_client,
    task_payload,
):
    task_id = uuid4()

    response = admin_client.put(
        f"/api/admin/tasks/{task_id}",
        json=task_payload,
    )

    assert response.status_code == 404

    response = admin_client.delete(
        f"/api/admin/tasks/{task_id}"
    )

    assert response.status_code == 404


def test_admin_task_invalid_dates(
    admin_client,
    regular_user_task,
    task_payload,
):
    response = admin_client.put(
        f"/api/admin/tasks/{regular_user_task['id']}",
        json={
            **task_payload,
            "end": "2026-11-20T10:00:00+00:00",
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 101},
        {"offset": -1},
        {"user_id": "invalid-uuid"},
        {"date_from": "2026-11-20T12:00:00"},
        {
            "date_from": "2026-11-21T00:00:00+00:00",
            "date_to": "2026-11-20T00:00:00+00:00",
        },
    ],
)
def test_admin_tasks_invalid_filters(
    admin_client,
    params,
):
    response = admin_client.get(
        "/api/admin/tasks",
        params=params,
    )

    assert response.status_code == 422
