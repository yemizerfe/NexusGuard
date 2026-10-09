import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  full_name: string;
  is_superuser?: boolean;
  is_active?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  fetchUser: () => Promise<void>;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const API_URL = `${API_BASE_URL}/api`;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
      error: null,

      fetchUser: async () => {
        const token = get().accessToken || localStorage.getItem('accessToken');
        if (!token) return;
        
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (response.ok) {
            const userData = await response.json();
            console.log('✅ fetchUser response:', userData);
            
            // ✅ Preserve existing is_superuser if backend doesn't return it
            const currentUser = get().user;
            set({
              user: {
                id: userData.id,
                email: userData.email,
                full_name: userData.full_name,
                is_superuser: userData.is_superuser ?? currentUser?.is_superuser ?? false,
                is_active: userData.is_active !== false,
              },
              isAuthenticated: true,
            });
          } else {
            localStorage.removeItem('accessToken');
            set({ user: null, isAuthenticated: false, accessToken: null });
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
        }
      },

      signup: async (email: string, password: string, fullName: string) => {
        set({ isLoading: true, error: null });
        
        try {
          console.log('📝 Signup request:', { email, full_name: fullName });
          
          const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              email: email.trim(),
              full_name: fullName.trim(),
              password: password
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.detail || 'Signup failed');
          }

          console.log('✅ Signup response:', data);
          
          // ✅ Check if user is admin (first user)
          const isAdmin = data.is_superuser === true;
          console.log('👑 Is Admin from signup:', isAdmin);
          
          // Auto-login after signup
          const loginResponse = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              email: email.trim(),
              password: password
            }),
          });

          if (!loginResponse.ok) {
            throw new Error('Auto-login failed');
          }

          const loginData = await loginResponse.json();
          
          localStorage.setItem('accessToken', loginData.access_token);
          
          // ✅ Create user with is_superuser from signup response
          const newUser = {
            id: data.id,
            email: data.email,
            full_name: data.full_name,
            is_superuser: isAdmin,
          };
          
          console.log('👑 Setting user with is_superuser:', newUser.is_superuser);
          
          set({
            user: newUser,
            isAuthenticated: true,
            isLoading: false,
            accessToken: loginData.access_token,
            error: null,
          });
          
          console.log('✅ User state set:', { user: get().user });
          
        } catch (error: any) {
          console.error('❌ Signup error:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Signup failed. Please try again.',
            isAuthenticated: false,
          });
          throw error;
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Login failed');
          }

          const data = await response.json();
          
          console.log('✅ Login response:', data);
          
          localStorage.setItem('accessToken', data.access_token);
          
          // ✅ First, try to get user from /me endpoint (source of truth)
          const meResponse = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${data.access_token}` }
          });
          
          let userData = null;
          if (meResponse.ok) {
            userData = await meResponse.json();
            console.log('👤 User data from /me:', userData);
          }
          
          // ✅ Determine is_superuser from /me or login response
          let isSuperuser = false;
          if (userData?.is_superuser !== undefined) {
            isSuperuser = userData.is_superuser === true;
          } else if (data.is_superuser !== undefined) {
            isSuperuser = data.is_superuser === true;
          } else if (data.user?.is_superuser !== undefined) {
            isSuperuser = data.user?.is_superuser === true;
          }
          
          const userObj = {
            id: userData?.id || data.user?.id || data.id,
            email: userData?.email || email,
            full_name: userData?.full_name || data.user?.full_name || email.split('@')[0],
            is_superuser: isSuperuser,
            is_active: userData?.is_active !== false,
          };
          
          console.log('👑 Login user is_superuser:', isSuperuser);
          console.log('✅ Setting user in store:', userObj);
          
          set({ 
            accessToken: data.access_token,
            isAuthenticated: true,
            user: userObj,
            isLoading: false,
          });
          
        } catch (error: any) {
          console.error('❌ Login error:', error);
          set({ 
            isLoading: false, 
            error: error.message || 'Login failed',
            isAuthenticated: false,
          });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        set({ 
          user: null, 
          isAuthenticated: false, 
          accessToken: null,
          error: null 
        });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken 
      }),
    }
  )
);
