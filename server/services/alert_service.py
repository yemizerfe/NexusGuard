from models import Alert
from schemas import Severity
from typing import List, Dict
from datetime import datetime

def generate_alerts(scan_id: str, findings: List[Dict]) -> List[Alert]:
    """Generate alerts for high and critical severity findings"""
    alerts = []
    
    for finding in findings:
        severity = finding.get("severity", "low")
        if severity in ["critical", "high"]:
            alerts.append(Alert(
                scan_id=scan_id,
                message=finding.get("name", "Security finding detected"),
                severity=Severity.CRITICAL if severity == "critical" else Severity.HIGH,
                ai_explanation=finding.get("message", "") + " " + finding.get("recommendation", ""),
                status="active"
            ))
    
    return alerts