'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, Clock, User, Mail, Phone, Calendar, MapPin, FileText, AlertCircle, Loader2, Archive, ArchiveRestore } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import { RegistrationApplication, Class } from '../types';
import { Skeleton } from '../components/Skeleton';

export default function RegistrationApplications() {
  const { t } = useLanguage();
  const [applications, setApplications] = useState<RegistrationApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<RegistrationApplication | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'archived'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | 'archive' | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [approveClasses, setApproveClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [archivedClasses, setArchivedClasses] = useState<{ classId: string; classTitle: string; programId: string | null }[]>([]);
  const [selectedRestoreClassIds, setSelectedRestoreClassIds] = useState<Set<string>>(new Set());

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

  const closeModal = () => {
    setSelectedApp(null);
    setConfirmAction(null);
    setRejectNotes('');
    setApproveClasses([]);
    setSelectedClassId('');
    setArchivedClasses([]);
    setSelectedRestoreClassIds(new Set());
  };

  const openApproveConfirm = async (app: RegistrationApplication, e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedApp(app);
    setConfirmAction('approve');
    setSelectedClassId('');
    setArchivedClasses([]);
    setSelectedRestoreClassIds(new Set());
    if (app.role === 'student') {
      setLoadingClasses(true);
      try {
        const [classes, archived] = await Promise.all([
          app.program ? api.classes.getByProgram(app.program) : Promise.resolve([]),
          api.registrations.getArchivedClasses(app.email),
        ]);
        setApproveClasses(classes);
        setArchivedClasses(archived);
      } catch {
        setApproveClasses([]);
        setArchivedClasses([]);
      } finally {
        setLoadingClasses(false);
      }
    } else {
      setApproveClasses([]);
    }
  };

  const openRejectConfirm = (app: RegistrationApplication, e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedApp(app);
    setRejectNotes('');
    setConfirmAction('reject');
  };

  const doApprove = async () => {
    if (!selectedApp) return;
    if (selectedApp.role === 'student' && approveClasses.length > 0 && !selectedClassId && selectedRestoreClassIds.size === 0) {
      alert('Please select a class for this student, or choose previous classes to restore.');
      return;
    }
    try {
      setProcessingId(selectedApp.id);
      await api.registrations.approve(
        selectedApp.id,
        selectedClassId || undefined,
        Array.from(selectedRestoreClassIds),
      );
      await loadApplications();
      closeModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to approve application');
    } finally {
      setProcessingId(null);
    }
  };

  const doReject = async () => {
    if (!selectedApp) return;
    try {
      setProcessingId(selectedApp.id);
      await api.registrations.reject(selectedApp.id, rejectNotes);
      await loadApplications();
      closeModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to reject application');
    } finally {
      setProcessingId(null);
    }
  };

  const doArchive = async (app: RegistrationApplication, e?: { stopPropagation: () => void }) => {
    e?.stopPropagation();
    try {
      setProcessingId(app.id);
      await api.registrations.archive(app.id);
      await loadApplications();
      if (selectedApp?.id === app.id) closeModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to archive application');
    } finally {
      setProcessingId(null);
    }
  };

  const doUnarchive = async (app: RegistrationApplication, e?: { stopPropagation: () => void }) => {
    e?.stopPropagation();
    try {
      setProcessingId(app.id);
      await api.registrations.unarchive(app.id);
      await loadApplications();
      if (selectedApp?.id === app.id) closeModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to unarchive application');
    } finally {
      setProcessingId(null);
    }
  };

  // Active = not archived. Archived = is_archived flag set.
  const activeApps = applications.filter(a => !a.isArchived);
  const archivedApps = applications.filter(a => a.isArchived);

  const filteredApps = filter === 'archived'
    ? archivedApps
    : activeApps.filter(app => filter === 'all' || app.status === filter);

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
            {t('registrations.title')}
          </h1>
          <p className="text-white/50 text-sm">
            {t('registrations.desc')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
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
              {f === 'all' ? t('registrations.all') : f === 'pending' ? t('registrations.pending_filter') : f === 'approved' ? t('registrations.approved_filter') : t('registrations.rejected_filter')} ({activeApps.filter(a => f === 'all' || a.status === f).length})
            </button>
          ))}
          <button
            onClick={() => setFilter('archived')}
            className={`px-4 py-2 text-xs font-medium uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 ${
              filter === 'archived'
                ? 'bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white'
                : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            {t('registrations.archived')} ({archivedApps.length})
          </button>
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
          <p className="text-white/50">{t('registrations.no_applications')}</p>
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
                      {app.secondaryPhone && (
                        <div className="flex items-center gap-2 text-white/60">
                          <Phone className="w-4 h-4" />
                          {app.secondaryPhone}
                        </div>
                      )}
                      {app.program && (
                        <div className="flex items-center gap-2 text-white/60">
                          <FileText className="w-4 h-4" />
                          {app.program}
                        </div>
                      )}
                      {app.location && (
                        <div className="flex items-center gap-2 text-white/60">
                          <MapPin className="w-4 h-4" />
                          {app.location}
                        </div>
                      )}
                    </div>

                    {app.createdAt && (
                      <div className="mt-2 text-xs text-white/40">
                        {t('registrations.applied')} {app.createdAt}
                      </div>
                    )}
                  </div>
                </div>

                {app.status === 'pending' && !app.isArchived && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => openApproveConfirm(app, e)}
                      disabled={!!processingId}
                      className="p-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                      title={t('registrations.approve')}
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => openRejectConfirm(app, e)}
                      disabled={!!processingId}
                      className="p-2 rounded-xl bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors disabled:opacity-50"
                      title={t('registrations.reject')}
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => doArchive(app, e)}
                      disabled={!!processingId}
                      className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                      title={t('registrations.archive')}
                    >
                      <Archive className="w-5 h-5" />
                    </button>
                  </div>
                )}
                {!app.isArchived && app.status !== 'pending' && (
                  <button
                    onClick={(e) => doArchive(app, e)}
                    disabled={!!processingId}
                    className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                    title={t('registrations.archive')}
                  >
                    <Archive className="w-5 h-5" />
                  </button>
                )}
                {app.isArchived && (
                  <button
                    onClick={(e) => doUnarchive(app, e)}
                    disabled={!!processingId}
                    className="p-2 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                    title={t('registrations.unarchive')}
                  >
                    <ArchiveRestore className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {selectedApp && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
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
                onClick={closeModal}
                className="text-white/50 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    {t('students.email')}
                  </label>
                  <p className="text-white">{selectedApp.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    {t('registrations.role')}
                  </label>
                  <p className="text-white capitalize">{selectedApp.role}</p>
                </div>
              </div>

              {selectedApp.phone && (
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    {t('students.phone')}
                  </label>
                  <p className="text-white">{selectedApp.phone}</p>
                </div>
              )}

              {selectedApp.secondaryPhone && (
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    {t('registrations.secondary_phone')}
                  </label>
                  <p className="text-white">{selectedApp.secondaryPhone}</p>
                </div>
              )}

              {selectedApp.location && (
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    {t('registrations.location')}
                  </label>
                  <p className="text-white">{selectedApp.location}</p>
                </div>
              )}

              {selectedApp.parentFirstName && (
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    {t('registrations.parent_name')}
                  </label>
                  <p className="text-white">{selectedApp.parentFirstName}</p>
                </div>
              )}

              {selectedApp.program && (
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    {t('registrations.program')}
                  </label>
                  <p className="text-white">{selectedApp.program}</p>
                </div>
              )}

              {selectedApp.idDocumentUrl && (
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    {t('registrations.id_document')}
                  </label>
                  <a
                    href={selectedApp.idDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#fc0ce4] hover:underline flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    {t('registrations.view_document')}
                  </a>
                </div>
              )}

              {selectedApp.role === 'student' && (
                <>
                  {selectedApp.dateOfBirth && (
                    <div>
                      <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        {t('registrations.date_of_birth')}
                      </label>
                      <p className="text-white">{selectedApp.dateOfBirth}</p>
                    </div>
                  )}
                  {selectedApp.address && (
                    <div>
                      <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        {t('registrations.address')}
                      </label>
                      <p className="text-white">{selectedApp.address}, {selectedApp.city}, {selectedApp.country}</p>
                    </div>
                  )}
                  {selectedApp.emergencyContactName && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                          {t('registrations.emergency_contact')}
                        </label>
                        <p className="text-white">{selectedApp.emergencyContactName}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                          {t('registrations.emergency_phone')}
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
                        {t('registrations.specialization')}
                      </label>
                      <p className="text-white">{selectedApp.specialization}</p>
                    </div>
                  )}
                  {selectedApp.qualifications && (
                    <div>
                      <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        {t('registrations.qualifications')}
                      </label>
                      <p className="text-white">{selectedApp.qualifications}</p>
                    </div>
                  )}
                  {selectedApp.experienceYears !== undefined && (
                    <div>
                      <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                        {t('registrations.experience')}
                      </label>
                      <p className="text-white">{selectedApp.experienceYears} {t('registrations.years')}</p>
                    </div>
                  )}
                </>
              )}

              {selectedApp.notes && (
                <div>
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">
                    {t('registrations.admin_notes')}
                  </label>
                  <p className="text-white">{selectedApp.notes}</p>
                </div>
              )}

              {selectedApp.status === 'pending' && !confirmAction && !selectedApp.isArchived && (
                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button
                    onClick={async () => {
                      setConfirmAction('approve');
                      setSelectedClassId('');
                      if (selectedApp.role === 'student' && selectedApp.program) {
                        setLoadingClasses(true);
                        try {
                          const classes = await api.classes.getByProgram(selectedApp.program);
                          setApproveClasses(classes);
                        } catch {
                          setApproveClasses([]);
                        } finally {
                          setLoadingClasses(false);
                        }
                      } else {
                        setApproveClasses([]);
                      }
                    }}
                    disabled={!!processingId}
                    className="flex-1 py-3 px-6 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {t('registrations.approve')}
                  </button>
                  <button
                    onClick={() => { setRejectNotes(''); setConfirmAction('reject'); }}
                    disabled={!!processingId}
                    className="flex-1 py-3 px-6 rounded-xl bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-5 h-5" />
                    {t('registrations.reject')}
                  </button>
                  <button
                    onClick={() => doArchive(selectedApp)}
                    disabled={!!processingId}
                    className="py-3 px-4 rounded-xl bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Archive"
                  >
                    <Archive className="w-5 h-5" />
                  </button>
                </div>
              )}

              {!selectedApp.isArchived && selectedApp.status !== 'pending' && !confirmAction && (
                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button
                    onClick={() => doArchive(selectedApp)}
                    disabled={!!processingId}
                    className="py-3 px-6 rounded-xl bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Archive className="w-4 h-4" />
                    {t('registrations.archive')}
                  </button>
                </div>
              )}

              {selectedApp.isArchived && !confirmAction && (
                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <div className="flex-1 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-sm text-amber-400/80">
                    {t('registrations.this_app_archived')}
                  </div>
                  <button
                    onClick={() => doUnarchive(selectedApp)}
                    disabled={!!processingId}
                    className="py-3 px-6 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingId === selectedApp.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArchiveRestore className="w-4 h-4" />}
                    {t('registrations.unarchive')}
                  </button>
                </div>
              )}

              {selectedApp.status === 'pending' && confirmAction === 'approve' && (
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <p className="text-sm text-white/70">{t('registrations.confirm_approve_msg')}</p>

                  {selectedApp.role === 'student' && (
                    <div className="space-y-4">
                      {/* Previously enrolled classes (archived) */}
                      {loadingClasses ? (
                        <div className="flex items-center gap-2 text-white/40 text-sm py-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> {t('registrations.loading_classes')}
                        </div>
                      ) : archivedClasses.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-white/40 uppercase tracking-wider block">
                            Restore previous classes
                          </label>
                          <div className="space-y-1.5">
                            {archivedClasses.map(cls => (
                              <label key={cls.classId} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                                <input
                                  type="checkbox"
                                  checked={selectedRestoreClassIds.has(cls.classId)}
                                  onChange={e => {
                                    setSelectedRestoreClassIds(prev => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(cls.classId);
                                      else next.delete(cls.classId);
                                      return next;
                                    });
                                  }}
                                  className="w-4 h-4 rounded accent-emerald-500"
                                />
                                <span className="text-sm text-white/80">{cls.classTitle}</span>
                                {cls.programId && <span className="text-xs text-white/40 ml-auto">{cls.programId}</span>}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Assign to a new class */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-white/40 uppercase tracking-wider block">
                          {t('registrations.assign_class')} {selectedApp.program && <span className="normal-case text-white/60">({selectedApp.program})</span>}
                        </label>
                        {loadingClasses ? null : approveClasses.length === 0 ? (
                          <p className="text-xs text-amber-400/80">{t('registrations.no_classes')}</p>
                        ) : (
                          <select
                            value={selectedClassId}
                            onChange={e => setSelectedClassId(e.target.value)}
                            className="glass-select w-full px-4 py-3 rounded-xl text-sm"
                          >
                            <option value="">{t('registrations.select_class')}</option>
                            {approveClasses.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.title}{c.teacher ? ` — ${c.teacher.firstName} ${c.teacher.lastName}` : ''}{c.enrollmentCount != null ? ` (${c.enrollmentCount} students)` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={doApprove}
                      disabled={processingId === selectedApp.id}
                      className="flex-1 py-3 px-6 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === selectedApp.id ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                          {t('registrations.processing')}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          {t('registrations.confirm_approve')}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmAction(null)}
                      disabled={processingId === selectedApp.id}
                      className="px-6 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors font-medium disabled:opacity-50"
                    >
                      {t('registrations.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {selectedApp.status === 'pending' && confirmAction === 'reject' && (
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-white/40 uppercase tracking-wider block">
                      {t('registrations.reject_reason')}
                    </label>
                    <textarea
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      placeholder={t('registrations.reject_reason_placeholder')}
                      className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 h-24 resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={doReject}
                      disabled={processingId === selectedApp.id}
                      className="flex-1 py-3 px-6 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === selectedApp.id ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                          {t('registrations.processing')}
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5" />
                          {t('registrations.confirm_reject')}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmAction(null)}
                      disabled={processingId === selectedApp.id}
                      className="px-6 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors font-medium disabled:opacity-50"
                    >
                      {t('registrations.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
