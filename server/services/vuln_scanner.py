import requests
from urllib.parse import urlparse


# =========================
# MID-LEVEL VULNERABILITY SCANNER
# =========================

COMMON_SENSITIVE_PATHS = [
    "/admin",
    "/login",
    "/dashboard",
    "/backup",
    "/config",
    "/.env",
    "/phpmyadmin",
    "/server-status",
    "/wp-admin"
]


def run_vuln_scan(target: str):
    """
    Mid-level vulnerability scanner:
    - Detects exposed endpoints
    - Checks basic misconfigurations
    - Identifies attack surface exposure
    """

    findings = []

    parsed = urlparse(target)
    domain = parsed.netloc if parsed.netloc else target

    base_urls = [
        f"http://{domain}",
        f"https://{domain}"
    ]

    # =========================
    # 1. CHECK EXPOSED PATHS
    # =========================
    for base in base_urls:
        for path in COMMON_SENSITIVE_PATHS:
            try:
                url = f"{base}{path}"
                response = requests.get(url, timeout=2)

                if response.status_code == 200:

                    severity = "high"

                    if path in ["/.env", "/config", "/backup"]:
                        severity = "critical"

                    findings.append({
                        "type": "vulnerability",
                        "severity": severity,
                        "name": "Exposed Sensitive Endpoint",
                        "message": f"Public access detected: {url}",
                        "recommendation": "Restrict access using authentication or firewall rules",
                        "category": "exposure"
                    })

            except requests.exceptions.RequestException:
                continue

    # =========================
    # 2. BASIC SECURITY MISCONFIG CHECK
    # =========================
    try:
        r = requests.get(f"http://{domain}", timeout=3)
        headers = r.headers

        # Server leakage
        if "server" in headers:
            findings.append({
                "type": "misconfiguration",
                "severity": "low",
                "name": "Server Header Disclosure",
                "message": f"Server info exposed: {headers.get('server')}",
                "recommendation": "Hide server version information"
            })

        # Missing security headers (basic checks)
        security_headers = [
            "X-Frame-Options",
            "Content-Security-Policy",
            "Strict-Transport-Security"
        ]

        for header in security_headers:
            if header not in headers:
                findings.append({
                    "type": "misconfiguration",
                    "severity": "medium",
                    "name": f"Missing {header}",
                    "message": f"{header} header not found",
                    "recommendation": f"Add {header} for improved security"
                })

    except:
        findings.append({
            "type": "info",
            "severity": "low",
            "name": "Scan limitation",
            "message": "Could not fetch HTTP response for header analysis",
            "recommendation": "Target may block requests or be offline"
        })

    return findings