# api/scans.py - UPDATED with realistic security scoring and fixed list_scans
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, update, or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
import asyncio

from database import get_db, AsyncSessionLocal
from models import SecurityScan, Alert, SecurityLog, User
from auth import get_current_user
from schemas import ScanRequest
from services.log_service import create_log
from services.google_ai import analyze_with_ai
from services.scanner import SecurityScanner

router = APIRouter()

# Severity ranking used to enforce the min_severity reporting threshold
SEVERITY_ORDER = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}


def calculate_security_score_from_findings(findings: List[dict], target: str = None) -> int:
    """
    Calculate SECURITY SCORE (0-100 where HIGHER = MORE SECURE)
    
    Realistic scoring that deducts points for:
    - Missing security headers (CSP, HSTS, etc.)
    - Exposed server information
    - Missing best practices
    
    Special handling for localhost (development environment)
    """
    if not findings:
        return 100
    
    # Check if target is localhost (development environment)
    is_localhost = target in ['127.0.0.1', 'localhost', '::1', '0.0.0.0'] if target else False
    
    security_score = 100
    
    # Adjusted severity deductions - less aggressive for localhost
    if is_localhost:
        # Development environment - gentler deductions
        severity_deductions = {
            "critical": 15,   # Reduced for localhost
            "high": 8,
            "medium": 4,
            "low": 1,
            "info": 0
        }
    else:
        # Production environment - standard deductions
        severity_deductions = {
            "critical": 25,
            "high": 15,
            "medium": 8,
            "low": 3,
            "info": 0
        }
    
    # Track deducted findings to avoid double counting
    deducted_finding_names = set()
    
    # Skip patterns - findings that shouldn't deduct points
    always_skip_patterns = [
        "port 80", "port 443", "port 8080", "port 8443",  # Expected web ports
        "https redirect implemented",  # This is GOOD
        "valid ssl certificate",  # This is GOOD
        "ssl certificate issuer",  # Informational
    ]
    
    # Additional patterns for localhost
    if is_localhost:
        always_skip_patterns.extend([
            "ssl certificate", "https", "certificate", "connection refused"
        ])
    
    for finding in findings:
        severity = finding.get("severity", "info").lower()
        name = finding.get("name", "").lower()
        
        # Skip benign findings
        should_skip = any(pattern in name for pattern in always_skip_patterns)
        if should_skip:
            continue
        
        # Deduct points for everything else
        if name not in deducted_finding_names:
            deducted_finding_names.add(name)
            deduction = severity_deductions.get(severity, 5)
            security_score -= deduction
            print(f"Deducting {deduction} points for: {name} (severity: {severity})")
    
    # For localhost, ensure minimum score isn't too low
    if is_localhost and security_score < 70:
        print(f"⚙️ Localhost detected: Adjusting score from {security_score} to 70")
        security_score = 70
    
    # Ensure score stays within 0-100 range
    security_score = max(0, min(100, security_score))
    
    return security_score


def generate_security_analysis(findings: List[dict], target: str, security_score: int, 
                               critical_count: int, high_count: int, medium_count: int, low_count: int) -> str:
    """Generate user-friendly security analysis based on security score"""
    
    if security_score >= 90:
        rating = "EXCELLENT"
        emoji = "✅"
        description = f"{target} has strong security posture."
    elif security_score >= 80:
        rating = "GOOD"
        emoji = "👍"
        description = f"{target} is generally secure."
    elif security_score >= 70:
        rating = "FAIR"
        emoji = "⚠️"
        description = f"{target} has some security gaps that should be addressed."
    elif security_score >= 50:
        rating = "POOR"
        emoji = "⚠️⚠️"
        description = f"{target} has significant security issues requiring attention."
    else:
        rating = "CRITICAL"
        emoji = "🔴"
        description = f"{target} has severe security vulnerabilities that need immediate action!"
    
    analysis = f"{emoji} SECURITY SCAN COMPLETE: {rating}\n\n"
    analysis += f"📊 Target: {target}\n"
    analysis += f"🛡️ Security Score: {security_score}/100 ({rating})\n\n"
    analysis += f"📈 Findings Summary: {critical_count} Critical, {high_count} High, {medium_count} Medium, {low_count} Low\n\n"
    analysis += f"📝 Assessment: {description}\n\n"
    
    if critical_count > 0:
        analysis += "🚨 CRITICAL ISSUES (Fix Immediately):\n"
        critical_findings = [f for f in findings if f.get("severity") == "critical"][:3]
        for f in critical_findings:
            analysis += f"  • {f.get('name', 'Unknown issue')}\n"
        analysis += "\n"
    
    if high_count > 0:
        analysis += "⚠️ HIGH SEVERITY ISSUES (Address within 24 hours):\n"
        high_findings = [f for f in findings if f.get("severity") == "high"][:3]
        for f in high_findings:
            analysis += f"  • {f.get('name', 'Unknown issue')}\n"
        analysis += "\n"
    
    if medium_count > 0:
        analysis += "📌 MEDIUM SEVERITY ISSUES (Plan to address):\n"
    
    recommendations = []
    for f in findings:
        severity = f.get("severity", "low").lower()
        if severity in ["critical", "high", "medium"]:
            if f.get("recommendation") and f.get("recommendation") not in recommendations:
                recommendations.append(f.get("recommendation"))
                if len(recommendations) >= 5:
                    break
    
    if recommendations:
        analysis += "💡 RECOMMENDATIONS:\n"
        for rec in recommendations:
            analysis += f"  • {rec}\n"
    else:
        analysis += "✅ No critical recommendations. Continue maintaining good security practices.\n"
    
    return analysis


