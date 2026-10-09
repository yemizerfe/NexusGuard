
import { useState, useEffect, useCallback } from "react";
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
  RefreshCw,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");

const API_URL = `${API_BASE_URL}/api`;

interface AdminStats {
  total_users: number;
  active_users: number;
  total_scans: number;
  total_logs: number;
  active_alerts: number;
  resolved_alerts: number;
  total_alerts: number;
  api_health: string;
  db_health: string;
}

interface RecentUser {
  id: string | number;
  full_name?: string | null;
  email?: string | null;
  created_at?: string | null;
}

const defaultStats: AdminStats = {
  total_users: 0,
  active_users: 0,
  total_scans: 0,
  total_logs: 0,
  active_alerts: 0,
  resolved_alerts: 0,
  total_alerts: 0,
  api_health: "unknown",
  db_health: "unknown",
};

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return "N/A";

  const date = new Date(dateString);

  return Number.isNaN(date.getTime())
    ? "N/A"
    : date.toLocaleDateString();
};

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats>(defaultStats);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        setError("Your session may have expired. Please sign in again.");
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [statsResult, usersResult] = await Promise.allSettled([
        fetch(`${API_URL}/admin/stats`, { headers }),
        fetch(`${API_URL}/admin/users/recent`, { headers }),
      ]);

      let requestSucceeded = false;

      if (statsResult.status === "fulfilled") {
        const response = statsResult.value;

        if (response.ok) {
          const data: unknown = await response.json();

          if (data && typeof data === "object") {
            setStats({
              ...defaultStats,
              ...(data as Partial<AdminStats>),
            });
            requestSucceeded = true;
          }
        } else if (response.status === 401 || response.status === 403) {
          setError(
            "You are not authorized to view the admin dashboard. Please check your session and permissions."
          );
        }
      }

      if (usersResult.status === "fulfilled") {
        const response = usersResult.value;

        if (response.ok) {
          const data: unknown = await response.json();

          if (data && typeof data === "object" && "users" in data) {
            const users = (data as { users?: unknown }).users;

            if (Array.isArray(users)) {
              setRecentUsers(users as RecentUser[]);
              requestSucceeded = true;
            }
          }
        } else if (
          (response.status === 401 || response.status === 403) &&
          !error
        ) {
          setError(
            "You are not authorized to view recent users. Please check your session and permissions."
          );
        }
      }

      if (!requestSucceeded && !error) {
        setError("Could not load dashboard data. Please try again.");
      }
    } catch (fetchError) {
      console.error("Failed to fetch admin data:", fetchError);
      setError(
        "Unable to connect to the backend. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [error]);

  useEffect(() => {
    void fetchAdminData();
  }, [fetchAdminData]);

  const handleRefreshData = () => {
    setRefreshing(true);
    void fetchAdminData();
  };

  const handleViewAuditLogs = () => navigate("/admin/audit-logs");
  const handleManageUsers = () => navigate("/admin/users");
  const handleSystemSettings = () => navigate("/admin/settings");
  const handleViewAlerts = () => navigate("/admin/alerts");

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

  const systemOnline =
    stats.api_health.toLowerCase() === "healthy" &&
    stats.db_health.toLowerCase() === "healthy";

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Shield className="h-8 w-8 text-red-500" />
              Admin Dashboard
            </h1>
            <p className="mt-1 text-gray-400">
              System overview and administration
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshData}
            disabled={refreshing || loading}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing || loading ? "animate-spin" : ""
              }`}
            />
            {refreshing || loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Loading and Error States */}
        {loading && (
          <div className="mb-6 text-sm text-gray-400" role="status">
            Loading dashboard data...
          </div>
        )}

        {error && (
          <div
            className="mb-6 flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <p className="text-sm text-red-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={stat.onClick}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    stat.onClick();
                  }
                }}
                role="button"
                tabIndex={0}
                className="cursor-pointer rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <Card className="border-gray-800 bg-gray-900/50 transition-all duration-200 hover:border-gray-700 hover:bg-gray-800/70">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="mb-1 text-sm text-gray-400">
                          {stat.title}
                        </p>
                        <p className="text-3xl font-bold">
                          {loading ? "—" : stat.value}
                        </p>
                      </div>
                      <Icon className={`h-10 w-10 ${stat.color} opacity-50`} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Alert Summary */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="p-4">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-500/10 p-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Active Alerts</p>
                    <p className="text-2xl font-bold text-red-500">
                      {stats.active_alerts}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-500/10 p-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Resolved Alerts</p>
                    <p className="text-2xl font-bold text-green-500">
                      {stats.resolved_alerts}
                    </p>
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

          <Card className="border-gray-800 bg-gray-900/50">
            <CardContent className="p-4">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <Server className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">System Health</p>
                    <p
                      className={`text-2xl font-bold ${
                        systemOnline ? "text-green-500" : "text-yellow-500"
                      }`}
                    >
                      {loading
                        ? "Checking..."
                        : systemOnline
                          ? "Online"
                          : "Check Status"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-500/10 p-2">
                    <Activity className="h-5 w-5 text-purple-500" />
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

        {/* Recent Users */}
        {recentUsers.length > 0 && (
          <Card className="mb-6 border-gray-800 bg-gray-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Recent Users
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-2">
                {recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-lg bg-gray-800/30 p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {user.full_name || "Unnamed user"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {user.email || "No email"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        Joined: {formatDate(user.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <button
              type="button"
              onClick={handleViewAuditLogs}
              className="group w-full rounded-lg bg-gray-800/30 p-3 text-left transition-colors hover:bg-gray-800/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium transition-colors group-hover:text-primary">
                    View All Audit Logs
                  </p>
                  <p className="text-xs text-gray-400">
                    Review all user activity across the system
                  </p>
                </div>
                <Eye className="h-4 w-4 text-gray-400 transition-colors group-hover:text-primary" />
              </div>
            </button>

            <button
              type="button"
              onClick={handleManageUsers}
              className="group w-full rounded-lg bg-gray-800/30 p-3 text-left transition-colors hover:bg-gray-800/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium transition-colors group-hover:text-primary">
                    Manage Users
                  </p>
                  <p className="text-xs text-gray-400">
                    Add, remove, or modify user accounts
                  </p>
                </div>
                <Users className="h-4 w-4 text-gray-400 transition-colors group-hover:text-primary" />
              </div>
            </button>

            <button
              type="button"
              onClick={handleSystemSettings}
              className="group w-full rounded-lg bg-gray-800/30 p-3 text-left transition-colors hover:bg-gray-800/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium transition-colors group-hover:text-primary">
                    System Settings
                  </p>
                  <p className="text-xs text-gray-400">
                    Configure global system settings
                  </p>
                </div>
                <Settings className="h-4 w-4 text-gray-400 transition-colors group-hover:text-primary" />
              </div>
            </button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;

