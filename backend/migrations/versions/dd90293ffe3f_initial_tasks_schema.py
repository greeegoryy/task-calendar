
"""Initial tasks schema.

Revision ID: dd90293ffe3f
Revises:
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "dd90293ffe3f"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(length=200),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "start",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "end",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "color",
            sa.String(length=7),
            nullable=False,
        ),
        sa.Column(
            "completed",
            sa.Boolean(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("tasks")
