
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session


# =========================
# TEST DATABASE ENGINE
# =========================

@pytest.fixture(scope="session")
def test_db_engine():
    database_url = os.environ["TEST_DATABASE_URL"]

    engine = create_engine(
        database_url,
        pool_pre_ping=True,
    )

    if engine.url.database != "calendar_test":
        engine.dispose()
        raise RuntimeError(
            "Integration tests must use calendar_test"
        )

    try:
        yield engine
    finally:
        engine.dispose()


# =========================
# TEST USER AND SESSION
# =========================

@pytest.fixture
def test_user_session(test_db_engine):
    from app.models.user import User
    from app.models.user_session import UserSession
    from app.session_security import hash_session_token

    token = uuid4().hex
    user_id = uuid4()

    with Session(test_db_engine) as db:
        user = User(
            id=user_id,
            first_name="Integration Test",
            email=f"integration-{user_id}@example.test",
            password_hash=None,
            is_active=True,
            is_admin=False,
        )

        session = UserSession(
            user_id=user_id,
            token_hash=hash_session_token(token),
            expires_at=(
                datetime.now(timezone.utc)
                + timedelta(hours=1)
            ),
        )

        db.add(user)
        db.add(session)
        db.commit()

    try:
        yield {
            "user_id": user_id,
            "token": token,
        }

    finally:
        # Delete test data in foreign-key-safe order.
        with test_db_engine.begin() as connection:

            # 1. Remove audit events related to the test user.
            connection.execute(
                text("""
                    DELETE FROM audit_logs
                    WHERE user_id = :user_id
                       OR resource_id IN (
                           SELECT id
                           FROM tasks
                           WHERE user_id = :user_id
                       )
                """),
                {"user_id": user_id},
            )

            # 2. Remove tasks owned by the test user.
            connection.execute(
                text("""
                    DELETE FROM tasks
                    WHERE user_id = :user_id
                """),
                {"user_id": user_id},
            )

            # 3. Remove authentication sessions.
            connection.execute(
                text("""
                    DELETE FROM user_sessions
                    WHERE user_id = :user_id
                """),
                {"user_id": user_id},
            )

            # 4. Remove the test user.
            connection.execute(
                text("""
                    DELETE FROM users
                    WHERE id = :user_id
                """),
                {"user_id": user_id},
            )


# =========================
# AUTHENTICATED TEST CLIENT
# =========================

@pytest.fixture
def authenticated_client(test_user_session):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.session_auth import SESSION_COOKIE_NAME

    with TestClient(app) as client:
        client.cookies.set(
            SESSION_COOKIE_NAME,
            test_user_session["token"],
        )

        client.headers.update({
            "Origin": "http://localhost:3000",
        })

        yield client
