'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Plus, X, Clock,
  Users, Trash2, Mail, Loader2, Check, AlertCircle, CheckCircle2, XCircle,
  Minus, GraduationCap, ChevronDown, ArrowLeft, BookOpen, Calendar,
  CalendarX, CalendarCheck,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';
import type { CalendarEvent, AdminDayClass } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────────

const EVENT_COLORS = [
  '#fc0ce4', '#949ce4', '#10b981', '#f59e0b', '#3b82f6', '#ef4444',
] as const;
type EventColor = typeof EVENT_COLORS[number];

const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
] as const;

const DAY_NUM_H         = 34;
const SLOT_H            = 22;
const MAX_VISIBLE_SLOTS = 3;

// ── Pure helpers ───────────────────────────────────────────────────────────────

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function dayFloor(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toInputDate(d: Date) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDateRange(start: string, end: string, allDay: boolean) {
  const s  = new Date(start);
  const e  = new Date(end);
  const ds = s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (allDay) {
    if (sameDay(s, e)) return ds;
    return `${ds} – ${e.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
  }
  if (sameDay(s, e)) return `${ds} · ${fmtTime(start)} – ${fmtTime(end)}`;
  return `${ds} ${fmtTime(start)} – ${e.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${fmtTime(end)}`;
}

/** 42-cell calendar grid for a given month (6 rows × 7 cols). */
function buildGrid(year: number, month: number): Date[] {
  const firstWeekday  = new Date(year, month, 1).getDay();
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const days: Date[]  = [];

  for (let i = firstWeekday - 1; i >= 0; i--)
    days.push(new Date(year, month - 1, prevMonthDays - i));
  for (let i = 1; i <= daysInMonth; i++)
    days.push(new Date(year, month, i));
  for (let i = 1; days.length < 42; i++)
    days.push(new Date(year, month + 1, i));

  return days;
}

// ── Event layout (spanning pills) ─────────────────────────────────────────────

interface EventLayout {
  event: CalendarEvent;
  startCol: number;
  span: number;
  slot: number;
  continuesLeft: boolean;
  continuesRight: boolean;
}

function layoutWeek(weekDays: Date[], events: CalendarEvent[]): EventLayout[] {
  const wStart = dayFloor(weekDays[0]);
  const wEnd   = dayFloor(weekDays[6]);

  const visible = events.filter(ev => {
    const s = dayFloor(new Date(ev.start_time));
    const e = dayFloor(new Date(ev.end_time));
    return s <= wEnd && e >= wStart;
  });

  visible.sort((a, b) => {
    const aDur = +new Date(a.end_time) - +new Date(a.start_time);
    const bDur = +new Date(b.end_time) - +new Date(b.start_time);
    return bDur !== aDur ? bDur - aDur : +new Date(a.start_time) - +new Date(b.start_time);
  });

  const result: EventLayout[] = [];
  const occ: boolean[][] = Array.from({ length: 7 }, () => []);

  for (const ev of visible) {
    const eStart         = dayFloor(new Date(ev.start_time));
    const eEnd           = dayFloor(new Date(ev.end_time));
    const continuesLeft  = eStart < wStart;
    const continuesRight = eEnd   > wEnd;

    let startCol = 0;
    if (!continuesLeft) {
      const idx = weekDays.findIndex(d => sameDay(d, eStart));
      if (idx === -1) continue;
      startCol = idx;
    }

    let endCol = 6;
    if (!continuesRight) {
      let idx = -1;
      for (let c = 6; c >= 0; c--) {
        if (dayFloor(weekDays[c]) <= eEnd) { idx = c; break; }
      }
      if (idx === -1) continue;
      endCol = idx;
    }

    const span         = endCol - startCol + 1;
    const slotsNeeded  = ev.event_type === 'class' ? 2 : 1;

    let slot = 0;
    outerLoop: while (true) {
      for (let extra = 0; extra < slotsNeeded; extra++) {
        for (let c = startCol; c <= endCol; c++) {
          if (occ[c][slot + extra]) { slot++; continue outerLoop; }
        }
      }
      break;
    }

    for (let extra = 0; extra < slotsNeeded; extra++) {
      for (let c = startCol; c <= endCol; c++) occ[c][slot + extra] = true;
    }

    result.push({ event: ev, startCol, span, slot, continuesLeft, continuesRight });
  }

  return result;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EventPill({ layout, onClick }: {
  layout: EventLayout;
  onClick: (ev: CalendarEvent, e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const { event, startCol, span, slot, continuesLeft, continuesRight } = layout;
  const leftPct  = (startCol / 7) * 100;
  const widthPct = (span / 7) * 100;
  const isClass  = event.event_type === 'class';
  const color    = isClass ? (event.color || '#3b82f6') : event.color;
  const padL     = continuesLeft  ? 0 : 3;
  const padR     = continuesRight ? 0 : 3;
  const radius   = continuesLeft
    ? (continuesRight ? '0px' : '0 4px 4px 0')
    : (continuesRight ? '4px 0 0 4px' : '4px');

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(event, e); }}
      style={{
        position:        'absolute',
        left:            `calc(${leftPct}% + ${padL}px)`,
        width:           `calc(${widthPct}% - ${padL}px - ${padR}px)`,
        top:             `${slot * SLOT_H + 2}px`,
        height:          `${(SLOT_H - 4) * (isClass ? 2 : 1)}px`,
        backgroundColor: color + '28',
        borderLeft:      continuesLeft ? 'none' : `${isClass ? '4px' : '3px'} solid ${color}`,
        borderRadius:    radius,
        boxShadow:       isClass ? `0 4px 12px ${color}33` : 'none',
      }}
      className="flex items-center px-1.5 cursor-pointer hover:brightness-125 transition-all z-10 select-none overflow-hidden"
      title={event.title}
    >
      {isClass && <GraduationCap className="w-3.5 h-3.5 mr-1 flex-shrink-0" style={{ color }} />}
      <span style={{ color }} className={`${isClass ? 'text-xs font-bold' : 'text-[11px] font-semibold'} truncate leading-none`}>
        {!continuesLeft && !event.all_day && (
          <span className="opacity-60 mr-1 font-normal">{fmtTime(event.start_time)}</span>
        )}
        {event.title}
      </span>
    </div>
  );
}

function ParticipantBadge({ name, email, onRemove }: {
  name?: string; email: string; onRemove?: () => void;
}) {
  const initial = (name ?? email)[0]?.toUpperCase() ?? '?';
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 group">
      <div className="w-6 h-6 rounded-full bg-[#fc0ce4]/20 grid place-items-center shrink-0">
        <span className="text-[10px] font-bold text-[#fc0ce4]">{initial}</span>
      </div>
      <div className="flex-1 min-w-0">
        {name && <p className="text-xs font-medium text-white/80 truncate">{name}</p>}
        <p className="text-[11px] text-white/40 truncate">{email}</p>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-0.5 hover:bg-red-400/10 rounded opacity-0 group-hover:opacity-100 transition-all text-white/30 hover:text-red-400"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Shared modal shell ─────────────────────────────────────────────────────────

function ModalShell({ children, onClose, wide }: {
  children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto`}
          onClick={e => e.stopPropagation()}
        >
          {children}
        </div>
      </motion.div>
    </>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">
      {children}
    </label>
  );
}

function inputCls(extra = '') {
  return `w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#fc0ce4]/50 focus:bg-[#fc0ce4]/5 transition-all ${extra}`;
}

// ── Attendance status badge ────────────────────────────────────────────────────

function AttBadge({ status }: { status?: string }) {
  const { t } = useLanguage();
  if (status === 'present') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 font-medium">{t('status.present')}</span>;
  if (status === 'late')    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 font-medium">{t('status.late')}</span>;
  if (status === 'absent')  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-400/15 text-red-400 font-medium">{t('status.absent')}</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/25 font-medium">{t('status.unrecorded')}</span>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Participant = { email: string; name?: string; userId?: string };

interface CreateForm {
  title: string; description: string; allDay: boolean;
  startDate: string; startTime: string; endDate: string; endTime: string;
  color: EventColor;
}

interface StudentRow { id: string; name: string; avatar: string; }

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminCalendar() {
  const today = useMemo(() => new Date(), []);

  // ── View state ────────────────────────────────────────────────────────────
  const [viewYear,  setViewYear ] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events,    setEvents   ] = useState<CalendarEvent[]>([]);
  const [loading,   setLoading  ] = useState(true);

  // ── Create event modal ────────────────────────────────────────────────────
  const [showCreate,      setShowCreate     ] = useState(false);
  const [saving,          setSaving         ] = useState(false);
  const [createError,     setCreateError    ] = useState('');
  const [audienceMode,    setAudienceMode   ] = useState<'everyone' | 'all_admins' | 'all_teachers' | 'custom'>('custom');
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [form,            setForm           ] = useState<CreateForm>({
    title: '', description: '', allDay: false,
    startDate: '', startTime: '09:00', endDate: '', endTime: '10:00',
    color: EVENT_COLORS[0],
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [emailInput,   setEmailInput  ] = useState('');
  const [emailError,   setEmailError  ] = useState('');
  const [lookingUp,    setLookingUp   ] = useState(false);

  // ── Regular event detail modal ────────────────────────────────────────────
  const [showDetail,   setShowDetail  ] = useState(false);
  const [selEvent,     setSelEvent    ] = useState<CalendarEvent | null>(null);
  const [deleting,     setDeleting    ] = useState(false);
  const [updatingRsvp, setUpdatingRsvp] = useState(false);

  // ── Admin Day Modal ───────────────────────────────────────────────────────
  const [adminDayOpen,    setAdminDayOpen   ] = useState<Date | null>(null);
  const [adminDayClasses, setAdminDayClasses] = useState<AdminDayClass[]>([]);
  const [adminDayLoading, setAdminDayLoading] = useState(false);
  const [expandedDegrees, setExpandedDegrees] = useState<Set<string>>(new Set());

  // ── Class detail panel (inside Admin Day Modal) ───────────────────────────
  const [detailClass,      setDetailClass     ] = useState<AdminDayClass | null>(null);
  const [detailStudents,   setDetailStudents  ] = useState<StudentRow[]>([]);
  const [detailAttendance, setDetailAttendance] = useState<Record<string, string>>({});
  const [detailLoading,    setDetailLoading   ] = useState(false);

  // Single-class reschedule inline form
  const [rescheduleMode,  setRescheduleMode ] = useState(false);
  const [rescheduleForm,  setRescheduleForm ] = useState({ date: '', startTime: '', endTime: '' });
  const [rescheduleSaving,setRescheduleSaving] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Single-class cancel confirm
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelSaving,  setCancelSaving  ] = useState(false);
  const [cancelReason,  setCancelReason  ] = useState('');

  // Bulk clear confirm (per degree)
  const [bulkClearProgramId, setBulkClearProgramId] = useState<string | null>(null);
  const [bulkClearing,       setBulkClearing       ] = useState(false);
  const [bulkClearReason,    setBulkClearReason    ] = useState('');

  // Bulk reschedule flow
  const [bulkOpen,           setBulkOpen           ] = useState(false);
  const [bulkDegreeClasses,  setBulkDegreeClasses  ] = useState<AdminDayClass[]>([]);
  const [bulkPhase,          setBulkPhase          ] = useState<'select' | 'carousel'>('select');
  const [bulkSelected,       setBulkSelected       ] = useState<Set<string>>(new Set());
  const [bulkCarouselIndex,  setBulkCarouselIndex  ] = useState(0);
  const [bulkForms,          setBulkForms          ] = useState<Map<string, { date: string; startTime: string; endTime: string }>>(new Map());
  const [bulkSaving,         setBulkSaving         ] = useState(false);
  const [bulkReason,         setBulkReason         ] = useState('');

  const { t } = useLanguage();
  const { user } = useUser();

  // ── Calendar grid ─────────────────────────────────────────────────────────
  const gridDays = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const weeks    = useMemo<Date[][]>(() => {
    const ws: Date[][] = [];
    for (let i = 0; i < 42; i += 7) ws.push(gridDays.slice(i, i + 7));
    return ws;
  }, [gridDays]);

  // Grouped day classes by program (for the day modal)
  const groupedByProgram = useMemo(() => {
    const groups = new Map<string, { programName: string; classes: AdminDayClass[] }>();
    for (const cls of adminDayClasses) {
      if (!groups.has(cls.programId)) {
        groups.set(cls.programId, { programName: cls.programName, classes: [] });
      }
      groups.get(cls.programId)!.classes.push(cls);
    }
    return Array.from(groups.entries()).map(([programId, { programName, classes }]) => ({
      programId, programName, classes,
    }));
  }, [adminDayClasses]);

  // Ordered list of selected classes for bulk carousel
  const bulkSelectedList = useMemo(
    () => bulkDegreeClasses.filter(c => bulkSelected.has(c.classId)),
    [bulkDegreeClasses, bulkSelected],
  );

  // ── Load events on month change ───────────────────────────────────────────
  useEffect(() => { void loadEvents(); }, [viewYear, viewMonth]);

  async function loadEvents() {
    setLoading(true);
    try { setEvents(await api.calendar.getEvents(viewYear, viewMonth, 'admin')); }
    catch (e) { console.error(e); }
    finally   { setLoading(false); }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function prev() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function next() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }
  function goToday() { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }

  // ── Create modal ──────────────────────────────────────────────────────────
  function openCreate(date?: Date) {
    const d = date ?? today;
    setForm({
      title: '', description: '', allDay: false,
      startDate: toInputDate(d), startTime: '09:00',
      endDate:   toInputDate(d), endTime:   '10:00',
      color: EVENT_COLORS[0],
    });
    setParticipants([]); setEmailInput(''); setEmailError('');
    setAudienceMode('custom'); setCreateError('');
    setShowCreate(true);
  }

  // ── Open regular event detail ─────────────────────────────────────────────
  function openDetail(ev: CalendarEvent, e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (ev.event_type === 'class') {
      // Class pill → open admin day modal for that day
      void openAdminDayModal(new Date(ev.start_time));
    } else {
      setSelEvent(ev);
      setShowDetail(true);
    }
  }

  // ── Admin Day Modal ───────────────────────────────────────────────────────
  async function openAdminDayModal(day: Date) {
    setAdminDayOpen(day);
    setAdminDayClasses([]);
    setAdminDayLoading(true);
    setDetailClass(null);
    setExpandedDegrees(new Set());
    setRescheduleMode(false);
    setConfirmCancel(false);
    try {
      const classes = await api.calendar.getClassesForDay(toInputDate(day));
      setAdminDayClasses(classes);
    } catch (e) { console.error(e); }
    finally { setAdminDayLoading(false); }
  }

  function closeAdminDayModal() {
    setAdminDayOpen(null);
    setDetailClass(null);
    setBulkClearProgramId(null);
  }

  function toggleDegree(programId: string) {
    setExpandedDegrees(prev => {
      const next = new Set(prev);
      if (next.has(programId)) next.delete(programId);
      else next.add(programId);
      return next;
    });
  }

  // ── Class detail ──────────────────────────────────────────────────────────
  async function openClassDetail(cls: AdminDayClass) {
    setDetailClass(cls);
    setDetailLoading(true);
    setRescheduleMode(false);
    setConfirmCancel(false);
    setRescheduleReason('');
    setCancelReason('');
    setRescheduleForm({ date: '', startTime: cls.startTime, endTime: cls.endTime });
    try {
      const [students, attendance] = await Promise.all([
        api.classAttendance.getStudentsForClass(cls.classId),
        api.classAttendance.getForClassDate(cls.classId, cls.originalDate),
      ]);
      setDetailStudents(students);
      setDetailAttendance(attendance as Record<string, string>);
    } catch (e) {
      console.error(e);
      setDetailStudents([]); setDetailAttendance({});
    } finally {
      setDetailLoading(false);
    }
  }

  // ── Single-class reschedule ───────────────────────────────────────────────
  async function handleReschedule() {
    if (!detailClass || !rescheduleForm.date) return;
    setRescheduleSaving(true);
    const snapshot = { ...detailClass };
    const newStartTime = rescheduleForm.startTime || detailClass.startTime;
    const newEndTime   = rescheduleForm.endTime   || detailClass.endTime;
    try {
      await api.calendar.rescheduleClassOccurrence({
        classId:      snapshot.classId,
        sessionId:    snapshot.sessionId,
        originalDate: snapshot.originalDate,
        newDate:      rescheduleForm.date,
        newStartTime,
        newEndTime,
        reason:       rescheduleReason || undefined,
      });
      void api.calendar.sendClassUpdateNotifications({
        classId:      snapshot.classId,
        className:    snapshot.className,
        originalDate: snapshot.originalDate,
        updateType:   'rescheduled',
        newDate:      rescheduleForm.date,
        newStartTime,
        newEndTime,
        reason:       rescheduleReason || undefined,
      });
      const classes = await api.calendar.getClassesForDay(snapshot.originalDate);
      setAdminDayClasses(classes);
      setDetailClass(null);
      setRescheduleMode(false);
      setRescheduleReason('');
      void loadEvents();
    } catch (e) { console.error(e); }
    finally { setRescheduleSaving(false); }
  }

  // ── Single-class cancel ───────────────────────────────────────────────────
  async function handleCancelClass() {
    if (!detailClass) return;
    setCancelSaving(true);
    const snapshot = { ...detailClass };
    try {
      await api.calendar.rescheduleClassOccurrence({
        classId:      snapshot.classId,
        sessionId:    snapshot.sessionId,
        originalDate: snapshot.originalDate,
        newDate:      null,
        reason:       cancelReason || undefined,
      });
      void api.calendar.sendClassUpdateNotifications({
        classId:      snapshot.classId,
        className:    snapshot.className,
        originalDate: snapshot.originalDate,
        updateType:   'cancelled',
        reason:       cancelReason || undefined,
      });
      const classes = await api.calendar.getClassesForDay(snapshot.originalDate);
      setAdminDayClasses(classes);
      setDetailClass(null);
      setCancelReason('');
      void loadEvents();
    } catch (e) { console.error(e); }
    finally { setCancelSaving(false); setConfirmCancel(false); }
  }

  // ── Bulk clear ────────────────────────────────────────────────────────────
  async function handleBulkClear(programId: string) {
    const cls = adminDayClasses.filter(c => c.programId === programId);
    if (!adminDayOpen || !cls.length) return;
    setBulkClearing(true);
    const reason = bulkClearReason || undefined;
    try {
      await Promise.all(cls.map(c =>
        api.calendar.rescheduleClassOccurrence({
          classId: c.classId, sessionId: c.sessionId,
          originalDate: c.originalDate, newDate: null,
          reason,
        })
      ));
      cls.forEach(c => {
        void api.calendar.sendClassUpdateNotifications({
          classId:      c.classId,
          className:    c.className,
          originalDate: c.originalDate,
          updateType:   'cancelled',
          reason,
        });
      });
      const classes = await api.calendar.getClassesForDay(toInputDate(adminDayOpen));
      setAdminDayClasses(classes);
      setBulkClearProgramId(null);
      setBulkClearReason('');
      void loadEvents();
    } catch (e) { console.error(e); }
    finally { setBulkClearing(false); }
  }

  // ── Bulk reschedule flow ──────────────────────────────────────────────────
  function startBulkReschedule(programId: string) {
    const cls = adminDayClasses.filter(c => c.programId === programId);
    setBulkDegreeClasses(cls);
    setBulkPhase('select');
    setBulkSelected(new Set());
    setBulkCarouselIndex(0);
    const forms = new Map<string, { date: string; startTime: string; endTime: string }>();
    cls.forEach(c => forms.set(c.classId, { date: '', startTime: c.startTime, endTime: c.endTime }));
    setBulkForms(forms);
    setBulkOpen(true);
  }

  async function handleBulkSave() {
    if (!adminDayOpen) return;
    setBulkSaving(true);
    const reason = bulkReason || undefined;
    try {
      await Promise.all(bulkSelectedList.map(cls => {
        const form = bulkForms.get(cls.classId);
        return api.calendar.rescheduleClassOccurrence({
          classId:      cls.classId,
          sessionId:    cls.sessionId,
          originalDate: cls.originalDate,
          newDate:      form?.date || null,
          newStartTime: form?.startTime,
          newEndTime:   form?.endTime,
          reason,
        });
      }));
      bulkSelectedList.forEach(cls => {
        const form = bulkForms.get(cls.classId);
        void api.calendar.sendClassUpdateNotifications({
          classId:      cls.classId,
          className:    cls.className,
          originalDate: cls.originalDate,
          updateType:   'rescheduled',
          newDate:      form?.date || undefined,
          newStartTime: form?.startTime,
          newEndTime:   form?.endTime,
          reason,
        });
      });
      const classes = await api.calendar.getClassesForDay(toInputDate(adminDayOpen));
      setAdminDayClasses(classes);
      setBulkOpen(false);
      setBulkReason('');
      void loadEvents();
    } catch (e) { console.error(e); }
    finally { setBulkSaving(false); }
  }

  // ── Audience preset ───────────────────────────────────────────────────────
  async function changeAudience(mode: 'everyone' | 'all_admins' | 'all_teachers' | 'custom') {
    setAudienceMode(mode);
    if (mode === 'custom') { setParticipants([]); return; }
    setLoadingAudience(true);
    try {
      const roleMap = { everyone: 'all', all_admins: 'admin', all_teachers: 'teacher' } as const;
      const users   = await api.calendar.getUsersByRole(roleMap[mode]);
      setParticipants(users.map(u => ({ email: u.email, name: `${u.firstName} ${u.lastName}`, userId: u.id })));
    } catch (e) { console.error(e); }
    finally { setLoadingAudience(false); }
  }

  // ── Participant lookup ────────────────────────────────────────────────────
  async function addParticipant() {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(t('cal.invalid_email')); return;
    }
    if (participants.some(p => p.email === email)) {
      setEmailError(t('cal.already_added')); return;
    }
    setLookingUp(true); setEmailError('');
    try {
      const profile = await api.calendar.lookupUserByEmail(email);
      if (!profile) { setEmailError(t('cal.user_not_found')); return; }
      setParticipants(ps => [...ps, { email, name: `${profile.firstName} ${profile.lastName}`, userId: profile.id }]);
      setEmailInput('');
    } catch { setEmailError(t('cal.lookup_failed')); }
    finally { setLookingUp(false); }
  }

  // ── Create event ──────────────────────────────────────────────────────────
  async function createEvent() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const start = form.allDay
        ? new Date(form.startDate + 'T00:00:00').toISOString()
        : new Date(`${form.startDate}T${form.startTime}`).toISOString();
      const end = form.allDay
        ? new Date(form.endDate + 'T23:59:59').toISOString()
        : new Date(`${form.endDate}T${form.endTime}`).toISOString();
      await api.calendar.createEvent({
        title: form.title.trim(), description: form.description.trim() || undefined,
        start_time: start, end_time: end, all_day: form.allDay, color: form.color,
        event_type: 'meeting',
        participants: participants.map(p => p.userId!).filter(Boolean),
      });
      setShowCreate(false);
      void loadEvents();
    } catch (e) {
      console.error(e);
      setCreateError(e instanceof Error ? e.message : 'Failed to create event.');
    } finally { setSaving(false); }
  }

  // ── Delete event ──────────────────────────────────────────────────────────
  async function deleteEvent() {
    if (!selEvent) return;
    setDeleting(true);
    try {
      await api.calendar.deleteEvent(selEvent.id);
      setShowDetail(false); setSelEvent(null);
      void loadEvents();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  }

  async function updateRsvp(status: 'attending' | 'pending' | 'declined') {
    if (!selEvent || !user) return;
    setUpdatingRsvp(true);
    try {
      await api.calendar.updateRsvp(selEvent.id, status);
      setSelEvent(prev => prev ? {
        ...prev,
        participants: prev.participants?.map(p => p.user_id === user.id ? { ...p, rsvp_status: status } : p),
      } : prev);
      void loadEvents();
    } catch (e) { console.error(e); }
    finally { setUpdatingRsvp(false); }
  }

  function eventsOnDay(day: Date): CalendarEvent[] {
    const start = dayFloor(day);
    const end   = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return events.filter(ev => new Date(ev.start_time) <= end && new Date(ev.end_time) >= start);
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col p-4 lg:p-6 gap-4 overflow-hidden">

      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('cal.title')}</h1>
          <p className="text-white/40 text-sm mt-0.5">{t('cal.desc')}</p>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold shadow-lg hover:shadow-[#fc0ce4]/25 hover:scale-105 active:scale-100 transition-all"
        >
          <Plus className="w-4 h-4" />
          {t('cal.new_event')}
        </button>
      </div>

      {/* Calendar card */}
      <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-2xl flex flex-col overflow-hidden min-h-0">

        {/* Month navigation */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 shrink-0">
          <button onClick={prev} className="w-8 h-8 rounded-lg grid place-items-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-bold text-white w-40 text-center tracking-tight">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
          <button onClick={next} className="w-8 h-8 rounded-lg grid place-items-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isCurrentMonth && (
            <button onClick={goToday} className="ml-1 px-3 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/30 text-xs font-medium transition-all">
              {t('cal.today')}
            </button>
          )}
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-white/5 shrink-0">
          {DAYS.map((d, i) => (
            <div key={d} className={`py-2 text-center text-[11px] font-semibold tracking-widest uppercase ${i === 0 || i === 6 ? 'text-white/20' : 'text-white/25'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[#fc0ce4] animate-spin" />
            </div>
          ) : (
            weeks.map((week, wi) => {
              // Only regular (non-class) events get rendered as pills
              const nonClassEvents = events.filter(ev => ev.event_type !== 'class');
              const layouts        = layoutWeek(week, nonClassEvents);
              const visibleLayouts = layouts.filter(l => l.slot < MAX_VISIBLE_SLOTS);
              const overflowCounts = Array(7).fill(0) as number[];
              for (const l of layouts) {
                if (l.slot >= MAX_VISIBLE_SLOTS) {
                  for (let c = l.startCol; c < l.startCol + l.span; c++) overflowCounts[c]++;
                }
              }

              // Which columns have at least one class event this week?
              const hasClassOnCol = week.map(day => {
                const start = dayFloor(day);
                const end   = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
                return events.some(
                  ev => ev.event_type === 'class' &&
                        new Date(ev.start_time) <= end &&
                        new Date(ev.end_time)   >= start,
                );
              });

              const pillAreaH = MAX_VISIBLE_SLOTS * SLOT_H + 18;
              const rowH      = DAY_NUM_H + pillAreaH;

              return (
                <div key={wi} className={`relative ${wi < 5 ? 'border-b border-white/5' : ''}`} style={{ height: rowH }}>
                  {/* Clickable day backgrounds → Admin Day Modal */}
                  <div className="absolute inset-0 grid grid-cols-7">
                    {week.map((day, di) => (
                      <div
                        key={di}
                        onClick={() => void openAdminDayModal(day)}
                        className={`cursor-pointer transition-colors hover:bg-white/[0.025] ${di < 6 ? 'border-r border-white/5' : ''} ${di === 0 || di === 6 ? 'bg-white/[0.012]' : ''}`}
                      />
                    ))}
                  </div>

                  {/* Day numbers + "View classes" button */}
                  <div className="relative grid grid-cols-7 pointer-events-none" style={{ height: DAY_NUM_H }}>
                    {week.map((day, di) => {
                      const isToday    = sameDay(day, today);
                      const isCurMonth = day.getMonth() === viewMonth;
                      return (
                        <div key={di} className="px-2 pt-1.5 flex items-start justify-between gap-1">
                          {/* "View classes" label — pointer-events-auto so it's clickable inside the none parent */}
                          {hasClassOnCol[di] ? (
                            <button
                              onClick={e => { e.stopPropagation(); void openAdminDayModal(day); }}
                              className="pointer-events-auto flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#fc0ce4]/12 border border-[#fc0ce4]/20 text-[#fc0ce4] text-[9px] font-semibold hover:bg-[#fc0ce4]/22 transition-all leading-none mt-0.5 shrink-0 select-none"
                            >
                              <GraduationCap className="w-2.5 h-2.5 shrink-0" />
                              <span>View classes</span>
                            </button>
                          ) : (
                            <span />
                          )}
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium transition-all shrink-0 ${
                            isToday ? 'bg-[#fc0ce4] text-white font-bold shadow-[0_0_12px_rgba(252,12,228,0.5)]'
                              : isCurMonth ? 'text-white/55' : 'text-white/18'
                          }`}>
                            {day.getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Event pill layer — non-class events only */}
                  <div className="relative overflow-hidden" style={{ height: pillAreaH }}>
                    {visibleLayouts.map((layout, li) => (
                      <EventPill key={`${layout.event.id}-${li}`} layout={layout} onClick={openDetail} />
                    ))}
                    {overflowCounts.map((count, col) => count > 0 ? (
                      <div
                        key={`ov-${col}`}
                        style={{
                          position: 'absolute',
                          left: `calc(${(col / 7) * 100}% + 4px)`,
                          width: `calc(${100 / 7}% - 8px)`,
                          top: MAX_VISIBLE_SLOTS * SLOT_H + 1,
                        }}
                        onClick={e => { e.stopPropagation(); void openAdminDayModal(week[col]); }}
                        className="text-[10px] text-white/35 hover:text-white/70 font-medium px-1 leading-tight cursor-pointer select-none transition-colors z-20"
                      >
                        +{count} more
                      </div>
                    ) : null)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Admin Day Modal
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {adminDayOpen && (
          <>
            <motion.div
              key="day-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeAdminDayModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              key="day-modal"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-2xl bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto flex flex-col max-h-[88vh]"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                  {detailClass ? (
                    <button
                      onClick={() => { setDetailClass(null); setRescheduleMode(false); setConfirmCancel(false); }}
                      className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-medium"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to day
                    </button>
                  ) : (
                    <div>
                      <h2 className="text-base font-bold text-white">
                        {adminDayOpen.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </h2>
                      <p className="text-xs text-white/30 mt-0.5">
                        {adminDayClasses.length === 0 ? 'No classes' : `${adminDayClasses.length} class${adminDayClasses.length !== 1 ? 'es' : ''}`}
                      </p>
                    </div>
                  )}
                  <button onClick={closeAdminDayModal} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {adminDayLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-5 h-5 text-[#fc0ce4] animate-spin" />
                    </div>
                  ) : detailClass ? (
                    /* ── Class Detail Panel ───────────────────────────────────── */
                    <div className="p-5 space-y-4">
                      {/* Class info header */}
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/8">
                        <div className="w-10 h-10 rounded-xl bg-[#fc0ce4]/15 grid place-items-center shrink-0">
                          <GraduationCap className="w-5 h-5 text-[#fc0ce4]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-base truncate">{detailClass.className}</p>
                          <p className="text-sm text-white/40 mt-0.5">{detailClass.programName}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {detailClass.teacherName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {detailClass.startTime} – {detailClass.endTime}
                            </span>
                            {detailClass.isRescheduled && (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/20">
                                Rescheduled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Students & attendance */}
                      <div>
                        <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Users className="w-3 h-3" /> Students
                        </p>
                        {detailLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-4 h-4 text-[#fc0ce4] animate-spin" />
                          </div>
                        ) : detailStudents.length === 0 ? (
                          <p className="text-sm text-white/25 py-4 text-center">No students enrolled</p>
                        ) : (
                          <div className="space-y-1.5">
                            {detailStudents.map(s => (
                              <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-white/10 grid place-items-center">
                                  {s.avatar
                                    ? <img src={s.avatar} alt={s.name} className="w-full h-full object-cover" />
                                    : <span className="text-xs font-bold text-white/50">{s.name[0]?.toUpperCase()}</span>
                                  }
                                </div>
                                <p className="flex-1 text-sm text-white/70 truncate">{s.name}</p>
                                <AttBadge status={detailAttendance[s.id]} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t border-white/5 space-y-3">
                        {!rescheduleMode && !confirmCancel && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setRescheduleMode(true)}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-[#fc0ce4]/25 text-[#fc0ce4] hover:bg-[#fc0ce4]/10 transition-all"
                            >
                              <CalendarCheck className="w-4 h-4" />
                              Reschedule this class
                            </button>
                            <button
                              onClick={() => setConfirmCancel(true)}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-red-400/20 text-red-400 hover:bg-red-400/10 transition-all"
                            >
                              <CalendarX className="w-4 h-4" />
                              Cancel this class
                            </button>
                          </div>
                        )}

                        {/* Inline reschedule form */}
                        {rescheduleMode && (
                          <div className="p-4 rounded-xl border border-[#fc0ce4]/20 bg-[#fc0ce4]/5 space-y-3">
                            <p className="text-xs font-semibold text-[#fc0ce4] uppercase tracking-widest">Reschedule this occurrence</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <FieldLabel>New Date *</FieldLabel>
                                <input
                                  type="date"
                                  value={rescheduleForm.date}
                                  onChange={e => setRescheduleForm(f => ({ ...f, date: e.target.value }))}
                                  className={inputCls('[color-scheme:dark]')}
                                />
                              </div>
                              <div>
                                <FieldLabel>Start time</FieldLabel>
                                <input
                                  type="time"
                                  value={rescheduleForm.startTime}
                                  onChange={e => setRescheduleForm(f => ({ ...f, startTime: e.target.value }))}
                                  className={inputCls('[color-scheme:dark]')}
                                />
                              </div>
                              <div>
                                <FieldLabel>End time</FieldLabel>
                                <input
                                  type="time"
                                  value={rescheduleForm.endTime}
                                  onChange={e => setRescheduleForm(f => ({ ...f, endTime: e.target.value }))}
                                  className={inputCls('[color-scheme:dark]')}
                                />
                              </div>
                            </div>
                            <div>
                              <FieldLabel>Reason (optional)</FieldLabel>
                              <textarea
                                value={rescheduleReason}
                                onChange={e => setRescheduleReason(e.target.value)}
                                placeholder="Why is this class being rescheduled?"
                                rows={2}
                                className={inputCls('resize-none')}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setRescheduleMode(false); setRescheduleReason(''); }}
                                className="px-4 py-2 rounded-lg text-sm border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => void handleReschedule()}
                                disabled={rescheduleSaving || !rescheduleForm.date}
                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold bg-[#fc0ce4]/20 text-[#fc0ce4] border border-[#fc0ce4]/30 hover:bg-[#fc0ce4]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                              >
                                {rescheduleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Save reschedule
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Cancel confirm */}
                        {confirmCancel && (
                          <div className="p-4 rounded-xl border border-red-400/20 bg-red-400/5 space-y-3">
                            <p className="text-sm text-white/70">
                              Cancel <strong className="text-white">{detailClass.className}</strong> on{' '}
                              <strong className="text-white">{adminDayOpen?.toLocaleDateString([], { month: 'short', day: 'numeric' })}</strong>?
                              <br />
                              <span className="text-xs text-white/35">This only affects this single occurrence. Future classes are unaffected.</span>
                            </p>
                            <div>
                              <FieldLabel>Reason (optional)</FieldLabel>
                              <textarea
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                placeholder="Why is this class being cancelled?"
                                rows={2}
                                className={inputCls('resize-none')}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setConfirmCancel(false); setCancelReason(''); }}
                                className="px-4 py-2 rounded-lg text-sm border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all"
                              >
                                Keep it
                              </button>
                              <button
                                onClick={() => void handleCancelClass()}
                                disabled={cancelSaving}
                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold bg-red-400/20 text-red-400 border border-red-400/30 hover:bg-red-400/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                              >
                                {cancelSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarX className="w-4 h-4" />}
                                Yes, cancel class
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : adminDayClasses.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-20 text-white/20">
                      <BookOpen className="w-10 h-10 mb-3 opacity-40" />
                      <p className="text-sm font-medium">No classes scheduled for this day</p>
                      <p className="text-xs mt-1 opacity-60">Click "New Event" to add a calendar event</p>
                    </div>
                  ) : (
                    /* ── Degree / Program sections ───────────────────────────── */
                    <div className="p-4 space-y-2">
                      {groupedByProgram.map(({ programId, programName, classes }) => (
                        <div key={programId} className="rounded-xl border border-white/8 overflow-hidden">

                          {/* Degree header (clickable to expand) */}
                          <button
                            onClick={() => toggleDegree(programId)}
                            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <GraduationCap className="w-4 h-4 text-[#fc0ce4]" />
                              <span className="text-sm font-semibold text-white">{programName}</span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-white/40 font-medium">
                                {classes.length} class{classes.length !== 1 ? 'es' : ''}
                              </span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-white/30 transition-transform duration-200 ${expandedDegrees.has(programId) ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Expanded: class list + bulk actions */}
                          <AnimatePresence>
                            {expandedDegrees.has(programId) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="overflow-hidden border-t border-white/5"
                              >
                                <div className="p-3 space-y-1.5">
                                  {classes.map(cls => (
                                    <button
                                      key={cls.sessionId ?? `${cls.classId}-${cls.originalDate}-${cls.startTime}`}
                                      onClick={() => void openClassDetail(cls)}
                                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all text-left group"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors truncate">{cls.className}</p>
                                        <p className="text-xs text-white/35 mt-0.5">{cls.teacherName} · {cls.startTime} – {cls.endTime}</p>
                                      </div>
                                      {cls.isRescheduled && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/20 shrink-0 font-medium">
                                          Rescheduled
                                        </span>
                                      )}
                                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
                                    </button>
                                  ))}
                                </div>

                                {/* Bulk clear confirm */}
                                {bulkClearProgramId === programId ? (
                                  <div className="px-3 pb-3">
                                    <div className="p-3 rounded-xl border border-red-400/20 bg-red-400/5 space-y-2">
                                      <p className="text-xs text-white/60">
                                        Cancel all {classes.length} classes for this degree on this day?
                                      </p>
                                      <textarea
                                        value={bulkClearReason}
                                        onChange={e => setBulkClearReason(e.target.value)}
                                        placeholder="Reason (optional)"
                                        rows={2}
                                        className={inputCls('resize-none text-xs')}
                                      />
                                      <div className="flex gap-2">
                                        <button onClick={() => { setBulkClearProgramId(null); setBulkClearReason(''); }} className="text-xs text-white/40 hover:text-white px-2 py-1 rounded-lg border border-white/10 hover:border-white/20 transition-all">
                                          No
                                        </button>
                                        <button
                                          onClick={() => void handleBulkClear(programId)}
                                          disabled={bulkClearing}
                                          className="text-xs text-red-400 px-3 py-1 rounded-lg border border-red-400/25 bg-red-400/10 hover:bg-red-400/20 disabled:opacity-50 transition-all flex items-center gap-1"
                                        >
                                          {bulkClearing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                          Yes, clear
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  /* Bulk action buttons */
                                  <div className="flex gap-2 px-3 pb-3">
                                    <button
                                      onClick={() => setBulkClearProgramId(programId)}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-red-400/20 text-red-400 hover:bg-red-400/10 transition-all"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Clear day
                                    </button>
                                    <button
                                      onClick={() => startBulkReschedule(programId)}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-[#fc0ce4]/20 text-[#fc0ce4] hover:bg-[#fc0ce4]/10 transition-all"
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                      Bulk reschedule
                                    </button>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          Bulk Reschedule Modal
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {bulkOpen && (
          <ModalShell onClose={() => setBulkOpen(false)} wide>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h2 className="text-base font-bold text-white">
                  {bulkPhase === 'select' ? 'Select classes to reschedule' : `Reschedule class ${bulkCarouselIndex + 1} of ${bulkSelectedList.length}`}
                </h2>
                <p className="text-xs text-white/30 mt-0.5">
                  {adminDayOpen?.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setBulkOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {bulkPhase === 'select' ? (
                <div className="space-y-2">
                  {/* Select all */}
                  <button
                    onClick={() => {
                      if (bulkSelected.size === bulkDegreeClasses.length)
                        setBulkSelected(new Set());
                      else
                        setBulkSelected(new Set(bulkDegreeClasses.map(c => c.classId)));
                    }}
                    className="text-xs text-[#fc0ce4] hover:underline mb-1"
                  >
                    {bulkSelected.size === bulkDegreeClasses.length ? 'Deselect all' : 'Select all'}
                  </button>

                  {bulkDegreeClasses.map(cls => {
                    const checked = bulkSelected.has(cls.classId);
                    return (
                      <button
                        key={cls.classId}
                        onClick={() => {
                          setBulkSelected(prev => {
                            const next = new Set(prev);
                            if (next.has(cls.classId)) next.delete(cls.classId);
                            else next.add(cls.classId);
                            return next;
                          });
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                          checked
                            ? 'bg-[#fc0ce4]/10 border-[#fc0ce4]/30'
                            : 'bg-white/[0.03] border-white/8 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-all ${
                          checked ? 'bg-[#fc0ce4] border-[#fc0ce4]' : 'bg-white/5 border-white/20'
                        }`}>
                          {checked && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white/80 truncate">{cls.className}</p>
                          <p className="text-xs text-white/35">{cls.teacherName} · {cls.startTime} – {cls.endTime}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Carousel step */
                (() => {
                  const cls  = bulkSelectedList[bulkCarouselIndex];
                  const form = bulkForms.get(cls.classId) ?? { date: '', startTime: cls.startTime, endTime: cls.endTime };
                  return (
                    <div className="space-y-4">
                      {/* Class info */}
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/8">
                        <GraduationCap className="w-5 h-5 text-[#fc0ce4] shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white">{cls.className}</p>
                          <p className="text-xs text-white/40 mt-0.5">{cls.teacherName} · Originally {cls.startTime} – {cls.endTime}</p>
                        </div>
                      </div>

                      {/* Step progress dots */}
                      <div className="flex items-center gap-1.5 justify-center">
                        {bulkSelectedList.map((_, i) => (
                          <div key={i} className={`h-1.5 rounded-full transition-all ${i === bulkCarouselIndex ? 'w-6 bg-[#fc0ce4]' : 'w-1.5 bg-white/15'}`} />
                        ))}
                      </div>

                      {/* New date/time */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <FieldLabel>New Date *</FieldLabel>
                          <input
                            type="date"
                            value={form.date}
                            onChange={e => {
                              const v = e.target.value;
                              setBulkForms(prev => {
                                const next = new Map(prev);
                                next.set(cls.classId, { ...form, date: v });
                                return next;
                              });
                            }}
                            className={inputCls('[color-scheme:dark]')}
                          />
                        </div>
                        <div>
                          <FieldLabel>Start time</FieldLabel>
                          <input
                            type="time"
                            value={form.startTime}
                            onChange={e => {
                              const v = e.target.value;
                              setBulkForms(prev => {
                                const next = new Map(prev);
                                next.set(cls.classId, { ...form, startTime: v });
                                return next;
                              });
                            }}
                            className={inputCls('[color-scheme:dark]')}
                          />
                        </div>
                        <div>
                          <FieldLabel>End time</FieldLabel>
                          <input
                            type="time"
                            value={form.endTime}
                            onChange={e => {
                              const v = e.target.value;
                              setBulkForms(prev => {
                                const next = new Map(prev);
                                next.set(cls.classId, { ...form, endTime: v });
                                return next;
                              });
                            }}
                            className={inputCls('[color-scheme:dark]')}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Reason field — shown in carousel phase on the last step */}
            {bulkPhase === 'carousel' && bulkCarouselIndex === bulkSelectedList.length - 1 && (
              <div className="px-6 pb-4">
                <FieldLabel>Reason for rescheduling (optional)</FieldLabel>
                <textarea
                  value={bulkReason}
                  onChange={e => setBulkReason(e.target.value)}
                  placeholder="Why are these classes being rescheduled?"
                  rows={2}
                  className={inputCls('resize-none')}
                />
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between gap-3">
              {bulkPhase === 'select' ? (
                <>
                  <span className="text-xs text-white/30">{bulkSelected.size} selected</span>
                  <div className="flex gap-2">
                    <button onClick={() => setBulkOpen(false)} className="px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm transition-all">
                      Cancel
                    </button>
                    <button
                      onClick={() => { setBulkCarouselIndex(0); setBulkPhase('carousel'); }}
                      disabled={bulkSelected.size === 0}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#fc0ce4]/20 transition-all"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (bulkCarouselIndex > 0) setBulkCarouselIndex(i => i - 1);
                      else setBulkPhase('select');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {bulkCarouselIndex === 0 ? 'Back to selection' : 'Previous'}
                  </button>

                  {bulkCarouselIndex < bulkSelectedList.length - 1 ? (
                    <button
                      onClick={() => setBulkCarouselIndex(i => i + 1)}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold hover:shadow-lg hover:shadow-[#fc0ce4]/20 transition-all"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleBulkSave()}
                      disabled={bulkSaving}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold disabled:opacity-50 hover:shadow-lg hover:shadow-[#fc0ce4]/20 transition-all"
                    >
                      {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Save all
                    </button>
                  )}
                </>
              )}
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          Create Event Modal
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCreate && (
          <ModalShell onClose={() => setShowCreate(false)}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-base font-bold text-white">{t('cal.new_event')}</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div>
                <FieldLabel>{t('cal.event_title')} *</FieldLabel>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={t('cal.title_placeholder')} autoFocus className={inputCls()} />
              </div>
              <div>
                <FieldLabel>{t('cal.description')}</FieldLabel>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('cal.desc_placeholder')} rows={2} className={inputCls('resize-none')} />
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <button type="button" onClick={() => setForm(f => ({ ...f, allDay: !f.allDay }))}
                  className={`relative w-10 h-[22px] rounded-full transition-colors ${form.allDay ? 'bg-[#fc0ce4]' : 'bg-white/10'}`}>
                  <div className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${form.allDay ? 'translate-x-[18px]' : ''}`} />
                </button>
                <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors">{t('cal.all_day')}</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel>{t('cal.start')}</FieldLabel>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls('[color-scheme:dark]')} />
                  {!form.allDay && <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className={inputCls('[color-scheme:dark]')} />}
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t('cal.end')}</FieldLabel>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inputCls('[color-scheme:dark]')} />
                  {!form.allDay && <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className={inputCls('[color-scheme:dark]')} />}
                </div>
              </div>

              <div>
                <FieldLabel>{t('cal.color')}</FieldLabel>
                <div className="flex gap-2.5 mt-1">
                  {EVENT_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full transition-all hover:scale-110 active:scale-95 ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f0f0f] scale-110' : ''}`} />
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel><span className="flex items-center gap-1.5"><Users className="w-3 h-3" />{t('cal.participants')}</span></FieldLabel>
                <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-3">
                  {(['everyone', 'all_admins', 'all_teachers', 'custom'] as const).map(mode => (
                    <button key={mode} type="button" onClick={() => void changeAudience(mode)} disabled={loadingAudience}
                      className={`flex-1 px-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${audienceMode === mode ? 'bg-[#fc0ce4]/20 text-[#fc0ce4] border border-[#fc0ce4]/30' : 'text-white/40 hover:text-white/60'}`}>
                      {t(`cal.${mode}`)}
                    </button>
                  ))}
                </div>

                {audienceMode === 'custom' && (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                      <input type="email" value={emailInput}
                        onChange={e => { setEmailInput(e.target.value); setEmailError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addParticipant(); } }}
                        placeholder={t('cal.email_placeholder')} className={inputCls('pl-8')} />
                    </div>
                    <button onClick={() => void addParticipant()} disabled={lookingUp || !emailInput.trim()}
                      className="px-3.5 rounded-xl bg-[#fc0ce4]/15 border border-[#fc0ce4]/25 text-[#fc0ce4] hover:bg-[#fc0ce4]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {emailError && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />{emailError}
                  </p>
                )}
                {loadingAudience && (
                  <div className="mt-2 flex items-center gap-2 text-white/40 text-xs py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />{t('cal.loading_participants')}
                  </div>
                )}
                {!loadingAudience && participants.length > 0 && (
                  <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                    {participants.map(p => (
                      <ParticipantBadge key={p.email} email={p.email} name={p.name}
                        onRemove={audienceMode === 'custom' ? () => setParticipants(ps => ps.filter(x => x.email !== p.email)) : undefined} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-3">
              {createError && (
                <p className="flex-1 text-xs text-red-400 flex items-center gap-1.5 mr-3">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{createError}
                </p>
              )}
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm transition-all">
                {t('registrations.cancel')}
              </button>
              <button onClick={() => void createEvent()} disabled={saving || !form.title.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#fc0ce4]/20 transition-all">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t('cal.create_event')}
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          Regular Event Detail Modal
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDetail && selEvent && (
          <ModalShell onClose={() => setShowDetail(false)}>
            <div style={{ backgroundColor: selEvent.color }} className="h-1 w-full" />

            <div className="flex items-start justify-between px-6 pt-5 pb-3">
              <div className="flex-1 pr-4">
                <h2 className="text-lg font-bold text-white leading-snug">{selEvent.title}</h2>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <span className="text-sm text-white/40">{fmtDateRange(selEvent.start_time, selEvent.end_time, selEvent.all_day)}</span>
                </div>
              </div>
              <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 pb-5 space-y-4">
              {selEvent.description && <p className="text-sm text-white/55 leading-relaxed">{selEvent.description}</p>}

              {user && selEvent.created_by !== user.id && selEvent.creator_profile && (() => {
                const org     = selEvent.creator_profile;
                const initial = org.firstName[0]?.toUpperCase() ?? '?';
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-2">{t('cal.organizer')}</p>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                      <div className="w-6 h-6 rounded-full bg-[#fc0ce4]/20 grid place-items-center shrink-0">
                        <span className="text-[10px] font-bold text-[#fc0ce4]">{initial}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/80 truncate">{org.firstName} {org.lastName}</p>
                        <p className="text-[11px] text-white/40 truncate">{org.email}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const others = selEvent.participants?.filter(p => p.user_id !== selEvent.created_by) ?? [];
                if (!others.length) return null;
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                      <Users className="w-3 h-3" />{t('cal.participants')} ({others.length})
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                      {others.map(p => {
                        const name    = p.profile ? `${p.profile.firstName} ${p.profile.lastName}` : undefined;
                        const initial = (name ?? p.profile?.email ?? '?')[0]?.toUpperCase() ?? '?';
                        const status  = p.rsvp_status ?? 'pending';
                        return (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                            <div className="w-6 h-6 rounded-full bg-[#fc0ce4]/20 grid place-items-center shrink-0">
                              <span className="text-[10px] font-bold text-[#fc0ce4]">{initial}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              {name && <p className="text-xs font-medium text-white/80 truncate">{name}</p>}
                              <p className="text-[11px] text-white/40 truncate">{p.profile?.email ?? ''}</p>
                            </div>
                            {status === 'attending' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                            {status === 'pending'   && <Minus        className="w-4 h-4 text-white/25 shrink-0" />}
                            {status === 'declined'  && <XCircle      className="w-4 h-4 text-red-400 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {user && selEvent.created_by !== user.id && selEvent.participants?.some(p => p.user_id === user.id) && (() => {
                const mine     = selEvent.participants!.find(p => p.user_id === user.id);
                const myStatus = mine?.rsvp_status ?? 'pending';
                return (
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-2">{t('cal.your_response')}</p>
                    <div className="flex gap-2">
                      <button onClick={() => void updateRsvp('attending')} disabled={updatingRsvp}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${myStatus === 'attending' ? 'bg-emerald-400/15 border-emerald-400/40 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40 hover:border-emerald-400/30 hover:text-emerald-400'}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('cal.rsvp_attending')}
                      </button>
                      <button onClick={() => void updateRsvp('pending')} disabled={updatingRsvp}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${myStatus === 'pending' ? 'bg-white/10 border-white/30 text-white/60' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'}`}>
                        <Minus className="w-3.5 h-3.5" /> {t('cal.rsvp_pending')}
                      </button>
                      <button onClick={() => void updateRsvp('declined')} disabled={updatingRsvp}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${myStatus === 'declined' ? 'bg-red-400/15 border-red-400/40 text-red-400' : 'bg-white/5 border-white/10 text-white/40 hover:border-red-400/30 hover:text-red-400'}`}>
                        <XCircle className="w-3.5 h-3.5" /> {t('cal.rsvp_declined')}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {user && selEvent.created_by === user.id && (
                <div className="pt-2 border-t border-white/5 flex justify-end">
                  <button onClick={() => void deleteEvent()} disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 disabled:opacity-50 transition-all">
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {t('cal.delete_event')}
                  </button>
                </div>
              )}
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}
