
# main.py - Complete NexusGuard API with AI integration and CORS

from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete
from datetime import datetime, timedelta
import asyncio
import os
import sys
from dotenv import load_dotenv

# Prevent UnicodeEncodeError from emoji log banners on Windows.
for _stream in (sys.stdout, sys.stderr):
    if _stream is not None and hasattr(_stream, "reconfigure"):
        if (_stream.encoding or "").lower().replace("-", "") != "utf8":
            try:
                _stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass

# Load environment variables.
load_dotenv()

from api.auth import router as auth_router
from api.scans import router as scans_router
from api.alerts import router as alerts_router
from api.dashboard import router as dashboard_router
from api.users import router as users_router
from api.admin import router as admin_router
from api.settings import router as settings_router

from websocket_manager import manager
from database import engine, Base, get_db, AsyncSessionLocal
from models import Alert, SecurityScan, SecurityLog, User
from auth import get_current_user

from services.ai_analyzer import AIAnalyzer

# Optional Google Gemini integration.
try:
    from services.google_ai import analyze_with_ai
    GOOGLE_AI_AVAILABLE = True
except ImportError:
    GOOGLE_AI_AVAILABLE = False
    print(
        "Google Gemini AI not available; "
        "using the local AI analyzer."
    )


# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="NexusGuard Security API",
    description="AI-Powered Cybersecurity Platform",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# =========================================================
# CORS CONFIGURATION
# =========================================================

