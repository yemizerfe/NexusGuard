import { useState, useEffect } from 'react';
import { Search, Filter, Download, FileSpreadsheet, FileJson, FileText, X } from 'lucide-react';
import Sidebar from '../components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useSecurityStore } from '../../store/securityStore';

const LogsPage = () => {
  const { logs, fetchLogs, isLoading } = useSecurityStore();
  const [search, setSearch] = useState('');
  const [filterEvent, setFilterEvent] = useState('all');
  const [exportFormat, setExportFormat] = useState('csv');
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.user.toLowerCase().includes(search.toLowerCase()) ||
                          log.ip.includes(search) ||
                          log.event.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterEvent === 'all' || log.event === filterEvent;
    return matchesSearch && matchesFilter;
  });

  const events = ['all', ...new Set(logs.map(l => l.event))];

  const getSeverityBadge = (severity: string) => {
    const colors = {
      high: 'bg-red-500/20 text-red-500',
      medium: 'bg-yellow-500/20 text-yellow-500',
      low: 'bg-green-500/20 text-green-500',
      critical: 'bg-red-600/20 text-red-600',
      info: 'bg-blue-500/20 text-blue-500'
    };
    return colors[severity as keyof typeof colors] || colors.low;
  };

  const exportAsCSV = () => {
    const headers = ['Time', 'User', 'IP Address', 'Event Type', 'Severity'];
    const rows = filteredLogs.map(log => [
      log.time,
      log.user,
      log.ip,
      log.event,
      log.severity
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsJSON = () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      total_logs: filteredLogs.length,
      filters: {
        search: search || 'none',
        event_type: filterEvent
      },
      logs: filteredLogs.map(log => ({
        time: log.time,
        user: log.user,
        ip_address: log.ip,
        event_type: log.event,
        severity: log.severity,
        id: log.id
      }))
    };
    
    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsTXT = () => {
    const header = '='.repeat(80) + '\n';
    const title = 'SYSTEM LOGS EXPORT\n';
    const date = `Export Date: ${new Date().toLocaleString()}\n`;
    const filters = `Filters Applied: Search="${search || 'none'}", Event Type="${filterEvent}"\n`;
    const total = `Total Logs: ${filteredLogs.length}\n`;
    const separator = '-'.repeat(80) + '\n';
    
    let logLines = '';
    filteredLogs.forEach(log => {
      logLines += `\n[${log.time}]\n`;
      logLines += `  User: ${log.user}\n`;
      logLines += `  IP: ${log.ip}\n`;
      logLines += `  Event: ${log.event}\n`;
      logLines += `  Severity: ${log.severity}\n`;
      logLines += separator;
    });
    
    const txtContent = header + title + date + filters + total + separator + logLines;
    const blob = new Blob([txtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>System Logs Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #fff; }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .meta { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #4f46e5; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    .severity-high { color: #ef4444; font-weight: bold; }
    .severity-medium { color: #eab308; font-weight: bold; }
    .severity-low { color: #22c55e; }
    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>System Logs Export</h1>
  <div class="meta">
    <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Total Logs:</strong> ${filteredLogs.length}</p>
    <p><strong>Filters:</strong> Search="${search || 'none'}", Event Type="${filterEvent}"</p>
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
      ${filteredLogs.map(log => `
        <tr>
          <td>${log.time}</td>
          <td>${log.user}</td>
          <td>${log.ip}</td>
          <td>${log.event}</td>
          <td class="severity-${log.severity}">${log.severity}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">
    <p>Generated by Security Dashboard - ${new Date().toISOString()}</p>
  </div>
</body>
</html>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `logs_report_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: string) => {
    setExportFormat(format);
    setShowExportMenu(false);
    
    switch(format) {
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
            <p className="text-gray-400 mt-1">All system activity with filtering and export</p>
          </div>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <CardTitle>Activity Logs ({filteredLogs.length})</CardTitle>
                <div className="flex gap-2 relative">
                  <div className="relative">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                    
                    {showExportMenu && (
                      <>
                        <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
                          <div className="py-1">
                            <button
                              onClick={() => handleExport('csv')}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                            >
                              <FileSpreadsheet className="w-4 h-4 text-green-500" />
                              Export as CSV
                            </button>
                            <button
                              onClick={() => handleExport('json')}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                            >
                              <FileJson className="w-4 h-4 text-yellow-500" />
                              Export as JSON
                            </button>
                            <button
                              onClick={() => handleExport('txt')}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4 text-blue-500" />
                              Export as TXT
                            </button>
                            <button
                              onClick={() => handleExport('html')}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4 text-purple-500" />
                              Export as HTML Report
                            </button>
                          </div>
                        </div>
                        <div 
                          className="fixed inset-0 z-0"
                          onClick={() => setShowExportMenu(false)}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by user, IP, or event..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 bg-gray-800/50 border-gray-700"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Filter className="w-4 h-4 text-gray-400 self-center" />
                  <select
                    value={filterEvent}
                    onChange={(e) => setFilterEvent(e.target.value)}
                    className="bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2 text-sm cursor-pointer"
                  >
                    {events.map(event => (
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                        <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="py-3">{log.time}</td>
                          <td className="py-3 font-medium">{log.user}</td>
                          <td className="py-3 font-mono text-xs">
                            {log.ip === 'unknown' ? '—' : log.ip}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-1 rounded-full bg-gray-800 text-xs">
                              {log.event}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${getSeverityBadge(log.severity)}`}>
                              {log.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {filteredLogs.length === 0 && !isLoading && (
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

export default LogsPage;