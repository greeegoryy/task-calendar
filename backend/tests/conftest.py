
import os

import pytest
from sqlalchemy import create_engine, text


@pytest.fixture
def test_db_engine():
    database_url = os.environ["TEST_DATABASE_URL"]

    engine = create_engine(
        database_url,
        pool_pre_ping=True
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


@pytest.fixture
def cleanup_tasks(test_db_engine):
    task_ids = []

    yield task_ids

    with test_db_engine.begin() as connection:
        for task_id in task_ids:
            connection.execute(
                text("DELETE FROM tasks WHERE id = :id"),
                {"id": task_id}
            )
