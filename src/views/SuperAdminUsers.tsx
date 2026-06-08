import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Edit2, FileDown, GraduationCap, Loader2, Plus, ShieldCheck, Trash2, Upload, UserCog, UserPlus, Users, X } from 'lucide-react';
import { api } from '../services/api';
import { SystemRole, UserWithRole } from '../types';

interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password?: string;
  systemRoleId: string;
}

const ROLES = ['admin', 'teacher', 'student'];

export const SuperAdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [systemRoles, setSystemRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ email: '', firstName: '', lastName: '', role: 'student', systemRoleId: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createStep, setCreateStep] = useState<'pick' | 'form'>('pick');
  const [createSuccess, setCreateSuccess] = useState('');

  // CSV modal state
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvStep, setCsvStep] = useState<'choose' | 'import'>('choose');
  const [csvRole, setCsvRole] = useState('student');
  const [csvContent, setCsvContent] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResults, setCsvResults] = useState<{ success: number; total: number; errors: string[] } | null>(null);

  useEffect(() => {
    loadUsers();
    api.roles.getAll().then(setSystemRoles).catch(() => {});
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setUsers(await api.users.getAll());
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: UserWithRole) => {
    if (user) {
      setEditingUser(user);
      setFormData({ email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, systemRoleId: user.roleId ?? '' });
    } else {
      setEditingUser(null);
      setFormData({ email: '', firstName: '', lastName: '', role: 'student', systemRoleId: '' });
      setCreateStep('pick');
      setCreateSuccess('');
      setError('');
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ email: '', firstName: '', lastName: '', role: 'student', systemRoleId: '' });
    setCreateStep('pick');
    setCreateSuccess('');
    setError('');
  };

  const handleSaveUser = async () => {
    if (!formData.email.trim() || !formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Email, first name, and last name are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        await api.users.update(editingUser.id, {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          role: formData.role,
          systemRoleId: formData.systemRoleId || null,
        });
        try { const bc = new BroadcastChannel('sis_permissions_update'); bc.postMessage({ type: 'user_updated' }); bc.close(); } catch {}
        setSuccess('User updated successfully');
        handleCloseModal();
        await loadUsers();
      } else {
        if (!formData.password) { setError('Password is required for new users'); return; }
        const created = await api.users.create(formData.email.trim(), formData.firstName.trim(), formData.lastName.trim(), formData.role, formData.password);
        if (formData.systemRoleId && created?.id) {
          await api.users.update(created.id, { systemRoleId: formData.systemRoleId });
          try { const bc = new BroadcastChannel('sis_permissions_update'); bc.postMessage({ type: 'user_updated' }); bc.close(); } catch {}
        }
        setCreateSuccess(`${formData.role.charAt(0).toUpperCase() + formData.role.slice(1)} account created successfully.`);
        await loadUsers();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      setError('');
      await api.users.delete(userId);
      setSuccess('User deleted');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const handleDownloadTemplate = async () => {
    const template = await api.users.generateCSVTemplate(csvRole);
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user_template_${csvRole}s_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async () => {
    if (!csvContent.trim()) { setError('Paste CSV content first.'); return; }
    setCsvImporting(true);
    setCsvResults(null);
    setError('');
    try {
      const parsed = await api.users.importFromCSV(csvContent, csvRole);
      let successCount = 0;
      const errors: string[] = [];

      for (const u of parsed) {
        if (!u.email || !u.firstName || !u.lastName || !u.password) {
          errors.push(`Skipped (missing required fields): ${u.email || 'unknown email'}`);
          continue;
        }
        try {
          await api.users.create(u.email, u.firstName, u.lastName, u.role || csvRole, u.password);
          successCount++;
        } catch (e: any) {
          errors.push(`${u.email}: ${e.message}`);
        }
      }

      setCsvResults({ success: successCount, total: parsed.length, errors });
      if (successCount > 0) await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setCsvImporting(false);
    }
  };

  const openCSVModal = () => {
    setCsvStep('choose');
    setCsvRole('student');
    setCsvContent('');
    setCsvResults(null);
    setShowCSVModal(true);
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
            onClick={openCSVModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
          >
            <Upload size={16} /> Bulk Import CSV
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]"
          >
            <Plus size={16} /> Create User
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-300/70 hover:text-red-200"><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-300/70 hover:text-emerald-200"><X size={16} /></button>
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
                <th className="text-left font-semibold py-3 pr-4">System Role</th>
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
                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs capitalize">{user.role}</span>
                  </td>
                  <td className="py-4 pr-4">
                    {user.systemRole
                      ? <span className="inline-flex px-2.5 py-1 rounded-lg bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 text-[#fc0ce4]/80 text-xs">{user.systemRole.name}</span>
                      : <span className="text-white/25 text-xs">—</span>
                    }
                  </td>
                  <td className="py-4">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleOpenModal(user)} className="p-2 rounded-xl border border-white/10 text-white/45 hover:text-white hover:bg-white/5 transition-colors" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDeleteUser(user.id, `${user.firstName} ${user.lastName}`)} className="p-2 rounded-xl border border-red-500/20 text-red-300/70 hover:text-red-200 hover:bg-red-500/10 transition-colors" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="text-center py-12 text-white/35">No users found</div>}
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl max-w-md w-full">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-medium">{editingUser ? 'Edit User' : 'Create User'}</h2>
                {!editingUser && createStep === 'form' && !createSuccess && (
                  <button
                    onClick={() => { setCreateStep('pick'); setError(''); }}
                    className="text-xs text-white/40 hover:text-white mt-0.5 flex items-center gap-1 transition-colors"
                  >
                    ← Back
                  </button>
                )}
              </div>
              <button onClick={handleCloseModal} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors"><X size={20} /></button>
            </div>

            {/* Edit form — single step */}
            {editingUser && (
              <>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Email</label>
                    <input type="email" value={formData.email} disabled className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white opacity-40" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">First Name</label>
                      <input type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Last Name</label>
                      <input type="text" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Role</label>
                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white">
                      {roleOptions.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                  {systemRoles.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">System Role <span className="normal-case text-white/25 font-normal">(optional)</span></label>
                      <select value={formData.systemRoleId} onChange={e => setFormData({ ...formData, systemRoleId: e.target.value })} className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white">
                        <option value="">None</option>
                        {systemRoles.filter(r => !r.isSystemRole).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
                  <button onClick={handleCloseModal} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors">Cancel</button>
                  <button onClick={handleSaveUser} disabled={saving} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                    {saving ? 'Saving...' : 'Update User'}
                  </button>
                </div>
              </>
            )}

            {/* Create flow — step-by-step */}
            {!editingUser && (
              <div className="p-6">
                {createStep === 'pick' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-white/50 mb-5">Select the type of account to create.</p>
                    <button
                      onClick={() => { setFormData(f => ({ ...f, role: 'student' })); setCreateStep('form'); }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-[#fc0ce4]/30 hover:bg-[#fc0ce4]/5 transition-all group text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 flex items-center justify-center shrink-0 group-hover:bg-[#fc0ce4]/20 transition-colors">
                        <GraduationCap className="w-5 h-5 text-[#fc0ce4]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">Student</div>
                        <div className="text-xs text-white/40 mt-0.5">Create a student account</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
                    </button>
                    <button
                      onClick={() => { setFormData(f => ({ ...f, role: 'teacher' })); setCreateStep('form'); }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-[#949ce4]/30 hover:bg-[#949ce4]/5 transition-all group text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#949ce4]/10 border border-[#949ce4]/20 flex items-center justify-center shrink-0 group-hover:bg-[#949ce4]/20 transition-colors">
                        <Users className="w-5 h-5 text-[#949ce4]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">Teacher</div>
                        <div className="text-xs text-white/40 mt-0.5">Create a teacher account</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
                    </button>
                    <button
                      onClick={() => { setFormData(f => ({ ...f, role: 'admin' })); setCreateStep('form'); }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all group text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                        <ShieldCheck className="w-5 h-5 text-white/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white">Admin</div>
                        <div className="text-xs text-white/40 mt-0.5">Create an admin account</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
                    </button>
                  </div>
                ) : createSuccess ? (
                  <div className="flex flex-col items-center py-6 text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <UserPlus className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm text-emerald-300 font-medium">{createSuccess}</p>
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={() => { setCreateSuccess(''); setFormData({ email: '', firstName: '', lastName: '', role: 'student', systemRoleId: '' }); setCreateStep('pick'); }}
                        className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
                      >
                        Create Another
                      </button>
                      <button
                        onClick={handleCloseModal}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {error && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">First Name *</label>
                        <input type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" placeholder="Jane" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Last Name *</label>
                        <input type="text" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" placeholder="Doe" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Email *</label>
                      <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white" placeholder="user@example.com" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Password *</label>
                      <input type="text" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} className="glass-input w-full px-3 py-2.5 rounded-xl text-sm text-white font-mono" placeholder="Initial password" />
                    </div>
                    {systemRoles.filter(r => !r.isSystemRole).length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">System Role <span className="normal-case text-white/25 font-normal">(optional)</span></label>
                        <select value={formData.systemRoleId} onChange={e => setFormData({ ...formData, systemRoleId: e.target.value })} className="glass-select w-full px-3 py-2.5 rounded-xl text-sm text-white">
                          <option value="">None</option>
                          {systemRoles.filter(r => !r.isSystemRole).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                    )}
                    <button
                      onClick={handleSaveUser}
                      disabled={saving}
                      className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {saving
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                        : <><UserPlus className="w-4 h-4" /> Create {formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}</>
                      }
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Import CSV Modal */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl max-w-lg w-full">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <div>
                <h2 className="font-display text-2xl font-medium">Bulk User Import</h2>
                {csvStep === 'import' && (
                  <button onClick={() => { setCsvStep('choose'); setCsvContent(''); setCsvResults(null); }} className="text-xs text-white/40 hover:text-white mt-0.5 transition-colors">← Back</button>
                )}
              </div>
              <button onClick={() => setShowCSVModal(false)} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Role selector — always visible */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">User Role</label>
                <select value={csvRole} onChange={e => { setCsvRole(e.target.value); setCsvResults(null); }} className="glass-select w-full px-4 py-3 rounded-xl text-sm text-white">
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>

              {csvStep === 'choose' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-white/10 hover:border-[#fc0ce4]/30 hover:bg-[#fc0ce4]/5 transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 flex items-center justify-center group-hover:bg-[#fc0ce4]/20 transition-colors">
                      <FileDown className="w-5 h-5 text-[#fc0ce4]" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-white">Download Template</div>
                      <div className="text-xs text-white/40 mt-0.5">Get the CSV template</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setCsvStep('import')}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-white/10 hover:border-[#949ce4]/30 hover:bg-[#949ce4]/5 transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#949ce4]/10 border border-[#949ce4]/20 flex items-center justify-center group-hover:bg-[#949ce4]/20 transition-colors">
                      <Upload className="w-5 h-5 text-[#949ce4]" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-white">Import CSV</div>
                      <div className="text-xs text-white/40 mt-0.5">Upload and create users</div>
                    </div>
                  </button>
                </div>
              )}

              {csvStep === 'import' && (
                <>
                  {csvResults ? (
                    <div className="space-y-3">
                      <div className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl text-sm ${csvResults.success > 0 ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300' : 'bg-red-500/10 border border-red-500/25 text-red-300'}`}>
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span>{csvResults.success} of {csvResults.total} users created successfully.</span>
                      </div>
                      {csvResults.errors.length > 0 && (
                        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                          <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Errors</div>
                          {csvResults.errors.map((e, i) => (
                            <p key={i} className="text-xs text-red-300/80">{e}</p>
                          ))}
                        </div>
                      )}
                      <button onClick={() => { setCsvResults(null); setCsvContent(''); }} className="text-xs text-white/40 hover:text-white transition-colors">Import more</button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Paste CSV Content</label>
                        <textarea
                          value={csvContent}
                          onChange={e => setCsvContent(e.target.value)}
                          className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white font-mono resize-none"
                          placeholder={`First Name,Last Name,Email,Role,Password\nJane,Doe,jane@example.com,${csvRole},FMA#2026`}
                          rows={7}
                        />
                        <p className="text-[11px] text-white/30 mt-1.5">Download the template first to get the correct column order.</p>
                      </div>
                      <button
                        onClick={handleImportCSV}
                        disabled={csvImporting || !csvContent.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {csvImporting ? (
                          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing...</>
                        ) : (
                          <><Upload size={16} /> Import Users</>
                        )}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminUsers;
