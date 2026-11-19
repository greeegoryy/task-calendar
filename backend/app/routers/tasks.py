
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskInput, TaskOut
from app.session_auth import get_current_user


router = APIRouter(
    prefix="/api/tasks",
    tags=["tasks"],
)


# =========================
# AUDIT HELPER
# =========================

def add_task_audit(
    db: Session,
    user_id: UUID,
    action: str,
    task_id: UUID,
):
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type="task",
        resource_id=task_id,
        details={
            "result": "success",
        },
    )

    db.add(audit_log)


# =========================
# LIST TASKS
# =========================

@router.get("", response_model=list[TaskOut])
def list_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Task)
        .where(Task.user_id == current_user.id)
        .order_by(Task.start)
    ).all()


# =========================
# CREATE TASK
# =========================

@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    payload: TaskInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = Task(
        **payload.model_dump(),
        user_id=current_user.id,
    )

    db.add(task)

    # Generate the task UUID before creating the audit event.
    db.flush()

    add_task_audit(
        db=db,
        user_id=current_user.id,
        action="TASK_CREATED",
        task_id=task.id,
    )

    # Task and audit event are committed together.
    db.commit()
    db.refresh(task)

    return task


# =========================
# GET TASK
# =========================

@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return task


# =========================
# UPDATE TASK
# =========================

@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: UUID,
    payload: TaskInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.scalar(
        select(Task)
        .where(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .with_for_update()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    for key, value in payload.model_dump().items():
        setattr(task, key, value)

    add_task_audit(
        db=db,
        user_id=current_user.id,
        action="TASK_UPDATED",
        task_id=task.id,
    )

    # Task update and audit event are committed together.
    db.commit()
    db.refresh(task)

    return task


# =========================
# DELETE TASK
# =========================

@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.scalar(
        select(Task)
        .where(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .with_for_update()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    add_task_audit(
        db=db,
        user_id=current_user.id,
        action="TASK_DELETED",
        task_id=task.id,
    )

    db.delete(task)

    # Task deletion and audit event are committed together.
    db.commit()
