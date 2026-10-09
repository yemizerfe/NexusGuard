
import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuthStore } from '../../store/authStore';

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { signup, isLoading, clearError, user } = useAuthStore();
  const navigate = useNavigate();

  // Clear the displayed error after five seconds.
  useEffect(() => {
    if (!error) return;

    const timer = window.setTimeout(() => {
      setError('');
      clearError();
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [error, clearError]);

  // Redirect after successful signup based on the user's role.
  useEffect(() => {
    if (!success || !user) return;

    const timer = window.setTimeout(() => {
      if (user.is_superuser) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [success, user, navigate]);

  // Password requirements.
  const getPasswordErrors = (value: string): string[] => {
    const errors: string[] = [];

    if (value.length < 8) {
      errors.push('At least 8 characters');
    }

    if (!/[A-Z]/.test(value)) {
      errors.push('One uppercase letter');
    }

    if (!/[a-z]/.test(value)) {
      errors.push('One lowercase letter');
    }

    if (!/[0-9]/.test(value)) {
      errors.push('One number');
    }

    return errors;
  };

  const passwordErrors = getPasswordErrors(password);
  const isPasswordValid =
    passwordErrors.length === 0 && password.length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess(false);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter a password.');
      return;
    }

    if (!isPasswordValid) {
      setError(
        `Password must have: ${passwordErrors.join(', ')}.`
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await signup(email.trim(), password, name.trim());
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Signup failed. Please try again.';

      setError(message);
      setSuccess(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-black p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="rounded-xl bg-primary/10 p-3">
                <Shield className="h-12 w-12 text-primary" />
              </div>
            </div>

            <h1 className="text-3xl font-bold">Create Account</h1>
            <p className="mt-2 text-gray-400">
              Join NexusGuard Security Platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>

              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />

                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="border-gray-700 bg-gray-900 pl-10 transition-colors focus:border-primary"
                  required
                  disabled={isLoading}
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />

                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-gray-700 bg-gray-900 pl-10 transition-colors focus:border-primary"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />

                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-gray-700 bg-gray-900 pl-10 pr-10 transition-colors focus:border-primary"
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Password Requirements */}
              {password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 space-y-1"
                >
                  <p className="mb-1 text-xs text-gray-500">
                    Password must have:
                  </p>

                  <ul className="space-y-1">
                    <li
                      className={`flex items-center gap-2 text-xs ${
                        password.length >= 8
                          ? 'text-green-500'
                          : 'text-gray-500'
                      }`}
                    >
                      {password.length >= 8 ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      At least 8 characters
                    </li>

                    <li
                      className={`flex items-center gap-2 text-xs ${
                        /[A-Z]/.test(password)
                          ? 'text-green-500'
                          : 'text-gray-500'
                      }`}
                    >
                      {/[A-Z]/.test(password) ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      One uppercase letter
                    </li>

                    <li
                      className={`flex items-center gap-2 text-xs ${
                        /[a-z]/.test(password)
                          ? 'text-green-500'
                          : 'text-gray-500'
                      }`}
                    >
                      {/[a-z]/.test(password) ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      One lowercase letter
                    </li>

                    <li
                      className={`flex items-center gap-2 text-xs ${
                        /[0-9]/.test(password)
                          ? 'text-green-500'
                          : 'text-gray-500'
                      }`}
                    >
                      {/[0-9]/.test(password) ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      One number
                    </li>
                  </ul>
                </motion.div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Confirm Password
              </Label>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />

                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  className="border-gray-700 bg-gray-900 pl-10 pr-10 transition-colors focus:border-primary"
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((visible) => !visible)
                  }
                  aria-label={
                    showConfirmPassword
                      ? 'Hide confirm password'
                      : 'Show confirm password'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 hover:text-gray-300"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3"
              >
                <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-500">{error}</p>
              </motion.div>
            )}

            {/* Success Message */}
            {success && !error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3"
              >
                <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                <p className="text-sm text-green-500">
                  Account created successfully! Redirecting...
                </p>
              </motion.div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || success}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating account...
                </div>
              ) : (
                'Sign Up'
              )}
            </Button>

            {/* Login Link */}
            <p className="text-center text-sm text-gray-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-primary hover:underline"
                disabled={isLoading}
              >
                Login
              </button>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
