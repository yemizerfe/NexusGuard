# api/admin.py - COMPLETE WORKING VERSION
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete
from datetime import datetime, timedelta
import uuid
import re

from database import get_db
from models import User, SecurityScan, SecurityLog, Alert
from auth import get_current_user

router = APIRouter()


async def require_admin(current_user: dict = Depends(get_current_user)):
    """Check if user is admin"""
    if not current_user.get("is_superuser"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def create_security_log(
    db: AsyncSession,
    user_id: uuid.UUID = None,
    event_type: str = None,
    severity: str = "info",
    ip_address: str = None,
    user_agent: str = None,
    details: dict = None
):
    """Create a security log entry"""
    try:
        log = SecurityLog(
            user_id=user_id,
            event_type=event_type,
            severity=severity,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details or {},
            created_at=datetime.utcnow()
        )
        db.add(log)
        await db.commit()
        return log
    except Exception as e:
        print(f"Failed to create log: {e}")
        await db.rollback()
        return None


# ============ DASHBOARD STATS ============
@router.get("/stats")
async def get_admin_stats(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get admin dashboard statistics"""
    try:
        # Total users
        user_result = await db.execute(select(func.count()).select_from(User))
        total_users = user_result.scalar() or 0
        
        # Active users (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        active_users_result = await db.execute(
            select(func.count()).select_from(User).where(User.last_login >= week_ago)
        )
        active_users = active_users_result.scalar() or 0
        
        # Total scans (non-deleted)
        scan_result = await db.execute(
            select(func.count()).select_from(SecurityScan).where(SecurityScan.is_deleted == False)
        )
        total_scans = scan_result.scalar() or 0
        
        # Total logs
        log_result = await db.execute(select(func.count()).select_from(SecurityLog))
        total_logs = log_result.scalar() or 0
        
        # Active alerts (status = 'active')
        active_alerts_result = await db.execute(
            select(func.count()).select_from(Alert).where(Alert.status == "active")
        )
        active_alerts = active_alerts_result.scalar() or 0
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "total_scans": total_scans,
            "total_logs": total_logs,
            "active_alerts": active_alerts,
            "api_health": "healthy",
            "db_health": "healthy"
        }
    except Exception as e:
        print(f"Error in /stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ RECENT USERS ============
@router.get("/users/recent")
async def get_recent_users(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 10
):
    """Get recently registered users"""
    try:
        result = await db.execute(
            select(User).order_by(desc(User.created_at)).limit(limit)
        )
        users = result.scalars().all()
        
        users_data = []
        for user in users:
            users_data.append({
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "is_superuser": user.is_superuser,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None
            })
        
        return {"users": users_data}
    except Exception as e:
        print(f"Error in /users/recent: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ ALL USERS (PAGINATED) ============
@router.get("/users")
async def get_all_users(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """Get all users with pagination"""
    try:
        result = await db.execute(
            select(User).order_by(desc(User.created_at)).offset(skip).limit(limit)
        )
        users = result.scalars().all()
        
        users_data = []
        for user in users:
            users_data.append({
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "is_superuser": user.is_superuser,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None
            })
        
        count_result = await db.execute(select(func.count()).select_from(User))
        total = count_result.scalar() or 0
        
        return {
            "users": users_data,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        print(f"Error in /users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ TOGGLE USER STATUS ============
@router.patch("/users/{user_id}/toggle")
async def toggle_user_status(
    user_id: str,
    admin: dict = Depends(require_admin),
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """Enable or disable a user account"""
    try:
        ip_address = request.client.host if request else None
        
        # Prevent disabling own account
        if user_id == str(admin["id"]):
            raise HTTPException(status_code=400, detail="Cannot disable your own account")
        
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user.is_active = not user.is_active
        await db.commit()
        
        return {
            "id": str(user.id),
            "is_active": user.is_active,
            "message": f"User {'enabled' if user.is_active else 'disabled'} successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in /users/{user_id}/toggle: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ ALL SCANS ============
@router.get("/all-scans")
async def get_all_scans(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    include_deleted: bool = False,
    limit: int = 100,
    skip: int = 0
):
    """Get all scans across all users"""
    try:
        query = select(SecurityScan).order_by(desc(SecurityScan.started_at))
        
        if not include_deleted:
            query = query.where(SecurityScan.is_deleted == False)
        
        result = await db.execute(query.offset(skip).limit(limit))
        scans = result.scalars().all()
        
        user_ids = {scan.user_id for scan in scans if scan.user_id}
        users = {}
        if user_ids:
            user_result = await db.execute(
                select(User).where(User.id.in_(user_ids))
            )
            for user in user_result.scalars().all():
                users[str(user.id)] = user.email
        
        return {
            "scans": [
                {
                    "id": str(s.id),
                    "target": s.target,
                    "risk_score": s.risk_score or 0,
                    "status": s.scan_status,
                    "started_at": s.started_at.isoformat(),
                    "user_email": users.get(str(s.user_id), "unknown"),
                    "is_deleted": s.is_deleted,
                    "deleted_at": s.deleted_at.isoformat() if s.deleted_at else None,
                    "deleted_by": s.deleted_by,
                    "deletion_reason": s.deletion_reason
                }
                for s in scans
            ]
        }
    except Exception as e:
        print(f"Error in /all-scans: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ DELETE SCAN ============
@router.delete("/scans/{scan_id}")
async def admin_delete_scan(
    scan_id: str,
    admin: dict = Depends(require_admin),
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """Admin delete any scan"""
    try:
        result = await db.execute(
            select(SecurityScan).where(SecurityScan.id == uuid.UUID(scan_id))
        )
        scan = result.scalar_one_or_none()
        
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")
        
        # Delete associated alerts
        await db.execute(delete(Alert).where(Alert.scan_id == scan.id))
        
        # Delete the scan
        await db.delete(scan)
        await db.commit()
        
        return {"message": "Scan permanently deleted", "scan_id": scan_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting scan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ ALL LOGS ============
@router.get("/all-logs")
async def get_all_logs(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 200,
    skip: int = 0
):
    """Get all system logs"""
    try:
        result = await db.execute(
            select(SecurityLog)
            .order_by(desc(SecurityLog.created_at))
            .offset(skip)
            .limit(limit)
        )
        logs = result.scalars().all()
        
        user_ids = {log.user_id for log in logs if log.user_id}
        users = {}
        if user_ids:
            user_result = await db.execute(
                select(User).where(User.id.in_(user_ids))
            )
            for user in user_result.scalars().all():
                users[str(user.id)] = user.email
        
        logs_data = []
        for l in logs:
            logs_data.append({
                "id": str(l.id),
                "user_email": users.get(str(l.user_id), "deleted_user") if l.user_id else "system",
                "event": l.event_type,
                "severity": l.severity,
                "ip": l.ip_address or "unknown",
                "details": l.details,
                "created_at": l.created_at.isoformat()
            })
        
        return {"logs": logs_data, "total": len(logs_data)}
    except Exception as e:
        print(f"Error in /all-logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ ALL ALERTS ============
@router.get("/all-alerts")
async def get_all_alerts(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
    skip: int = 0
):
    """Get all alerts across all users"""
    try:
        result = await db.execute(
            select(Alert)
            .order_by(desc(Alert.created_at))
            .offset(skip)
            .limit(limit)
        )
        alerts = result.scalars().all()
        
        user_ids = {alert.user_id for alert in alerts if alert.user_id}
        users = {}
        if user_ids:
            user_result = await db.execute(
                select(User).where(User.id.in_(user_ids))
            )
            for user in user_result.scalars().all():
                users[str(user.id)] = user.email
        
        return {
            "alerts": [
                {
                    "id": str(a.id),
                    "title": a.title,
                    "severity": a.severity,
                    "status": a.status,
                    "created_at": a.created_at.isoformat(),
                    "user_email": users.get(str(a.user_id), "unknown"),
                    "source_ip": a.source_ip,
                    "description": a.description
                }
                for a in alerts
            ]
        }
    except Exception as e:
        print(f"Error in /all-alerts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ SYSTEM SETTINGS ============
@router.get("/settings")
async def get_system_settings(
    admin: dict = Depends(require_admin)
):
    """Get system settings"""
    return {
        "settings": {
            "scan_timeout": 300,
            "max_concurrent_scans": 5,
            "alert_retention_days": 90,
            "log_retention_days": 30,
            "enable_ai_analysis": True
        }
    }


print("✅ Admin routes loaded:")
print("   - GET /stats")
print("   - GET /users")
print("   - GET /users/recent")
print("   - PATCH /users/{user_id}/toggle")
print("   - GET /all-scans")
print("   - DELETE /scans/{scan_id}")
print("   - GET /all-logs")
print("   - GET /all-alerts")