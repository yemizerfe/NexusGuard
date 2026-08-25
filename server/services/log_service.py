# services/log_service.py
from models import SecurityLog
from datetime import datetime
import uuid

async def create_log(db, user_id, event, ip, severity="low", details=None, user_agent=None):
    """Create a security log entry"""
    log = SecurityLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        event_type=event,
        ip_address=ip,
        severity=severity,
        user_agent=user_agent,
        details=details or {},
        created_at=datetime.utcnow()
    )
    db.add(log)
    await db.flush()
    return log


async def create_api_key_log(db, user_id, api_key_name, action, ip_address, user_agent=None):
    """Create a log specifically for API key actions"""
    log = SecurityLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        event_type=f"API_KEY_{action}",
        ip_address=ip_address,
        severity="low",
        user_agent=user_agent,
        details={
            "api_key_name": api_key_name,
            "action": action,
            "timestamp": datetime.utcnow().isoformat()
        },
        created_at=datetime.utcnow()
    )
    db.add(log)
    await db.flush()
    return log


async def create_scan_log(db, user_id, scan_id, target, action, ip_address, user_agent=None):
    """Create a log for scan actions"""
    log = SecurityLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        event_type=f"SCAN_{action}",
        ip_address=ip_address,
        severity="info",
        user_agent=user_agent,
        details={
            "scan_id": scan_id,
            "target": target,
            "action": action,
            "timestamp": datetime.utcnow().isoformat()
        },
        created_at=datetime.utcnow()
    )
    db.add(log)
    await db.flush()
    return log