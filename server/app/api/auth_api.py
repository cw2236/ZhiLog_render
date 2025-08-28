import logging
import os
from typing import Optional
from datetime import datetime, timedelta, timezone

from app.auth.dependencies import get_current_user, get_required_user, create_temp_user, create_session
from app.auth.utils import clear_session_cookie, set_session_cookie
from app.schemas.user import CurrentUser
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

auth_router = APIRouter()

client_domain = os.getenv("CLIENT_DOMAIN", "http://localhost:3000")
api_domain = os.getenv("API_DOMAIN", "http://localhost:8000")


class AuthResponse(BaseModel):
    """Response model for auth routes."""

    success: bool
    message: str
    user: Optional[CurrentUser] = None


@auth_router.get("/me", response_model=AuthResponse)
async def get_me(
    request: Request,
    response: Response,
    current_user: Optional[CurrentUser] = Depends(get_current_user)
):
    """Get current user information."""
    try:
        if not current_user:
            # 如果没有用户，自动创建一个临时用户
            temp_user = create_temp_user()
            token = create_session(temp_user)
            
            # 设置session cookie，使用timezone-aware的datetime
            expires_at = datetime.now(timezone.utc) + timedelta(days=30)
            set_session_cookie(
                response, 
                token=token, 
                expires_at=expires_at
            )
            
            # 返回用户信息
            return AuthResponse(
                success=True, 
                message="Created temporary user", 
                user=temp_user
            )
        
        return AuthResponse(success=True, message="User authenticated", user=current_user)
    except Exception as e:
        logger.error(f"Error in get_me: {e}")
        # 返回一个简单的错误响应，而不是抛出异常
        return AuthResponse(
            success=False,
            message=f"Error: {str(e)}",
            user=None
        )


@auth_router.post("/auto-login")
async def auto_login(response: Response):
    """自动登录，创建临时用户用于测试"""
    try:
        # 创建临时用户
        temp_user = create_temp_user()
        token = create_session(temp_user)
        
        # 设置session cookie，使用timezone-aware的datetime
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        set_session_cookie(
            response, 
            token=token, 
            expires_at=expires_at
        )
        
        return AuthResponse(
            success=True, 
            message="Auto login successful", 
            user=temp_user
        )
    except Exception as e:
        logger.error(f"Error during auto login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to auto login"
        )


@auth_router.post("/logout")
async def logout(
    response: Response,
    current_user: CurrentUser = Depends(get_required_user),
):
    """Logout user and clear session."""
    try:
        # 简化logout逻辑，使用内存存储
        # 清理内存中的会话数据
        from app.auth.dependencies import session_tokens, user_sessions
        
        # 找到并删除用户的会话token
        token_to_remove = None
        for token, user_id in session_tokens.items():
            if user_id == str(current_user.id):
                token_to_remove = token
                break
        
        if token_to_remove:
            del session_tokens[token_to_remove]
        
        # 删除用户数据
        if str(current_user.id) in user_sessions:
            del user_sessions[str(current_user.id)]
        
        # Clear session cookie
        clear_session_cookie(response)
        
        return AuthResponse(success=True, message="Logged out successfully")
    except Exception as e:
        logger.error(f"Error during logout: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to logout"
        )
