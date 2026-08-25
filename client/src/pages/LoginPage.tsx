import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuthStore } from '../../store/authStore';

const API_URL = 'http://localhost:8000/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'newPassword'>('email');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login, isLoading, user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Redirect after login based on role
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.is_superuser) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate]);

  // Clear any stale temp token on component mount (only once)
  useEffect(() => {
    const tempToken = localStorage.getItem('tempToken');
    if (tempToken && window.location.pathname === '/login') {
      const timer = setTimeout(() => {
        localStorage.removeItem('tempToken');
        localStorage.removeItem('userEmail');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (!email.trim()) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }
    
    if (!password) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('accessToken', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refreshToken', data.refresh_token);
        }
        await login(email, password);
      } else {
        const errorMessage = data.detail || data.message || 'Invalid email or password';
        
        if (errorMessage.includes('Invalid credentials') || errorMessage.includes('Invalid email or password')) {
          setError('Invalid email or password. Please try again.');
        } else if (errorMessage.includes('Account disabled')) {
          setError('Your account has been disabled. Please contact support.');
        } else {
          setError(errorMessage);
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Failed to connect to server. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    
    if (!resetEmail.trim()) {
      setResetError('Please enter your email address');
      return;
    }
    
    setIsResetting(true);
    
    try {
      // Step 1: check whether this email exists in the database
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.exists) {
        // Email found -> show the inline "set new password" step
        setVerifiedEmail(resetEmail);
        setResetEmail('');
        setNewPassword('');
        setConfirmPassword('');
        setResetMessage('Email verified! Now set a new password.');
        setResetStep('newPassword');
      } else if (response.ok && data.exists === false) {
        setResetError('No account found with this email address.');
      } else {
        setResetError(data.detail || 'Failed to verify email. Please try again.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setResetError('Failed to connect to server. Please make sure the backend is running.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDirectReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    
    // Same password rules as the signup page
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setResetError('Password must have: at least 8 characters, one uppercase letter, one lowercase letter, one number');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    
    setIsResetting(true);
    
    try {
      // Step 2: reset the password directly (local mode - no email involved)
      const response = await fetch(`${API_URL}/auth/reset-password-by-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: verifiedEmail, new_password: newPassword }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Done -> back to the login page with the email prefilled
        setResetMessage('Password reset successfully! You can now log in with your new password.');
        setEmail(verifiedEmail);
        setPassword('');
        setTimeout(() => {
          setShowForgotPassword(false);
          setResetMessage('');
          setResetStep('email');
          setVerifiedEmail('');
          setNewPassword('');
          setConfirmPassword('');
        }, 2500);
      } else {
        setResetError(data.detail || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setResetError('Failed to connect to server. Please make sure the backend is running.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-black">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Shield className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold">NexusGuard</h1>
            <p className="text-gray-400 mt-2">AI-Powered Cybersecurity Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@nexusguard.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-gray-900 border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  required
                  disabled={loading || isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-gray-900 border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  required
                  disabled={loading || isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
              >
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              </motion.div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || isLoading}
            >
              {(loading || isLoading) ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging in...
                </div>
              ) : (
                'Login'
              )}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-sm text-gray-400">
                Don't have an account?{' '}
                <button 
                  type="button" 
                  onClick={() => navigate('/signup')} 
                  className="text-primary hover:underline transition-colors"
                  disabled={loading || isLoading}
                >
                  Sign up
                </button>
              </p>
              <p className="text-xs text-gray-500">
                <button 
                  type="button" 
                  onClick={() => setShowForgotPassword(true)} 
                  className="hover:text-gray-300 transition-colors"
                >
                  Forgot password?
                </button>
              </p>
            </div>
          </form>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700 max-w-md w-full"
          >
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  {resetStep === 'email' ? (
                    <Mail className="w-10 h-10 text-primary" />
                  ) : (
                    <Lock className="w-10 h-10 text-primary" />
                  )}
                </div>
              </div>
              <h2 className="text-2xl font-bold">
                {resetStep === 'email' ? 'Forgot Password?' : 'Set New Password'}
              </h2>
              <p className="text-gray-400 text-sm mt-2">
                {resetStep === 'email'
                  ? "Enter your email address and we'll verify it against our database (no email required)."
                  : `Setting a new password for ${verifiedEmail}`}
              </p>
            </div>

            <form onSubmit={resetStep === 'email' ? handleForgotPassword : handleDirectReset} className="space-y-4">
              {resetStep === 'email' ? (
                <div className="space-y-2">
                  <Label htmlFor="resetEmail">Email Address</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    placeholder="admin@nexusguard.com"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      setResetError('');
                      setResetMessage('');
                    }}
                    className="bg-gray-900 border-gray-700 focus:border-primary"
                    required
                    autoFocus
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setResetError('');
                        }}
                        className="pl-10 pr-10 bg-gray-900 border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary"
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">Min 8 chars, 1 uppercase, 1 lowercase, 1 number</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="confirmNewPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setResetError('');
                        }}
                        className="pl-10 pr-10 bg-gray-900 border-gray-700 focus:border-primary focus:ring-1 focus:ring-primary"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {resetError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-500">{resetError}</p>
                </motion.div>
              )}

              {resetMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                >
                  <AlertCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-green-500">{resetMessage}</p>
                </motion.div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail('');
                    setResetError('');
                    setResetMessage('');
                    setResetStep('email');
                    setVerifiedEmail('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {resetStep === 'email' ? 'Verifying...' : 'Resetting...'}
                    </div>
                  ) : (
                    resetStep === 'email' ? 'Verify Email' : 'Reset Password'
                  )}
                </Button>
              </div>
            </form>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                  setResetError('');
                  setResetMessage('');
                  setResetStep('email');
                  setVerifiedEmail('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Back to Login
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;