
import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Eye,
  User,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/+$/, '');
const API_URL = `${API_BASE_URL}/api`;

interface AuditLog {
  id: string;
  user_email: string;
  event: string;
  severity?: string;
  status?: string;
  ip: string;
  user_agent?: string;
  details?: unknown;
  created_at: string;
}

interface ApiLogsResponse {
  logs?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeAuditLog = (value: unknown): AuditLog | null => {
  if (!isRecord(value)) return null;

  if (typeof value.id !== 'string' || typeof value.event !== 'string') {
    return null;
  }

  return {
    id: value.id,
    event: value.event,
    user_email:
      typeof value.user_email === 'string' ? value.user_email : 'system',
    ip: typeof value.ip === 'string' ? value.ip : 'unknown',
    created_at:
      typeof value.created_at === 'string' ? value.created_at : '',
    severity:
      typeof value.severity === 'string' ? value.severity : undefined,
    status: typeof value.status === 'string' ? value.status : undefined,
    user_agent:
      typeof value.user_agent === 'string' ? value.user_agent : undefined,
    details: value.details,
  };
};

const AdminAuditLogsPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterEvent, setFilterEvent] = useState('all');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<string[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    void fetchAllLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [search, filterUser, filterSeverity, filterEvent, logs]);

  const fetchAllLogs = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_URL}/admin/all-logs`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          'Failed to fetch audit logs:',
          response.status,
          errorText
        );
        return;
      }

      const data: unknown = await response.json();

      let rawLogs: unknown[] = [];

      if (Array.isArray(data)) {
        rawLogs = data;
      } else if (isRecord(data)) {
        const responseData = data as ApiLogsResponse;
        if (Array.isArray(responseData.logs)) {
          rawLogs = responseData.logs;
        }
      }

      const logsArray = rawLogs
        .map(normalizeAuditLog)
        .filter((log): log is AuditLog => log !== null);

      setLogs(logsArray);

      const uniqueUsers: string[] = Array.from(
        new Set<string>(
          logsArray
            .map((log) => log.user_email)
            .filter(
              (email): email is string =>
                typeof email === 'string' && email.length > 0
            )
        )
      );

      const uniqueEvents: string[] = Array.from(
        new Set<string>(
          logsArray
            .map((log) => log.event)
            .filter(
              (event): event is string =>
                typeof event === 'string' && event.length > 0
            )
        )
      );

      setUsers(uniqueUsers);
      setEventTypes(uniqueEvents);

      if (logsArray.length === 0) {
        console.warn('No audit logs received from the API.');
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    const searchTerm = search.toLowerCase();

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.user_email.toLowerCase().includes(searchTerm) ||
          log.event.toLowerCase().includes(searchTerm) ||
          log.ip.toLowerCase().includes(searchTerm)
      );
    }

    if (filterUser !== 'all') {
      filtered = filtered.filter((log) => log.user_email === filterUser);
    }

    if (filterSeverity !== 'all') {
      filtered = filtered.filter(
        (log) => (log.severity?.toLowerCase() || 'info') === filterSeverity
      );
    }

    if (filterEvent !== 'all') {
      filtered = filtered.filter((log) => log.event === filterEvent);
    }

    setFilteredLogs(filtered);
  };

  const exportLogs = () => {
    const headers = [
      'Timestamp',
      'User',
      'Event',
      'Severity',
      'Status',
      'IP Address',
      'User Agent',
    ];

    const rows = filteredLogs.map((log) => [
      log.created_at ? new Date(log.created_at).toLocaleString() : '',
      log.user_email,
      log.event,
      log.severity || 'info',
      log.status || 'success',
      log.ip,
      log.user_agent || '',
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `audit-logs-${new Date()
      .toISOString()
      .split('T')[0]}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const getSeverityBadge = (severity?: string) => {
    const value = severity?.toLowerCase() || 'info';

    const badges: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-500 border border-red-500/30',
      high: 'bg-orange-500/20 text-orange-500 border border-orange-500/30',
      medium: 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30',
      low: 'bg-blue-500/20 text-blue-500 border border-blue-500/30',
      info: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
    };

    return badges[value] || badges.info;
  };

  const getStatusIcon = (status?: string) => {
    const value = status?.toLowerCase() || 'success';

    switch (value) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failure':
      case 'failed':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getEventBadge = (event: string) => {
    const eventUpper = event.toUpperCase();

    const badges: Record<string, string> = {
      LOGIN_SUCCESS: 'bg-green-500/20 text-green-500',
      LOGIN_FAILED: 'bg-red-500/20 text-red-500',
      LOGIN_FAILURE: 'bg-red-500/20 text-red-500',
      SCAN_STARTED: 'bg-blue-500/20 text-blue-500',
      SCAN_COMPLETED: 'bg-blue-500/20 text-blue-500',
      SCAN_FAILED: 'bg-red-500/20 text-red-500',
      ALERT_TRIGGERED: 'bg-red-500/20 text-red-500',
      ALERT_RESOLVED: 'bg-green-500/20 text-green-500',
      USER_CREATED: 'bg-purple-500/20 text-purple-500',
      ADMIN_TOGGLE_USER: 'bg-yellow-500/20 text-yellow-500',
      ADMIN_ACTION: 'bg-yellow-500/20 text-yellow-500',
      SETTINGS_CHANGED: 'bg-gray-500/20 text-gray-400',
      PASSWORD_CHANGED: 'bg-indigo-500/20 text-indigo-500',
      API_KEY_CREATED: 'bg-cyan-500/20 text-cyan-500',
      EXPORT_DATA: 'bg-pink-500/20 text-pink-500',
      PERMISSION_CHANGED: 'bg-orange-500/20 text-orange-500',
    };

    if (badges[eventUpper]) return badges[eventUpper];
    if (eventUpper.includes('LOGIN')) return badges.LOGIN_SUCCESS;
    if (eventUpper.includes('SCAN')) return badges.SCAN_COMPLETED;
    if (eventUpper.includes('ALERT')) return badges.ALERT_TRIGGERED;

    return 'bg-gray-500/20 text-gray-400';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);

    return Number.isNaN(date.getTime())
      ? dateString
      : date.toLocaleString();
  };

  const toggleRowExpansion = (logId: string) => {
    setExpandedRow((current) => (current === logId ? null : logId));
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Eye className="w-8 h-8 text-primary" />
            Audit Logs
          </h1>
          <p className="text-gray-400 mt-1">
            Complete system audit trail - all user activity
          </p>
        </div>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                All Activity Logs ({filteredLogs.length} of {logs.length})
              </CardTitle>

              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
                disabled={filteredLogs.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by user, event, or IP..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10 bg-gray-800/50 border-gray-700"
                />
              </div>

              <div className="flex gap-2 items-center">
                <User className="w-4 h-4 text-gray-400" />
                <select
                  value={filterUser}
                  onChange={(event) => setFilterUser(event.target.value)}
                  className="flex-1 bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2 text-sm cursor-pointer"
                >
                  <option value="all">All Users ({users.length})</option>
                  {users.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                <select
                  value={filterSeverity}
                  onChange={(event) => setFilterSeverity(event.target.value)}
                  className="flex-1 bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2 text-sm cursor-pointer"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="info">Info</option>
                </select>
              </div>

              <div className="flex gap-2 items-center">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterEvent}
                  onChange={(event) => setFilterEvent(event.target.value)}
                  className="flex-1 bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2 text-sm cursor-pointer"
                >
                  <option value="all">All Events ({eventTypes.length})</option>
                  {eventTypes.slice(0, 20).map((event) => (
                    <option key={event} value={event}>
                      {event}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400">No logs found in the system</p>
                <p className="text-gray-500 text-sm mt-2">
                  Run some scans or trigger events to generate logs
                </p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No logs match your filters. Try adjusting your search criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-800">
                    <tr className="text-left text-gray-400">
                      <th className="pb-3 w-10" />
                      <th className="pb-3">Timestamp</th>
                      <th className="pb-3">User</th>
                      <th className="pb-3">Event</th>
                      <th className="pb-3">Severity</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">IP Address</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLogs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr
                          className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                          onClick={() => toggleRowExpansion(log.id)}
                        >
                          <td className="py-3">
                            {expandedRow === log.id ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </td>

                          <td className="py-3 font-mono text-xs whitespace-nowrap">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="py-3 font-medium max-w-[200px] truncate">
                            {log.user_email || 'system'}
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${getEventBadge(log.event)}`}
                            >
                              {log.event || 'UNKNOWN'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${getSeverityBadge(log.severity)}`}
                            >
                              {log.severity || 'info'}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              {getStatusIcon(log.status)}
                              <span className="text-xs capitalize">
                                {log.status || 'success'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-xs">
                            {log.ip || 'unknown'}
                          </td>
                        </tr>

                        {expandedRow === log.id && (
                          <tr className="bg-gray-800/20">
                            <td colSpan={7} className="py-4 px-4">
                              <div className="space-y-2">
                                <div>
                                  <span className="text-xs text-gray-400 font-mono">
                                    Log ID:
                                  </span>
                                  <p className="text-sm font-mono">{log.id}</p>
                                </div>

                                {log.user_agent && (
                                  <div>
                                    <span className="text-xs text-gray-400">
                                      User Agent:
                                    </span>
                                    <p className="text-sm break-all">
                                      {log.user_agent}
                                    </p>
                                  </div>
                                )}

                                {isRecord(log.details) &&
                                  Object.keys(log.details).length > 0 && (
                                    <div>
                                      <span className="text-xs text-gray-400">
                                        Details:
                                      </span>
                                      <pre className="text-xs mt-1 p-2 bg-gray-900 rounded overflow-x-auto">
                                        {JSON.stringify(log.details, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAuditLogsPage;
