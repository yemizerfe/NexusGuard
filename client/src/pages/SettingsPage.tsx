
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

import Sidebar from '../components/layout/sidebar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuthStore } from '../../store/authStore';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/+$/, '');

const API_URL = `${API_BASE_URL}/api`;

interface UserProfile {
  full_name?: string;
  email?: string;
  is_superuser?: boolean;
  created_at?: string;
}

const SettingsPage = () => {
  const { user, logout, accessToken } = useAuthStore();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Delete-account modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token =
          accessToken || localStorage.getItem('accessToken');

        if (!token) {
          return;
        }

        const response = await fetch(`${API_URL}/settings/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch profile (${response.status})`
          );
        }

        const data: UserProfile = await response.json();
        setProfile(data);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      }
    };

    void fetchUserProfile();
  }, [accessToken]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (confirmationText !== 'DELETE') {
      setDeleteError('Please type "DELETE" to confirm.');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');
    setDeleteSuccess('');

    try {
      const token =
        accessToken || localStorage.getItem('accessToken');

      if (!token) {
        setDeleteError('Please sign in again before deleting your account.');
        return;
      }

      const response = await fetch(
        `${API_URL}/settings/delete-account`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            confirmation: confirmationText,
          }),
        }
      );

      if (response.ok) {
        setDeleteSuccess(
          'Account deleted successfully. Redirecting to login...'
        );

        window.setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else {
        let message = 'Failed to delete account';

        try {
          const data = await response.json();
          message = data.detail || data.message || message;
        } catch {
          // Keep the default error message if the response is not JSON.
        }

        setDeleteError(message);
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      setDeleteError('Failed to connect to the server.');
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
    if (isDeleting) return;

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
        {
          label: 'Profile Information',
          description: 'Update your personal information',
          path: '/settings/profile',
          comingSoon: true,
        },
        {
          label: 'Change Password',
          description: 'Update your password',
          path: '/settings/password',
          comingSoon: false,
        },
      ],
    },
    {
      title: 'Security',
      icon: Shield,
      items: [
        {
          label: 'Active Sessions',
          description: 'View and manage active sessions',
          path: '/settings/sessions',
          comingSoon: true,
        },
      ],
    },
    {
      title: 'Preferences',
      icon: Bell,
      items: [
        {
          label: 'Notifications',
          description: 'Configure alert preferences',
          path: '/settings/notifications',
          comingSoon: true,
        },
        {
          label: 'Theme',
          description: 'Dark / Light mode',
          path: '/settings/theme',
          comingSoon: true,
        },
      ],
    },
  ];

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const fullName =
    profile?.full_name ||
    user?.full_name ||
    user?.email?.split('@')[0] ||
    'User';

  const email = profile?.email || user?.email || 'user@example.com';

  const isSuperuser =
    profile?.is_superuser ?? user?.is_superuser ?? false;

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="mt-1 text-gray-400">
              Manage your account and security preferences
            </p>
          </div>

          <div className="max-w-3xl space-y-6">
            {/* Account Information */}
            <Card className="border-gray-800 bg-gray-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={fullName}
                    className="border-gray-700 bg-gray-800/50"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    value={email}
                    className="border-gray-700 bg-gray-800/50"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Input
                    value={
                      isSuperuser ? 'Administrator' : 'Standard User'
                    }
                    className="border-gray-700 bg-gray-800/50"
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label>Member Since</Label>
                  <Input
                    value={formatDate(profile?.created_at)}
                    className="border-gray-700 bg-gray-800/50"
                    disabled
                  />
                </div>
              </CardContent>
            </Card>

            {/* Settings Sections */}
            {settingsSections.map((section) => {
              const Icon = section.icon;

              return (
                <Card
                  key={section.title}
                  className="border-gray-800 bg-gray-900/50"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {section.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {section.items.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          if (!item.comingSoon) {
                            navigate(item.path);
                          }
                        }}
                        disabled={item.comingSoon}
                        className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                          item.comingSoon
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer hover:bg-gray-800/50'
                        }`}
                      >
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="text-sm text-gray-400">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.comingSoon && (
                            <span className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-400">
                              Coming Soon
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              );
            })}

            {/* Danger Zone */}
            <Card className="border-red-500/20 bg-red-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <LogOut className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleLogout}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>

                  <Button
                    variant="outline"
                    onClick={openDeleteModal}
                    className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Account
                  </Button>
                </div>

                <p className="text-xs text-gray-500">
                  ⚠️ Deleting your account is permanent and cannot be
                  undone. All your data will be removed.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            aria-label="Close delete account dialog"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closeDeleteModal}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative mx-4 w-full max-w-md overflow-hidden rounded-xl border border-red-500/30 bg-gray-900 shadow-2xl"
          >
            {/* Modal Header */}
            <div className="border-b border-red-500/20 bg-red-500/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                  <h2
                    id="delete-account-title"
                    className="text-lg font-semibold text-red-500"
                  >
                    Delete Account
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                  aria-label="Close dialog"
                  className="text-gray-400 transition-colors hover:text-gray-300 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="mb-4 text-gray-300">
                This action is{' '}
                <span className="font-bold text-red-500">
                  permanent and cannot be undone
                </span>
                . All your data will be permanently deleted, including:
              </p>

              <ul className="mb-4 ml-2 list-inside list-disc space-y-1 text-sm text-gray-400">
                <li>Your account information</li>
                <li>All scan results</li>
                <li>All security alerts</li>
                <li>API keys and logs</li>
              </ul>

              <p className="mb-4 text-gray-300">
                To confirm, type{' '}
                <span className="font-mono font-bold text-red-500">
                  DELETE
                </span>{' '}
                below:
              </p>

              <Input
                type="text"
                placeholder="Type DELETE to confirm"
                value={confirmationText}
                onChange={(event) => {
                  setConfirmationText(event.target.value);
                  setDeleteError('');
                }}
                className="border-gray-700 bg-gray-800/50 font-mono"
                autoFocus
                disabled={isDeleting}
              />

              {deleteError && (
                <p className="mt-2 flex items-center gap-2 text-sm text-red-500">
                  <AlertTriangle className="h-4 w-4" />
                  {deleteError}
                </p>
              )}

              {deleteSuccess && (
                <p className="mt-2 flex items-center gap-2 text-sm text-green-500">
                  <CheckCircle className="h-4 w-4" />
                  {deleteSuccess}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 bg-gray-800/30 p-4">
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
                disabled={
                  confirmationText !== 'DELETE' ||
                  isDeleting ||
                  Boolean(deleteSuccess)
                }
                className="gap-2 bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
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
