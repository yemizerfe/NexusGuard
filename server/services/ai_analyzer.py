# services/ai_analyzer.py - Improved risk scoring
import json
from typing import List, Dict

class AIAnalyzer:
    
    @staticmethod
    def analyze_findings(findings: List[Dict]) -> Dict:
        """Analyze security findings with context-aware risk scoring"""
        
        if not findings:
            return {
                "risk_score": 0,
                "summary": "No security issues detected",
                "recommendations": ["System appears secure"],
                "attack_patterns": []
            }
        
        # Count findings by severity
        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0
        }
        
        for finding in findings:
            severity = finding.get("severity", "low").lower()
            if severity in severity_counts:
                severity_counts[severity] += 1
        
        # Calculate base risk score (0-100)
        # Critical issues: 30 points each (max 60)
        # High issues: 10 points each (max 30)
        # Medium issues: 3 points each (max 9)
        # Low issues: 1 point each (max 3)
        
        critical_score = min(severity_counts["critical"] * 30, 60)
        high_score = min(severity_counts["high"] * 10, 30)
        medium_score = min(severity_counts["medium"] * 3, 9)
        low_score = min(severity_counts["low"] * 1, 3)
        
        total_risk = critical_score + high_score + medium_score + low_score
        
        # Normalize to 0-100 scale
        risk_score = min(total_risk, 100)
        
        # Determine risk level and summary based on actual issues
        if severity_counts["critical"] > 0:
            risk_level = "CRITICAL"
            summary = f"Found {severity_counts['critical']} critical vulnerabilities requiring immediate action"
        elif severity_counts["high"] >= 8:
            risk_level = "CRITICAL"
            summary = f"Found {severity_counts['high']} high-severity issues that need urgent attention"
        elif severity_counts["high"] >= 4:
            risk_level = "HIGH"
            summary = f"Found {severity_counts['high']} high-severity issues that should be addressed soon"
        elif severity_counts["high"] >= 1:
            risk_level = "MEDIUM"
            summary = f"Found {severity_counts['high']} high and {severity_counts['medium']} medium severity issues"
        elif severity_counts["medium"] >= 3:
            risk_level = "LOW"
            summary = f"Found {severity_counts['medium']} medium severity issues to review"
        else:
            risk_level = "LOW"
            summary = "Minor security improvements recommended"
        
        # Generate attack patterns based on findings
        attack_patterns = []
        if severity_counts["critical"] > 0:
            attack_patterns.append("Critical vulnerabilities - immediate exploitation risk")
        if severity_counts["high"] > 0:
            attack_patterns.append("Authentication bypass or data exposure possible")
        
        # Generate recommendations based on findings
        recommendations = []
        
        # Port 22 (SSH) open
        if any(f.get("port") == 22 for f in findings):
            recommendations.append("Close SSH port 22 or restrict access with firewall")
        
        # Missing HSTS
        if any("HSTS" in f.get("name", "") for f in findings):
            recommendations.append("Enable HSTS to enforce HTTPS connections")
        
        # Missing CSP
        if any("CSP" in f.get("name", "") for f in findings):
            recommendations.append("Implement Content-Security-Policy to prevent XSS")
        
        # Open database ports
        if any(f.get("port") in [3306, 5432, 6379] for f in findings):
            recommendations.append("Close database ports or restrict access")
        
        if not recommendations:
            recommendations.append("Continue regular security monitoring")
        
        return {
            "risk_score": risk_score,
            "summary": summary,
            "attack_patterns": attack_patterns if attack_patterns else ["No immediate attack patterns detected"],
            "recommendations": recommendations[:5],  # Top 5 recommendations
            "severity_counts": severity_counts
        }