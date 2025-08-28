from fastapi import Depends, HTTPException, Cookie, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from ..database.database import get_db
from ..database.models import User, Session as DbSession
from .auth_types import CurrentUser
from .dependencies import get_current_user

security = HTTPBearer(auto_error=False)

async def get_required_user(
    request: Request,
    db: Session = Depends(get_db),
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> CurrentUser:
    """获取当前登录用户，如果未登录则抛出异常"""
    # 首先尝试从内存存储获取用户
    try:
        current_user = await get_current_user(request, auth)
        if current_user:
            return current_user
    except Exception as e:
        # 如果内存存储失败，继续尝试数据库方式
        pass
    
    # 尝试从 cookie 获取 token
    session_token = None
    if not auth:
        cookies = request.cookies
        session_token = cookies.get("session")
        if not session_token:
            raise HTTPException(status_code=401, detail="No authentication token found")
    else:
        session_token = auth.credentials

    # 查询会话
    session = db.query(DbSession).filter(
        DbSession.token == session_token,
        DbSession.expires_at > datetime.now()
    ).first()
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    
    return CurrentUser(
        id=user.id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        is_admin=user.is_admin
    ) 