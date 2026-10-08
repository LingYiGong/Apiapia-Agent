from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class UserCreate(BaseModel):
    # Widths mirror models/user.py. Unbounded, a 60-character username reached
    # Postgres and surfaced as a 500 rather than a 422 naming the field.
    username: str = Field(min_length=2, max_length=50)
    email: EmailStr = Field(max_length=255)
    # Lower bound only; bcrypt silently truncates at 72 *bytes*, so anything past
    # that is ignored by the hash and two different passwords would authenticate
    # each other. See core/security.get_password_hash.
    password: str = Field(min_length=6, max_length=72)


class UserLogin(BaseModel):
    username_or_email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=72)


class UserResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    is_superuser: bool = False
    is_active: bool = True
    can_access_all_models: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
