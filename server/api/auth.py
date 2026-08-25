# api/auth.py - COMPLETE WITH LOCAL (NO-EMAIL) FORGOT/RESET PASSWORD
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timedelta
import secrets
import os
from dotenv import load_dotenv

from database import get_db
from auth import get_current_user, register_user, login_user, get_password_hash, verify_password
from models import User
from api.admin import create_security_log

load_dotenv()

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    full_name: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class DirectResetRequest(BaseModel):
    email: str
    new_password: str


# ============ API ENDPOINTS ============

@router.post("/register")
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    try:
        result = await register_user(db, request.email, request.full_name, request.password)
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
async def login(
    request: LoginRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Login user"""
    try:
        client_ip = http_request.client.host if http_request.client else "unknown"
        user_agent = http_request.headers.get("user-agent", "unknown")
        
        result = await db.execute(select(User).where(User.email == request.email))
        user = result.scalar_one_or_none()
        
        login_result = await login_user(db, request.email, request.password, client_ip)
        
        if user:
            await create_security_log(
                db=db,
                user_id=user.id,
                event_type="LOGIN_SUCCESS",
                severity="info",
                ip_address=client_ip,
                user_agent=user_agent,
                details={"email": request.email}
            )
        
        return login_result
        
    except HTTPException as e:
        client_ip = http_request.client.host if http_request.client else "unknown"
        user_agent = http_request.headers.get("user-agent", "unknown")
        
        result = await db.execute(select(User).where(User.email == request.email))
        user = result.scalar_one_or_none()
        
        await create_security_log(
            db=db,
            user_id=user.id if user else None,
            event_type="LOGIN_FAILED",
            severity="high",
            ip_address=client_ip,
            user_agent=user_agent,
            details={
                "email": request.email,
                "reason": str(e.detail) if hasattr(e, 'detail') else "Invalid credentials"
            }
        )
        raise e
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ FORGOT PASSWORD ============

@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Generate a password reset link locally (NO email is sent).

    The token is stored on the user row via the ORM, the link is printed to
    the server console AND returned directly in the API response.
    """
    
    client_ip = http_request.client.host if http_request.client else "unknown"
    user_agent = http_request.headers.get("user-agent", "unknown")
    
    # Check if user exists
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user:
        # Email not found in DB - tell the local client directly
        print(f"Password reset requested for non-existent email: {request.email}")
        return {"message": "No account found with this email address.", "exists": False}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    
    # Store token in database via ORM (expires in 1 hour)
    user.reset_token = reset_token
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    await db.commit()
    
    # Build the local reset link (no email is ever sent)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    # Local mode: print the link to the server console instead of emailing it
    print(f"\n{'='*60}")
    print("🔐 PASSWORD RESET LINK (local mode - no email sent)")
    print(f"Email: {request.email}")
    print(f"Link: {reset_link}")
    print("Expires in: 1 hour")
    print(f"{'='*60}\n")
    
    # Log the reset request
    await create_security_log(
        db=db,
        user_id=user.id,
        event_type="PASSWORD_RESET_REQUESTED",
        severity="info",
        ip_address=client_ip,
        user_agent=user_agent,
        details={"email": request.email}
    )
    
    return {
        "message": "Email verified. You can now set a new password.",
        "exists": True,
        "reset_link": reset_link,
    }


@router.post("/reset-password-by-email")
async def reset_password_by_email(
    request: DirectResetRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Local-mode password reset: verify the email exists in the DB and set
    the new password directly. No email is ever sent."""
    
    client_ip = http_request.client.host if http_request.client else "unknown"
    user_agent = http_request.headers.get("user-agent", "unknown")
    
    # Validate password strength (same rules as registration)
    if (len(request.new_password) < 8
            or not any(c.isupper() for c in request.new_password)
            or not any(c.islower() for c in request.new_password)
            or not any(c.isdigit() for c in request.new_password)):
        raise HTTPException(
            status_code=400,
            detail="Password must have: at least 8 characters, one uppercase letter, one lowercase letter, one number"
        )
    
    # Check the email exists in the database (via ORM)
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email address.")
    
    # Update password via ORM and clear any stale reset token
    user.password_hash = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()
    
    # Log successful password reset
    await create_security_log(
        db=db,
        user_id=user.id,
        event_type="PASSWORD_RESET_SUCCESS",
        severity="info",
        ip_address=client_ip,
        user_agent=user_agent,
        details={"email": user.email, "method": "local_direct"}
    )
    
    print(f"✅ Password reset (direct/local) successful for: {user.email}")
    
    return {"message": "Password reset successfully. You can now log in with your new password."}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Reset password using token"""
    
    client_ip = http_request.client.host if http_request.client else "unknown"
    user_agent = http_request.headers.get("user-agent", "unknown")
    
    # Validate password length
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Find user with valid reset token
    result = await db.execute(
        select(User).where(
            User.reset_token == request.token,
            User.reset_token_expires > datetime.utcnow()
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Update password
    user.password_hash = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()
    
    # Log successful password reset
    await create_security_log(
        db=db,
        user_id=user.id,
        event_type="PASSWORD_RESET_SUCCESS",
        severity="info",
        ip_address=client_ip,
        user_agent=user_agent,
        details={"email": user.email}
    )
    
    print(f"✅ Password reset successful for: {user.email}")
    
    return {"message": "Password reset successfully. You can now login with your new password."}


@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user)
):
    """Get current user info"""
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "is_superuser": current_user.get("is_superuser", False)
    }


print("✅ Auth routes loaded")