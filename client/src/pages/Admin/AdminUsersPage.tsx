import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Ban, 
  CheckCircle, 
  Shield, 
  User,
  Loader2,
  AlertCircle
} from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useAuthStore } from '../../../store/authStore';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const API_URL = `${API_BASE_URL}/api`;

interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  last_login: string;
}

const AdminUsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Get current user from auth store
  const { user: currentUser } = useAuthStore();
  const currentAdminId = currentUser?.id;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [search, filterRole, users]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else if (response.status === 403) {
        setError('Admin access required');
      } else {
        setError('Failed to fetch users');
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];
    
    if (search) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.full_name.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (filterRole !== 'all') {
      filtered = filtered.filter(user => 
        filterRole === 'admin' ? user.is_superuser : !user.is_superuser
      );
    }
    
    setFilteredUsers(filtered);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    // ✅ Prevent disabling your own account
    if (userId === currentAdminId) {
      setError('❌ You cannot disable or enable your own account');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    const userToToggle = users.find(u => u.id === userId);
    if (userToToggle?.is_superuser && currentStatus === true) {
      const confirmDisable = window.confirm(
        `⚠️ WARNING: You are about to disable an Admin account (${userToToggle.email}).\n\n` +
        `This user will lose all admin privileges. Continue?`
      );
      if (!confirmDisable) return;
    }
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/admin/users/${userId}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        setUsers(users.map(user => 
          user.id === userId ? { ...user, is_active: !currentStatus } : user
        ));
        setSuccess(`User ${currentStatus ? 'disabled' : 'enabled'} successfully`);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to toggle user status');
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      console.error('Failed to toggle user:', error);
      setError('Failed to connect to server');
      setTimeout(() => setError(''), 3000);
    }
  };

  const activeUsers = users.filter(u => u.is_active).length;
  const disabledUsers = users.filter(u => !u.is_active).length;
  const adminUsers = users.filter(u => u.is_superuser).length;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" />
            User Management
          </h1>
          <p className="text-gray-400 mt-1">
            Manage user accounts and permissions
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-xs text-gray-400">Total Users</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
            <p className="text-2xl font-bold text-green-500">{activeUsers}</p>
            <p className="text-xs text-gray-400">Active Users</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
            <p className="text-2xl font-bold text-red-500">{disabledUsers}</p>
            <p className="text-xs text-gray-400">Disabled Users</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
            <p className="text-2xl font-bold text-purple-500">{adminUsers}</p>
            <p className="text-xs text-gray-400">Admin Users</p>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-500 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {success}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          </div>
        )}

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <CardTitle>All Users ({filteredUsers.length})</CardTitle>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by email or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-gray-800/50 border-gray-700"
                />
              </div>
              
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2 text-sm cursor-pointer"
              >
                <option value="all">All Users</option>
                <option value="admin">Admins Only</option>
                <option value="user">Regular Users</option>
              </select>
            </div>
          </CardHeader>
          
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No users found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-800">
                    <tr className="text-left text-gray-400">
                      <th className="pb-3">User</th>
                      <th className="pb-3">Email</th>
                      <th className="pb-3">Role</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Joined</th>
                      <th className="pb-3">Last Login</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const isCurrentUser = user.id === currentAdminId;
                      
                      return (
                        <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="py-3 font-medium">
                            <div className="flex items-center gap-2">
                              {user.full_name}
                              {isCurrentUser && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                                  You
                                </span>
                              )}
                            </div>
                           </td>
                          <td className="py-3">{user.email}</td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              user.is_superuser 
                                ? 'bg-red-500/20 text-red-500' 
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {user.is_superuser ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              user.is_active 
                                ? 'bg-green-500/20 text-green-500' 
                                : 'bg-red-500/20 text-red-500'
                            }`}>
                              {user.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="py-3 text-gray-400">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 text-gray-400">
                            {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="py-3">
                            {!isCurrentUser ? (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => toggleUserStatus(user.id, user.is_active)}
                                className={user.is_active 
                                  ? 'text-red-500 hover:text-red-400 hover:bg-red-500/10' 
                                  : 'text-green-500 hover:text-green-400 hover:bg-green-500/10'
                                }
                                title={user.is_active ? 'Disable User' : 'Enable User'}
                              >
                                {user.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                              </Button>
                            ) : (
                              <div className="w-8 h-8" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Admin Warning Note */}
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-500">
              <p className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Note: You cannot modify your own account. Action buttons are hidden for your own row.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersPage;
