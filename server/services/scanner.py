"""
Security Scanner - Complete Production Version
Scans ports, web headers, and sensitive paths
"""

import socket
import time
import re
import requests
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
from tenacity import retry, stop_after_attempt, wait_exponential

try:
    from config import settings
    MAX_PORTS = min(getattr(settings, 'max_ports', 20), 100)
except ImportError:
    MAX_PORTS = 20

SERVICE_MAP = {
    22: "SSH", 80: "HTTP", 443: "HTTPS", 3306: "MySQL",
    5432: "PostgreSQL", 21: "FTP", 25: "SMTP", 8080: "HTTP-ALT",
    1433: "MSSQL", 3389: "RDP", 5900: "VNC", 6379: "Redis"
}

COMMON_PATHS = [
    "/admin", "/login", "/backup", "/config", "/.env", 
    "/phpmyadmin", "/wp-admin", "/dashboard", "/api", 
    "/console", "/debug", "/test", "/info"
]

EXPECTED_WEB_PORTS = {80, 443, 8080, 8443}
HIGH_RISK_PORTS = {22, 3306, 5432, 3389, 6379, 27017, 11211}
MEDIUM_RISK_PORTS = {21, 25, 1433, 5900, 143, 993, 995, 465, 587}

# ------------------------------------------------------------------
# Standard scan-parameter support (Nmap-style port presets, ZAP-style
# intensity levels, Nessus-style profile policies)
# ------------------------------------------------------------------

# Curated "top ports" lists (ordered by how commonly services appear)
TOP_PORTS_10 = [80, 443, 8080, 8443, 22, 21, 25, 3389, 3306, 5432]
TOP_PORTS_25 = TOP_PORTS_10 + [
    53, 110, 135, 139, 143, 445, 587, 993, 995, 1433, 5900,
    6379, 11211, 8000, 8888
]
TOP_PORTS_100 = TOP_PORTS_25 + [
    69, 79, 88, 106, 161, 179, 389, 427, 444, 465, 500, 514, 515, 543,
    548, 554, 587, 623, 631, 636, 771, 783, 873, 902, 990, 992, 993, 995,
    1025, 1080, 1194, 1723, 1863, 2049, 2082, 2083, 2181, 2222, 2375,
    2376, 2483, 2484, 3000, 3128, 3268, 3306, 3389, 3690, 4848, 5000,
    5009, 5051, 5432, 5555, 5560, 5672, 5800, 5900, 5984, 5985, 5986,
    6443, 6666, 7001, 7002, 7077, 7180, 7181, 7443, 7676, 7777, 8008,
    8009, 8010, 8020, 8042, 8069, 8081, 8088, 8090, 8091, 8118, 8123,
    8181, 8222, 8243, 8280, 8333, 8443, 8500, 8642, 8686, 8800, 8899,
    9000, 9001, 9042, 9060, 9080, 9090, 9091, 9100, 9200, 9418, 9443,
    9595, 9999, 10000, 10443, 11211, 15672, 18080, 19300, 25565, 27017,
    28017, 50000, 50030, 50060, 50070, 50090
]
# "top-1000" falls back to every port 1-1000 (no full Nmap service DB available)
TOP_PORTS_1000 = sorted(set(TOP_PORTS_100) | set(range(1, 1001)))
PORT_PRESETS = {
    "top-10": TOP_PORTS_10,
    "top-25": TOP_PORTS_25,
    "top-100": TOP_PORTS_100,
    "top-1000": TOP_PORTS_1000,
}

# Extended wordlist probed ONLY in aggressive mode (Burp/Nikto-flavoured)
EXTENDED_PATHS = [
    "/.git/config", "/.git/HEAD", "/.svn/entries", "/.htaccess",
    "/.htpasswd", "/.DS_Store", "/robots.txt", "/sitemap.xml",
    "/crossdomain.xml", "/clientaccesspolicy.xml", "/wp-login.php",
    "/xmlrpc.php", "/wp-content/debug.log", "/administrator",
    "/cpanel", "/webmail", "/manager/html", "/jmx-console",
    "/solr/admin", "/actuator", "/actuator/env", "/actuator/health",
    "/swagger-ui.html", "/api-docs", "/graphql", "/server-info",
    "/server-status/", "/elmah.axd", "/trace.axd", "/dump.sql",
    "/db.sql", "/database.sql", "/backup.sql", "/db.sqlite",
    "/composer.lock", "/package.json", "/web.config", "/Dockerfile",
    "/docker-compose.yml",
]

