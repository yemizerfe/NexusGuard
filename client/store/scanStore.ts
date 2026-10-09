// store/scanStore.ts - UPDATED with better error handling + standard scan parameters
import { create } from 'zustand';
import { type ScanResult, type ScanHistoryItem, type ScanStats, type ScanFinding, type ScanOptions, DEFAULT_SCAN_OPTIONS } from '../types';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api`;


interface ScanState {
  // State
  currentScan: ScanResult | null;
  scanHistory: ScanHistoryItem[];
  scanStats: ScanStats;
  isScanning: boolean;
  isLoading: boolean;
  error: string | null;
  pollingInterval: number | null;
  
  // Actions
  runScan: (target: string, options?: Partial<ScanOptions>) => Promise<string | null>;
  getScanStatus: (scanId: string) => Promise<any>;
  getScanResults: (scanId: string) => Promise<ScanResult | null>;
  fetchScanHistory: () => Promise<void>;
  fetchScanStats: () => Promise<void>;
  deleteScan: (scanId: string) => Promise<boolean>;
  startPolling: (scanId: string, onComplete?: (results: ScanResult) => void) => void;
  stopPolling: () => void;
  clearCurrentScan: () => void;
  clearError: () => void;
  checkAuth: () => boolean;
}

export const useScanStore = create<ScanState>((set, get) => ({
  currentScan: null,
  scanHistory: [],
  scanStats: {
    total_scans: 0,
    average_risk_score: 0,
    total_critical_findings: 0,
    total_high_findings: 0,
  },
  isScanning: false,
  isLoading: false,
  error: null,
  pollingInterval: null,

  checkAuth: () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('No auth token found');
      return false;
    }
    return true;
  },

  runScan: async (target: string, options?: any) => {
    set({ isScanning: true, error: null });
    
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Please login first');
      }
      
      // Merge user-supplied standard scan parameters over defaults.
      // Field names are snake_case to match the server contract exactly.
      const opts: ScanOptions = { ...DEFAULT_SCAN_OPTIONS, ...(options || {}) };
      const scanData = {
        target: target,
        ...opts,
      };

      console.log('🚀 Running scan:', scanData);

      const response = await fetch(`${API_URL}/scans/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(scanData),
      });

      if (response.status === 401) {
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Scan failed to start');
      }

      const data = await response.json();
      console.log('✅ Scan started:', data);
      
      await get().fetchScanHistory();
      
      return data.scan_id;
    } catch (err: any) {
      console.error('❌ Run scan error:', err);
      set({ error: err.message, isScanning: false });
      return null;
    }
  },

  getScanStatus: async (scanId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return null;
      
      const response = await fetch(`${API_URL}/scans/${scanId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      return null;
    }
  },

  getScanResults: async (scanId: string) => {
    set({ isLoading: true });
    
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No authentication token');
      }
      
      console.log(`📡 Fetching scan results for: ${scanId}`);
      
      const response = await fetch(`${API_URL}/scans/${scanId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.status === 401) {
        throw new Error('Session expired. Please login again.');
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch scan results');
      }
      
      const data = await response.json();
      console.log('📊 Scan results:', data);
      
      const findings: ScanFinding[] = (data.findings || []).map((f: any) => ({
        type: f.type || 'vulnerability',
        severity: f.severity || 'medium',
        name: f.name,
        message: f.message,
        recommendation: f.recommendation || 'Review and address this issue',
        port: f.port,
        service: f.service,
        category: f.category,
      }));
      
      const scanResult: ScanResult = {
        id: data.id,
        target: data.target,
        status: data.status,
        risk_score: data.risk_score || 0,
        findings: findings,
        findings_count: findings.length,
        ai_analysis: data.ai_analysis || 'Analysis complete',
        started_at: data.started_at,
        completed_at: data.completed_at,
        error_message: data.error_message,
      };
      
      set({ currentScan: scanResult, isLoading: false });
      
      if (data.status === 'completed' || data.status === 'failed') {
        get().stopPolling();
        await get().fetchScanStats();
      }
      
      return scanResult;
    } catch (err: any) {
      console.error('❌ Get scan results error:', err);
      set({ error: err.message, isLoading: false });
      return null;
    }
  },

  startPolling: (scanId: string, onComplete?: (results: ScanResult) => void) => {
    get().stopPolling();
    
    const interval = window.setInterval(async () => {
      const results = await get().getScanResults(scanId);
      if (results && (results.status === 'completed' || results.status === 'failed')) {
        get().stopPolling();
        set({ isScanning: false });
        if (onComplete) onComplete(results);
        await get().fetchScanHistory();
      }
    }, 2000);
    
    set({ pollingInterval: interval });
  },

  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval !== null) {
      window.clearInterval(pollingInterval);
      set({ pollingInterval: null });
    }
  },

  fetchScanHistory: async () => {
    set({ isLoading: true });
    
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      
      const response = await fetch(`${API_URL}/scans/?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.status === 401) {
        console.error('Session expired');
        set({ isLoading: false });
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch scan history');
      }
      
      const data = await response.json();
      
      const history: ScanHistoryItem[] = (data.scans || []).map((scan: any) => ({
        id: scan.id,
        target: scan.target,
        risk_score: scan.risk_score || 0,
        status: scan.status,
        created_at: scan.started_at,
        completed_at: scan.completed_at,
        findings_count: scan.findings_count || 0,
      }));
      
      set({ scanHistory: history, isLoading: false });
    } catch (err: any) {
      console.error('Failed to fetch scan history:', err);
      set({ error: err.message, isLoading: false });
    }
  },

  fetchScanStats: async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      
      const response = await fetch(`${API_URL}/scans/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.status === 401) return;
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      set({
        scanStats: {
          total_scans: data.total_scans || 0,
          average_risk_score: data.average_risk_score || 0,
          total_critical_findings: data.total_critical_findings || 0,
          total_high_findings: data.total_high_findings || 0,
        },
      });
    } catch (err) {
      console.error('Failed to fetch scan stats:', err);
    }
  },

  deleteScan: async (scanId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return false;
      
      const response = await fetch(`${API_URL}/scans/${scanId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) return false;
      
      await get().fetchScanHistory();
      await get().fetchScanStats();
      
      return true;
    } catch (err) {
      return false;
    }
  },

  clearCurrentScan: () => set({ currentScan: null }),
  clearError: () => set({ error: null }),
}));
