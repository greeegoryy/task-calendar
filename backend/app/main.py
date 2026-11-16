from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4
import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import Boolean, DateTime, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)

class Base(DeclarativeBase):
    pass

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#6366f1", nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    start: datetime
    end: datetime
    color: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")
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

app = FastAPI(title="Task Calendar API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def startup():
    Base.metadata.create_all(engine)

@app.get("/health")
def health():
    with engine.connect() as conn:
        conn.exec_driver_sql("SELECT 1")
    return {"status": "ok"}

@app.get("/api/tasks", response_model=list[TaskOut])
def list_tasks():
    with Session(engine) as db:
        return db.scalars(select(Task).order_by(Task.start)).all()

@app.post("/api/tasks", response_model=TaskOut, status_code=201)
def create_task(payload: TaskInput):
    with Session(engine) as db:
        task = Task(**payload.model_dump())
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

@app.get("/api/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: UUID):
    with Session(engine) as db:
        task = db.get(Task, task_id)
        if task is None:
            raise HTTPException(404, "Task not found")
        return task

@app.put("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: UUID, payload: TaskInput):
    with Session(engine) as db:
        task = db.get(Task, task_id)
        if task is None:
            raise HTTPException(404, "Task not found")
        for key, value in payload.model_dump().items():
            setattr(task, key, value)
        db.commit()
        db.refresh(task)
        return task

@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: UUID):
    with Session(engine) as db:
        task = db.get(Task, task_id)
        if task is None:
            raise HTTPException(404, "Task not found")
        db.delete(task)
        db.commit()
