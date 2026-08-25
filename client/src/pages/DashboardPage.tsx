// DashboardPage.tsx - Fixed AI insights auto-refresh
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Activity, 
  AlertTriangle,  
  Shield, 
  Brain,
  TrendingUp,
  Zap,
  Server,
  Clock,
  Calendar
} from 'lucide-react';
import Sidebar from '../components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useSecurityStore } from '../../store/securityStore';
import { useAuthStore } from '../../store/authStore';
import { useScanStore } from '../../store/scanStore';

const DashboardPage = () => {
  const { 
    stats, 
    logs, 
    alerts, 
    aiInsights, 
    generateAIInsight,
    fetchDashboardData,
    fetchLogs,
    fetchAlerts,
    isLoading 
  } = useSecurityStore();
  
  const { user, fetchUser } = useAuthStore();
  const { scanStats, fetchScanStats } = useScanStore();
  
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshCount, setRefreshCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to refresh all data
  const refreshAllData = useCallback(async () => {
    console.log('🔄 Auto-refreshing dashboard data...', new Date().toLocaleTimeString());
    
    try {
      await Promise.all([
        fetchDashboardData(),
        fetchLogs(),
        fetchAlerts(),
        fetchScanStats(),
        generateAIInsight(),
        fetchUser()
      ]);
      setLastRefresh(new Date());
      setRefreshCount(prev => prev + 1);
      console.log('✅ Dashboard data refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing dashboard data:', error);
    }
  }, [fetchDashboardData, fetchLogs, fetchAlerts, fetchScanStats, generateAIInsight, fetchUser]);

  useEffect(() => {
    // Initial load
    refreshAllData();
    
    // Set up auto-refresh every 60 seconds
    intervalRef.current = setInterval(() => {
      refreshAllData();
    }, 60000); // 60 seconds
    
    // Cleanup interval on component unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshAllData]);

  const formatDate = (timestamp: string) => {
    if (!timestamp) return 'N/A';
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return timestamp;
      return d.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const formatAbsoluteDateTime = (timestamp: string) => {
    if (!timestamp) return 'N/A';
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return timestamp;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
    } catch {
      return timestamp;
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    if (!timestamp) return 'Just now';
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return 'Just now';
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return diffMins + ' min ago';
      if (diffHours < 24) return diffHours + ' hour' + (diffHours > 1 ? 's' : '') + ' ago';
      if (diffDays < 7) return diffDays + ' day' + (diffDays > 1 ? 's' : '') + ' ago';
      return formatAbsoluteDateTime(timestamp);
    } catch {
      return 'Just now';
    }
  };

  const getSeverityClass = (severity: string) => {
    const s = (severity || '').toLowerCase();
    if (s === 'critical') return 'text-red-600 bg-red-600/10 border-red-600/20';
    if (s === 'high') return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (s === 'medium') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    if (s === 'low') return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    return 'text-green-500 bg-green-500/10 border-green-500/20';
  };

  const getSeverityColor = (severity: string) => {
    const s = (severity || '').toLowerCase();
    if (s === 'critical') return 'text-red-600';
    if (s === 'high') return 'text-red-500';
    if (s === 'medium') return 'text-yellow-500';
    if (s === 'low') return 'text-blue-500';
    return 'text-green-500';
  };

  const getEventClass = (event: string) => {
    const e = (event || '').toLowerCase();
    if (e.includes('login')) return 'bg-blue-500/20 text-blue-500';
    if (e.includes('scan')) return 'bg-purple-500/20 text-purple-500';
    if (e.includes('alert')) return 'bg-red-500/20 text-red-500';
    return 'bg-gray-500/20 text-gray-400';
  };

  const displayName = user?.full_name || (user?.email ? user.email.split('@')[0] : 'User');
  const displayEmail = user?.email || 'user@example.com';

  const formatAverageScore = (score: number) => {
    if (score === undefined || score === null) return '0';
    return score.toFixed(1);
  };

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold">Security Dashboard</h1>
                <p className="text-gray-400 mt-1">
                  Welcome back, <span className="text-primary font-medium">{displayName}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">{displayEmail}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">
                  Auto-refreshing every 60 seconds
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Last update: {lastRefresh.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Total Logs Today</p>
                    <p className="text-3xl font-bold">{stats.totalLogsToday || 0}</p>
                  </div>
                  <Activity className="w-10 h-10 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Active Alerts</p>
                    <p className="text-3xl font-bold">{stats.activeAlerts || 0}</p>
                  </div>
                  <AlertTriangle className="w-10 h-10 text-red-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Avg Security Score</p>
                    <p className="text-3xl font-bold">{formatAverageScore(scanStats.average_risk_score)}%</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-yellow-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Total Scans</p>
                    <p className="text-3xl font-bold">{scanStats.total_scans || 0}</p>
                  </div>
                  <Shield className="w-10 h-10 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Recent Activity Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading && logs.length === 0 ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : logs.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No logs available</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-800">
                          <tr className="text-left text-gray-400">
                            <th className="pb-3">Time</th>
                            <th className="pb-3">User</th>
                            <th className="pb-3">IP</th>
                            <th className="pb-3">Event</th>
                            <th className="pb-3">Severity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.slice(0, 10).map((log, idx) => (
                            <tr key={log.id || idx} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                              <td className="py-3 text-xs">{formatDate(log.time || log.created_at)}</td>
                              <td className="py-3">{log.user || log.user_email || 'system'}</td>
                              <td className="py-3 text-xs font-mono">{log.ip || 'unknown'}</td>
                              <td className="py-3">
                                <span className={"px-2 py-1 rounded-full text-xs " + getEventClass(log.event)}>
                                  {log.event || 'unknown'}
                                </span>
                              </td>
                              <td className="py-3">
                                <span className={"px-2 py-1 rounded-full text-xs " + getSeverityClass(log.severity)}>
                                  {log.severity || 'info'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Active Alerts */}
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-500">
                    <AlertTriangle className="w-5 h-5" />
                    Active Alerts ({alerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
                    {alerts.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">No active alerts</p>
                    ) : (
                      <div className="space-y-3">
                        {alerts.slice(0, 5).map((alert, idx) => (
                          <div key={alert.id || idx} className={"p-4 rounded-lg border transition-all hover:shadow-lg " + getSeverityClass(alert.severity)}>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={"w-4 h-4 shrink-0 " + getSeverityColor(alert.severity)} />
                                <p className="text-sm font-medium flex-1">{alert.message}</p>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 ml-6">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatRelativeTime(alert.timestamp)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span className="font-mono">{formatAbsoluteDateTime(alert.timestamp)}</span>
                                </div>
                              </div>
                              {(alert as any).target && (
                                <div className="flex items-center gap-1.5 bg-gray-800/30 px-2 py-1 rounded-md w-fit ml-6">
                                  <Server className="w-3 h-3 text-gray-400" />
                                  <span className="text-gray-400 text-xs">Target:</span>
                                  <span className="text-purple-400 text-xs font-medium">{(alert as any).target}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* AI Insights - Auto-refreshes every 60s */}
              <Card className="bg-gray-900/50 border-gray-800 border-purple-500/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-500" />
                    <CardTitle>AI Security Insights</CardTitle>
                    <span className="text-xs text-purple-500/70">(Auto-refreshes every 60s)</span>
                    {isLoading && (
                      <div className="ml-2 w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }} className="custom-scrollbar">
                    {aiInsights.length === 0 && isLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                      </div>
                    ) : aiInsights.length === 0 ? (
                      <div className="text-center py-8">
                        <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">No insights available yet</p>
                        <p className="text-xs text-gray-500 mt-1">Run scans to generate AI insights</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {aiInsights.map((insight, index) => (
                          <div 
                            key={index} 
                            className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-purple-500" />
                              <span className="text-sm font-medium text-purple-400">
                                Security Score: {insight.riskScore}/100
                              </span>
                            </div>
                            <p className="text-sm mb-2 text-gray-300 leading-relaxed">{insight.analysis}</p>
                            <div className="flex items-start gap-2 mt-2 pt-2 border-t border-gray-800">
                              <Zap className="w-3 h-3 text-yellow-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-gray-400 leading-relaxed">{insight.recommendation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 text-right mt-3 pt-2 border-t border-gray-800">
                    Last AI refresh: {lastRefresh.toLocaleTimeString()} (Refresh #{refreshCount})
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1f2937;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #8b5cf6;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #7c3aed;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #8b5cf6 #1f2937;
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;