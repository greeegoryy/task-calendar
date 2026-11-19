
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.admin_auth import get_current_admin
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.task import Task
from app.models.user import User


router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


# =========================
# RESPONSE SCHEMAS
# =========================

class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: datetime


class AdminAuditLogOut(BaseModel):
    id: UUID
    user_id: UUID | None
    user_email: str | None
    action: str
    resource_type: str | None
    resource_id: UUID | None
    details: dict | None
    created_at: datetime


class AdminAuditLogsPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AdminAuditLogOut]


class AdminRoleUpdate(BaseModel):
    is_admin: bool


class AdminTaskOut(BaseModel):
    id: UUID
    user_id: UUID | None
    user_email: str | None
    title: str
    description: str
    start: datetime
    end: datetime
    color: str
    completed: bool


class AdminTasksPage(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AdminTaskOut]


# =========================
# LIST USERS
# =========================

@router.get(
    "/users",
    response_model=list[AdminUserOut],
)
def list_users(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(User).order_by(User.created_at.desc())
    ).all()


# =========================
# LIST AUDIT LOGS
# =========================

@router.get(
    "/audit-logs",
    response_model=AdminAuditLogsPage,
)
def list_audit_logs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    total = db.scalar(
        select(func.count()).select_from(AuditLog)
    ) or 0

    statement = (
        select(AuditLog, User.email)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(
            AuditLog.created_at.desc(),
            AuditLog.id.desc(),
        )
        .limit(limit)
        .offset(offset)
    )

    rows = db.execute(statement).all()

    items = [
        AdminAuditLogOut(
            id=log.id,
            user_id=log.user_id,
            user_email=email,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            created_at=log.created_at,
        )
        for log, email in rows
    ]

    return AdminAuditLogsPage(
        total=total,
        limit=limit,
        offset=offset,
        items=items,
    )


# =========================
# UPDATE USER ROLE
# =========================

@router.patch(
    "/users/{user_id}/role",
    response_model=AdminUserOut,
)
def update_user_role(
    user_id: UUID,
    payload: AdminRoleUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        db.execute(
            text("SELECT pg_advisory_xact_lock(22012)")
        )

        actor = db.scalar(
            select(User)
            .where(User.id == current_admin.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        if (
            actor is None
            or not actor.is_active
            or not actor.is_admin
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator privileges required.",
            )

        target_user = db.scalar(
            select(User)
            .where(User.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        if target_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        if target_user.is_admin == payload.is_admin:
            db.commit()
            db.refresh(target_user)
            return target_user

        if payload.is_admin and not target_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot grant admin role to an inactive user.",
            )

        if target_user.is_admin and not payload.is_admin:
            active_admin_count = db.scalar(
                select(func.count())
                .select_from(User)
                .where(
                    User.is_admin.is_(True),
                    User.is_active.is_(True),
                )
            ) or 0

            if target_user.is_active and active_admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Cannot remove the last active administrator.",
                )

        old_role = target_user.is_admin
        target_user.is_admin = payload.is_admin

        db.add(
            AuditLog(
                user_id=actor.id,
                action=(
                    "ADMIN_ROLE_GRANTED"
                    if payload.is_admin
                    else "ADMIN_ROLE_REVOKED"
                ),
                resource_type="user",
                resource_id=target_user.id,
                details={
                    "result": "success",
                    "target_email": target_user.email,
                    "old_is_admin": old_role,
                    "new_is_admin": payload.is_admin,
                },
            )
        )

        db.commit()
        db.refresh(target_user)

        return target_user

    except Exception:
        db.rollback()
        raise


# =========================
# LIST ALL TASKS
# =========================

@router.get(
    "/tasks",
    response_model=AdminTasksPage,
)
def list_all_tasks(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    total = db.scalar(
        select(func.count()).select_from(Task)
    ) or 0

    statement = (
        select(Task, User.email)
        .outerjoin(User, Task.user_id == User.id)
        .order_by(
            Task.start.desc(),
            Task.id.desc(),
        )
        .limit(limit)
        .offset(offset)
    )

    rows = db.execute(statement).all()

    items = [
        AdminTaskOut(
            id=task.id,
            user_id=task.user_id,
            user_email=email,
            title=task.title,
            description=task.description,
            start=task.start,
            end=task.end,
            color=task.color,
            completed=task.completed,
        )
        for task, email in rows
    ]

    return AdminTasksPage(
        total=total,
        limit=limit,
        offset=offset,
        items=items,
    )


# =========================
# DELETE ANY TASK
# =========================

@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def admin_delete_task(
    task_id: UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        # Lock and re-check administrator permissions.
        actor = db.scalar(
            select(User)
            .where(User.id == current_admin.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

        if (
            actor is None
            or not actor.is_active
            or not actor.is_admin
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator privileges required.",
            )

        # Lock the task before deleting it.
        task = db.scalar(
            select(Task)
            .where(Task.id == task_id)
            .with_for_update()
        )

        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found.",
            )

        # Save relevant data before deletion.
        task_owner_id = task.user_id
        task_title = task.title

        owner_email = None

        if task_owner_id is not None:
            owner_email = db.scalar(
                select(User.email)
                .where(User.id == task_owner_id)
            )

        # Record who deleted the task and who owned it.
        db.add(
            AuditLog(
                user_id=actor.id,
                action="ADMIN_TASK_DELETED",
                resource_type="task",
                resource_id=task.id,
                details={
                    "result": "success",
                    "task_title": task_title,
                    "task_owner_id": (
                        str(task_owner_id)
                        if task_owner_id is not None
                        else None
                    ),
                    "task_owner_email": owner_email,
                },
            )
        )

        db.delete(task)
        db.commit()

    except Exception:
        db.rollback()
        raise
