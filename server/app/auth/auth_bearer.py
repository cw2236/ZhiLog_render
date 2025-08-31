from fastapi import Depends, HTTPException, Cookie, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

from .auth_types import CurrentUser
from .dependencies import get_current_user

security = HTTPBearer(auto_error=False)

async def get_required_user(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> CurrentUser:
    """获取当前登录用户，如果未登录则抛出异常"""
    # 从内存存储获取用户
    try:
        current_user = await get_current_user(request, auth)
        if current_user:
            return current_user
    except Exception as e:
        print(f"Error getting current user from memory: {e}")
        pass
    
    # 如果内存存储失败，抛出认证错误
    raise HTTPException(status_code=401, detail="Authentication required") 