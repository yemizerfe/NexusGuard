import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Bell, Shield, Key, LogOut, ChevronRight, Lock, Smartphone, Code, Trash2, Loader2, X, AlertTriangle, CheckCircle } from 'lucide-react';
import Sidebar from '../components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuthStore } from '../../store/authStore';

const API_URL = 'http://localhost:8000/api';

const SettingsPage = () => {
  const { user, logout, accessToken } = useAuthStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = accessToken || localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/settings/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (confirmationText !== 'DELETE') {
      setDeleteError('Please type "DELETE" to confirm');
      return;
    }
    
    setIsDeleting(true);
    setDeleteError('');
    
    try {
      const token = accessToken || localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/settings/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirmation: confirmationText })
      });
      
      if (response.ok) {
        setDeleteSuccess('Account deleted successfully. Redirecting to login...');
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else {
        const error = await response.json();
        setDeleteError(error.detail || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      setDeleteError('Failed to connect to server');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = () => {
    setConfirmationText('');
    setDeleteError('');
    setDeleteSuccess('');
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setConfirmationText('');
    setDeleteError('');
    setDeleteSuccess('');
  };

  const settingsSections = [
    {
      title: 'Account',
      icon: User,
      items: [
        { label: 'Profile Information', description: 'Update your personal information', path: '/settings/profile', comingSoon: true },
        { label: 'Change Password', description: 'Update your password', path: '/settings/password', comingSoon: false },
      ]
    },
    {
      title: 'Security',
      icon: Shield,
      items: [
        { label: 'Active Sessions', description: 'View and manage active sessions', path: '/settings/sessions', comingSoon: true },
      ]
    },
    {
      title: 'Preferences',
      icon: Bell,
      items: [
        { label: 'Notifications', description: 'Configure alert preferences', path: '/settings/notifications', comingSoon: true },
        { label: 'Theme', description: 'Dark / Light mode', path: '/settings/theme', comingSoon: true },
      ]
    }
  ];

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-gray-400 mt-1">Manage your account and security preferences</p>
          </div>

          <div className="max-w-3xl space-y-6">
            {/* Account Information Card */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    value={profile?.full_name || user?.full_name || user?.email?.split('@')[0] || 'User'} 
                    className="bg-gray-800/50 border-gray-700" 
                    disabled 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input 
                    value={profile?.email || user?.email || 'user@example.com'} 
                    className="bg-gray-800/50 border-gray-700" 
                    disabled 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Input 
                    value={profile?.is_superuser || user?.is_superuser ? 'Administrator' : 'Standard User'} 
                    className="bg-gray-800/50 border-gray-700" 
                    disabled 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Member Since</Label>
                  <Input 
                    value={profile?.created_at ? formatDate(profile.created_at) : (user?.created_at ? formatDate(user.created_at) : 'N/A')} 
                    className="bg-gray-800/50 border-gray-700" 
                    disabled 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Settings Sections */}
            {settingsSections.map((section) => {
              const Icon = section.icon;
              return (
                <Card key={section.title} className="bg-gray-900/50 border-gray-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {section.items.map((item) => (
                      <div
                        key={item.label}
                        onClick={() => !item.comingSoon && navigate(item.path)}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                          item.comingSoon 
                            ? 'opacity-50 cursor-not-allowed' 
                            : 'hover:bg-gray-800/50 cursor-pointer'
                        }`}
                      >
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="text-sm text-gray-400">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.comingSoon && (
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-400">
                              Coming Soon
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}

            {/* Danger Zone */}
            <Card className="bg-red-500/5 border-red-500/20">
              <CardHeader>
                <CardTitle className="text-red-500 flex items-center gap-2">
                  <LogOut className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button variant="destructive" onClick={handleLogout} className="gap-2">
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={openDeleteModal}
                    className="gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  ⚠️ Deleting your account is permanent and cannot be undone. All your data will be removed.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeDeleteModal} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-gray-900 rounded-xl border border-red-500/30 shadow-2xl max-w-md w-full mx-4 overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 bg-red-500/10 border-b border-red-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <h2 className="text-lg font-semibold text-red-500">
                    Delete Account
                  </h2>
                </div>
                <button
                  onClick={closeDeleteModal}
                  className="text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-gray-300 mb-4">
                This action is <span className="font-bold text-red-500">permanent and cannot be undone</span>. 
                All your data will be permanently deleted, including:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-400 space-y-1 mb-4 ml-2">
                <li>Your account information</li>
                <li>All scan results</li>
                <li>All security alerts</li>
                <li>API keys and logs</li>
              </ul>
              <p className="text-gray-300 mb-4">
                To confirm, type <span className="font-mono font-bold text-red-500">DELETE</span> below:
              </p>
              <Input
                type="text"
                placeholder="Type DELETE to confirm"
                value={confirmationText}
                onChange={(e) => {
                  setConfirmationText(e.target.value);
                  setDeleteError('');
                }}
                className="bg-gray-800/50 border-gray-700 font-mono"
                autoFocus
              />
              {deleteError && (
                <p className="text-sm text-red-500 mt-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {deleteError}
                </p>
              )}
              {deleteSuccess && (
                <p className="text-sm text-green-500 mt-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {deleteSuccess}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-800/30 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={closeDeleteModal}
                className="gap-2"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteAccount}
                disabled={confirmationText !== 'DELETE' || isDeleting}
                className="gap-2 bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Permanently Delete
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;