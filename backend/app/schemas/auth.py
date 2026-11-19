
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# =========================
# REGISTRATION
# =========================

class RegisterInput(BaseModel):
    first_name: str = Field(
        min_length=1,
        max_length=100,
    )

    email: EmailStr


class RegisterResponse(BaseModel):
    message: str


# =========================
# ACCOUNT ACTIVATION
# =========================

class ActivateAccountInput(BaseModel):
    token: str = Field(
        min_length=1,
        max_length=512,
    )

    password: str = Field(
        min_length=12,
        max_length=128,
    )


class ActivateAccountResponse(BaseModel):
    message: str


# =========================
# LOGIN
# =========================

class LoginInput(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    message: str


# =========================
# USER
# =========================

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    email: EmailStr
    is_active: bool
    is_admin: bool
