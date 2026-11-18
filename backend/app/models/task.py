
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )

    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False
    )

    description: Mapped[str] = mapped_column(
        Text,
        default="",
        nullable=False
    )

    start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    color: Mapped[str] = mapped_column(
        String(7),
        default="#6366f1",
        nullable=False
    )

    completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
