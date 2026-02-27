import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, Clock, User, Mail, Phone, Calendar, MapPin, FileText, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { RegistrationApplication } from '../types';
import { Skeleton } from '../components/Skeleton';

export default function RegistrationApplications() {
  const { t } = useLanguage();
  const [applications, setApplications] = useState<RegistrationApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<RegistrationApplication | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const data = await api.registrations.getAll();
      setApplications(data);
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Are you sure you want to approve this application? This will create a new user account.')) return;

    try {
      setProcessingId(id);
      await api.registrations.approve(id);
      await loadApplications();
      setSelectedApp(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to approve application');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const notes = prompt('Enter rejection reason (optional):');
    if (notes === null) return;

    try {
      setProcessingId(id);
      await api.registrations.reject(id, notes);
      await loadApplications();
      setSelectedApp(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to reject application');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredApps = applications.filter(app => filter === 'all' || app.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'approved': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'rejected': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-white/40 bg-white/5 border-white/10';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">
            Registration Applications
          </h1>
          <p className="text-white/50 text-sm">
            Review and approve registration requests
          </p>
        </div>

        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wider rounded-xl transition-all ${
                filter === f
                  ? 'bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white'
                  : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              {f} ({applications.filter(a => f === 'all' || a.status === f).length})
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-6 rounded-2xl">
              <Skeleton className="w-48 h-6 mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="w-full h-4" />
                <Skeleton className="w-full h-4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl text-center">
          <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/50">No {filter !== 'all' && filter} applications found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredApps.map((app) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer"
              onClick={() => setSelectedApp(app)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#fc0ce4] to-[#949ce4] flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-lg">
                        {app.firstName} {app.lastName}
                      </h3>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getStatusColor(app.status)}`}>
                        {app.status}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
                        {app.role}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-white/60">
                        <Mail className="w-4 h-4" />
                        {app.email}
                      </div>
                      {app.phone && (
                        <div className="flex items-center gap-2 text-white/60">
                          <Phone className="w-4 h-4" />
                          {app.phone}
                        </div>
                      )}
                      {app.program && (
                        <div className="flex items-center gap-2 text-white/60">
                          <FileText className="w-4 h-4" />
                          {app.program}
                        </div>
                      )}
                    </div>

                    {app.createdAt && (
                      <div className="mt-2 text-xs text-white/40">
                        Applied: {app.createdAt}
                      </div>
                    )}
                  </div>
                </div>

                {app.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(app.id);
                      }}
                      disabled={processingId === app.id}
                      className="p-2 rounded-xl bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReject(app.id);
                      }}
                      disabled={processingId === app.id}
                      className="p-2 rounded-xl bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {selectedApp && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedApp(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-panel p-8 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl font-medium mb-1">
                  {selectedApp.firstName} {selectedApp.lastName}
                </h2>
                <span className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border ${getStatusColor(selectedApp.status)}`}>
                  {selectedApp.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="text-white/50 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    Email
                  </label>
                  <p className="text-white">{selectedApp.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    Role
                  </label>
                  <p className="text-white capitalize">{selectedApp.role}</p>
                </div>
              </div>

              {selectedApp.phone && (
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    Phone
                  </label>
                  <p className="text-white">{selectedApp.phone}</p>
                </div>
              )}

              {selectedApp.program && (
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    Program
                  </label>
                  <p className="text-white">{selectedApp.program}</p>
                </div>
              )}

              {selectedApp.role === 'student' && (
                <>
                  {selectedApp.dateOfBirth && (
                    <div>
                      <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        Date of Birth
                      </label>
                      <p className="text-white">{selectedApp.dateOfBirth}</p>
                    </div>
                  )}
                  {selectedApp.address && (
                    <div>
                      <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        Address
                      </label>
                      <p className="text-white">{selectedApp.address}, {selectedApp.city}, {selectedApp.country}</p>
                    </div>
                  )}
                  {selectedApp.emergencyContactName && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                          Emergency Contact
                        </label>
                        <p className="text-white">{selectedApp.emergencyContactName}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                          Emergency Phone
                        </label>
                        <p className="text-white">{selectedApp.emergencyContactPhone}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedApp.role === 'teacher' && (
                <>
                  {selectedApp.specialization && (
                    <div>
                      <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        Specialization
                      </label>
                      <p className="text-white">{selectedApp.specialization}</p>
                    </div>
                  )}
                  {selectedApp.qualifications && (
                    <div>
                      <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        Qualifications
                      </label>
                      <p className="text-white">{selectedApp.qualifications}</p>
                    </div>
                  )}
                  {selectedApp.experienceYears !== undefined && (
                    <div>
                      <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        Years of Experience
                      </label>
                      <p className="text-white">{selectedApp.experienceYears} years</p>
                    </div>
                  )}
                </>
              )}

              {selectedApp.notes && (
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    Admin Notes
                  </label>
                  <p className="text-white">{selectedApp.notes}</p>
                </div>
              )}

              {selectedApp.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button
                    onClick={() => handleApprove(selectedApp.id)}
                    disabled={processingId === selectedApp.id}
                    className="flex-1 btn-primary py-3 disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Approve Application
                  </button>
                  <button
                    onClick={() => handleReject(selectedApp.id)}
                    disabled={processingId === selectedApp.id}
                    className="flex-1 py-3 px-6 rounded-xl bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5 mr-2 inline" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
