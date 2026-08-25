import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import LogsPage from "./pages/LogsPage";
import AlertsPage from "./pages/AlertsPage";
import SettingsPage from "./pages/SettingsPage";
import SecurityScanPage from "./pages/SecurityScanPage";
import ChangePasswordPage from "./pages/settings/ChangePasswordPage";
// Admin Imports
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminUsersPage from "./pages/Admin/AdminUsersPage";
import AdminAuditLogsPage from "./pages/Admin/AdminAuditLogsPage";
import AdminScansPage from "./pages/Admin/AdminScansPage";
import AdminAlertsPage from "./pages/Admin/AdminAlertsPage";
import AdminSystemSettingsPage from "./pages/Admin/AdminSystemSettingsPage";
import { useAuthStore } from "../store/authStore";

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-950">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

// Protected Route Component - Only accessible when logged in
const PrivateRoute = ({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) => {
  const { isAuthenticated, isLoading, fetchUser, user } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token && !isAuthenticated) {
      fetchUser();
    }
  }, [isAuthenticated, fetchUser]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Check if admin access is required
  if (requireAdmin && !user?.is_superuser) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

// Public Route Component - Redirects to appropriate dashboard if already logged in
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    // Redirect admin to admin dashboard, regular users to user dashboard
    if (user?.is_superuser) {
      return <Navigate to="/admin" />;
    }
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

function App() {
  const { fetchUser, isAuthenticated, user } = useAuthStore();

  // Check for existing token on app startup
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token && !isAuthenticated) {
      fetchUser();
    }
  }, [fetchUser, isAuthenticated]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />

        {/* User Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute requireAdmin={false}>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/scan"
          element={
            <PrivateRoute requireAdmin={false}>
              <SecurityScanPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <PrivateRoute requireAdmin={false}>
              <LogsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <PrivateRoute requireAdmin={false}>
              <AlertsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute requireAdmin={false}>
              <SettingsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings/password"
          element={
            <PrivateRoute requireAdmin={false}>
              <ChangePasswordPage />
            </PrivateRoute>
          }
        />

        {/* Admin Protected Routes - Require Admin Privileges */}
        <Route
          path="/admin"
          element={
            <PrivateRoute requireAdmin={true}>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <PrivateRoute requireAdmin={true}>
              <AdminUsersPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <PrivateRoute requireAdmin={true}>
              <AdminAuditLogsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/scans"
          element={
            <PrivateRoute requireAdmin={true}>
              <AdminScansPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/alerts"
          element={
            <PrivateRoute requireAdmin={true}>
              <AdminAlertsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <PrivateRoute requireAdmin={true}>
              <AdminSystemSettingsPage />
            </PrivateRoute>
          }
        />

        {/* Default redirect - based on user role */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              user?.is_superuser ? (
                <Navigate to="/admin" />
              ) : (
                <Navigate to="/dashboard" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* 404 - Catch all unmatched routes */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
