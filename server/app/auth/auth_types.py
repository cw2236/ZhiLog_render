from pydantic import BaseModel
from uuid import UUID
from typing import Optional

class CurrentUser(BaseModel):
    id: UUID
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    is_admin: bool = False 