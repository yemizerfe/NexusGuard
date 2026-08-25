// AlertsPage.tsx - Updated with target IP display for security scanner
import React, { useEffect } from 'react';
import { AlertTriangle, Shield, CheckCircle, Brain, Loader2, Server, Globe, Target, MapPin } from 'lucide-react';
import Sidebar from '../components/layout/sidebar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useSecurityStore } from '../../store/securityStore';

const AlertsPage = () => {
  const { alerts, isLoading, fetchAlerts, resolveAlert } = useSecurityStore();

  useEffect(() => {
    fetchAlerts();
    
    // Auto-refresh every 15 seconds
    const interval = setInterval(() => {
      fetchAlerts();
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);

  // Format absolute date and time
  const formatDateTime = (timestamp: string) => {
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
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
      return timestamp;
    }
  };

  // Format relative time
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
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return formatDateTime(timestamp);
    } catch {
      return 'Just now';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch(severity?.toLowerCase()) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'medium': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Shield className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBg = (severity: string) => {
    switch(severity?.toLowerCase()) {
      case 'critical': return 'border-red-600/30 bg-red-600/5';
      case 'high': return 'border-red-500/30 bg-red-500/5';
      case 'medium': return 'border-yellow-500/30 bg-yellow-500/5';
      default: return 'border-blue-500/30 bg-blue-500/5';
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch(severity?.toLowerCase()) {
      case 'critical': return 'bg-red-600/20 text-red-600';
      case 'high': return 'bg-red-500/20 text-red-500';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500';
      default: return 'bg-blue-500/20 text-blue-500';
    }
  };

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Security Alerts</h1>
            <p className="text-gray-400 mt-1">Critical vulnerabilities found during security scans</p>
          </div>

          {isLoading && alerts.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : alerts.length === 0 ? (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-12 text-center">
                <Shield className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-400">No active alerts. All scanned targets are secure.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Card key={alert.id} className={`${getSeverityBg(alert.severity)} border transition-all hover:shadow-lg`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="flex gap-4 flex-1 min-w-0">
                        {getSeverityIcon(alert.severity)}
                        <div className="flex-1 min-w-0">
                          {/* Badges Row */}
                          <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <span className={`text-sm font-bold uppercase ${getSeverityBadgeClass(alert.severity)}`}>
                              {alert.severity?.toUpperCase() || 'INFO'} SEVERITY
                            </span>
                            
                            {/* Target Website/Domain */}
                            {alert.target && (
                              <span className="flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                                <Target className="w-3 h-3" />
                                Target: {alert.target}
                              </span>
                            )}
                            
                            {/* Source IP - This is the IP of the scanned website */}
                            {alert.source_ip && (
                              <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-mono">
                                <Globe className="w-3 h-3" />
                                IP: {alert.source_ip}
                              </span>
                            )}
                          </div>
                          
                          {/* Alert Message */}
                          <p className="font-medium mb-2 break-words text-gray-200">
                            {alert.message}
                          </p>
                          
                          {/* Timestamps */}
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                            <span>{formatRelativeTime(alert.timestamp)}</span>
                            <span className="font-mono">{formatDateTime(alert.timestamp)}</span>
                          </div>
                          
                          {/* Description */}
                          {alert.description && (
                            <p className="text-sm text-gray-400 mt-2">{alert.description}</p>
                          )}
                          
                          {/* AI Explanation */}
                          {alert.explanation && (
                            <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                              <div className="flex items-center gap-2 mb-1">
                                <Brain className="w-4 h-4 text-purple-500" />
                                <span className="text-xs font-semibold text-purple-400">AI Analysis</span>
                              </div>
                              <p className="text-sm text-gray-300">{alert.explanation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Resolve Button */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                        className="gap-2 shrink-0"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Resolve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertsPage;