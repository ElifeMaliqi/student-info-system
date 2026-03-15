import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Plus, X, Clock,
  Trash2, Loader2, Check, GraduationCap, StickyNote, AlertCircle, CheckCircle2, XCircle, Minus,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';
import type { CalendarEvent } from '../types';
import { ClassAttendanceModal } from '../components/ClassAttendanceModal';

// ── Constants ──────────────────────────────────────────────────────────────────

const EVENT_COLORS = [
  '#fc0ce4', '#949ce4', '#10b981', '#f59e0b', '#3b82f6', '#ef4444',
] as const;
type EventColor = typeof EVENT_COLORS[number];

const CLASS_COLOR = '#10b981';
const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
] as const;

const DAY_NUM_H        = 34;
const SLOT_H           = 22;
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
    const de = e.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    return `${ds} – ${de}`;
  }
  if (sameDay(s, e)) return `${ds} · ${fmtTime(start)} – ${fmtTime(end)}`;
  const de = e.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${ds} ${fmtTime(start)} – ${de} ${fmtTime(end)}`;
}

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
    const eStart = dayFloor(new Date(ev.start_time));
    const eEnd   = dayFloor(new Date(ev.end_time));
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

    const span = endCol - startCol + 1;
    const slotsNeeded = ev.event_type === 'class' ? 2 : 1;
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
  key?: React.Key;
  layout: EventLayout;
  onClick: (ev: CalendarEvent, e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const { event, startCol, span, slot, continuesLeft, continuesRight } = layout;
  const isClass  = event.event_type === 'class';
  const color    = isClass ? CLASS_COLOR : event.color;
  const leftPct  = (startCol / 7) * 100;
  const widthPct = (span / 7) * 100;
  const padL     = continuesLeft  ? 0 : 3;
  const padR     = continuesRight ? 0 : 3;
  const radius   = continuesLeft
    ? (continuesRight ? '0px' : '0 4px 4px 0')
    : (continuesRight ? '4px 0 0 4px' : '4px');
  
  // Class events are larger and more prominent
  const heightMultiplier = isClass ? 2 : 1;
  const fontSize = isClass ? 'text-xs' : 'text-[11px]';
  const fontWeight = isClass ? 'font-bold' : 'font-semibold';
  const borderWidth = isClass ? '4px' : '3px';
  const opacity = isClass ? 0.5 : 0.28;

  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(event, e); }}
      style={{
        position:        'absolute',
        left:            `calc(${leftPct}% + ${padL}px)`,
        width:           `calc(${widthPct}% - ${padL}px - ${padR}px)`,
        top:             `${slot * SLOT_H + 2}px`,
        height:          `${(SLOT_H - 4) * heightMultiplier}px`,
        backgroundColor: color + (opacity * 100).toFixed(0),
        borderLeft:      continuesLeft ? 'none' : `${borderWidth} solid ${color}`,
        borderRadius:    radius,
        boxShadow:       isClass ? `0 4px 12px ${color}33` : 'none'
      }}
      className={`flex items-center px-2 cursor-pointer hover:brightness-125 transition-all z-20 select-none overflow-hidden`}
      title={event.title}
    >
      {isClass && <GraduationCap style={{ color }} className={`w-3.5 h-3.5 mr-1.5 shrink-0`} />}
      {!isClass && event.description && <StickyNote style={{ color }} className="w-2.5 h-2.5 mr-1 shrink-0 opacity-60" />}
      <span style={{ color }} className={`${fontSize} ${fontWeight} truncate leading-tight`}>
        {!continuesLeft && !event.all_day && (
          <span className="opacity-70 mr-1 font-normal text-[10px]">{fmtTime(event.start_time)}</span>
        )}
        {event.title}
      </span>
    </div>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{ opacity: 0,    scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="w-full max-w-lg bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
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

// ── Main component ─────────────────────────────────────────────────────────────

interface CreateForm {
  title:       string;
  note:        string;
  allDay:      boolean;
  startDate:   string;
  startTime:   string;
  endDate:     string;
  endTime:     string;
  color:       EventColor;
}

export default function StudentCalendar() {
  const today = useMemo(() => new Date(), []);

  const [viewYear,  setViewYear ] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events,    setEvents   ] = useState<CalendarEvent[]>([]);
  const [loading,   setLoading  ] = useState(true);

  // ── Create modal ──────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [saving,     setSaving    ] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form,       setForm      ] = useState<CreateForm>({
    title: '', note: '', allDay: false,
    startDate: '', startTime: '09:00',
    endDate:   '', endTime:   '10:00',
    color: EVENT_COLORS[0],
  });

  // ── Detail modal ──────────────────────────────────────────────────────────
  const [showDetail, setShowDetail] = useState(false);
  const [selEvent,   setSelEvent  ] = useState<CalendarEvent | null>(null);
  const [deleting,   setDeleting  ] = useState(false);
  const [updatingRsvp, setUpdatingRsvp] = useState(false);
  const [dayViewDay, setDayViewDay] = useState<Date | null>(null);
  const [classAttEvent, setClassAttEvent] = useState<CalendarEvent | null>(null);

  const { t } = useLanguage();
  const { user } = useUser();

  const gridDays = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const weeks    = useMemo<Date[][]>(() => {
    const ws: Date[][] = [];
    for (let i = 0; i < 42; i += 7) ws.push(gridDays.slice(i, i + 7));
    return ws;
  }, [gridDays]);

  useEffect(() => { void loadEvents(); }, [viewYear, viewMonth]);

  async function loadEvents() {
    setLoading(true);
    try { setEvents(await api.calendar.getEvents(viewYear, viewMonth)); }
    catch (e) { console.error(e); }
    finally   { setLoading(false); }
  }

  function prev() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function next() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }
  function goToday() { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }

  function openCreate(date: Date) {
    setForm({
      title: '', note: '', allDay: false,
      startDate: toInputDate(date), startTime: '09:00',
      endDate:   toInputDate(date), endTime:   '10:00',
      color: EVENT_COLORS[0],
    });
    setCreateError('');
    setShowCreate(true);
  }

  function openDetail(ev: CalendarEvent, e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (ev.event_type === 'class' && ev.class_id) {
      setClassAttEvent(ev);
    } else {
      setSelEvent(ev);
      setShowDetail(true);
    }
  }

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
        title:       form.title.trim(),
        description: form.note.trim() || undefined,
        start_time:  start,
        end_time:    end,
        all_day:     form.allDay,
        color:       form.color,
        event_type:  'personal',
      });
      setShowCreate(false);
      void loadEvents();
    } catch (e) {
      console.error(e);
      setCreateError(e instanceof Error ? e.message : 'Failed to create event. Please try again.');
    }
    finally     { setSaving(false); }
  }

  async function deleteEvent() {
    if (!selEvent) return;
    setDeleting(true);
    try {
      await api.calendar.deleteEvent(selEvent.id);
      setShowDetail(false);
      setSelEvent(null);
      void loadEvents();
    } catch (e) { console.error(e); }
    finally     { setDeleting(false); }
  }

  async function updateRsvp(status: 'attending' | 'pending' | 'declined') {
    if (!selEvent || !user) return;
    setUpdatingRsvp(true);
    try {
      await api.calendar.updateRsvp(selEvent.id, status);
      setSelEvent(prev => prev ? {
        ...prev,
        participants: prev.participants?.map(p =>
          p.user_id === user.id ? { ...p, rsvp_status: status } : p
        ),
      } : prev);
      void loadEvents();
    } catch (e) { console.error(e); }
    finally     { setUpdatingRsvp(false); }
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
          <p className="text-white/40 text-sm mt-0.5">{t('cal.student_desc')}</p>
        </div>
        <button
          onClick={() => openCreate(today)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold shadow-lg hover:shadow-[#fc0ce4]/25 hover:scale-105 active:scale-100 transition-all"
        >
          <Plus className="w-4 h-4" />
          {t('cal.add_note')}
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <GraduationCap className="w-3.5 h-3.5" style={{ color: CLASS_COLOR }} />
          <span className="text-xs text-white/40">{t('cal.class_event')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5 text-[#fc0ce4]/60" />
          <span className="text-xs text-white/40">{t('cal.personal_note')}</span>
        </div>
      </div>

      {/* Calendar card */}
      <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-2xl flex flex-col overflow-hidden min-h-0">

        {/* Month navigator */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              className="p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={next}
              className="p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <h2 className="text-base font-bold text-white">
              {MONTHS[viewMonth]} {viewYear}
            </h2>
          </div>
          {!isCurrentMonth && (
            <button
              onClick={goToday}
              className="px-3 py-1 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs transition-all"
            >
              {t('cal.today')}
            </button>
          )}
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-white/5 shrink-0">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-white/25 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-white/30 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <div>
              {weeks.map((week, wi) => {
                const layouts        = layoutWeek(week, events);
                const visibleLayouts = layouts.filter(l => l.slot < MAX_VISIBLE_SLOTS);
                const overflowCounts = Array(7).fill(0) as number[];
                for (const l of layouts) {
                  if (l.slot >= MAX_VISIBLE_SLOTS) {
                    for (let c = l.startCol; c < l.startCol + l.span; c++) overflowCounts[c]++;
                  }
                }
                const rowH = DAY_NUM_H + MAX_VISIBLE_SLOTS * SLOT_H + 18;

                return (
                  <div
                    key={wi}
                    className="grid grid-cols-7 border-b border-white/5 last:border-0 relative"
                    style={{ height: `${rowH}px` }}
                  >
                    {/* Day cells */}
                    {week.map((day, di) => {
                      const isCur  = sameDay(day, today);
                      const isThis = day.getMonth() === viewMonth;
                      return (
                        <div
                          key={di}
                          onClick={() => openCreate(day)}
                          className={`border-r border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.02] transition-colors ${
                            !isThis ? 'opacity-30' : ''
                          }`}
                        >
                          <div className="px-2 pt-1.5 pb-0.5 flex" style={{ height: `${DAY_NUM_H}px` }}>
                            <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                              isCur
                                ? 'bg-[#fc0ce4] text-white'
                                : 'text-white/40'
                            }`}>
                              {day.getDate()}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Event pills */}
                    <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ top: `${DAY_NUM_H}px` }}>
                      {visibleLayouts.map((l, i) => (
                        <EventPill
                          key={`${l.event.id}-${i}`}
                          layout={l}
                          onClick={openDetail}
                        />
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
                          onClick={(e) => { e.stopPropagation(); setDayViewDay(week[col]); }}
                          className="text-[10px] text-white/35 hover:text-white/70 font-medium px-1 leading-tight cursor-pointer select-none transition-colors z-20"
                        >
                          +{count} more
                        </div>
                      ) : null)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Note / Personal Event Modal ────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <ModalShell onClose={() => setShowCreate(false)}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-[#fc0ce4]" />
                <h2 className="text-base font-bold text-white">{t('cal.add_note')}</h2>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">

              {/* Title */}
              <div>
                <FieldLabel>{t('cal.event_title')} *</FieldLabel>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={t('cal.title_placeholder')}
                  autoFocus
                  className={inputCls()}
                />
              </div>

              {/* Note */}
              <div>
                <FieldLabel>{t('cal.note')}</FieldLabel>
                <textarea
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder={t('cal.note_placeholder')}
                  rows={3}
                  className={inputCls('resize-none')}
                />
              </div>

              {/* All-day toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, allDay: !f.allDay }))}
                  className={`relative w-10 h-[22px] rounded-full transition-colors ${
                    form.allDay ? 'bg-[#fc0ce4]' : 'bg-white/10'
                  }`}
                >
                  <div className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    form.allDay ? 'translate-x-[18px]' : ''
                  }`} />
                </button>
                <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors">
                  {t('cal.all_day')}
                </span>
              </label>

              {/* Date / time pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel>{t('cal.start')}</FieldLabel>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className={inputCls('[color-scheme:dark]')}
                  />
                  {!form.allDay && (
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                      className={inputCls('[color-scheme:dark]')}
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>{t('cal.end')}</FieldLabel>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className={inputCls('[color-scheme:dark]')}
                  />
                  {!form.allDay && (
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                      className={inputCls('[color-scheme:dark]')}
                    />
                  )}
                </div>
              </div>

              {/* Color swatches */}
              <div>
                <FieldLabel>{t('cal.color')}</FieldLabel>
                <div className="flex gap-2.5 mt-1">
                  {EVENT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full transition-all hover:scale-110 active:scale-95 ${
                        form.color === c
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f0f0f] scale-110'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-3">
              {createError && (
                <p className="flex-1 text-xs text-red-400 flex items-center gap-1.5 mr-3">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {createError}
                </p>
              )}
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm transition-all"
              >
                {t('registrations.cancel')}
              </button>
              <button
                onClick={() => void createEvent()}
                disabled={saving || !form.title.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#fc0ce4]/20 transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t('cal.save_note')}
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ── Event Detail Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDetail && selEvent && (
          <ModalShell onClose={() => setShowDetail(false)}>
            {/* Colour accent stripe */}
            <div
              style={{ backgroundColor: selEvent.event_type === 'class' ? CLASS_COLOR : selEvent.color }}
              className="h-1 w-full"
            />

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-3">
              <div className="flex-1 pr-4">
                {selEvent.event_type === 'class' && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <GraduationCap className="w-3.5 h-3.5" style={{ color: CLASS_COLOR }} />
                    <span
                      className="text-[11px] font-semibold uppercase tracking-widest"
                      style={{ color: CLASS_COLOR }}
                    >
                      {t('cal.class_event')}
                    </span>
                  </div>
                )}
                {selEvent.event_type !== 'class' && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <StickyNote className="w-3.5 h-3.5" style={{ color: selEvent.color }} />
                    <span
                      className="text-[11px] font-semibold uppercase tracking-widest"
                      style={{ color: selEvent.color }}
                    >
                      {t('cal.personal_note')}
                    </span>
                  </div>
                )}
                <h2 className="text-lg font-bold text-white leading-snug">{selEvent.title}</h2>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <span className="text-sm text-white/40">
                    {fmtDateRange(selEvent.start_time, selEvent.end_time, selEvent.all_day)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 pb-5 space-y-4">
              {/* Description / note */}
              {selEvent.description && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8">
                  <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <StickyNote className="w-3 h-3" />
                    {t('cal.note')}
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                    {selEvent.description}
                  </p>
                </div>
              )}

              {/* Organizer — only shown to non-creators */}
              {user && selEvent.created_by !== user.id && selEvent.creator_profile && (() => {
                const org = selEvent.creator_profile;
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#fc0ce4]/10 text-[#fc0ce4] font-semibold uppercase tracking-wider shrink-0">
                        {t('cal.organizer')}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Class participants list */}
              {selEvent.event_type === 'class' && (() => {
                const others = selEvent.participants?.filter(p => p.user_id !== selEvent.created_by) ?? [];
                if (!others.length) return null;
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {t('cal.students_in_class')} ({others.length})
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                      {others.map(p => {
                        const name = p.profile ? `${p.profile.firstName} ${p.profile.lastName}` : undefined;
                        const initial = (name ?? p.profile?.email ?? '?')[0]?.toUpperCase() ?? '?';
                        const status = p.rsvp_status ?? 'pending';
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

              {/* RSVP buttons — for participants who are not the creator */}
              {user && selEvent.created_by !== user.id && selEvent.participants?.some(p => p.user_id === user.id) && (() => {
                const mine     = selEvent.participants!.find(p => p.user_id === user.id);
                const myStatus = mine?.rsvp_status ?? 'pending';
                return (
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-2">{t('cal.your_response')}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => void updateRsvp('attending')}
                        disabled={updatingRsvp}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${myStatus === 'attending' ? 'bg-emerald-400/15 border-emerald-400/40 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40 hover:border-emerald-400/30 hover:text-emerald-400'}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('cal.rsvp_attending')}
                      </button>
                      <button
                        onClick={() => void updateRsvp('pending')}
                        disabled={updatingRsvp}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${myStatus === 'pending' ? 'bg-white/10 border-white/30 text-white/60' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'}`}
                      >
                        <Minus className="w-3.5 h-3.5" /> {t('cal.rsvp_pending')}
                      </button>
                      <button
                        onClick={() => void updateRsvp('declined')}
                        disabled={updatingRsvp}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${myStatus === 'declined' ? 'bg-red-400/15 border-red-400/40 text-red-400' : 'bg-white/5 border-white/10 text-white/40 hover:border-red-400/30 hover:text-red-400'}`}
                      >
                        <XCircle className="w-3.5 h-3.5" /> {t('cal.rsvp_declined')}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Personal events: delete button */}
              {user && selEvent.created_by === user.id && selEvent.event_type !== 'class' && (
                <div className="pt-2 border-t border-white/5 flex justify-end">
                  <button
                    onClick={() => void deleteEvent()}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 disabled:opacity-50 transition-all"
                  >
                    {deleting
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2  className="w-3.5 h-3.5" />
                    }
                    {t('cal.delete_note')}
                  </button>
                </div>
              )}
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* ── Day View Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {dayViewDay && (() => {
          const dayEvs = eventsOnDay(dayViewDay);
          return (
            <ModalShell onClose={() => setDayViewDay(null)}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {dayViewDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h2>
                  <p className="text-xs text-white/30 mt-0.5">
                    {dayEvs.length} {dayEvs.length === 1 ? 'event' : 'events'}
                  </p>
                </div>
                <button
                  onClick={() => setDayViewDay(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-3 space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {dayEvs.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => { setDayViewDay(null); setSelEvent(ev); setShowDetail(true); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors text-left group"
                  >
                    <div style={{ backgroundColor: ev.event_type === 'class' ? CLASS_COLOR : ev.color }} className="w-1 h-8 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/80 group-hover:text-white truncate transition-colors">
                        {ev.title}
                      </p>
                      <p className="text-[11px] text-white/35 truncate">
                        {ev.all_day ? 'All day' : `${fmtTime(ev.start_time)} – ${fmtTime(ev.end_time)}`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            </ModalShell>
          );
        })()}
      </AnimatePresence>

      {/* ── Class Attendance Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {classAttEvent && user && (
          <ClassAttendanceModal
            event={classAttEvent}
            viewerRole="student"
            viewerUserId={user.id}
            onClose={() => setClassAttEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
