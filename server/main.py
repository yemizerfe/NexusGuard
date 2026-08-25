# main.py - COMPLETE VERSION WITH AI INTEGRATION AND ALL ROUTERS
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, delete
from datetime import datetime, timedelta
import asyncio
import os
import sys
from dotenv import load_dotenv

# Prevent UnicodeEncodeError ('charmap' codec) from emoji log banners
# when stdout/stderr are redirected to a file or pipe on Windows.
for _stream in (sys.stdout, sys.stderr):
    if _stream is not None and hasattr(_stream, "reconfigure"):
        if (_stream.encoding or "").lower().replace("-", "") != "utf8":
            try:
                _stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass

# Load environment variables
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

# Import AI services
from services.ai_analyzer import AIAnalyzer

# Try to import Google Gemini AI (optional)
try:
    from services.google_ai import analyze_with_ai
    GOOGLE_AI_AVAILABLE = True
except ImportError:
    GOOGLE_AI_AVAILABLE = False
    print("⚠️ Google Gemini AI not available, using local AI analyzer only")

# Create FastAPI app
app = FastAPI(
    title="NexusGuard Security API",
    description="AI-Powered Cybersecurity Platform",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers - ALL ROUTERS ARE CORRECTLY REGISTERED
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(scans_router, prefix="/api/scans", tags=["Security Scans"])
app.include_router(alerts_router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(settings_router, tags=["Settings"])  # router already has prefix=/api/settings


# ============ AUTO CLEANUP FUNCTION ============
async def cleanup_old_logs():
    """Delete logs older than 90 days every day at midnight"""
    while True:
        try:
            now = datetime.utcnow()
            next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            wait_seconds = (next_midnight - now).total_seconds()
            
            print(f"🕐 Next log cleanup scheduled at {next_midnight.strftime('%Y-%m-%d %H:%M:%S')}")
            await asyncio.sleep(wait_seconds)
            
            cutoff_date = datetime.utcnow() - timedelta(days=90)
            
            async with AsyncSessionLocal() as db:
                log_result = await db.execute(
                    delete(SecurityLog).where(SecurityLog.created_at < cutoff_date)
                )
                log_count = log_result.rowcount
                
                alert_result = await db.execute(
                    delete(Alert).where(
                        Alert.created_at < cutoff_date,
                        Alert.status == "resolved"
                    )
                )
                alert_count = alert_result.rowcount
                
                await db.commit()
                
                print(f"🧹 Auto-cleanup completed at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"   - Deleted {log_count} old security logs")
                print(f"   - Deleted {alert_count} old resolved alerts")
                
        except Exception as e:
            print(f"❌ Auto-cleanup error: {e}")
            await asyncio.sleep(3600)


# ============ STARTUP EVENT ============
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Database tables created/verified")
    
    asyncio.create_task(cleanup_old_logs())
    print("🕐 Auto-cleanup scheduler started (90 days retention)")
    print("📚 API Documentation available at: http://localhost:8000/docs")
    
    # Check AI service status
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if google_api_key and GOOGLE_AI_AVAILABLE:
        print("🤖 Google Gemini AI service is configured and ready")
    else:
        print("🤖 Using local AI analyzer (Google Gemini not configured)")
    
    # Print all registered routes for debugging
    print("\n📋 Registered Routes:")
    for route in app.routes:
        if hasattr(route, "path"):
            print(f"   {route.methods if hasattr(route, 'methods') else 'GET'} {route.path}")


# ============ AI INSIGHTS ENDPOINT ============
@app.get("/api/ai/insights")
async def get_ai_insights(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI-powered security insights based on actual scan and alert data"""
    
    try:
        # Get active alerts for this user
        alerts_result = await db.execute(
            select(Alert).where(
                Alert.status == "active",
                Alert.user_id == current_user["id"]
            ).order_by(desc(Alert.created_at))
        )
        alerts = alerts_result.scalars().all()
        
        # Get recent scans (last 10)
        scans_result = await db.execute(
            select(SecurityScan)
            .where(SecurityScan.user_id == current_user["id"])
            .order_by(desc(SecurityScan.started_at))
            .limit(10)
        )
        recent_scans = scans_result.scalars().all()
        
        # Get recent logs
        logs_result = await db.execute(
            select(SecurityLog)
            .where(SecurityLog.user_id == current_user["id"])
            .order_by(desc(SecurityLog.created_at))
            .limit(20)
        )
        logs = logs_result.scalars().all()
        
        insights = []
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 1. Try Google Gemini AI if available
        google_api_key = (os.getenv("GOOGLE_API_KEY") or "").strip()
        gemini_ready = bool(google_api_key) and google_api_key.startswith("AIza") and GOOGLE_AI_AVAILABLE
        if google_api_key and not google_api_key.startswith("AIza"):
            print("⚠️ GOOGLE_API_KEY is not a valid Gemini key (must start with 'AIza') - using local analyzer")
        
        ai_insight_generated = False
        
        if gemini_ready and (alerts or recent_scans):
            try:
                # Prepare findings for AI analysis
                findings = []
                
                for alert in alerts[:10]:
                    findings.append({
                        "type": "alert",
                        "severity": alert.severity,
                        "title": alert.title,
                        "description": alert.description or "",
                        "source_ip": alert.source_ip or "unknown"
                    })
                
                for scan in recent_scans[:5]:
                    if scan.findings:
                        for finding in scan.findings[:5]:
                            findings.append({
                                "type": "scan_finding",
                                "severity": finding.get("severity", "medium"),
                                "name": finding.get("name", "Unknown"),
                                "message": finding.get("message", ""),
                                "recommendation": finding.get("recommendation", "")
                            })
                    else:
                        findings.append({
                            "type": "scan_summary",
                            "target": scan.target,
                            "risk_score": scan.risk_score or 0,
                            "findings_count": scan.findings_count or 0
                        })
                
                if findings:
                    target = recent_scans[0].target if recent_scans else "your system"
                    ai_result = analyze_with_ai(findings, target)
                    
                    insights.append({
                        "analysis": ai_result.get("summary", "AI analysis completed"),
                        "riskScore": ai_result.get("risk_score", 50),
                        "recommendation": ai_result.get("recommendations", ["Review security findings"])[0] if ai_result.get("recommendations") else "Review security findings",
                        "timestamp": current_time
                    })
                    ai_insight_generated = True
                    print("✅ AI insights generated using Google Gemini")
                    
            except Exception as e:
                print(f"⚠️ Google Gemini AI failed: {e}, falling back to local analyzer")
        
        # 2. Use local AI analyzer (fallback or primary)
        if not ai_insight_generated:
            # Prepare findings for local analyzer
            local_findings = []
            
            for alert in alerts[:15]:
                local_findings.append({
                    "severity": alert.severity,
                    "name": alert.title,
                    "description": alert.description or "",
                    "type": "alert"
                })
            
            for scan in recent_scans[:5]:
                local_findings.append({
                    "severity": "critical" if (scan.risk_score and scan.risk_score < 40) else "high" if (scan.risk_score and scan.risk_score < 60) else "medium",
                    "name": f"Security Scan of {scan.target}",
                    "risk_score": scan.risk_score,
                    "findings_count": scan.findings_count,
                    "type": "scan"
                })
            
            # Use local AI analyzer
            analysis = AIAnalyzer.analyze_findings(local_findings)
            
            insights.append({
                "analysis": analysis.get("summary", "Security analysis completed"),
                "riskScore": analysis.get("risk_score", 50),
                "recommendation": analysis.get("recommendations", ["Continue security monitoring"])[0] if analysis.get("recommendations") else "Continue security monitoring",
                "timestamp": current_time
            })
            
            print("✅ AI insights generated using local analyzer")
        
        # 3. Critical/High Alert Analysis (additional insight)
        critical_alerts = [a for a in alerts if a.severity == "critical"]
        high_alerts = [a for a in alerts if a.severity == "high"]
        
        if critical_alerts:
            insights.append({
                "analysis": f"🚨 CRITICAL: {len(critical_alerts)} critical security issues require immediate attention",
                "riskScore": 90,
                "recommendation": f"Address {critical_alerts[0].title if critical_alerts else 'critical issues'} immediately",
                "timestamp": current_time
            })
        elif high_alerts:
            insights.append({
                "analysis": f"⚠️ HIGH: {len(high_alerts)} high-severity issues need attention",
                "riskScore": 70,
                "recommendation": "Prioritize fixing high severity vulnerabilities",
                "timestamp": current_time
            })
        
        # 4. Scan Statistics Analysis
        if recent_scans:
            total_scans = len(recent_scans)
            completed_scans = [s for s in recent_scans if s.scan_status == "completed"]
            avg_risk = sum(s.risk_score or 0 for s in completed_scans) / len(completed_scans) if completed_scans else 0
            
            total_findings = sum(s.findings_count or 0 for s in recent_scans)
            total_critical = sum(s.critical_count or 0 for s in recent_scans)
            total_high = sum(s.high_count or 0 for s in recent_scans)
            
            insights.append({
                "analysis": f"📊 SCAN SUMMARY: {total_scans} scans, {total_findings} findings, avg risk {avg_risk:.0f}/100",
                "riskScore": min(85, int(avg_risk) + (total_critical * 5)),
                "recommendation": "Focus on fixing critical and high severity issues first",
                "timestamp": current_time
            })
        
        # 5. Latest Scan Analysis
        if recent_scans:
            latest_scan = recent_scans[0]
            if latest_scan.risk_score:
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
                    "analysis": f"{emoji} LATEST SCAN: '{latest_scan.target}' scored {latest_scan.risk_score}/100 ({risk_level})",
                    "riskScore": latest_scan.risk_score,
                    "recommendation": "Review findings and apply recommended fixes" if latest_scan.risk_score < 70 else "Good security posture, continue monitoring",
                    "timestamp": current_time
                })
        
        # 6. Security Tip (always last)
        if len(insights) < 3:
            insights.append({
                "analysis": "💡 SECURITY TIP: Regular security scanning helps identify vulnerabilities before attackers find them",
                "riskScore": 5,
                "recommendation": "Schedule weekly scans for your important systems",
                "timestamp": current_time
            })
        
        # Limit to 5 insights and sort by risk score
        insights = insights[:5]
        insights.sort(key=lambda x: x["riskScore"], reverse=True)
        
        return insights
        
    except Exception as e:
        print(f"Error in AI insights: {e}")
        # Return fallback insights
        return [{
            "analysis": "Security analysis is currently unavailable. Please try again later.",
            "riskScore": 50,
            "recommendation": "Check system logs for any security issues",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }]


@app.get("/health")
async def health():
    return {"status": "healthy"}