async def run_scan_task(scan_id: str, target: str, user_id: str, client_ip: str,
                        scan_options: Optional[dict] = None):
    """Run actual security scan with AI analysis.

    `scan_options` carries the standard scan parameters (profile, intensity,
    enabled checks, timeouts, HTTP behaviour, reporting prefs) accepted by
    POST /api/scans/run.
    """
    scan_options = scan_options or {}
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SecurityScan).where(
                SecurityScan.id == scan_id,
                SecurityScan.is_deleted == False
            )
        )
        scan = result.scalar_one_or_none()

        if not scan:
            return

        findings = []
        security_score = 0
        critical_count = 0
        high_count = 0
        medium_count = 0
        low_count = 0
        ai_analysis = ""

        try:
            # Update status to running
            scan.scan_status = "running"
            await db.commit()
            print(f"🔄 Scan {scan_id} started for {target}")

            # Run the actual scanner with user-supplied parameters
            scanner = SecurityScanner(options=scan_options)
            scan_data = {"target": target}
            if scan_options.get("ports"):
                scan_data["ports"] = scan_options["ports"]
            else:
                scan_data["port_range"] = scan_options.get("port_range", "top-100")
            print(f"⚙️ Scan params: profile={scan_options.get('profile', 'standard')}, "
                  f"intensity={scan_options.get('intensity', 'normal')}, "
                  f"port_range={scan_data.get('port_range', 'custom list')}")
            scan_results = scanner.run_full_scan(scan_data)

            findings = scan_results.get("findings", [])
            print(f"📊 Found {len(findings)} findings")

            # Enforce min_severity reporting threshold (standard in Nessus/ZAP)
            threshold = SEVERITY_ORDER.get(
                str(scan_options.get("min_severity", "info")).lower(), 0)
            if threshold > 0:
                findings = [
                    f for f in findings
                    if SEVERITY_ORDER.get(str(f.get("severity", "info")).lower(), 0) >= threshold
                ]
                print(f"📉 min_severity filter ({threshold}): {len(findings)} findings kept")

            # Calculate severity counts
            for finding in findings:
                severity = finding.get("severity", "info").lower()
                
                if severity == "critical":
                    critical_count += 1
                elif severity == "high":
                    high_count += 1
                elif severity == "medium":
                    medium_count += 1
                elif severity == "low":
                    low_count += 1

            print(f"📈 Severity breakdown - Critical: {critical_count}, High: {high_count}, Medium: {medium_count}, Low: {low_count}")

            # Calculate security score with target info
            security_score = calculate_security_score_from_findings(findings, target)
            
            ai_analysis = generate_security_analysis(
                findings, target, security_score, 
                critical_count, high_count, medium_count, low_count
            )
            
            # AI post-analysis only when the user kept it enabled
            if scan_options.get("ai_enhanced", True):
                try:
                    ai_result = analyze_with_ai(findings, target)
                    if ai_result and ai_result.get("summary"):
                        ai_analysis = ai_result.get("summary") + "\n\n" + ai_analysis
                except Exception as e:
                    print(f"⚠️ AI enhancement failed: {e}")
            else:
                print("🤖 ai_enhanced=false - skipping Gemini analysis")

            print(f"🎯 Security Score: {security_score}/100 (Higher is Better)")

            # Mark scan as completed
            scan.scan_status = "completed"
            scan.risk_score = security_score
            scan.findings = findings
            scan.findings_count = len(findings)
            scan.critical_count = critical_count
            scan.high_count = high_count
            scan.medium_count = medium_count
            scan.low_count = low_count
            scan.ai_analysis = ai_analysis
            scan.completed_at = datetime.utcnow()
            scan.duration_ms = int((scan.completed_at - scan.started_at).total_seconds() * 1000)

            await db.commit()
            print(f"✅ Scan {scan_id} completed. Security Score: {security_score}/100")

        except Exception as e:
            print(f"❌ Scan {scan_id} failed during scan: {str(e)}")
            import traceback
            traceback.print_exc()
            scan.scan_status = "failed"
            scan.error_message = str(e)[:500]
            await db.commit()
            return

        # Create alerts for critical/high findings with proper UUID handling
        try:
            for finding in findings:
                severity = finding.get("severity", "low").lower()
                name = finding.get("name", "").lower()
                
                skip_alert_patterns = [
                    "port 80", "port 443", "port 8080", "port 8443",
                    "https redirect", "valid ssl", "ssl certificate issuer",
                    "server information", "localhost"
                ]
                should_skip_alert = any(pattern in name for pattern in skip_alert_patterns)
                
                if severity in ["critical", "high"] and not should_skip_alert:
                    alert = Alert(
                        id=uuid.uuid4(),
                        user_id=uuid.UUID(user_id),
                        scan_id=uuid.UUID(scan_id),
                        title=finding.get("name", "Security Finding"),
                        description=finding.get("message", ""),
                        severity=severity,
                        status="active",
                        source_ip=client_ip,
                        source_type="scan",
                        ai_insight={
                            "explanation": finding.get("recommendation", ""),
                            "security_score": security_score
                        },
                        ai_confidence=85,
                        created_at=datetime.utcnow()
                    )
                    db.add(alert)
                    print(f"📢 Created alert: {finding.get('name')}")
            
            await db.commit()
            print(f"✅ Alerts created successfully")
        except Exception as alert_error:
            print(f"⚠️ Alert creation failed: {alert_error}")
            import traceback
            traceback.print_exc()

        # Create log
        try:
            await create_log(
                db=db,
                user_id=user_id,
                event="scan_completed",
                ip=client_ip,
                severity="info",
                details={
                    "target": target,
                    "security_score": security_score,
                    "findings_count": len(findings),
                    "critical_count": critical_count,
                    "high_count": high_count
                }
            )
            await db.commit()
            print(f"📝 Created completion log")
        except Exception as log_error:
            print(f"⚠️ Log creation failed: {log_error}")


