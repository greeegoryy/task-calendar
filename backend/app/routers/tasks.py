
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine
from app.models.task import Task
from app.schemas.task import TaskInput, TaskOut


router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
def list_tasks():
    with Session(engine) as db:
        return db.scalars(
            select(Task).order_by(Task.start)
        ).all()


@router.post("", response_model=TaskOut, status_code=201)
def create_task(payload: TaskInput):
    with Session(engine) as db:
        task = Task(**payload.model_dump())

        db.add(task)
        db.commit()
        db.refresh(task)

        return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: UUID):
    with Session(engine) as db:
        task = db.get(Task, task_id)

        if task is None:
            raise HTTPException(
                status_code=404,
                detail="Task not found"
            )

        return task


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: UUID, payload: TaskInput):
    with Session(engine) as db:
        task = db.get(Task, task_id)

        if task is None:
            raise HTTPException(
                status_code=404,
                detail="Task not found"
            )

        for key, value in payload.model_dump().items():
            setattr(task, key, value)

        db.commit()
        db.refresh(task)

        return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: UUID):
    with Session(engine) as db:
        task = db.get(Task, task_id)

        if task is None:
            raise HTTPException(
                status_code=404,
                detail="Task not found"
            )

        db.delete(task)
        db.commit()
