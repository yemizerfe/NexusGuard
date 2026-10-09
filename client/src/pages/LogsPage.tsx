
import { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
} from 'lucide-react';
import Sidebar from '../components/layout/sidebar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useSecurityStore } from '../../store/securityStore';

const LogsPage = () => {
  const { logs, fetchLogs, isLoading } = useSecurityStore();

  const [search, setSearch] = useState('');
  const [filterEvent, setFilterEvent] = useState('all');
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    const searchTerm = search.toLowerCase();

    const matchesSearch =
      log.user.toLowerCase().includes(searchTerm) ||
      log.ip.includes(search) ||
      log.event.toLowerCase().includes(searchTerm);

    const matchesFilter =
      filterEvent === 'all' || log.event === filterEvent;

    return matchesSearch && matchesFilter;
  });

  const events = ['all', ...new Set(logs.map((log) => log.event))];

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-500/20 text-red-500',
      medium: 'bg-yellow-500/20 text-yellow-500',
      low: 'bg-green-500/20 text-green-500',
      critical: 'bg-red-600/20 text-red-600',
      info: 'bg-blue-500/20 text-blue-500',
    };

    return colors[severity] || colors.low;
  };

  const downloadFile = (
    content: string,
    mimeType: string,
    extension: string,
    prefix = 'logs'
  ) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${prefix}_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, '-')}.${extension}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const exportAsCSV = () => {
    const headers = [
      'Time',
      'User',
      'IP Address',
      'Event Type',
      'Severity',
    ];

    const rows = filteredLogs.map((log) => [
      log.time,
      log.user,
      log.ip,
      log.event,
      log.severity,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    downloadFile(
      csvContent,
      'text/csv;charset=utf-8;',
      'csv'
    );
  };

  const exportAsJSON = () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      total_logs: filteredLogs.length,
      filters: {
        search: search || 'none',
        event_type: filterEvent,
      },
      logs: filteredLogs.map((log) => ({
        time: log.time,
        user: log.user,
        ip_address: log.ip,
        event_type: log.event,
        severity: log.severity,
        id: log.id,
      })),
    };

    downloadFile(
      JSON.stringify(exportData, null, 2),
      'application/json',
      'json'
    );
  };

  const exportAsTXT = () => {
    const header = `${'='.repeat(80)}\n`;
    const title = 'SYSTEM LOGS EXPORT\n';
    const date = `Export Date: ${new Date().toLocaleString()}\n`;
    const filters = `Filters Applied: Search="${search || 'none'}", Event Type="${filterEvent}"\n`;
    const total = `Total Logs: ${filteredLogs.length}\n`;
    const separator = `${'-'.repeat(80)}\n`;

    const logLines = filteredLogs
      .map(
        (log) =>
          `\n[${log.time}]\n` +
          `  User: ${log.user}\n` +
          `  IP: ${log.ip}\n` +
          `  Event: ${log.event}\n` +
          `  Severity: ${log.severity}\n` +
          separator
      )
      .join('');

    const txtContent =
      header + title + date + filters + total + separator + logLines;

    downloadFile(txtContent, 'text/plain;charset=utf-8', 'txt');
  };

  const exportAsHTML = () => {
    const escapeHTML = (value: string) =>
      value.replace(/[&<>"']/g, (character) => {
        const entities: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        };

        return entities[character];
      });

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>System Logs Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #fff; color: #222; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
    .meta { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #4f46e5; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    .severity-high, .severity-critical { color: #dc2626; font-weight: bold; }
    .severity-medium { color: #ca8a04; font-weight: bold; }
    .severity-low { color: #16a34a; }
    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>System Logs Export</h1>
  <div class="meta">
    <p><strong>Export Date:</strong> ${escapeHTML(new Date().toLocaleString())}</p>
    <p><strong>Total Logs:</strong> ${filteredLogs.length}</p>
    <p><strong>Search:</strong> ${escapeHTML(search || 'none')}</p>
    <p><strong>Event Type:</strong> ${escapeHTML(filterEvent)}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>User</th>
        <th>IP Address</th>
        <th>Event Type</th>
        <th>Severity</th>
      </tr>
    </thead>
    <tbody>
      ${filteredLogs
        .map(
          (log) => `
      <tr>
        <td>${escapeHTML(log.time)}</td>
        <td>${escapeHTML(log.user)}</td>
        <td>${escapeHTML(log.ip)}</td>
        <td>${escapeHTML(log.event)}</td>
        <td class="severity-${escapeHTML(log.severity)}">${escapeHTML(log.severity)}</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>
  <div class="footer">
    <p>Generated by NexusGuard - ${escapeHTML(new Date().toISOString())}</p>
  </div>
</body>
</html>`;

    downloadFile(
      htmlContent,
      'text/html;charset=utf-8',
      'html',
      'logs_report'
    );
  };

  const handleExport = (format: string) => {
    setShowExportMenu(false);

    switch (format) {
      case 'csv':
        exportAsCSV();
        break;
      case 'json':
        exportAsJSON();
        break;
      case 'txt':
        exportAsTXT();
        break;
      case 'html':
        exportAsHTML();
        break;
      default:
        exportAsCSV();
    }
  };

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">System Logs</h1>
            <p className="mt-1 text-gray-400">
              All system activity with filtering and export
            </p>
          </div>

          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <CardTitle>
                  Activity Logs ({filteredLogs.length})
                </CardTitle>

                <div className="relative flex gap-2">
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowExportMenu((previous) => !previous)}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>

                    {showExportMenu && (
                      <>
                        <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => handleExport('csv')}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-700"
                            >
                              <FileSpreadsheet className="h-4 w-4 text-green-500" />
                              Export as CSV
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExport('json')}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-700"
                            >
                              <FileJson className="h-4 w-4 text-yellow-500" />
                              Export as JSON
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExport('txt')}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-700"
                            >
                              <FileText className="h-4 w-4 text-blue-500" />
                              Export as TXT
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExport('html')}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-700"
                            >
                              <FileText className="h-4 w-4 text-purple-500" />
                              Export as HTML Report
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          aria-label="Close export menu"
                          className="fixed inset-0 z-10 cursor-default"
                          onClick={() => setShowExportMenu(false)}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                  <Input
                    placeholder="Search by user, IP, or event..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="border-gray-700 bg-gray-800/50 pl-10"
                  />
                </div>

                <div className="flex gap-2">
                  <Filter className="h-4 w-4 self-center text-gray-400" />
                  <select
                    value={filterEvent}
                    onChange={(event) => setFilterEvent(event.target.value)}
                    className="cursor-pointer rounded-md border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm"
                  >
                    {events.map((event) => (
                      <option key={event} value={event}>
                        {event === 'all' ? 'All Events' : event}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-800">
                      <tr className="text-left text-gray-400">
                        <th className="pb-3">Time</th>
                        <th className="pb-3">User</th>
                        <th className="pb-3">IP Address</th>
                        <th className="pb-3">Event Type</th>
                        <th className="pb-3">Severity</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-gray-800/50 transition-colors hover:bg-gray-800/30"
                        >
                          <td className="py-3">{log.time}</td>
                          <td className="py-3 font-medium">{log.user}</td>
                          <td className="py-3 font-mono text-xs">
                            {log.ip === 'unknown' ? '—' : log.ip}
                          </td>
                          <td className="py-3">
                            <span className="rounded-full bg-gray-800 px-2 py-1 text-xs">
                              {log.event}
                            </span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${getSeverityBadge(log.severity)}`}
                            >
                              {log.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredLogs.length === 0 && !isLoading && (
                    <div className="py-8 text-center text-gray-400">
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

export default LogsPage;

