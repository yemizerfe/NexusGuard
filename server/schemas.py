# schemas.py
from enum import Enum
from typing import Annotated, List, Optional

from pydantic import BaseModel, Field

# Valid port number (1-65535) - constraint applies to each list ELEMENT
Port = Annotated[int, Field(ge=1, le=65535)]


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


# ====================================================================
# Standard security-scan parameters
# Modelled after what production scanners expose:
#   - Nessus/OpenVAS: scan policies & per-plugin severities
#   - OWASP ZAP: attack strength + enabled rule categories
#   - Nmap: port specs ("top-100", "1-1024", "80,443")
#   - Burp Suite/Acunetix: HTTP options (redirects, TLS verify, UA)
# ====================================================================


class ScanProfile(str, Enum):
    """Predefined scan policy presets (like Nessus 'Policy' / ZAP 'Scan Policy').

    The UI applies preset values into the form; CUSTOM means the user tuned
    every parameter manually.
    """
    QUICK = "quick"            # Fast recon: top web ports + header checks only
    STANDARD = "standard"      # Balanced default: common ports + all passive checks
    DEEP = "deep"              # Wider scope: more ports & paths, relaxed timeouts
    AGGRESSIVE = "aggressive"  # Full sweep: top-1000 ports, extended path list
    CUSTOM = "custom"          # User-defined parameters


class ScanIntensity(str, Enum):
    """How aggressively the scanner probes the target
    (equivalent to ZAP 'Attack Strength' / Nessus 'Scan Intensity')."""
    PASSIVE = "passive"        # No intrusive requests: headers/TLS inspection only
    LIGHT = "light"            # Minimal probing, small subset of paths
    NORMAL = "normal"          # Balanced default probing
    AGGRESSIVE = "aggressive"  # Maximum coverage incl. extended path wordlist


class EnabledChecks(BaseModel):
    """Per-module toggles so scans can be scoped to specific check categories."""
    port_scan: bool = True           # TCP connect port discovery
    web_headers: bool = True         # Missing security-header detection
    sensitive_paths: bool = True     # Exposed admin/backup/config endpoints
    ssl_tls: bool = True             # Certificate validity & TLS checks
    server_info: bool = True         # Server / X-Powered-By disclosure
    https_redirect: bool = True      # HTTP -> HTTPS redirect verification


class ScanRequest(BaseModel):
    """Body accepted by POST /api/scans/run. All fields except `target` are
    optional so older clients remain compatible."""
    # ---------------- Scope ----------------
    target: str
    ports: Optional[List[Port]] = Field(
        default=None,
        description="Explicit port list; takes precedence over port_range",
    )
    port_range: str = Field(
        default="top-100",
        description="Nmap-style spec: 'top-25' | 'top-100' | 'top-1000' | "
                    "'1-1024' | comma list '80,443,8080'",
    )
    exclude_paths: List[str] = Field(
        default_factory=list,
        description="Path prefixes skipped during sensitive-path probing, e.g. ['/health']",
    )

    # ---------------- Policy ----------------
    profile: ScanProfile = ScanProfile.STANDARD
    intensity: ScanIntensity = ScanIntensity.NORMAL
    enabled_checks: EnabledChecks = Field(default_factory=EnabledChecks)

    # ---------------- Performance ----------------
    timeout_seconds: int = Field(default=5, ge=1, le=60,
                                 description="Per-request/connect timeout")
    max_threads: int = Field(default=10, ge=1, le=200,
                             description="Concurrent workers for port/path probes")
    max_ports: int = Field(default=100, ge=1, le=65535,
                           description="Hard cap on number of ports scanned")

    # ---------------- HTTP client behaviour ----------------
    follow_redirects: bool = True
    verify_ssl: bool = False  # Off by default: scanners must audit self-signed hosts
    user_agent: str = "Mozilla/5.0 (compatible; NexusGuardScanner/1.0)"

    # ---------------- Reporting ----------------
    ai_enhanced: bool = Field(default=True,
                              description="Run Gemini AI analysis over findings")
    min_severity: Severity = Field(default=Severity.INFO,
                                   description="Drop findings below this threshold")