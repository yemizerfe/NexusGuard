# api/dashboard.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime

from database import get_db
from models import Alert, SecurityLog, SecurityScan
from auth import get_current_user

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    logs_today = await db.execute(
        select(func.count()).select_from(SecurityLog).where(
            SecurityLog.user_id == current_user["id"],
            SecurityLog.created_at >= today_start
        )
    )
    
    active_alerts = await db.execute(
        select(func.count()).select_from(Alert).where(
            Alert.status == "active",
            Alert.user_id == current_user["id"]
        )
    )
    
    return {
        "total_logs_today": logs_today.scalar() or 0,
        "active_alerts": active_alerts.scalar() or 0,
        "high_risk_users": 0,
        "blocked_ips": 0
    }


@router.get("/logs")
async def get_logs(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get recent security logs for dashboard table with real IP addresses"""
    result = await db.execute(
        select(SecurityLog)
        .where(SecurityLog.user_id == current_user["id"])
        .order_by(desc(SecurityLog.created_at))
        .limit(limit)
    )
    logs = result.scalars().all()
    
    return [
        {
            "id": str(log.id),
            "time": log.created_at.strftime("%H:%M:%S"),
            "user": current_user["email"],
            "ip": log.ip_address if log.ip_address else "unknown",
            "event": log.event_type,
            "severity": log.severity,
            "created_at": log.created_at.isoformat()
        }
        for log in logs
    ]


@router.get("/alerts")
async def get_active_alerts(
    limit: int = 10,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get active alerts for dashboard"""
    result = await db.execute(
        select(Alert)
        .where(
            Alert.user_id == current_user["id"],
            Alert.status == "active"
        )
        .order_by(desc(Alert.created_at))
        .limit(limit)
    )
    alerts = result.scalars().all()
    
    alert_list = []
    for alert in alerts:
        scan_target = None
        if alert.scan_id:
            scan_result = await db.execute(
                select(SecurityScan).where(SecurityScan.id == alert.scan_id)
            )
            scan = scan_result.scalar_one_or_none()
            if scan:
                scan_target = scan.target
        
        alert_list.append({
            "id": str(alert.id),
            "severity": alert.severity,
            "message": alert.title,
            "description": alert.description,
            "source_ip": alert.source_ip or "unknown",
            "source_type": alert.source_type or "scan",
            "target": scan_target or alert.target,
            "timestamp": alert.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "created_at": alert.created_at.isoformat(),
            "explanation": alert.ai_insight.get("explanation") if alert.ai_insight else None,
            "status": alert.status
        })
    
    return alert_list