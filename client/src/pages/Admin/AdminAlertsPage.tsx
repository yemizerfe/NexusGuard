import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, Loader2, Globe, Target, Users } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const API_URL = 'http://localhost:8000/api';

interface AffectedUser {
  email: string;
  detected_at: string;
}

interface Alert {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
  source_ip?: string;
  target?: string;
  description?: string;
  mitre_tactic?: string;
  mitre_technique?: string;
  affected_users?: AffectedUser[];
  total_affected?: number;
}

const AdminAlertsPage = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllAlerts();
  }, []);

  useEffect(() => {
    filterAlerts();
  }, [search, filterSeverity, alerts]);

  const fetchAllAlerts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/admin/all-alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAlerts = () => {
    let filtered = [...alerts];
    
    if (search) {
      filtered = filtered.filter(alert => 
        alert.title?.toLowerCase().includes(search.toLowerCase()) ||
        alert.target?.toLowerCase().includes(search.toLowerCase()) ||
        alert.source_ip?.toLowerCase().includes(search.toLowerCase()) ||
        alert.affected_users?.some(u => u.email.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(alert => alert.severity === filterSeverity);
    }
    
    setFilteredAlerts(filtered);
  };

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'critical': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const activeCount = alerts.filter(a => a.status === 'active').length;
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-8 h-8 text-primary" />
            System Alerts
          </h1>
          <p className="text-gray-400 mt-1">
            View all system alerts across all users
          </p>
          <div className="flex gap-4 mt-2">
            <span className="text-xs text-red-500">Active: {activeCount}</span>
            <span className="text-xs text-green-500">Resolved: {resolvedCount}</span>
          </div>
        </div>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <CardTitle>All Alerts ({filteredAlerts.length})</CardTitle>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by title, user, target IP or domain..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-gray-800/50 border-gray-700"
                />
              </div>
              
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2 text-sm cursor-pointer"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </CardHeader>
          
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)} ${
                      alert.status === 'resolved' ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-semibold">{alert.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getSeverityColor(alert.severity)}`}>
                            {alert.severity?.toUpperCase()}
                          </span>
                          {alert.status === 'active' ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-500">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">
                              RESOLVED
                            </span>
                          )}
                        </div>
                        
                        {/* Target IP and Domain Information */}
                        <div className="flex flex-wrap gap-3 mb-2">
                          {alert.target && alert.target !== '127.0.0.1' && (
                            <div className="flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">
                              <Target className="w-3 h-3" />
                              <span>Target: {alert.target}</span>
                            </div>
                          )}
                          {alert.source_ip && alert.source_ip !== '127.0.0.1' && alert.source_ip !== 'localhost' && (
                            <div className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded font-mono">
                              <Globe className="w-3 h-3" />
                              <span>IP: {alert.source_ip}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Description */}
                        {alert.description && (
                          <p className="text-sm text-gray-400 mb-2">{alert.description}</p>
                        )}
                        
                        {/* Affected Users Section */}
                        {alert.affected_users && alert.affected_users.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center gap-2 text-xs text-yellow-500 mb-1">
                              <Users className="w-3 h-3" />
                              <span>Affected {alert.total_affected || alert.affected_users.length} user(s):</span>
                            </div>
                            <div className="flex flex-wrap gap-2 ml-5">
                              {alert.affected_users.map((user, idx) => (
                                <div key={idx} className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded">
                                  <span>{user.email}</span>
                                  <span className="text-gray-500">•</span>
                                  <span className="text-gray-500">{formatDate(user.detected_at)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* MITRE Info */}
                        {(alert.mitre_tactic || alert.mitre_technique) && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {alert.mitre_tactic && (
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                Tactic: {alert.mitre_tactic}
                              </span>
                            )}
                            {alert.mitre_technique && (
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                                Technique: {alert.mitre_technique}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredAlerts.length === 0 && !loading && (
                  <div className="text-center py-8 text-gray-400">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No alerts found</p>
                    <p className="text-xs mt-1">Try adjusting your search or filter</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAlertsPage;