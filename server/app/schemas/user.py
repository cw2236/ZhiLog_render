from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# Base User Schema
class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    picture: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False
    locale: Optional[str] = None


# Schema for creating a new user
class UserCreate(UserBase):
    password: str


# Schema for updating a user
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    locale: Optional[str] = None


# Schema for returning a user
class User(UserBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class ConfigDict:
        from_attributes = True


# Base Session Schema
class SessionBase(BaseModel):
    user_id: UUID
    expires_at: datetime
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None


# Schema for creating a session
class SessionCreate(SessionBase):
    token: str


# Schema for returning a session
class Session(SessionBase):
    id: UUID
    token: str
    created_at: datetime

    class ConfigDict:
        from_attributes = True


# Token schema for JWT
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# Schema to encode in JWT
class TokenPayload(BaseModel):
    sub: str  # user_id
    exp: int  # expiration time


# Current user with scopes/permissions
class CurrentUser(BaseModel):
    id: UUID
    email: EmailStr
    name: Optional[str] = None
    is_admin: bool = False
    picture: Optional[str] = None

    # is_active describes if the user account is on the RESEARCHER or BASIC plan
    is_active: bool = False

    class ConfigDict:
        from_attributes = True
