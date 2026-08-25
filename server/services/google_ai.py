"""
Google Gemini AI Integration for Security Analysis
Using new google-genai package
"""

from google import genai
from google.genai import types
import os
import json
from typing import List, Dict, Any
from datetime import datetime

# Models to try in order (newer first; fall back automatically)
GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"]

client = None

def get_client():
    global client
    if client is None:
        api_key = (os.getenv("GOOGLE_API_KEY") or "").strip()
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        if not api_key.startswith("AIza"):
            raise ValueError(
                "GOOGLE_API_KEY is not a valid Gemini API key (valid keys start "
                "with 'AIza'). Get one free at https://aistudio.google.com/apikey"
            )
        client = genai.Client(api_key=api_key)
    return client


def extract_json(text: str):
    """Parse JSON out of a model response, tolerating markdown fences/prose."""
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t[3:]
    if t.endswith("```"):
        t = t[:-3]
    t = t.strip()
    start, end = t.find("{"), t.rfind("}")
    if start != -1 and end > start:
        t = t[start:end + 1]
    return json.loads(t)

# System instruction for security analysis
SYSTEM_INSTRUCTION = """You are a senior cybersecurity expert. Your role is to analyze security scan findings and provide clear, actionable advice. Always respond in valid JSON format. Be concise but thorough. Prioritize critical issues first."""


def summarize_findings(findings: List[Dict]) -> Dict:
    """Summarize findings before sending to AI to reduce token usage"""
    summary = {
        "total": len(findings),
        "by_severity": {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0
        },
        "by_type": {},
        "open_ports": [],
        "missing_headers": [],
        "exposed_paths": []
    }

    for finding in findings:
        # Count by severity
        severity = finding.get("severity", "low")
        if severity in summary["by_severity"]:
            summary["by_severity"][severity] += 1

        # Categorize findings
        if "port" in finding:
            summary["open_ports"].append({
                "port": finding.get("port"),
                "service": finding.get("service"),
                "severity": severity
            })
        elif "missing_header" in finding.get("type", ""):
            summary["missing_headers"].append(finding.get("name"))
        elif "exposed_endpoint" in finding.get("type", ""):
            summary["exposed_paths"].append(finding.get("path", "unknown"))

    return summary


def analyze_with_ai(findings: List[Dict], target: str) -> Dict:
    """
    Analyze security findings using Google Gemini AI

    Args:
        findings: List of security findings from scanner
        target: The scanned target (domain/IP)

    Returns:
        Dict with risk_score, summary, attack_patterns, recommendations
    """

    # If no findings, return safe default
    if not findings:
        return {
            "risk_score": 0,
            "summary": "No security issues found. System appears secure.",
            "attack_patterns": [],
            "recommendations": ["Continue regular security monitoring"],
            "critical_issues": 0,
            "high_issues": 0
        }

    # Summarize findings to reduce token usage
    summary = summarize_findings(findings)

    prompt = f"""
Analyze these security scan findings for target: {target}

SCAN SUMMARY:
- Total findings: {summary['total']}
- Critical: {summary['by_severity']['critical']}
- High: {summary['by_severity']['high']}
- Medium: {summary['by_severity']['medium']}
- Low: {summary['by_severity']['low']}

OPEN PORTS:
{json.dumps(summary['open_ports'][:10], indent=2)}

MISSING SECURITY HEADERS:
{summary['missing_headers']}

EXPOSED PATHS:
{summary['exposed_paths'][:5]}

Based on these findings, provide:

1. RISK SCORE (0-100, where 100 is highest risk)
2. EXECUTIVE SUMMARY (2-3 sentences explaining overall security posture)
3. ATTACK PATTERNS (list of potential attack vectors)
4. RECOMMENDATIONS (prioritized list of fixes)

Return ONLY valid JSON in this exact format:
{{
    "risk_score": number,
    "summary": "string",
    "attack_patterns": ["pattern1", "pattern2"],
    "recommendations": ["fix1", "fix2"],
    "critical_issues": number,
    "high_issues": number
}}
"""

    try:
        # Try each model until one responds (handles retired model names)
        last_err = None
        response = None
        used_model = None
        for model_name in GEMINI_MODELS:
            try:
                client = get_client()
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        top_p=0.9,
                        top_k=40,
                        max_output_tokens=2048,
                        system_instruction=SYSTEM_INSTRUCTION
                    )
                )
                used_model = model_name
                break
            except Exception as me:
                last_err = me
                print(f"⚠️ Gemini model {model_name} failed: {me}")
                client = None  # force re-init for next attempt
        
        if response is None:
            raise RuntimeError(f"All Gemini models failed: {last_err}")

        print(f"✅ Gemini analysis completed using {used_model}")

        # Parse JSON response (tolerates ```json fences)
        result = extract_json(response.text)

        # Ensure all expected fields exist
        return {
            "risk_score": result.get("risk_score", 50),
            "summary": result.get("summary", "Analysis completed"),
            "attack_patterns": result.get("attack_patterns", []),
            "recommendations": result.get("recommendations", []),
            "critical_issues": result.get("critical_issues", summary['by_severity']['critical']),
            "high_issues": result.get("high_issues", summary['by_severity']['high'])
        }

    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        print(f"Raw response: {response.text[:200] if 'response' in locals() else 'N/A'}")

        # Fallback response
        return {
            "risk_score": 50,
            "summary": "Analysis completed. Manual review recommended.",
            "attack_patterns": ["Unknown pattern - manual review needed"],
            "recommendations": ["Review scan findings manually"],
            "critical_issues": summary['by_severity']['critical'],
            "high_issues": summary['by_severity']['high']
        }
    except Exception as e:
        print(f"AI analysis error: {e}")
        return {
            "risk_score": 50,
            "summary": "AI analysis temporarily unavailable. Manual review recommended.",
            "attack_patterns": [],
            "recommendations": ["Check system manually for security issues"],
            "critical_issues": 0,
            "high_issues": 0
        }


async def analyze_finding_stream(findings: List[Dict], target: str):
    """Stream AI analysis for real-time feedback"""

    prompt = f"Analyze security findings for {target}: {json.dumps(findings[:5])}"

    try:
        client = get_client()
        async for chunk in client.models.generate_content_stream(
            model="gemini-1.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                system_instruction=SYSTEM_INSTRUCTION
            )
        ):
            if chunk.text:
                yield chunk.text
    except Exception as e:
        yield f"Error: {str(e)}"


# Test function
if __name__ == "__main__":
    # Test with sample findings
    test_findings = [
        {
            "type": "open_port",
            "severity": "high",
            "port": 22,
            "service": "SSH"
        },
        {
            "type": "missing_header",
            "severity": "high",
            "name": "Missing HSTS header"
        }
    ]

    result = analyze_with_ai(test_findings, "example.com")
    print(json.dumps(result, indent=2))