@router.post("/run")
async def run_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    client_ip = http_request.client.host if http_request.client else "unknown"
    scan_id = str(uuid.uuid4())

    new_scan = SecurityScan(
        id=scan_id,
        user_id=current_user["id"],
        target=request.target,
        scan_status="queued",
        started_at=datetime.utcnow()
    )

    db.add(new_scan)
    await db.commit()

    # Serialize all standard scan parameters for the background task.
    # mode="json" converts enums (profile/intensity/severity) to plain strings.
    background_tasks.add_task(
        run_scan_task,
        scan_id,
        request.target,
        current_user["id"],
        client_ip,
        request.model_dump(mode="json")
    )

    return {"scan_id": scan_id, "status": "queued", "message": "Scan started"}


@router.get("/stats")
async def get_scan_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    total_query = select(func.count()).select_from(SecurityScan).where(
        SecurityScan.user_id == current_user["id"],
        or_(
            SecurityScan.is_deleted == False,
            SecurityScan.is_deleted.is_(None)
        )
    )
    total_result = await db.execute(total_query)
    total_scans = total_result.scalar() or 0

    avg_query = select(func.avg(SecurityScan.risk_score)).where(
        SecurityScan.user_id == current_user["id"],
        SecurityScan.risk_score.isnot(None),
        or_(
            SecurityScan.is_deleted == False,
            SecurityScan.is_deleted.is_(None)
        )
    )
    avg_result = await db.execute(avg_query)
    avg_security_score = avg_result.scalar() or 0

    critical_query = select(func.sum(SecurityScan.critical_count)).where(
        SecurityScan.user_id == current_user["id"],
        or_(
            SecurityScan.is_deleted == False,
            SecurityScan.is_deleted.is_(None)
        )
    )
    critical_result = await db.execute(critical_query)
    total_critical = critical_result.scalar() or 0

    high_query = select(func.sum(SecurityScan.high_count)).where(
        SecurityScan.user_id == current_user["id"],
        or_(
            SecurityScan.is_deleted == False,
            SecurityScan.is_deleted.is_(None)
        )
    )
    high_result = await db.execute(high_query)
    total_high = high_result.scalar() or 0

    return {
        "total_scans": total_scans,
        "average_risk_score": round(float(avg_security_score), 1),
        "total_critical_findings": total_critical,
        "total_high_findings": total_high
    }


