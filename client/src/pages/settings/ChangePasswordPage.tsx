import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Key, Lock, Eye, EyeOff, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Sidebar from '../../components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const API_URL = `${API_BASE_URL}/api`;


const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const validatePassword = (password: string) => {
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    return { hasMinLength, hasUpperCase, hasLowerCase, hasNumber };
  };

  const passwordValidation = validatePassword(newPassword);
  const isPasswordValid = passwordValidation.hasMinLength && 
                          passwordValidation.hasUpperCase && 
                          passwordValidation.hasLowerCase && 
                          passwordValidation.hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!currentPassword) {
      setError('Please enter your current password');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    if (!isPasswordValid) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and a number');
      return;
    }
    
    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/settings/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        // Clear all auth data and redirect to login after 2 seconds
        setTimeout(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('auth-storage');
          // Force full page reload to clear all state
          window.location.href = '/login';
        }, 2000);
      } else {
        setError(data.detail || 'Failed to change password. Please check your current password.');
      }
    } catch (err) {
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/settings')}
              className="mb-4 -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Settings
            </Button>
            <h1 className="text-3xl font-bold">Change Password</h1>
            <p className="text-gray-400 mt-1">Update your account password</p>
          </div>

          <div className="max-w-2xl">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Password Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {success ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Password Changed!</h3>
                    <p className="text-gray-400">Your password has been updated successfully.</p>
                    <p className="text-sm text-gray-500 mt-2">Redirecting to login page...</p>
                    <div className="mt-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent mx-auto"></div>
                    </div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Current Password */}
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="currentPassword"
                          type={showCurrent ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="pl-10 pr-10 bg-gray-800/50 border-gray-700"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          {showCurrent ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="newPassword"
                          type={showNew ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10 pr-10 bg-gray-800/50 border-gray-700"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          {showNew ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                        </button>
                      </div>
                      
                      {/* Password Requirements */}
                      {newPassword && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-2 p-3 rounded-lg bg-gray-800/30 border border-gray-700"
                        >
                          <p className="text-xs font-semibold mb-2">Password Requirements:</p>
                          <div className="space-y-1 text-xs">
                            <div className={`flex items-center gap-2 ${passwordValidation.hasMinLength ? 'text-green-500' : 'text-gray-400'}`}>
                              {passwordValidation.hasMinLength ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              <span>At least 8 characters</span>
                            </div>
                            <div className={`flex items-center gap-2 ${passwordValidation.hasUpperCase ? 'text-green-500' : 'text-gray-400'}`}>
                              {passwordValidation.hasUpperCase ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              <span>At least one uppercase letter</span>
                            </div>
                            <div className={`flex items-center gap-2 ${passwordValidation.hasLowerCase ? 'text-green-500' : 'text-gray-400'}`}>
                              {passwordValidation.hasLowerCase ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              <span>At least one lowercase letter</span>
                            </div>
                            <div className={`flex items-center gap-2 ${passwordValidation.hasNumber ? 'text-green-500' : 'text-gray-400'}`}>
                              {passwordValidation.hasNumber ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              <span>At least one number</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="confirmPassword"
                          type={showConfirm ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 pr-10 bg-gray-800/50 border-gray-700"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          {showConfirm ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                        </button>
                      </div>
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                      )}
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                      >
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-500">{error}</p>
                      </motion.div>
                    )}

                    <div className="flex gap-3">
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Updating...' : 'Update Password'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => navigate('/settings')}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
