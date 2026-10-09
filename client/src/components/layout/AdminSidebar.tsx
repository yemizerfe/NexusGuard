
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Shield, 
  Users, 
  Activity, 
  Eye, 
  Settings,
  LogOut,
  BarChart3,
  Bell
} from 'lucide-react';
import { Button } from '../ui/button';
import { useAuthStore } from '../../../store/authStore';

const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const menuItems = [
    { path: '/admin', icon: BarChart3, label: 'Dashboard' },
    { path: '/admin/users', icon: Users, label: 'User Management' },
    { path: '/admin/audit-logs', icon: Eye, label: 'Audit Logs' },
    { path: '/admin/scans', icon: Activity, label: 'All Scans' },
    { path: '/admin/alerts', icon: Bell, label: 'Alerts' },
    { path: '/admin/settings', icon: Settings, label: 'System Setting' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Admin';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="w-64 bg-gray-900/50 border-r border-gray-800 flex flex-col h-screen">
      {/* Admin Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-red-500" />
          <span className="font-bold text-lg">NexusGuard</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 ml-2">
            ADMIN
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">Administration Panel</p>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant={isActive ? 'default' : 'ghost'}
              className="w-full justify-start gap-3"
              onClick={() => navigate(item.path)}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* Admin Profile */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex items-center gap-3 p-2 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-sm font-semibold text-red-500">{userInitial}</span>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">Administrator</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-red-500 hover:text-red-400 mt-2"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default AdminSidebar;
