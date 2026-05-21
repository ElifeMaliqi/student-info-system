'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X, GraduationCap, Clock, Users, Check, Minus,
  Loader2, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import type { CalendarEvent } from '../types';

const CLASS_COLOR = '#10b981';

type AttStatus = 'present' | 'absent' | 'late';

interface Student {
  id: string;
  name: string;
  avatar: string;
}

interface Props {
  event: CalendarEvent;
  /** 'teacher' = can mark; 'admin' = read-only all students; 'student' = shows own row only */
  viewerRole: 'teacher' | 'admin' | 'student';
  viewerUserId: string;
  onClose: () => void;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Sub-component: shows a student's overall attendance rate for a specific class */
function ClassRate({ classId, studentId }: { classId: string; studentId: string }) {
  const [rate, setRate] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.classAttendance.getForStudent(studentId)
      .then(records => {
        const forClass = records.filter(r => r.classId === classId);
        if (!forClass.length) { setTotal(0); setRate(null); return; }
        const present = forClass.filter(r => r.status !== 'absent').length;
        setTotal(forClass.length);
        setRate(Math.round((present / forClass.length) * 100));
      })
      .catch(() => {});
  }, [classId, studentId]);

  if (rate === null || total === 0) return null;

  const color = rate >= 75 ? 'text-emerald-400' : rate >= 50 ? 'text-amber-400' : 'text-red-400';
  const bar   = rate >= 75 ? 'bg-emerald-400'   : rate >= 50 ? 'bg-amber-400'   : 'bg-red-400';

  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/8 space-y-2">
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Overall Class Attendance</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${rate}%` }} />
        </div>
        <span className={`text-sm font-bold ${color}`}>{rate}%</span>
      </div>
      <p className="text-[11px] text-white/30">{total} session{total !== 1 ? 's' : ''} recorded</p>
    </div>
  );
}

export function ClassAttendanceModal({ event, viewerRole, viewerUserId, onClose }: Props) {
  const classId = event.class_id!;
  const date    = event.start_time.split('T')[0];

  const [students, setStudents]     = useState<Student[]>([]);
  const [marks, setMarks]           = useState<Record<string, AttStatus>>({});
  const [saving, setSaving]         = useState<Record<string, boolean>>({});
  const [loading, setLoading]       = useState(true);
  const [error,   setError]         = useState('');

  useEffect(() => { void load(); }, [classId, date]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [studs, existing] = await Promise.all([
        api.classAttendance.getStudentsForClass(classId),
        api.classAttendance.getForClassDate(classId, date),
      ]);
      setStudents(studs);
      setMarks(existing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function mark(studentId: string, status: AttStatus) {
    // Optimistic update — save on every button click
    const prev = marks[studentId];
    setMarks(m => ({ ...m, [studentId]: status }));
    setSaving(s => ({ ...s, [studentId]: true }));
    try {
      await api.classAttendance.mark(classId, studentId, date, status);
    } catch (e) {
      // Roll back on failure
      setMarks(m => ({ ...m, [studentId]: prev }));
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(s => ({ ...s, [studentId]: false }));
    }
  }

  const teacher       = event.creator_profile;
  const schedule      = `${fmtTime(event.start_time)} – ${fmtTime(event.end_time)}`;
  const sessionDate   = new Date(event.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const presentCount  = Object.values(marks).filter(s => s !== 'absent').length;
  const absentCount   = Object.values(marks).filter(s => s === 'absent').length;
  const lateCount     = Object.values(marks).filter(s => s === 'late').length;
  const totalMarked   = Object.keys(marks).length;

  const myStatus      = viewerRole === 'student' ? marks[viewerUserId] : undefined;
  const myStudent     = students.find(s => s.id === viewerUserId);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="att-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />

      {/* Panel */}
      <motion.div
        key="att-modal"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{ opacity: 0,    scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
        >
          {/* Accent stripe */}
          <div className="h-1 w-full" style={{ backgroundColor: CLASS_COLOR }} />

          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <GraduationCap className="w-3.5 h-3.5 shrink-0" style={{ color: CLASS_COLOR }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: CLASS_COLOR }}>
                  Class Session
                </span>
              </div>
              <h2 className="text-lg font-bold text-white leading-snug truncate">{event.title}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {schedule} · {sessionDate}
                </div>
                {teacher && (
                  <div className="flex items-center gap-1.5 text-xs text-white/40">
                    <div className="w-4 h-4 rounded-full bg-[#fc0ce4]/20 flex items-center justify-center text-[8px] font-bold text-[#fc0ce4] shrink-0">
                      {teacher.firstName[0]}
                    </div>
                    {teacher.firstName} {teacher.lastName}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats bar */}
          {totalMarked > 0 && (
            <div className="px-6 pb-4 flex gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {presentCount} Present
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5" />
                {lateCount} Late
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                <XCircle className="w-3.5 h-3.5" />
                {absentCount} Absent
              </div>
            </div>
          )}

          {/* Divider + section label */}
          <div className="border-t border-white/5 px-6 py-2.5 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-white/30" />
            <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">
              {viewerRole === 'student' ? 'Your Attendance' : `Students (${students.length})`}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="px-6 pb-2 flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Body */}
          {loading ? (
            <div className="flex items-center justify-center py-10 text-white/30">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : viewerRole === 'student' ? (
            /* ── Student view: own row + class rate ── */
            <div className="px-6 pb-6 space-y-3">
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 border border-white/8">
                <div className="w-8 h-8 rounded-full bg-[#fc0ce4]/15 flex items-center justify-center text-[11px] font-bold text-[#fc0ce4] shrink-0">
                  {(myStudent?.name ?? 'Y')[0]}
                </div>
                <span className="text-sm font-medium text-white/80 flex-1">{myStudent?.name ?? 'You'}</span>
                {myStatus ? (
                  <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                    myStatus === 'present' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                    myStatus === 'late'    ? 'bg-amber-500/15  border-amber-500/30  text-amber-400'   :
                                            'bg-red-500/15    border-red-500/30    text-red-400'
                  }`}>
                    {myStatus === 'present' ? '✓ Present' : myStatus === 'late' ? '⏱ Late' : '✗ Absent'}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold border bg-white/5 border-white/10 text-white/30">
                    Not marked yet
                  </span>
                )}
              </div>
              <ClassRate classId={classId} studentId={viewerUserId} />
            </div>
          ) : (
            /* ── Teacher / Admin view: all students ── */
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {students.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-white/30">No enrolled students found.</p>
              ) : (
                <div className="px-4 pb-4 space-y-1">
                  {students.map(student => {
                    const status   = marks[student.id];
                    const isSaving = saving[student.id];
                    return (
                      <div
                        key={student.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-full bg-[#fc0ce4]/15 flex items-center justify-center text-[10px] font-bold text-[#fc0ce4] shrink-0">
                          {student.name.charAt(0)}
                        </div>
                        <span className="text-sm text-white/75 flex-1 truncate">{student.name}</span>

                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white/30 shrink-0" />
                        ) : viewerRole === 'teacher' ? (
                          /* Marking buttons */
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => void mark(student.id, 'present')}
                              title="Present"
                              className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                                status === 'present'
                                  ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/40'
                                  : 'bg-white/5 text-white/30 hover:bg-emerald-500/15 hover:text-emerald-400 border-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => void mark(student.id, 'late')}
                              title="Late"
                              className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                                status === 'late'
                                  ? 'bg-amber-500/25 text-amber-400 border-amber-500/40'
                                  : 'bg-white/5 text-white/30 hover:bg-amber-500/15 hover:text-amber-400 border-transparent'
                              }`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => void mark(student.id, 'absent')}
                              title="Absent"
                              className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                                status === 'absent'
                                  ? 'bg-red-500/25 text-red-400 border-red-500/40'
                                  : 'bg-white/5 text-white/30 hover:bg-red-500/15 hover:text-red-400 border-transparent'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          /* Admin: read-only badge */
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${
                            status === 'present' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            status === 'late'    ? 'bg-amber-500/10  border-amber-500/20  text-amber-400'   :
                            status === 'absent'  ? 'bg-red-500/10    border-red-500/20    text-red-400'     :
                                                  'bg-white/5 border-white/10 text-white/25'
                          }`}>
                            {status === 'present' ? 'Present' : status === 'late' ? 'Late' : status === 'absent' ? 'Absent' : '—'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
