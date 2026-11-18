
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    start: datetime
    end: datetime
    color: str = Field(
        default="#6366f1",
        pattern=r"^#[0-9a-fA-F]{6}$"
    )
    completed: bool = False

    @model_validator(mode="after")
    def validate_times(self):
        if self.start.tzinfo is None or self.end.tzinfo is None:
            raise ValueError("Dates must include a timezone offset")

        if self.end <= self.start:
            raise ValueError("End must be after start")

        return self


class TaskOut(TaskInput):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
