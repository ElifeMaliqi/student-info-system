import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Edit2, Plus, RotateCcw, Trash2, UserCog, X } from 'lucide-react';
import { api } from '../services/api';
import { UserWithRole } from '../types';

interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password?: string;
}

const ROLES = ['admin', 'teacher', 'student'];

export const SuperAdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'student',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvContent, setCSVContent] = useState('');
  const [selectedRole, setSelectedRole] = useState('student');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.users.getAll();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: UserWithRole) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } else {
      setEditingUser(null);
      setFormData({ email: '', firstName: '', lastName: '', role: 'student' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ email: '', firstName: '', lastName: '', role: 'student' });
  };

  const handleSaveUser = async () => {
    try {
      setError('');
      setSaving(true);
      if (!formData.email.trim() || !formData.firstName.trim() || !formData.lastName.trim()) {
        setError('Email, first name, and last name are required');
        return;
      }

      if (editingUser) {
        await api.users.update(editingUser.id, {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          role: formData.role,
        });
        setSuccess('User updated successfully');
      } else {
        if (!formData.password) {
          setError('Password is required for new users');
          return;
        }
        await api.users.create(
          formData.email.trim(),
          formData.firstName.trim(),
          formData.lastName.trim(),
          formData.role,
          formData.password,
        );
        setSuccess('User created successfully');
      }

      handleCloseModal();
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;

    try {
      setError('');
      await api.users.deactivate(userId);
      setSuccess('User deactivated successfully');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate user');
    }
  };

  const handleReactivateUser = async (userId: string) => {
    try {
      setError('');
      await api.users.reactivate(userId);
      setSuccess('User reactivated successfully');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to reactivate user');
    }
  };

  const handleDownloadCSVTemplate = async () => {
    try {
      const template = await api.users.generateCSVTemplate(selectedRole);
      const blob = new Blob([template], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_template_${selectedRole}s.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccess('CSV template downloaded successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to download template');
    }
  };

  const handleImportCSV = async () => {
    try {
      setError('');
      if (!csvContent.trim()) {
        setError('CSV content is empty');
        return;
      }

      const importedUsers = await api.users.importFromCSV(csvContent, selectedRole);
      setSuccess(`Successfully parsed ${importedUsers.length} users`);
      setCSVContent('');
      setShowCSVModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to import CSV');
    }
  };

  const roleOptions = ROLES.includes(formData.role) ? ROLES : [formData.role, ...ROLES];

  if (loading) {
    return (
      <div className="glass-card rounded-3xl p-12 flex items-center justify-center text-white/40">
        <span className="w-5 h-5 border-2 border-white/10 border-t-[#fc0ce4] rounded-full animate-spin mr-3" />
        Loading users...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">Users</h1>
          <p className="text-white/40 text-sm">Create accounts and manage platform access.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowCSVModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
          >
            <Download size={18} /> Import CSV
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]"
          >
            <Plus size={18} /> Create User
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-300/70 hover:text-red-200">
            <X size={18} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-300/70 hover:text-emerald-200">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="glass-card rounded-3xl p-6 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar -mx-6 px-6">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                <th className="text-left font-semibold py-3 pr-4">User</th>
                <th className="text-left font-semibold py-3 pr-4">Email</th>
                <th className="text-left font-semibold py-3 pr-4">Role</th>
                <th className="text-left font-semibold py-3 pr-4">Status</th>
                <th className="text-right font-semibold py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 flex items-center justify-center">
                        <UserCog className="w-4 h-4 text-[#fc0ce4]" />
                      </div>
                      <span className="font-medium text-sm">{user.firstName} {user.lastName}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-sm text-white/50">{user.email}</td>
                  <td className="py-4 pr-4">
                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs capitalize">
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    {user.isArchived ? (
                      <span className="inline-flex px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">Deactivated</span>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">Active</span>
                    )}
                  </td>
                  <td className="py-4">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="p-2 rounded-xl border border-white/10 text-white/45 hover:text-white hover:bg-white/5 transition-colors"
                        title="Edit user"
                      >
                        <Edit2 size={18} />
                      </button>
                      {user.isArchived ? (
                        <button
                          onClick={() => handleReactivateUser(user.id)}
                          className="p-2 rounded-xl border border-emerald-500/20 text-emerald-300/70 hover:text-emerald-200 hover:bg-emerald-500/10 transition-colors"
                          title="Reactivate user"
                        >
                          <RotateCcw size={18} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeactivateUser(user.id)}
                          className="p-2 rounded-xl border border-red-500/20 text-red-300/70 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                          title="Deactivate user"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-12 text-white/35">No users found</div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl max-w-md w-full">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-display text-2xl font-medium">{editingUser ? 'Edit User' : 'Create User'}</h2>
              <button onClick={handleCloseModal} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                  className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white disabled:opacity-40"
                  placeholder="user@example.com"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                >
                  {roleOptions.map(role => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password || ''}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                    placeholder="Initial password"
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCSVModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl max-w-2xl w-full">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-display text-2xl font-medium">Import Users</h2>
              <button onClick={() => setShowCSVModal(false)} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Role</label>
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white"
                >
                  {ROLES.map(role => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleDownloadCSVTemplate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
              >
                <Download size={16} /> Download Template
              </button>

              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">CSV Content</label>
                <textarea
                  value={csvContent}
                  onChange={e => setCSVContent(e.target.value)}
                  className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white font-mono resize-none"
                  placeholder={'First Name,Last Name,Email,Role,Password\nJohn,Doe,john@example.com,student,Pass@123'}
                  rows={6}
                />
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
              <button
                onClick={() => setShowCSVModal(false)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCSV}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all"
              >
                Import Users
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminUsers;
