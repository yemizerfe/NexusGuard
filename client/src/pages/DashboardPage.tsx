
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  Shield,
  Brain,
  TrendingUp,
  Zap,
  Server,
  Clock,
  Calendar,
} from 'lucide-react';
import Sidebar from '../components/layout/sidebar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
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
    isLoading,
  } = useSecurityStore();

  const { user, fetchUser } = useAuthStore();
  const { scanStats, fetchScanStats } = useScanStore();

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshCount, setRefreshCount] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAllData = useCallback(async () => {
    try {
      await Promise.all([
        fetchDashboardData(),
        fetchLogs(),
        fetchAlerts(),
        fetchScanStats(),
        generateAIInsight(),
        fetchUser(),
      ]);

      setLastRefresh(new Date());
      setRefreshCount((previous) => previous + 1);
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
    }
  }, [
    fetchDashboardData,
    fetchLogs,
    fetchAlerts,
    fetchScanStats,
    generateAIInsight,
    fetchUser,
  ]);

  useEffect(() => {
    void refreshAllData();

    intervalRef.current = setInterval(() => {
      void refreshAllData();
    }, 60_000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshAllData]);

  const formatDate = (timestamp?: string | null): string => {
    if (!timestamp) return 'N/A';

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }

    return date.toLocaleString();
  };

  const formatAbsoluteDateTime = (
    timestamp?: string | null
  ): string => {
    if (!timestamp) return 'N/A';

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const formatRelativeTime = (
    timestamp?: string | null
  ): string => {
    if (!timestamp) return 'Just now';

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return 'Just now';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Avoid showing negative elapsed time for future timestamps.
    if (diffMs < 60_000) return 'Just now';

    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 60) {
      return `${diffMins} min ago`;
    }

    if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }

    if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }

    return formatAbsoluteDateTime(timestamp);
  };

  const getSeverityClass = (severity?: string): string => {
    const value = (severity || '').toLowerCase();

    if (value === 'critical') {
      return 'text-red-600 bg-red-600/10 border-red-600/20';
    }

    if (value === 'high') {
      return 'text-red-500 bg-red-500/10 border-red-500/20';
    }

    if (value === 'medium') {
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    }

    if (value === 'low') {
      return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }

    return 'text-green-500 bg-green-500/10 border-green-500/20';
  };

  const getSeverityColor = (severity?: string): string => {
    const value = (severity || '').toLowerCase();

    if (value === 'critical') return 'text-red-600';
    if (value === 'high') return 'text-red-500';
    if (value === 'medium') return 'text-yellow-500';
    if (value === 'low') return 'text-blue-500';

    return 'text-green-500';
  };

  const getEventClass = (event?: string): string => {
    const value = (event || '').toLowerCase();

    if (value.includes('login')) return 'bg-blue-500/20 text-blue-500';
    if (value.includes('scan')) return 'bg-purple-500/20 text-purple-500';
    if (value.includes('alert')) return 'bg-red-500/20 text-red-500';

    return 'bg-gray-500/20 text-gray-400';
  };

  const displayName =
    user?.full_name ||
    (user?.email ? user.email.split('@')[0] : 'User');

  const displayEmail = user?.email || 'user@example.com';

  const formatAverageScore = (score?: number | null): string => {
    if (score === undefined || score === null || !Number.isFinite(score)) {
      return '0';
    }

    return score.toFixed(1);
  };

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold">
                  Security Dashboard
                </h1>

                <p className="mt-1 text-gray-400">
                  Welcome back,{' '}
                  <span className="font-medium text-primary">
                    {displayName}
                  </span>
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {displayEmail}
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs text-gray-500">
                  Auto-refreshing every 60 seconds
                </div>

                <div className="mt-1 text-xs text-gray-600">
                  Last update: {lastRefresh.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-gray-800 bg-gray-900/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-sm text-gray-400">
                      Total Logs Today
                    </p>
                    <p className="text-3xl font-bold">
                      {stats.totalLogsToday || 0}
                    </p>
                  </div>
                  <Activity className="h-10 w-10 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-800 bg-gray-900/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-sm text-gray-400">
                      Active Alerts
                    </p>
                    <p className="text-3xl font-bold">
                      {stats.activeAlerts || 0}
                    </p>
                  </div>
                  <AlertTriangle className="h-10 w-10 text-red-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-800 bg-gray-900/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-sm text-gray-400">
                      Avg Security Score
                    </p>
                    <p className="text-3xl font-bold">
                      {formatAverageScore(scanStats.average_risk_score)}%
                    </p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-yellow-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-800 bg-gray-900/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="mb-1 text-sm text-gray-400">
                      Total Scans
                    </p>
                    <p className="text-3xl font-bold">
                      {scanStats.total_scans || 0}
                    </p>
                  </div>
                  <Shield className="h-10 w-10 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="border-gray-800 bg-gray-900/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity Logs
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  {isLoading && logs.length === 0 ? (
                    <div className="flex justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                    </div>
                  ) : logs.length === 0 ? (
                    <p className="py-8 text-center text-gray-400">
                      No logs available
                    </p>
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
                          {logs.slice(0, 10).map((log, index) => (
                            <tr
                              key={log.id || index}
                              className="border-b border-gray-800/50 hover:bg-gray-800/30"
                            >
                              <td className="py-3 text-xs">
                                {formatDate(log.time || log.created_at)}
                              </td>

                              <td className="py-3">
                                {log.user || log.user_email || 'system'}
                              </td>

                              <td className="py-3 font-mono text-xs">
                                {log.ip || 'unknown'}
                              </td>

                              <td className="py-3">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs ${getEventClass(log.event)}`}
                                >
                                  {log.event || 'unknown'}
                                </span>
                              </td>

                              <td className="py-3">
                                <span
                                  className={`rounded-full px-2 py-1 text-xs ${getSeverityClass(log.severity)}`}
                                >
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
              <Card className="border-gray-800 bg-gray-900/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-500">
                    <AlertTriangle className="h-5 w-5" />
                    Active Alerts ({alerts.length})
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <div
                    style={{
                      maxHeight: '400px',
                      overflowY: 'auto',
                      paddingRight: '8px',
                    }}
                    className="custom-scrollbar"
                  >
                    {alerts.length === 0 ? (
                      <p className="py-8 text-center text-gray-400">
                        No active alerts
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {alerts.slice(0, 5).map((alert, index) => (
                          <div
                            key={alert.id || index}
                            className={`rounded-lg border p-4 transition-all hover:shadow-lg ${getSeverityClass(alert.severity)}`}
                          >
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle
                                  className={`h-4 w-4 shrink-0 ${getSeverityColor(alert.severity)}`}
                                />
                                <p className="flex-1 text-sm font-medium">
                                  {alert.message}
                                </p>
                              </div>

                              <div className="ml-6 flex items-center gap-3 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {formatRelativeTime(alert.timestamp)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span className="font-mono">
                                    {formatAbsoluteDateTime(alert.timestamp)}
                                  </span>
                                </div>
                              </div>

                              {alert.target && (
                                <div className="ml-6 flex w-fit items-center gap-1.5 rounded-md bg-gray-800/30 px-2 py-1">
                                  <Server className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-400">
                                    Target:
                                  </span>
                                  <span className="text-xs font-medium text-purple-400">
                                    {alert.target}
                                  </span>
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

              <Card className="border border-gray-800 border-purple-500/20 bg-gray-900/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    <CardTitle>AI Security Insights</CardTitle>
                    <span className="text-xs text-purple-500/70">
                      (Auto-refreshes every 60s)
                    </span>

                    {isLoading && (
                      <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <div
                    style={{
                      maxHeight: '400px',
                      overflowY: 'auto',
                      paddingRight: '8px',
                    }}
                    className="custom-scrollbar"
                  >
                    {aiInsights.length === 0 && isLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-purple-500" />
                      </div>
                    ) : aiInsights.length === 0 ? (
                      <div className="py-8 text-center">
                        <Brain className="mx-auto mb-3 h-12 w-12 text-gray-600" />
                        <p className="text-gray-400">
                          No insights available yet
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Run scans to generate AI insights
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {aiInsights.map((insight, index) => (
                          <div
                            key={index}
                            className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 transition-colors hover:bg-purple-500/10"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-purple-500" />
                              <span className="text-sm font-medium text-purple-400">
                                Security Score: {insight.riskScore}/100
                              </span>
                            </div>

                            <p className="mb-2 text-sm leading-relaxed text-gray-300">
                              {insight.analysis}
                            </p>

                            <div className="mt-2 flex items-start gap-2 border-t border-gray-800 pt-2">
                              <Zap className="mt-0.5 h-3 w-3 shrink-0 text-yellow-500" />
                              <p className="text-xs leading-relaxed text-gray-400">
                                {insight.recommendation}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 border-t border-gray-800 pt-2 text-right text-xs text-gray-500">
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

