import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Edit2, LockKeyhole, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import { SystemRole } from '../types';

interface RoleFormData {
  name: string;
  description: string;
}

const AVAILABLE_MODULES = [
  'roles',
  'users',
  'programs',
  'classes',
  'announcements',
  'analytics',
  'settings',
  'grades',
  'finance',
  'attendance',
  'registrations',
  'calendar',
  'invoices',
];

const AVAILABLE_ACTIONS = ['read', 'create', 'update', 'delete'];

export const SuperAdminRoles: React.FC = () => {
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<SystemRole | null>(null);
  const [formData, setFormData] = useState<RoleFormData>({ name: '', description: '' });
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>({});
  const [disabledModules, setDisabledModules] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await api.roles.getAll();
      setRoles(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (role?: SystemRole) => {
    if (role) {
      setEditingRole(role);
      setFormData({ name: role.name, description: role.description || '' });
      const permissions: Record<string, string[]> = {};
      const disabled = new Set<string>();
      (role.permissions || []).forEach((permission: any) => {
        if ((permission.actions || []).includes('deactivate')) {
          disabled.add(permission.module);
        } else {
          permissions[permission.module] = permission.actions || [];
        }
      });
      setSelectedPermissions(permissions);
      setDisabledModules(disabled);
    } else {
      setEditingRole(null);
      setFormData({ name: '', description: '' });
      setSelectedPermissions({});
      setDisabledModules(new Set());
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRole(null);
    setFormData({ name: '', description: '' });
    setSelectedPermissions({});
    setDisabledModules(new Set());
  };

  const handleSaveRole = async () => {
    try {
      setError('');
      setSaving(true);
      if (!formData.name.trim()) {
        setError('Role name is required');
        return;
      }

      const savedRole = editingRole
        ? await api.roles.update(editingRole.id, formData.name.trim(), formData.description.trim())
        : await api.roles.create(formData.name.trim(), formData.description.trim());

      const roleId = editingRole?.id || savedRole?.id;
      if (!roleId) throw new Error('Role could not be saved');

      await api.roles.updatePermissions(
        roleId,
        AVAILABLE_MODULES.map(module => ({
          module,
          actions: disabledModules.has(module) ? ['deactivate'] : (selectedPermissions[module] || []),
        })),
      );

      try { const bc = new BroadcastChannel('sis_permissions_update'); bc.postMessage({ type: 'role_updated' }); bc.close(); } catch {}

      setSuccess(`Role ${editingRole ? 'updated' : 'created'} successfully`);
      handleCloseModal();
      await loadRoles();
    } catch (err: any) {
      setError(err.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;

    try {
      setError('');
      await api.roles.delete(roleId);
      setSuccess('Role deleted successfully');
      await loadRoles();
    } catch (err: any) {
      setError(err.message || 'Failed to delete role');
    }
  };

  const toggleAction = (module: string, action: string) => {
    setSelectedPermissions(prev => {
      const current = new Set(prev[module] || []);
      if (current.has(action)) {
        current.delete(action);
      } else {
        current.add(action);
      }
      return { ...prev, [module]: Array.from(current) };
    });
  };

  if (loading) {
    return (
      <div className="glass-card rounded-3xl p-12 flex items-center justify-center text-white/40">
        <span className="w-5 h-5 border-2 border-white/10 border-t-[#fc0ce4] rounded-full animate-spin mr-3" />
        Loading roles...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">Roles</h1>
          <p className="text-white/40 text-sm">Manage platform roles and module permissions.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto"
        >
          <Plus size={18} /> Create Role
        </button>
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

      <div className="grid gap-4">
        {roles.map(role => {
          const visiblePermissions = (role.permissions || []).filter(permission => permission.actions.length > 0);
          return (
            <div key={role.id} className="glass-card rounded-2xl p-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-[#fc0ce4]" />
                    </div>
                    <h3 className="font-display text-lg font-medium capitalize">{role.name}</h3>
                    {role.isSystemRole && (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-white/5 text-white/45 border border-white/10 px-2 py-1 rounded-lg">
                        <LockKeyhole size={12} /> System
                      </span>
                    )}
                  </div>
                  <p className="text-white/45 text-sm mb-4">{role.description || 'No description provided.'}</p>
                  {visiblePermissions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {visiblePermissions.map(permission => (
                        <div key={permission.module} className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
                          <div className="text-xs font-semibold text-white/70 capitalize mb-1">{permission.module}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {permission.actions.includes('deactivate') ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">Deactivated</span>
                            ) : (
                              permission.actions.map(action => (
                                <span key={`${permission.module}-${action}`} className="text-[11px] px-2 py-0.5 rounded-lg bg-[#fc0ce4]/10 text-[#fc0ce4] border border-[#fc0ce4]/20 capitalize">
                                  {action}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-white/30">No permissions assigned.</div>
                  )}
                </div>

                {!role.isSystemRole && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(role)}
                      className="p-2 rounded-xl border border-white/10 text-white/45 hover:text-white hover:bg-white/5 transition-colors"
                      title="Edit role"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="p-2 rounded-xl border border-red-500/20 text-red-300/70 hover:text-red-200 hover:bg-red-500/10 transition-colors"
                      title="Delete role"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h2 className="font-display text-2xl font-medium">{editingRole ? 'Edit Role' : 'Create Role'}</h2>
              <button onClick={handleCloseModal} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Role Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white"
                  placeholder="Content Manager"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white resize-none"
                  placeholder="Describe this role"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Permissions</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AVAILABLE_MODULES.map(module => {
                    const isDisabled = disabledModules.has(module);
                    return (
                      <div key={module} className={`rounded-2xl border p-4 transition-colors ${isDisabled ? 'bg-red-500/[0.03] border-red-500/15' : 'bg-white/[0.03] border-white/5'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-sm capitalize">{module}</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setDisabledModules(prev => {
                                const next = new Set(prev);
                                if (next.has(module)) {
                                  next.delete(module);
                                } else {
                                  next.add(module);
                                  setSelectedPermissions(p => ({ ...p, [module]: [] }));
                                }
                                return next;
                              });
                            }}
                            className={`text-xs px-2 py-1 rounded-lg border font-medium transition-all ${
                              isDisabled
                                ? 'bg-red-500/15 border-red-500/35 text-red-400'
                                : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/20'
                            }`}
                          >
                            {isDisabled ? 'Deactivated' : 'Deactivate'}
                          </button>
                        </div>
                        <div className={`flex flex-wrap gap-2 ${isDisabled ? 'opacity-30 pointer-events-none' : ''}`}>
                          {AVAILABLE_ACTIONS.map(action => {
                            const checked = (selectedPermissions[module] || []).includes(action);
                            return (
                              <button
                                key={`${module}-${action}`}
                                type="button"
                                onClick={() => toggleAction(module, action)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all ${
                                  checked
                                    ? 'bg-[#fc0ce4]/15 border-[#fc0ce4]/35 text-[#fc0ce4]'
                                    : 'bg-white/5 border-white/10 text-white/45 hover:text-white hover:border-white/20'
                                }`}
                              >
                                {action}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3 justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRole}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminRoles;
