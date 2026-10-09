
import { useState, useEffect } from 'react';
import { Search, Download, Eye, User } from 'lucide-react';
import Sidebar from '../../components/layout/sidebar';
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

interface AdminLog {
  id: string;
  user_email: string;
  event: string;
  ip: string;
  created_at: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeAdminLog = (value: unknown): AdminLog | null => {
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
  };
};

const AdminLogsPage = () => {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AdminLog[]>([]);
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<string[]>([]);

  useEffect(() => {
    void fetchAllLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [search, filterUser, logs]);

  const fetchAllLogs = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_URL}/admin/all-logs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error(
          'Failed to fetch admin logs:',
          response.status,
          await response.text()
        );
        return;
      }

      const data: unknown = await response.json();

      let rawLogs: unknown[] = [];

      if (Array.isArray(data)) {
        rawLogs = data;
      } else if (isRecord(data) && Array.isArray(data.logs)) {
        rawLogs = data.logs;
      }

      const logsArray = rawLogs
        .map(normalizeAdminLog)
        .filter((log): log is AdminLog => log !== null);

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

      setUsers(uniqueUsers);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
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

    setFilteredLogs(filtered);
  };

  const exportLogs = () => {
    const rows = [
      ['User', 'Event', 'IP Address', 'Timestamp'],
      ...filteredLogs.map((log) => [
        log.user_email,
        log.event,
        log.ip,
        log.created_at ? new Date(log.created_at).toLocaleString() : '',
      ]),
    ];

    const csv = rows
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
    anchor.download = `admin-logs-${new Date()
      .toISOString()
      .split('T')[0]}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const getEventBadge = (event: string) => {
    const badges: Record<string, string> = {
      login_success: 'bg-green-500/20 text-green-500',
      login_failed: 'bg-red-500/20 text-red-500',
      scan_started: 'bg-blue-500/20 text-blue-500',
      scan_completed: 'bg-blue-500/20 text-blue-500',
      alert_triggered: 'bg-red-500/20 text-red-500',
      scan_failed: 'bg-yellow-500/20 text-yellow-500',
    };

    return (
      badges[event.toLowerCase()] || 'bg-gray-500/20 text-gray-400'
    );
  };

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Eye className="w-8 h-8 text-primary" />
              Admin Audit Logs
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
                  All Activity Logs ({filteredLogs.length})
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

              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by user, event, or IP..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-10 bg-gray-800/50 border-gray-700"
                  />
                </div>

                <div className="flex gap-2">
                  <User className="w-4 h-4 text-gray-400 self-center" />
                  <select
                    value={filterUser}
                    onChange={(event) => setFilterUser(event.target.value)}
                    className="bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2 text-sm cursor-pointer"
                  >
                    <option value="all">All Users</option>
                    {users.map((user) => (
                      <option key={user} value={user}>
                        {user}
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
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-800">
                      <tr className="text-left text-gray-400">
                        <th className="pb-3">Timestamp</th>
                        <th className="pb-3">User</th>
                        <th className="pb-3">Event</th>
                        <th className="pb-3">IP Address</th>
                        <th className="pb-3">Details</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="py-3 font-mono text-xs">
                            {log.created_at
                              ? new Date(log.created_at).toLocaleString()
                              : 'N/A'}
                          </td>
                          <td className="py-3 font-medium">
                            {log.user_email}
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${getEventBadge(log.event)}`}
                            >
                              {log.event}
                            </span>
                          </td>
                          <td className="py-3 font-mono text-xs">{log.ip}</td>
                          <td className="py-3 text-gray-400">-</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredLogs.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      No logs found matching your criteria
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminLogsPage;
