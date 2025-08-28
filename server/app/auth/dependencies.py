import logging
import uuid
from typing import Annotated, Optional, Dict
from datetime import datetime, timedelta

from app.schemas.user import CurrentUser
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader

logger = logging.getLogger(__name__)

# Session cookie name
SESSION_COOKIE_NAME = "session"

# 内存存储用户会话 (在生产环境中应该使用Redis)
# 这是一个简单的内存存储，用于测试目的
user_sessions: Dict[str, CurrentUser] = {}
session_tokens: Dict[str, str] = {}  # token -> user_id

# Setup header auth
api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


async def get_current_user(
    request: Request,
    authorization: str = Depends(api_key_header),
) -> Optional[CurrentUser]:
    """
    Get the current user from session token in cookie or Authorization header.
    使用内存存储和cookies，不需要数据库。
    """
    token = None

    # First try from Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")

    # Then try from cookie
    if not token:
        token = request.cookies.get(SESSION_COOKIE_NAME)

    if not token:
        return None

    # 从内存存储中获取用户
    user_id = session_tokens.get(token)
    if not user_id:
        return None

    user = user_sessions.get(user_id)
    if not user:
        return None

    return user


async def get_required_user(
    current_user: Annotated[Optional[CurrentUser], Depends(get_current_user)]
) -> CurrentUser:
    """
    Require a logged-in user for protected routes.
    Raises 401 Unauthorized if no user is found.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


async def get_admin_user(
    current_user: Annotated[CurrentUser, Depends(get_required_user)]
) -> CurrentUser:
    """
    Require an admin user for admin-only routes.
    Raises 403 Forbidden if user is not admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user


# 辅助函数：创建临时用户
def create_temp_user() -> CurrentUser:
    """创建一个临时用户用于测试"""
    user_id = str(uuid.uuid4())
    user = CurrentUser(
        id=uuid.UUID(user_id),
        email="temp@example.com",
        name="Temporary User",
        is_admin=False,
        picture=None,
        is_active=True,
    )
    # 使用字符串形式的user_id作为键
    user_sessions[user_id] = user
    return user


# 辅助函数：创建会话
def create_session(user: CurrentUser) -> str:
    """为用户创建会话token"""
    token = str(uuid.uuid4())
    # 使用字符串形式的user.id作为值
    session_tokens[token] = str(user.id)
    return token  # 返回token


# 辅助函数：清理过期会话
def cleanup_expired_sessions():
    """清理过期的会话（可以定期调用）"""
    # 这里可以添加会话过期逻辑
    # 为了简单起见，暂时不实现
    pass
