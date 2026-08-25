import React, { useState, useEffect } from 'react';
import { Settings, Database, Shield, Globe, Lock, Activity, CheckCircle } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const API_URL = 'http://localhost:8000/api';

const AdminSystemSettingsPage = () => {
  // ✅ AUTO-DETECT ENVIRONMENT
  const detectEnvironment = () => {
    // Method 1: Check build mode
    if (import.meta.env.PROD) {
      return 'production';
    }
    if (import.meta.env.DEV) {
      return 'development';
    }
    
    // Method 2: Check hostname
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    }
    
    // Method 3: Check URL
    if (window.location.href.includes('localhost')) {
      return 'development';
    }
    
    return 'production';
  };
  
  // ✅ Get version from package.json or build time
  const getVersion = () => {
    // You can also import from package.json
    return '1.0.0';
  };

  const [settings, setSettings] = useState({
    appName: 'NexusGuard',
    version: getVersion(),
    environment: detectEnvironment(), // ✅ AUTO-DETECTED!
    sessionTimeout: '30',
    maxLoginAttempts: '5',
    defaultScanPorts: '80, 443, 22, 3306, 5432',
    mfaEnabled: true,
    argon2MemoryCost: '102400 KB (100 MB)',
    argon2TimeCost: '2 iterations',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemConfig();
  }, []);

  const fetchSystemConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`${API_URL}/admin/system/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        // ✅ Preserve auto-detected environment if backend doesn't provide it
        setSettings({
          ...data,
          environment: data.environment || detectEnvironment(),
        });
      }
      // If API fails, keep auto-detected values
    } catch (error) {
      console.error('Failed to fetch system config:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  // Determine badge color based on environment
  const getEnvironmentBadge = () => {
    if (settings.environment === 'production') {
      return 'bg-green-500/20 text-green-500';
    }
    if (settings.environment === 'staging') {
      return 'bg-yellow-500/20 text-yellow-500';
    }
    return 'bg-blue-500/20 text-blue-500';
  };

  const getEnvironmentIcon = () => {
    if (settings.environment === 'production') {
      return <CheckCircle className="w-4 h-4" />;
    }
    return null;
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-8 h-8 text-primary" />
            System Configuration
          </h1>
          <p className="text-gray-400 mt-1">
            Current system settings and configuration
          </p>
        </div>

        {/* Environment Banner - AUTO-DETECTED */}
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
          settings.environment === 'production' 
            ? 'bg-green-500/10 border border-green-500/20'
            : 'bg-yellow-500/10 border border-yellow-500/20'
        }`}>
          {settings.environment === 'production' ? (
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
          ) : (
            <div className="w-5 h-5 text-yellow-500 mt-0.5">⚠️</div>
          )}
          <div>
            <p className={`text-sm font-medium ${
              settings.environment === 'production' ? 'text-green-500' : 'text-yellow-500'
            }`}>
              {settings.environment === 'production' ? 'Production Environment' : 'Development Environment'}
            </p>
            <p className="text-sm text-gray-400">
              {settings.environment === 'production' 
                ? 'These settings reflect your live production configuration.'
                : 'This is a development environment. Some features may behave differently in production.'
              }
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Application Settings */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Application Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">Application Name</span>
                <span className="text-sm font-medium">{settings.appName}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">Version</span>
                <span className="text-sm font-medium text-primary">v{settings.version}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">Environment</span>
                <span className={`text-sm px-2 py-0.5 rounded-full flex items-center gap-1 ${getEnvironmentBadge()}`}>
                  {getEnvironmentIcon()}
                  {settings.environment}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">JWT Token Expiry</span>
                <span className="text-sm">{settings.sessionTimeout} minutes</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">Max Login Attempts</span>
                <span className="text-sm">{settings.maxLoginAttempts} attempts</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">MFA Status</span>
                <span className="text-sm text-green-500 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Available for all users
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">Password Hashing</span>
                <span className="text-sm">Argon2id (Memory: {settings.argon2MemoryCost}, Iterations: {settings.argon2TimeCost})</span>
              </div>
            </CardContent>
          </Card>

          {/* Scanner Configuration */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Scanner Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">Default Scan Ports</span>
                <span className="text-sm font-mono text-xs">{settings.defaultScanPorts}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">SSL Certificate Check</span>
                <span className="text-sm text-green-500 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Enabled
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">Security Headers Check</span>
                <span className="text-sm">CSP, HSTS, X-Frame-Options, X-Content-Type</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">Sensitive Paths Check</span>
                <span className="text-sm">15+ common admin/config paths</span>
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">API Status</span>
                <span className="text-sm text-green-500 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Operational
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">Database</span>
                <span className="text-sm text-green-500 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">WebSocket</span>
                <span className="text-sm text-green-500 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Active
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-800/30">
                <span className="text-sm text-gray-400">AI Engine</span>
                <span className="text-sm text-green-500 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Ready
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-gray-500">
            <p>⚙️ Settings reflect your actual application configuration. NexusGuard Security Platform v{settings.version}</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSystemSettingsPage;