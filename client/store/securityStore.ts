// store/securityStore.ts - Complete updated version
import { create } from 'zustand';
import { LogEntry, Alert, AIInsight, DashboardStats } from '../types';


const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api`;

interface SecurityState {
  logs: LogEntry[];
  alerts: Alert[];
  aiInsights: AIInsight[];
  stats: DashboardStats;
  isLoading: boolean;
  error: string | null;
  
  fetchDashboardData: () => Promise<void>;
  fetchLogs: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  generateAIInsight: () => Promise<void>;
  addLog: (log: LogEntry) => void;
  clearError: () => void;
  forceRefreshAlerts: () => Promise<void>;
  forceRefreshAI: () => Promise<void>;
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  logs: [],
  alerts: [],
  aiInsights: [],
  stats: {
    totalLogsToday: 0,
    activeAlerts: 0,
    highRiskUsers: 0,
    blockedIPs: 0,
  },
  isLoading: false,
  error: null,

  fetchDashboardData: async () => {
    set({ isLoading: true });
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        set({ 
          stats: {
            totalLogsToday: data.total_logs_today || 0,
            activeAlerts: data.active_alerts || 0,
            highRiskUsers: data.high_risk_users || 0,
            blockedIPs: data.blocked_ips || 0,
          },
          isLoading: false 
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      set({ isLoading: false });
    }
  },

  fetchLogs: async () => {
    set({ isLoading: true });
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/dashboard/logs`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        const logsArray = Array.isArray(data) ? data : [];
        
        const transformedLogs: LogEntry[] = logsArray.map((log: any) => ({
          id: log.id || String(Math.random()),
          time: log.time || (log.created_at ? new Date(log.created_at).toLocaleTimeString() : new Date().toLocaleTimeString()),
          user: log.user || 'system',
          ip: log.ip || 'unknown',
          event: log.event || log.event_type || 'unknown',
          severity: log.severity || 'low',
        }));
        
        console.log(`✅ Fetched ${transformedLogs.length} logs`);
        set({ logs: transformedLogs, isLoading: false });
      } else {
        console.error('Failed to fetch logs:', response.status);
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      set({ isLoading: false });
    }
  },

  fetchAlerts: async () => {
    set({ isLoading: true });
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.warn('No token found');
        set({ isLoading: false });
        return;
      }
      
      const response = await fetch(`${API_URL}/alerts/?status=active`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const alertsArray = Array.isArray(data) ? data : [];
        
        const transformedAlerts: Alert[] = alertsArray.map((alert: any) => ({
          id: alert.id,
          severity: alert.severity || 'medium',
          message: alert.title || alert.message,
          timestamp: alert.created_at,
          explanation: alert.ai_explanation,
          scan_id: alert.scan_id,
          status: alert.status || 'active',
          source_ip: alert.source_ip,
          target: alert.target,
          description: alert.message
        }));
        
        console.log(`✅ Fetched ${transformedAlerts.length} alerts`);
        set({ alerts: transformedAlerts, isLoading: false });
      } else {
        console.error('Failed to fetch alerts:', response.status);
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      set({ isLoading: false });
    }
  },

  forceRefreshAlerts: async () => {
    console.log('🔄 Force refreshing alerts...');
    await get().fetchAlerts();
  },

  resolveAlert: async (alertId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/alerts/${alertId}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.ok) {
        set((state) => ({
          alerts: state.alerts.filter(a => a.id !== alertId),
          stats: {
            ...state.stats,
            activeAlerts: Math.max(0, state.stats.activeAlerts - 1)
          }
        }));
        console.log(`✅ Alert ${alertId} resolved`);
      } else {
        console.error('Failed to resolve alert:', response.status);
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  },

  generateAIInsight: async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.warn('No token found for AI insights');
        return;
      }
      
      const timestamp = Date.now();
      const response = await fetch(`${API_URL}/ai/insights?t=${timestamp}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const insightsArray = Array.isArray(data) ? data : [data];
        
        const newInsights: AIInsight[] = insightsArray.map((item: any) => ({
          analysis: item.analysis || "Security analysis complete",
          riskScore: item.riskScore || 50,
          recommendation: item.recommendation || "Continue monitoring",
          timestamp: item.timestamp || new Date().toISOString(),
        }));
        
        console.log(`✅ AI Insights refreshed at ${new Date().toLocaleTimeString()}`);
        set({ aiInsights: newInsights });
      } else {
        console.error('Failed to refresh AI insights:', response.status);
      }
    } catch (error) {
      console.error('Failed to generate AI insight:', error);
    }
  },

  forceRefreshAI: async () => {
    console.log('🔄 Force refreshing AI insights...');
    await get().generateAIInsight();
  },

  addLog: (log: LogEntry) => {
    set((state) => ({ 
      logs: [log, ...state.logs].slice(0, 100),
      stats: { ...state.stats, totalLogsToday: state.stats.totalLogsToday + 1 }
    }));
  },

  clearError: () => set({ error: null }),
}));
