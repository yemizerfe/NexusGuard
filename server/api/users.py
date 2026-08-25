# api/users.py - Updated with correct function names
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import List, Optional
import secrets
import hashlib
import uuid

from database import get_db
from models import User, ApiKey, Alert, SecurityLog
from auth import get_current_user, verify_password, get_password_hash  # ✅ Changed from hash_password to get_password_hash
from services.log_service import create_log

router = APIRouter()


# ============ PASSWORD CHANGE ============

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change user password"""
    # Get user from DB
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify current password
    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Hash and update new password using get_password_hash
    user.password_hash = get_password_hash(request.new_password)  # ✅ Fixed

    await db.commit()

    return {"message": "Password changed successfully"}


# ============ USER PROFILE ============

@router.get("/profile")
async def get_profile(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get full user profile"""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None
    }