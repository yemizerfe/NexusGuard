import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  Users,
  Activity,
  Server,
  TrendingUp,
  CheckCircle,
  Eye,
  Settings,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";

const API_URL = "http://localhost:8000/api";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_users: 0,
    active_users: 0,
    total_scans: 0,
    total_logs: 0,
    active_alerts: 0,
    resolved_alerts: 0,
    total_alerts: 0,
    api_health: "healthy",
    db_health: "healthy",
  });
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");

      const statsRes = await fetch(`${API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      const usersRes = await fetch(`${API_URL}/admin/users/recent`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (usersRes.ok) {
        const data = await usersRes.json();
        setRecentUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefreshData = async () => {
    setRefreshing(true);
    await fetchAdminData();
  };

  const handleViewAuditLogs = () => {
    navigate("/admin/audit-logs");
  };

  const handleManageUsers = () => {
    navigate("/admin/users");
  };

  const handleSystemSettings = () => {
    navigate("/admin/settings");
  };

  const handleViewAlerts = () => {
    navigate("/admin/alerts");
  };

  const statsCards = [
    {
      title: "Total Users",
      value: stats.total_users,
      icon: Users,
      color: "text-blue-500",
      onClick: handleManageUsers,
    },
    {
      title: "Active Users",
      value: stats.active_users,
      icon: CheckCircle,
      color: "text-green-500",
      onClick: handleManageUsers,
    },
    {
      title: "Total Scans",
      value: stats.total_scans,
      icon: Activity,
      color: "text-purple-500",
      onClick: handleViewAuditLogs,
    },
    {
      title: "Active Alerts",
      value: stats.active_alerts,
      icon: AlertCircle,
      color: "text-red-500",
      onClick: handleViewAlerts,
    },
  ];

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header with Refresh Button */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="w-8 h-8 text-red-500" />
              Admin Dashboard
            </h1>
            <p className="text-gray-400 mt-1">
              System overview and administration
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshData}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={stat.onClick}
                className="cursor-pointer"
              >
                <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:bg-gray-800/70 transition-all duration-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">
                          {stat.title}
                        </p>
                        <p className="text-3xl font-bold">{stat.value}</p>
                      </div>
                      <Icon className={`w-10 h-10 ${stat.color} opacity-50`} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Alert Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Active Alerts</p>
                    <p className="text-2xl font-bold text-red-500">{stats.active_alerts}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Resolved Alerts</p>
                    <p className="text-2xl font-bold text-green-500">{stats.resolved_alerts}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleViewAlerts}
                  className="text-xs"
                >
                  View All
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Server className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">System Health</p>
                    <p className="text-2xl font-bold text-green-500">Online</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Activity className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Total Logs</p>
                    <p className="text-2xl font-bold">{stats.total_logs}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Users Section */}
        {recentUsers.length > 0 && (
          <Card className="bg-gray-900/50 border-gray-800 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Recent Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentUsers.map((user: any) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30"
                  >
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        Joined: {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              onClick={handleViewAuditLogs}
              className="w-full text-left p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">
                    View All Audit Logs
                  </p>
                  <p className="text-xs text-gray-400">
                    Review all user activity across the system
                  </p>
                </div>
                <Eye className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
            </button>
            <button
              onClick={handleManageUsers}
              className="w-full text-left p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">
                    Manage Users
                  </p>
                  <p className="text-xs text-gray-400">
                    Add, remove, or modify user accounts
                  </p>
                </div>
                <Users className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
            </button>
            <button
              onClick={handleSystemSettings}
              className="w-full text-left p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">
                    System Settings
                  </p>
                  <p className="text-xs text-gray-400">
                    Configure global system settings
                  </p>
                </div>
                <Settings className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
            </button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
