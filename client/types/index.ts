// types/index.ts
export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at?: string;
  is_superuser?: boolean;
  is_active?: boolean;
}

export interface LogEntry {
  id: string;
  time: string;
  user: string;
  ip: string;
  event: string;
  severity: 'high' | 'medium' | 'low';
}

export interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  timestamp: string;
  scan_id?: string;
  explanation?: string;
  status?: 'active' | 'resolved';
  source_ip?: string;      // ✅ Add this
  target?: string;          // ✅ Add this
  description?: string;     // ✅ Add this
}

export interface AIInsight {
  analysis: string;
  riskScore: number;
  recommendation: string;
  timestamp: string;
}

export interface DashboardStats {
  totalLogsToday: number;
  activeAlerts: number;
  highRiskUsers: number;
  blockedIPs: number;
}

// Scan related types
export interface ScanFinding {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  name: string;
  message: string;
  recommendation: string;
  port?: number;
  service?: string;
  category?: string;
}

export interface ScanResult {
  id: string;
  target: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  risk_score: number;
  findings: ScanFinding[];
  findings_count: number;
  ai_analysis: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface ScanHistoryItem {
  id: string;
  target: string;
  risk_score: number;
  status: string;
  created_at: string;
  completed_at?: string;
  findings_count: number;
}

export interface ScanStats {
  total_scans: number;
  average_risk_score: number;
  total_critical_findings: number;
  total_high_findings: number;
}

// =====================================================================
// Standard security-scan parameters (mirrors server schemas.ScanRequest)
// Field names intentionally use snake_case to match the API wire format.
// Modelled after Nessus/OpenVAS policies, OWASP ZAP attack strength,
// Nmap port specs and Burp Suite HTTP options.
// =====================================================================

export type ScanProfile = 'quick' | 'standard' | 'deep' | 'aggressive' | 'custom';
export type ScanIntensity = 'passive' | 'light' | 'normal' | 'aggressive';
export type MinSeverity = 'info' | 'low' | 'medium' | 'high';

export interface EnabledChecks {
  port_scan: boolean;        // TCP connect port discovery
  web_headers: boolean;      // Missing security-header detection
  sensitive_paths: boolean;  // Exposed admin/backup/config endpoints
  ssl_tls: boolean;          // Certificate validity & TLS checks
  server_info: boolean;      // Server / X-Powered-By disclosure
  https_redirect: boolean;   // HTTP -> HTTPS redirect verification
}

export interface ScanOptions {
  // Scope
  ports?: number[];          // Explicit list; overrides port_range when set
  port_range: string;        // 'top-25' | 'top-100' | 'top-1000' | '1-1024' | '80,443'
  exclude_paths: string[];
  // Policy
  profile: ScanProfile;
  intensity: ScanIntensity;
  enabled_checks: EnabledChecks;
  // Performance
  timeout_seconds: number;
  max_threads: number;
  max_ports: number;
  // HTTP client behaviour
  follow_redirects: boolean;
  verify_ssl: boolean;
  user_agent: string;
  // Reporting
  ai_enhanced: boolean;
  min_severity: MinSeverity;
}

export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  profile: 'standard',
  intensity: 'normal',
  port_range: 'top-100',
  exclude_paths: [],
  enabled_checks: {
    port_scan: true,
    web_headers: true,
    sensitive_paths: true,
    ssl_tls: true,
    server_info: true,
    https_redirect: true,
  },
  timeout_seconds: 5,
  max_threads: 10,
  max_ports: 100,
  follow_redirects: true,
  verify_ssl: false,   // scanners must audit self-signed hosts by default
  user_agent: 'Mozilla/5.0 (compatible; NexusGuardScanner/1.0)',
  ai_enhanced: true,
  min_severity: 'info',
};

// Policy presets applied into the form (server also has fallbacks for
// direct-API callers that only send {"target": "...", "profile": "..."})
export const SCAN_PROFILE_PRESETS: Record<
  Exclude<ScanProfile, 'custom'>,
  { label: string; description: string; patch: Partial<ScanOptions> }
> = {
  quick: {
    label: 'Quick',
    description: 'Fast recon - top 10 web ports, light probing',
    patch: {
      intensity: 'light',
      port_range: 'top-10',
      max_threads: 20,
      timeout_seconds: 5,
      max_ports: 10,
      enabled_checks: {
        port_scan: true,
        web_headers: true,
        sensitive_paths: false,
        ssl_tls: false,
        server_info: true,
        https_redirect: true,
      },
    },
  },
  standard: {
    label: 'Standard',
    description: 'Balanced - top 100 ports, all passive checks',
    patch: {
      intensity: 'normal',
      port_range: 'top-100',
      max_threads: 10,
      timeout_seconds: 5,
      max_ports: 100,
      enabled_checks: {
        port_scan: true,
        web_headers: true,
        sensitive_paths: true,
        ssl_tls: true,
        server_info: true,
        https_redirect: true,
      },
    },
  },
  deep: {
    label: 'Deep',
    description: 'Wide sweep - ports 1-1024 with more paths',
    patch: {
      intensity: 'normal',
      port_range: '1-1024',
      max_threads: 15,
      timeout_seconds: 8,
      max_ports: 1024,
      enabled_checks: {
        port_scan: true,
        web_headers: true,
        sensitive_paths: true,
        ssl_tls: true,
        server_info: true,
        https_redirect: true,
      },
    },
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Full audit - top 1000 ports + extended path wordlist',
    patch: {
      intensity: 'aggressive',
      port_range: 'top-1000',
      max_threads: 30,
      timeout_seconds: 4,
      max_ports: 1000,
      enabled_checks: {
        port_scan: true,
        web_headers: true,
        sensitive_paths: true,
        ssl_tls: true,
        server_info: true,
        https_redirect: true,
      },
    },
  },
};