@router.get("/")
async def list_scans(
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # ✅ FIXED: Include scans where is_deleted is NULL or False
    result = await db.execute(
        select(SecurityScan)
        .where(
            SecurityScan.user_id == current_user["id"],
            or_(
                SecurityScan.is_deleted == False,
                SecurityScan.is_deleted.is_(None)
            )
        )
        .order_by(desc(SecurityScan.started_at))
        .limit(limit)
    )
    scans = result.scalars().all()

    return [
        {
            "id": str(s.id),
            "target": s.target,
            "risk_score": s.risk_score,
            "status": s.scan_status,
            "started_at": s.started_at.isoformat(),
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "findings_count": s.findings_count,
            "critical_count": s.critical_count or 0,
            "high_count": s.high_count or 0,
            "medium_count": s.medium_count or 0,
            "low_count": s.low_count or 0
        }
        for s in scans
    ]


@router.get("/{scan_id}")
async def get_scan(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        uuid.UUID(scan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid scan ID format: {scan_id}")
    
    result = await db.execute(
        select(SecurityScan).where(
            SecurityScan.id == scan_id,
            SecurityScan.user_id == current_user["id"],
            or_(
                SecurityScan.is_deleted == False,
                SecurityScan.is_deleted.is_(None)
            )
        )
    )
    scan = result.scalar_one_or_none()

    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    return {
        "id": str(scan.id),
        "target": scan.target,
        "risk_score": scan.risk_score,
        "findings": scan.findings,
        "findings_count": scan.findings_count,
        "status": scan.scan_status,
        "started_at": scan.started_at.isoformat(),
        "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
        "critical_count": scan.critical_count or 0,
        "high_count": scan.high_count or 0,
        "medium_count": scan.medium_count or 0,
        "low_count": scan.low_count or 0,
        "ai_analysis": scan.ai_analysis
    }


@router.delete("/{scan_id}")
async def delete_scan(
    scan_id: str,
    current_user: dict = Depends(get_current_user),
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """Soft delete a scan"""
    try:
        uuid.UUID(scan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scan ID format")
    
    client_ip = request.client.host if request else "unknown"
    
    result = await db.execute(
        select(SecurityScan).where(
            SecurityScan.id == scan_id,
            SecurityScan.user_id == current_user["id"],
            or_(
                SecurityScan.is_deleted == False,
                SecurityScan.is_deleted.is_(None)
            )
        )
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan.is_deleted = True
    scan.deleted_at = datetime.utcnow()
    scan.deleted_by = current_user["id"]
    scan.deletion_reason = "User initiated deletion"
    
    await create_log(
        db=db,
        user_id=current_user["id"],
        event="USER_DELETED_SCAN",
        ip=client_ip,
        severity="low",
        details={
            "scan_id": scan_id,
            "target": scan.target,
            "risk_score": scan.risk_score,
            "deleted_by": current_user["email"],
            "deleted_at": datetime.utcnow().isoformat(),
            "deletion_type": "user"
        }
    )
    
    await db.commit()
    
    return {"message": "Scan deleted successfully", "scan_id": scan_id}


@router.get("/{scan_id}/export")
async def export_scan_report(
    scan_id: str,
    format: str = "json",
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        uuid.UUID(scan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid scan ID format: {scan_id}")
    
    result = await db.execute(
        select(SecurityScan).where(
            SecurityScan.id == scan_id,
            SecurityScan.user_id == current_user["id"],
            or_(
                SecurityScan.is_deleted == False,
                SecurityScan.is_deleted.is_(None)
            )
        )
    )
    scan = result.scalar_one_or_none()

    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    if format.lower() == "json":
        report = {
            "report_type": "Security Scan Report",
            "generated_at": datetime.utcnow().isoformat(),
            "scan": {
                "id": str(scan.id),
                "target": scan.target,
                "status": scan.scan_status,
                "started_at": scan.started_at.isoformat() if scan.started_at else None,
                "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
                "security_score": scan.risk_score,
                "findings_count": scan.findings_count,
                "severity_breakdown": {
                    "critical": scan.critical_count or 0,
                    "high": scan.high_count or 0,
                    "medium": scan.medium_count or 0,
                    "low": scan.low_count or 0
                }
            },
            "findings": scan.findings or [],
            "ai_analysis": scan.ai_analysis,
            "recommendations": []
        }

        if scan.findings:
            for finding in scan.findings:
                if finding.get("recommendation"):
                    report["recommendations"].append({
                        "priority": finding.get("severity", "low"),
                        "finding": finding.get("name", "Unknown"),
                        "recommendation": finding.get("recommendation")
                    })

        return report
    else:
        raise HTTPException(status_code=400, detail="Only JSON format is supported")