# How many sensitive paths each intensity level probes
INTENSITY_PATH_LIMITS = {
    "passive": 0,      # No intrusive path probing at all
    "light": 6,
    "normal": 15,
    "aggressive": None,  # Full wordlist (COMMON + EXTENDED)
}

# Timeout multiplier per intensity - aggressive scans trade patience for speed
INTENSITY_TIMEOUT_FACTOR = {
    "passive": 1.5,
    "light": 1.25,
    "normal": 1.0,
    "aggressive": 0.7,
}

# Policy presets applied as FALLBACKS when the API caller omits fields
# (the UI sends fully-populated forms, so presets mainly serve direct API use)
PROFILE_DEFAULTS = {
    "quick":      {"intensity": "light",      "port_range": "top-10",   "max_threads": 20},
    "standard":   {"intensity": "normal",     "port_range": "top-100",  "max_threads": 10},
    "deep":       {"intensity": "normal",     "port_range": "1-1024",   "max_threads": 15},
    "aggressive": {"intensity": "aggressive", "port_range": "top-1000", "max_threads": 30},
}


class SecurityScanner:
    def __init__(self, options: Optional[Dict] = None, max_ports: int = MAX_PORTS):
        """
        Args:
            options: standard scan parameters dict (mirrors schemas.ScanRequest).
                     Recognised keys: profile, intensity, enabled_checks,
                     port_range, ports, exclude_paths, timeout_seconds,
                     max_threads, max_ports, follow_redirects, verify_ssl,
                     user_agent, ai_enhanced, min_severity.
            max_ports: legacy kwarg kept for backwards compatibility.
        """
        self.options = dict(options or {})

        # Legacy kwarg respected unless overridden via options
        self.max_ports = min(int(self.options.get("max_ports") or max_ports), 65535)

        # --- Policy: apply profile preset fallbacks for omitted keys ---
        self.profile = str(self.options.get("profile", "standard")).lower()
        if self.profile != "custom":
            for key, value in PROFILE_DEFAULTS.get(self.profile, {}).items():
                self.options.setdefault(key, value)

        self.intensity = str(self.options.get("intensity", "normal")).lower()

        checks = self.options.get("enabled_checks") or {}
        self.enabled_checks = {
            "port_scan": bool(checks.get("port_scan", True)),
            "web_headers": bool(checks.get("web_headers", True)),
            "sensitive_paths": bool(checks.get("sensitive_paths", True)),
            "ssl_tls": bool(checks.get("ssl_tls", True)),
            "server_info": bool(checks.get("server_info", True)),
            "https_redirect": bool(checks.get("https_redirect", True)),
        }

        # --- Performance ---
        base_timeout = float(self.options.get("timeout_seconds", 5))
        factor = INTENSITY_TIMEOUT_FACTOR.get(self.intensity, 1.0)
        self.timeout = max(0.5, round(base_timeout * factor, 2))
        self.max_threads = min(max(int(self.options.get("max_threads", 10)), 1), 200)

        # --- HTTP client behaviour ---
        self.verify_ssl = bool(self.options.get("verify_ssl", False))
        self.follow_redirects = bool(self.options.get("follow_redirects", True))
        self.user_agent = str(self.options.get(
            "user_agent", "Mozilla/5.0 (compatible; NexusGuardScanner/1.0)"))

        # --- Exclusions (normalised to lowercase leading-slash form) ---
        normalized = set()
        for p in (self.options.get("exclude_paths") or []):
            if not isinstance(p, str) or not p.strip():
                continue
            q = p.strip().lower()
            if not q.startswith("/"):
                q = "/" + q
            normalized.add(q.rstrip("/") or "/")
        self.exclude_paths = normalized

        self.seen_findings = set()

    def is_localhost(self, domain: str) -> bool:
        """Check if target is localhost/development environment"""
        return domain in ['127.0.0.1', 'localhost', '::1', '0.0.0.0']

    def _http_get(self, url: str, **kwargs):
        """GET request driven by scan parameters: timeout, user_agent,
        verify_ssl and follow_redirects."""
        kwargs.setdefault("timeout", self.timeout)
        kwargs.setdefault("allow_redirects", self.follow_redirects)
        kwargs.setdefault("verify", self.verify_ssl)
        headers = {"User-Agent": self.user_agent}
        headers.update(kwargs.pop("headers", {}) or {})
        kwargs["headers"] = headers
        return requests.get(url, **kwargs)

    @staticmethod
    def resolve_ports(port_spec: Optional[str] = None,
                      explicit_ports: Optional[List[int]] = None,
                      cap: int = 100) -> List[int]:
        """Expand a port specification into a concrete sorted list.

        Supported specs (Nmap-flavoured):
          'top-25' | 'top-100' | 'top-1000'
          ranges:   '1-1024'
          lists:    '80,443,8080' (ranges/lists mixable: '20-25,80,443')
        An explicit port list always takes precedence.
        """
        if explicit_ports:
            try:
                ports = sorted({int(p) for p in explicit_ports if 1 <= int(p) <= 65535})
                return ports[:cap]
            except (TypeError, ValueError):
                pass  # fall through to spec parsing

        spec = (port_spec or "top-100").strip().lower()
        resolved: List[int] = []
        seen = set()

        def add_ports(values) -> None:
            for p in values:
                p = int(p)
                if 1 <= p <= 65535 and p not in seen:
                    seen.add(p)
                    resolved.append(p)

        for token in spec.split(","):
            token = token.strip()
            if not token:
                continue
            m = re.fullmatch(r"top-(\d{1,4})", token)
            if m:
                n = int(m.group(1))
                # Use the smallest curated preset covering N so ordering is
                # by service popularity, not numeric port value
                preset_name = ("top-10" if n <= 10 else
                               "top-25" if n <= 25 else
                               "top-100" if n <= 100 else "top-1000")
                add_ports(PORT_PRESETS[preset_name][:n])
                continue
            m = re.fullmatch(r"(\d{1,5})-(\d{1,5})", token)
            if m:
                lo, hi = int(m.group(1)), int(m.group(2))
                if 1 <= lo <= hi <= 65535:
                    add_ports(range(lo, hi + 1))
                    continue
            if token.isdigit():
                add_ports([int(token)])

        # Cap BEFORE sorting so a small max_ports keeps the most popular ports,
        # then sort for deterministic scan output.
        trimmed = resolved[:cap] if resolved else PORT_PRESETS["top-100"][:cap]
        return sorted(trimmed)

    def scan_ports(self, target: str, ports: Optional[List[int]] = None,
                   port_range: Optional[str] = None) -> List[Dict]:
        results = []
        ports_to_scan = self.resolve_ports(port_range, ports, cap=self.max_ports)
        print(f"   Probing {len(ports_to_scan)} ports with {self.max_threads} threads "
              f"(timeout {self.timeout}s)")

        # Resolve DNS once up-front so worker threads can't fail on gaierror
        try:
            socket.gethostbyname(target)
        except socket.gaierror:
            print(f"   Could not resolve {target} - skipping port scan")
            return []

        def probe(port: int) -> Optional[Dict]:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(self.timeout)
                start = time.time()
                result = sock.connect_ex((target, port))
                latency = round((time.time() - start) * 1000, 2)
                sock.close()

                if result == 0:
                    if port in EXPECTED_WEB_PORTS:
                        severity = "info"
                        name_type = "Expected Web Port"
                        message = f"Port {port} is open and serving web traffic"
                        recommendation = "This is a standard web port. Ensure proper security configurations are in place."
                    elif port in HIGH_RISK_PORTS:
                        severity = "critical"
                        name_type = "High Risk Service Exposed"
                        message = f"Critical service port {port} ({SERVICE_MAP.get(port, 'unknown')}) is exposed"
                        recommendation = f"Move port {port} behind VPN, restrict access by IP whitelist, or close if not needed."
                    elif port in MEDIUM_RISK_PORTS:
                        severity = "high"
                        name_type = "Service Port Exposed"
                        message = f"Service port {port} ({SERVICE_MAP.get(port, 'unknown')}) is accessible"
                        recommendation = f"Review if port {port} needs to be publicly accessible. Consider firewall restrictions."
                    else:
                        severity = "medium"
                        name_type = "Unexpected Open Port"
                        message = f"Port {port} ({SERVICE_MAP.get(port, 'unknown')}) is open and accessible"
                        recommendation = f"Close port {port} if not needed, or restrict access with firewall rules."

                    return {
                        "type": "open_port",
                        "port": port,
                        "service": SERVICE_MAP.get(port, "unknown"),
                        "status": "open",
                        "latency_ms": latency,
                        "severity": severity,
                        "name": f"{name_type}: Port {port}",
                        "message": message,
                        "recommendation": recommendation
                    }
            except Exception:
                return None
            return None

        workers = min(self.max_threads, max(len(ports_to_scan), 1))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for item in pool.map(probe, ports_to_scan):
                if item:
                    results.append(item)

        results.sort(key=lambda f: f["port"])
        return results
    
    def scan_web_headers(self, domain: str) -> List[Dict]:
        """Scan web headers for security configurations"""
        findings = []
        
        # Security headers to check
        expected_headers = {
            "Content-Security-Policy": {
                "severity": "high",
                "name": "Missing CSP Header",
                "description": "Content Security Policy prevents XSS and data injection attacks",
                "fix": "Add Content-Security-Policy header"
            },
            "Strict-Transport-Security": {
                "severity": "high",
                "name": "Missing HSTS Header",
                "description": "HSTS forces browsers to always use HTTPS",
                "fix": "Add Strict-Transport-Security: max-age=31536000; includeSubDomains"
            },
            "X-Frame-Options": {
                "severity": "high",
                "name": "Missing Clickjacking Protection",
                "description": "X-Frame-Options prevents your site from being embedded in iframes",
                "fix": "Add X-Frame-Options: DENY or SAMEORIGIN"
            },
            "X-Content-Type-Options": {
                "severity": "medium",
                "name": "Missing MIME Sniffing Protection",
                "description": "Prevents browsers from guessing file types",
                "fix": "Add X-Content-Type-Options: nosniff"
            },
            "Referrer-Policy": {
                "severity": "medium",
                "name": "Missing Referrer Policy",
                "description": "Controls how much referrer info is sent to other sites",
                "fix": "Add Referrer-Policy: strict-origin-when-cross-origin"
            }
        }
        
        reported_headers = set()
        response_headers = {}
        
        # Try to get headers via HTTPS
        try:
            print(f"   Fetching headers for {domain}...")
            response = self._http_get(f"https://{domain}", verify=False)
            response_headers = response.headers
            print(f"   Successfully fetched headers from {response.url}")
        except requests.exceptions.SSLError as e:
            print(f"   SSL Error for {domain}: {e}")
            try:
                response = self._http_get(f"http://{domain}", verify=False)
                response_headers = response.headers
                print(f"   Using HTTP for {domain}")
                print(f"   Using HTTP for {domain}")
            except Exception as http_e:
                print(f"   HTTP also failed: {http_e}")
                return findings
        except requests.exceptions.ConnectionError:
            print(f"   Connection error for {domain}")
            return findings
        except Exception as e:
            print(f"   Failed to fetch headers for {domain}: {e}")
            return findings
        
        headers_lower = {k.lower(): v for k, v in response_headers.items()}
        
        for header, info in expected_headers.items():
            header_lower = header.lower()
            if header_lower in headers_lower:
                print(f"   Found header: {header}")
                reported_headers.add(header)
            else:
                print(f"   MISSING header: {header}")
                findings.append({
                    "type": "missing_header",
                    "severity": info["severity"],
                    "name": info["name"],
                    "header": header,
                    "message": info["description"],
                    "recommendation": info["fix"]
                })
        
        if self.enabled_checks["server_info"] and "server" in headers_lower:
            server_value = headers_lower.get("server", "")[:50]
            findings.append({
                "type": "info",
                "severity": "low",
                "name": "Server Information Exposed",
                "message": f"Server header reveals: {server_value}",
                "recommendation": "Remove or obscure Server header to hide technology stack"
            })

        if self.enabled_checks["server_info"] and "x-powered-by" in headers_lower:
            powered_value = headers_lower.get("x-powered-by", "")[:50]
            findings.append({
                "type": "info",
                "severity": "low",
                "name": "Technology Stack Exposed",
                "message": f"X-Powered-By header reveals: {powered_value}",
                "recommendation": "Remove X-Powered-By header to hide backend technology"
            })
        
        if self.enabled_checks["https_redirect"]:
            try:
                http_response = self._http_get(f"http://{domain}", allow_redirects=False)
                if http_response.status_code in [301, 302]:
                    location = http_response.headers.get('location', '')
                    if location.startswith('https'):
                        findings.append({
                            "type": "positive",
                            "severity": "info",
                            "name": "HTTPS Redirect Implemented",
                            "message": "HTTP traffic properly redirects to HTTPS",
                            "recommendation": "Good practice. Ensure HSTS is also enabled."
                        })
            except Exception:
                pass
        
        return findings
    
    def scan_sensitive_paths(self, domain: str) -> List[Dict]:
        findings = []
        reported_paths = set()

        if not self.enabled_checks["sensitive_paths"]:
            return findings

        limit = INTENSITY_PATH_LIMITS.get(self.intensity, 15)
        if limit == 0:  # passive intensity: no intrusive path probing
            print("   Passive intensity - skipping sensitive path probing")
            return findings

        # Aggressive mode adds the extended wordlist (Burp/Nikto-style paths)
        pool = list(COMMON_PATHS)
        if self.intensity == "aggressive":
            pool += EXTENDED_PATHS

        # Honour exclude_paths parameter (prefix match on normalised form)
        candidates = [
            p for p in pool
            if not any(p == exc or p.startswith(exc + "/") for exc in self.exclude_paths)
        ]
        candidates = candidates[:limit] if limit else candidates
        print(f"   Probing {len(candidates)} paths "
              f"(intensity: {self.intensity}, excluded: {len(self.exclude_paths)} patterns)")

        def probe(path: str) -> Optional[Dict]:
            for protocol in ["https", "http"]:
                try:
                    url = f"{protocol}://{domain}{path}"
                    response = self._http_get(url, allow_redirects=False)

                    if response.status_code == 200:
                        if path in ["/.env", "/config", "/backup", "/info", "/debug",
                                    "/dump.sql", "/db.sql", "/database.sql", "/backup.sql",
                                    "/.git/config", "/.htpasswd"]:
                            severity = "critical"
                            recommendation = f"CRITICAL: {path} is exposed and contains sensitive data. Remove immediately!"
                        else:
                            severity = "high"
                            recommendation = f"Restrict access to {path} with authentication or IP whitelisting"

                        return {
                            "type": "exposed_endpoint",
                            "severity": severity,
                            "name": f"Exposed Endpoint: {path}",
                            "path": path,
                            "url": url,
                            "status_code": response.status_code,
                            "message": f"Sensitive endpoint {path} is publicly accessible (HTTP {response.status_code})",
                            "recommendation": recommendation
                        }
                except Exception:
                    continue
            return None

        workers = min(self.max_threads, max(len(candidates), 1))
        with ThreadPoolExecutor(max_workers=workers) as pool_exec:
            for item in pool_exec.map(probe, candidates):
                if item:
                    reported_paths.add(item["path"])
                    findings.append(item)

        return findings
    
    def scan_ssl_certificate(self, domain: str) -> List[Dict]:
        findings = []
        
        # For localhost, return info-level finding instead of error
        if self.is_localhost(domain):
            findings.append({
                "type": "ssl_info",
                "severity": "info",
                "name": "SSL Certificate (Development)",
                "message": "No HTTPS configured on localhost - expected for development environment",
                "recommendation": "For production, use valid SSL certificates"
            })
            return findings
        
        try:
            import ssl
            import datetime as dt
            context = ssl.create_default_context()
            with socket.create_connection((domain, 443), timeout=self.timeout) as sock:
                with context.wrap_socket(sock, server_hostname=domain) as ssock:
                    cert = ssock.getpeercert()
                    expiry_str = cert.get('notAfter', '')
                    if expiry_str:
                        expiry = dt.datetime.strptime(expiry_str, '%b %d %H:%M:%S %Y %Z')
                        days_left = (expiry - dt.datetime.now()).days
                        
                        if days_left < 0:
                            findings.append({
                                "type": "ssl_error",
                                "severity": "critical",
                                "name": "SSL Certificate Expired",
                                "message": f"SSL certificate expired on {expiry_str}",
                                "recommendation": "RENEW SSL CERTIFICATE IMMEDIATELY!"
                            })
                        elif days_left < 30:
                            findings.append({
                                "type": "ssl_warning",
                                "severity": "high",
                                "name": "SSL Certificate Expiring Soon",
                                "message": f"SSL certificate expires in {days_left} days",
                                "recommendation": "Renew SSL certificate before expiration"
                            })
                        else:
                            findings.append({
                                "type": "positive",
                                "severity": "info",
                                "name": "Valid SSL Certificate",
                                "message": f"SSL certificate valid for {days_left} days",
                                "recommendation": "Continue monitoring expiration"
                            })
                    
                    issuer = dict(x[0] for x in cert.get('issuer', []))
                    findings.append({
                        "type": "ssl_info",
                        "severity": "info",
                        "name": "SSL Certificate Information",
                        "message": f"Issued by: {issuer.get('organizationName', 'Unknown')}",
                        "recommendation": "Verify certificate is from trusted authority"
                    })
        except Exception as e:
            findings.append({
                "type": "ssl_error",
                "severity": "medium",
                "name": "SSL Certificate Issue",
                "message": f"Could not verify SSL certificate: {str(e)[:100]}",
                "recommendation": "Install valid SSL certificate for HTTPS"
            })
        return findings
    
    def run_full_scan(self, data: Dict) -> Dict:
        target = data.get("target", "")
        if not target:
            return {"findings": [], "summary": {"total_findings": 0, "critical": 0, "high": 0, "medium": 0, "low": 0, "error": "No target provided"}}
        
        # Clean target
        target = target.replace("http://", "").replace("https://", "").split("/")[0]
        domain = target.split(":")[0]
        
        print(f"\n🔐 Starting security scan for: {domain}")
        print(f"   Parameters: profile={self.profile} | intensity={self.intensity} | "
              f"threads={self.max_threads} | timeout={self.timeout}s | verify_ssl={self.verify_ssl}")
        print(f"   Modules: {', '.join(k for k, v in self.enabled_checks.items() if v)}")
        if self.is_localhost(domain):
            print("⚙️ Development environment detected - adjusting scoring")
        print("-" * 50)

        all_findings = []

        # Each module runs only when enabled via the standard scan parameters
        if self.enabled_checks["port_scan"]:
            print("📡 Running port scan...")
            all_findings += self.scan_ports(domain, data.get("ports"), data.get("port_range"))

        if self.enabled_checks["web_headers"]:
            print("🌐 Checking web headers...")
            all_findings += self.scan_web_headers(domain)

        if self.enabled_checks["sensitive_paths"]:
            print("🔍 Scanning sensitive paths...")
            path_findings = self.scan_sensitive_paths(domain)
            all_findings += path_findings

        if self.enabled_checks["ssl_tls"]:
            print("🔒 Checking SSL certificate...")
            ssl_findings = self.scan_ssl_certificate(domain)
            all_findings += ssl_findings
        
        seen_names = set()
        unique_findings = []
        for finding in all_findings:
            name = finding.get("name", "")
            if name not in seen_names:
                seen_names.add(name)
                unique_findings.append(finding)
        
        severity_counts = {
            "critical": sum(1 for f in unique_findings if f.get("severity") == "critical"),
            "high": sum(1 for f in unique_findings if f.get("severity") == "high"),
            "medium": sum(1 for f in unique_findings if f.get("severity") == "medium"),
            "low": sum(1 for f in unique_findings if f.get("severity") == "low"),
            "info": sum(1 for f in unique_findings if f.get("severity") == "info")
        }
        
        print("-" * 50)
        print(f"✅ Scan complete!")
        print(f"   Total findings: {len(unique_findings)}")
        print(f"   🚨 Critical: {severity_counts['critical']} | ⚠️ High: {severity_counts['high']}")
        print(f"   📌 Medium: {severity_counts['medium']} | ℹ️ Low/Info: {severity_counts['low'] + severity_counts['info']}")
        print("-" * 50)
        
        return {
            "findings": unique_findings,
            "summary": {
                "total_findings": len(unique_findings),
                "critical": severity_counts["critical"],
                "high": severity_counts["high"],
                "medium": severity_counts["medium"],
                "low": severity_counts["low"],
                "target": target,
                "domain": domain,
                "scan_time": time.strftime("%Y-%m-%d %H:%M:%S"),
                # Echo the standard scan parameters used for this run
                "parameters": {
                    "profile": self.profile,
                    "intensity": self.intensity,
                    "enabled_checks": {k: v for k, v in self.enabled_checks.items()},
                    "timeout_seconds": self.options.get("timeout_seconds", 5),
                    "max_threads": self.max_threads,
                    "ports_scanned_cap": self.max_ports,
                    "follow_redirects": self.follow_redirects,
                    "verify_ssl": self.verify_ssl,
                    "user_agent": self.user_agent,
                    "excluded_paths": sorted(self.exclude_paths),
                },
            }
        }


if __name__ == "__main__":
    scanner = SecurityScanner()
    result = scanner.run_full_scan({"target": "apple.com"})
    
    print("\n📊 Apple.com Findings:")
    for finding in result["findings"]:
        print(f"  • [{finding.get('severity', 'info').upper()}] {finding.get('name', '')}")
        if finding.get('recommendation'):
            print(f"    💡 {finding.get('recommendation')}")