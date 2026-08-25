// Updated Sidebar.tsx - Small red ping pulse only
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Settings,
  User,
  Key,
  LogOut,
  ChevronUp,
  Search
} from 'lucide-react';
import { Button } from '../ui/button';
import { useAuthStore } from '../../../store/authStore';
import { useSecurityStore } from '../../../store/securityStore';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, fetchUser, isAuthenticated } = useAuthStore();
  const { alerts, fetchAlerts } = useSecurityStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token && isAuthenticated && !user) {
      fetchUser();
    }
  }, [isAuthenticated, user, fetchUser]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAlerts();
    }
  }, [isAuthenticated, fetchAlerts]);

  // Check if there are active alerts
  const hasActiveAlerts = alerts.some(a => a.status === 'active');
  const hasCriticalAlerts = alerts.some(a => a.severity === 'critical' && a.status === 'active');

  const menuItems = [
    { path: '/dashboard', icon: Shield, label: 'Dashboard' },
    { path: '/scan', icon: Search, label: 'Security Scan' },
    { path: '/logs', icon: Activity, label: 'Logs' },
    { path: '/alerts', icon: AlertTriangle, label: 'Alerts', hasAlert: hasActiveAlerts, isCritical: hasCriticalAlerts },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Guest User';
  const displayEmail = user?.email || 'guest@example.com';
  const userInitial = displayName !== 'Guest User' ? displayName.charAt(0).toUpperCase() : 'G';

  return (
    <div className="w-64 bg-gray-900/50 border-r border-gray-800 flex flex-col min-h-screen">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary" />
          <span className="font-bold text-lg">NexusGuard</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">Security Platform</p>
      </div>
      
      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant={isActive ? 'default' : 'ghost'}
              className="w-full justify-start gap-3 relative"
              onClick={() => navigate(item.path)}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              
              {/* ✅ Tiny Red Ping Pulse for Alerts */}
              {item.hasAlert && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${item.isCritical ? 'bg-red-500' : 'bg-orange-500'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${item.isCritical ? 'bg-red-600' : 'bg-orange-600'}`}></span>
                  </div>
                </div>
              )}
            </Button>
          );
        })}
      </nav>

      {/* Profile Section at Bottom */}
      <div className="border-t border-gray-800 p-4 mt-auto">
        <button
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">
              {userInitial}
            </span>
          </div>
          
          <div className="flex-1 text-left">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{displayEmail}</p>
          </div>
          
          <ChevronUp className={`w-4 h-4 text-gray-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isProfileOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-2 space-y-1"
            >
              <div className="px-3 py-2 rounded-lg bg-gray-800/50 mb-2">
                <p className="text-xs text-gray-400">Logged in as</p>
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-gray-400 truncate">{displayEmail}</p>
              </div>
              
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-sm"
                onClick={() => {
                  setIsProfileOpen(false);
                  navigate('/settings');
                }}
              >
                <User className="w-4 h-4" />
                Account Settings
              </Button>
              
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-sm"
                onClick={() => {
                  setIsProfileOpen(false);
                  navigate('/settings/password');
                }}
              >
                <Key className="w-4 h-4" />
                Change Password
              </Button>
              
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-sm text-red-500 hover:text-red-400"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Sidebar;