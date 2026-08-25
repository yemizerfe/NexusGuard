# api/alerts.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from datetime import datetime

from database import get_db
from models import Alert, SecurityScan
from auth import get_current_user

router = APIRouter()


@router.get("/")
async def get_alerts(
    status: str = "active",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get alerts with optional status filter"""
    query = select(Alert).where(
        Alert.status == status,
        Alert.user_id == current_user["id"]
    ).order_by(desc(Alert.created_at))

    result = await db.execute(query)
    alerts = result.scalars().all()

    # Get the scan for each alert to retrieve target domain
    alerts_data = []
    for alert in alerts:
        # Fetch the associated scan to get the target domain
        target_domain = None
        if alert.scan_id:
            scan_result = await db.execute(
                select(SecurityScan).where(SecurityScan.id == alert.scan_id)
            )
            scan = scan_result.scalar_one_or_none()
            if scan:
                target_domain = scan.target
        
        # Filter out localhost IPs - don't show them
        source_ip = alert.source_ip
        if source_ip in ['127.0.0.1', 'localhost', '0.0.0.0', '::1']:
            source_ip = None  # Don't show localhost IPs
        
        alerts_data.append({
            "id": alert.id,
            "severity": alert.severity,
            "title": alert.title,
            "message": alert.description,
            "created_at": alert.created_at.isoformat(),
            "status": alert.status,
            "ai_explanation": alert.ai_insight.get("explanation") if alert.ai_insight else None,
            "source_ip": source_ip,  # Will be None for localhost (won't display)
            "target": target_domain,
            "mitre_tactic": alert.mitre_tactic,
            "mitre_technique": alert.mitre_technique
        })

    return alerts_data


@router.patch("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resolve a specific alert"""
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = current_user["id"]
    await db.commit()

    return {"message": "Alert resolved", "status": "success"}