# Explicitly allow deployed frontend origins.
# Additional origins can be configured in Render using
# the FRONTEND_ORIGINS environment variable, separated by commas.
default_origins = [
    "https://nexus-guard-1c4bgw6fw-yemizerfes-projects.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

configured_origins = os.getenv("FRONTEND_ORIGINS", "")

extra_origins = [
    origin.strip().rstrip("/")
    for origin in configured_origins.split(",")
    if origin.strip()
]

allowed_origins = list(dict.fromkeys(default_origins + extra_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# =========================================================
# API ROUTERS
# =========================================================

app.include_router(
    auth_router,
    prefix="/api/auth",
    tags=["Authentication"],
)

app.include_router(
    scans_router,
    prefix="/api/scans",
    tags=["Security Scans"],
)

app.include_router(
    alerts_router,
    prefix="/api/alerts",
    tags=["Alerts"],
)

app.include_router(
    dashboard_router,
    prefix="/api/dashboard",
    tags=["Dashboard"],
)

app.include_router(
    users_router,
    prefix="/api/users",
    tags=["Users"],
)

app.include_router(
    admin_router,
    prefix="/api/admin",
    tags=["Admin"],
)

# This router already defines its own /api/settings prefix.
app.include_router(
    settings_router,
    tags=["Settings"],
)


# =========================================================
# AUTOMATIC CLEANUP
# =========================================================

async def cleanup_old_logs():
    """Delete security logs older than 90 days daily."""

    while True:
        try:
            now = datetime.utcnow()

            next_midnight = (
                now + timedelta(days=1)
            ).replace(
                hour=0,
                minute=0,
                second=0,
                microsecond=0,
            )

            wait_seconds = (
                next_midnight - now
            ).total_seconds()

            print(
                "Next log cleanup scheduled at "
                f"{next_midnight.strftime('%Y-%m-%d %H:%M:%S')}"
            )

            await asyncio.sleep(wait_seconds)

            cutoff_date = datetime.utcnow() - timedelta(days=90)

            async with AsyncSessionLocal() as db:
                log_result = await db.execute(
                    delete(SecurityLog).where(
                        SecurityLog.created_at < cutoff_date
                    )
                )

                log_count = log_result.rowcount or 0

                alert_result = await db.execute(
                    delete(Alert).where(
                        Alert.created_at < cutoff_date,
                        Alert.status == "resolved",
                    )
                )

                alert_count = alert_result.rowcount or 0

                await db.commit()

                print(
                    "Auto-cleanup completed at "
                    f"{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"
                )
                print(f"Deleted {log_count} old security logs")
                print(f"Deleted {alert_count} old resolved alerts")

        except asyncio.CancelledError:
            raise

        except Exception as exc:
            print(f"Auto-cleanup error: {exc}")
            await asyncio.sleep(3600)


# =========================================================
# APPLICATION LIFECYCLE
# =========================================================

@app.on_event("startup")
async def startup():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        print("Database tables created/verified")

    except Exception as exc:
        # Keep the startup failure visible in Render logs.
        print(f"Database initialization failed: {exc}")
        raise

    asyncio.create_task(cleanup_old_logs())

    print("Automatic cleanup scheduler started (90-day retention)")
    print("API documentation: /docs")
    print(f"Allowed frontend origins: {allowed_origins}")

    google_api_key = (os.getenv("GOOGLE_API_KEY") or "").strip()

    if google_api_key and GOOGLE_AI_AVAILABLE:
        print("Google Gemini AI service is configured")
    else:
        print("Using local AI analyzer or configured fallback")


# =========================================================
# AI INSIGHTS ENDPOINT
# =========================================================

@app.get("/api/ai/insights")
async def get_ai_insights(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate security insights using user scan and alert data."""

    try:
        # Retrieve active alerts belonging to the current user.
        alerts_result = await db.execute(
            select(Alert)
            .where(
                Alert.status == "active",
                Alert.user_id == current_user["id"],
            )
            .order_by(desc(Alert.created_at))
        )

        alerts = alerts_result.scalars().all()

        # Retrieve the latest ten scans.
        scans_result = await db.execute(
            select(SecurityScan)
            .where(SecurityScan.user_id == current_user["id"])
            .order_by(desc(SecurityScan.started_at))
            .limit(10)
        )

        recent_scans = scans_result.scalars().all()

        # Retrieve the latest twenty logs.
        logs_result = await db.execute(
            select(SecurityLog)
            .where(SecurityLog.user_id == current_user["id"])
            .order_by(desc(SecurityLog.created_at))
            .limit(20)
        )

        logs = logs_result.scalars().all()

        insights = []
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # -------------------------------------------------
        # 1. Google Gemini AI analysis
        # -------------------------------------------------

        google_api_key = (
            os.getenv("GOOGLE_API_KEY") or ""
        ).strip()

        gemini_ready = (
            bool(google_api_key)
            and google_api_key.startswith("AIza")
            and GOOGLE_AI_AVAILABLE
        )

        if google_api_key and not google_api_key.startswith("AIza"):
            print(
                "GOOGLE_API_KEY does not have the expected format; "
                "using local analysis."
            )

        ai_insight_generated = False

        if gemini_ready and (alerts or recent_scans):
            try:
                findings = []

                for alert in alerts[:10]:
                    findings.append({
                        "type": "alert",
                        "severity": alert.severity,
                        "title": alert.title,
                        "description": alert.description or "",
                        "source_ip": alert.source_ip or "unknown",
                    })

                for scan in recent_scans[:5]:
                    if scan.findings:
                        for finding in scan.findings[:5]:
                            findings.append({
                                "type": "scan_finding",
                                "severity": finding.get("severity", "medium"),
                                "name": finding.get("name", "Unknown"),
                                "message": finding.get("message", ""),
                                "recommendation": finding.get(
                                    "recommendation", ""
                                ),
                            })
                    else:
                        findings.append({
                            "type": "scan_summary",
                            "target": scan.target,
                            "risk_score": scan.risk_score or 0,
                            "findings_count": scan.findings_count or 0,
                        })

                if findings:
                    target = (
                        recent_scans[0].target
                        if recent_scans
                        else "your system"
                    )

                    ai_result = analyze_with_ai(findings, target)

                    recommendations = ai_result.get(
                        "recommendations", []
                    )

                    insights.append({
                        "analysis": ai_result.get(
                            "summary",
                            "AI analysis completed",
                        ),
                        "riskScore": ai_result.get("risk_score", 50),
                        "recommendation": (
                            recommendations[0]
                            if recommendations
                            else "Review security findings"
                        ),
                        "timestamp": current_time,
                    })

                    ai_insight_generated = True
                    print("AI insights generated using Google Gemini")

            except Exception as exc:
                print(
                    f"Google Gemini AI failed: {exc}. "
                    "Falling back to local analysis."
                )

        # -------------------------------------------------
        # 2. Local AI analyzer fallback
        # -------------------------------------------------

        if not ai_insight_generated:
            local_findings = []

            for alert in alerts[:15]:
                local_findings.append({
                    "severity": alert.severity,
                    "name": alert.title,
                    "description": alert.description or "",
                    "type": "alert",
                })

            for scan in recent_scans[:5]:
                local_findings.append({
                    "severity": (
                        "critical"
                        if scan.risk_score and scan.risk_score < 40
                        else "high"
                        if scan.risk_score and scan.risk_score < 60
                        else "medium"
                    ),
                    "name": f"Security Scan of {scan.target}",
                    "risk_score": scan.risk_score,
                    "findings_count": scan.findings_count,
                    "type": "scan",
                })

            analysis = AIAnalyzer.analyze_findings(local_findings)

            recommendations = analysis.get("recommendations", [])

            insights.append({
                "analysis": analysis.get(
                    "summary",
                    "Security analysis completed",
                ),
                "riskScore": analysis.get("risk_score", 50),
                "recommendation": (
                    recommendations[0]
                    if recommendations
                    else "Continue security monitoring"
                ),
                "timestamp": current_time,
            })

            print("AI insights generated using local analyzer")

        # -------------------------------------------------
        # 3. Critical/high alert analysis
        # -------------------------------------------------

        critical_alerts = [
            alert for alert in alerts
            if alert.severity == "critical"
        ]

        high_alerts = [
            alert for alert in alerts
            if alert.severity == "high"
        ]

        if critical_alerts:
            insights.append({
                "analysis": (
                    f"CRITICAL: {len(critical_alerts)} critical security "
                    "issues require immediate attention"
                ),
                "riskScore": 90,
                "recommendation": (
                    f"Address {critical_alerts[0].title} immediately"
                ),
                "timestamp": current_time,
            })

        elif high_alerts:
            insights.append({
                "analysis": (
                    f"HIGH: {len(high_alerts)} high-severity "
                    "issues need attention"
                ),
                "riskScore": 70,
                "recommendation": (
                    "Prioritize fixing high-severity vulnerabilities"
                ),
                "timestamp": current_time,
            })

        # -------------------------------------------------
        # 4. Scan statistics
        # -------------------------------------------------

        if recent_scans:
            total_scans = len(recent_scans)

            completed_scans = [
                scan for scan in recent_scans
                if scan.scan_status == "completed"
            ]

            avg_risk = (
                sum(scan.risk_score or 0 for scan in completed_scans)
                / len(completed_scans)
                if completed_scans
                else 0
            )

            total_findings = sum(
                scan.findings_count or 0 for scan in recent_scans
            )

            total_critical = sum(
                scan.critical_count or 0 for scan in recent_scans
            )

            insights.append({
                "analysis": (
                    f"SCAN SUMMARY: {total_scans} scans, "
                    f"{total_findings} findings, "
                    f"average risk {avg_risk:.0f}/100"
                ),
                "riskScore": min(
                    85,
                    int(avg_risk) + (total_critical * 5),
                ),
                "recommendation": (
                    "Focus on fixing critical and high-severity issues first"
                ),
                "timestamp": current_time,
            })

        # -------------------------------------------------
        # 5. Latest scan analysis
        # -------------------------------------------------

        if recent_scans:
            latest_scan = recent_scans[0]

            if latest_scan.risk_score is not None:
                if latest_scan.risk_score >= 70:
                    risk_level = "GOOD"
                    emoji = "🟢"
                elif latest_scan.risk_score >= 40:
                    risk_level = "FAIR"
                    emoji = "🟡"
                else:
                    risk_level = "POOR"
                    emoji = "🔴"

                insights.append({
                    "analysis": (
                        f"{emoji} LATEST SCAN: '{latest_scan.target}' "
                        f"scored {latest_scan.risk_score}/100 "
                        f"({risk_level})"
                    ),
                    "riskScore": latest_scan.risk_score,
                    "recommendation": (
                        "Review findings and apply recommended fixes"
                        if latest_scan.risk_score < 70
                        else "Good security posture, continue monitoring"
                    ),
                    "timestamp": current_time,
                })

        # -------------------------------------------------
        # 6. Security tip
        # -------------------------------------------------

        if len(insights) < 3:
            insights.append({
                "analysis": (
                    "SECURITY TIP: Regular security scanning helps "
                    "identify vulnerabilities before attackers find them"
                ),
                "riskScore": 5,
                "recommendation": (
                    "Schedule weekly scans for important systems"
                ),
                "timestamp": current_time,
            })

        # Return at most five insights, highest risk first.
        insights = insights[:5]
        insights.sort(
            key=lambda insight: insight["riskScore"],
            reverse=True,
        )

        return insights

    except Exception as exc:
        print(f"Error generating AI insights: {exc}")

        return [{
            "analysis": (
                "Security analysis is currently unavailable. "
                "Please try again later."
            ),
            "riskScore": 50,
            "recommendation": (
                "Check system logs for security issues"
            ),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }]


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
async def health():
    return {"status": "healthy"}
