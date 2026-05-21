'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Mail, Phone, MapPin, BookOpen, CreditCard, Edit2, CheckCircle, XCircle, Loader2, X, Clock, BarChart2, GraduationCap, FileText, CheckCircle2, Calendar } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { api } from '../services/api';

interface ProjectGrade {
  tableName: string;
  className: string;
  teacherName: string;
  totalPoints: number | null;
  passed: boolean | null;
  gradedAt: string | null;
  note: string | null;
}

interface ClassEnrollmentInfo {
  classId: string;
  className: string;
  programName: string;
  enrolledAt: string;
}

interface AttendanceRecord {
  classId: string;
  className: string;
  date: string;
  status: 'present' | 'absent' | 'late';
}

interface StudentData {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  program: string;
  status: string;
  date: string;
  avatar: string;
  attendance: number | null;
}

export default function StudentProfile() {
  const params = useParams();
  const id = params?.['id'] as string;
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useUser();
  const isTeacher = user?.role === 'teacher';

  const [student, setStudent] = useState<StudentData | null>(null);
  const [projectGrades, setProjectGrades] = useState<ProjectGrade[]>([]);
  const [classEnrollments, setClassEnrollments] = useState<ClassEnrollmentInfo[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState<{ type: string; title: string; content: Record<string, string> } | null>(null);
  const [gradeModal, setGradeModal] = useState<ProjectGrade | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        const profile = await loadStudentProfile(id);
        setStudent(profile);

        const [grades, attRecords, enrollments] = await Promise.all([
          api.gradeTables.getForStudent(id),
          api.classAttendance.getForStudent(id),
          loadClassEnrollments(id),
        ]);
        setProjectGrades(grades);
        setAttendanceRecords(attRecords);
        setClassEnrollments(enrollments);

        // Check current month invoice status
        try {
          const invoices = await api.finance.getInvoices(id);
          const now = new Date();
          const thisMonth = now.getMonth() + 1;
          const thisYear = now.getFullYear();
          const monthInvoices = (invoices || []).filter((i: any) => i.month === thisMonth && i.year === thisYear);
          if (monthInvoices.length === 0) {
            setPaymentStatus(null);
          } else {
            const allPaid = monthInvoices.every((i: any) => i.status === 'paid');
            setPaymentStatus(allPaid ? 'paid' : 'pending');
          }
        } catch {
          setPaymentStatus(null);
        }
      } catch (err) {
        console.error('Failed to load student profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-20 text-white/40">
        <p>Student not found.</p>
        <button onClick={() => router.push('/students')} className="mt-4 text-sm text-[#fc0ce4] hover:underline">Back to Students</button>
      </div>
    );
  }

  const passedCount = projectGrades.filter(g => g.passed === true).length;
  const failedCount = projectGrades.filter(g => g.passed === false).length;

  const attPresent = attendanceRecords.filter(r => r.status === 'present').length;
  const attLate = attendanceRecords.filter(r => r.status === 'late').length;
  const attAbsent = attendanceRecords.filter(r => r.status === 'absent').length;
  const attTotal = attendanceRecords.length;
  const attPct = attTotal > 0 ? Math.round(((attPresent + attLate) / attTotal) * 100) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.push('/students')}
          className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('profile.back')}
        </button>
        {!isTeacher && (
          <button className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2">
            <Edit2 className="w-4 h-4" />
            {t('profile.edit')}
          </button>
        )}
      </div>

      {/* Main Profile Card */}
      <div className="glass-card rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#fc0ce4]/10 to-transparent rounded-bl-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
          <img 
            src={student.avatar} 
            alt={student.name} 
            className="w-32 h-32 rounded-2xl border-4 border-white/10 object-cover shadow-2xl"
            referrerPolicy="no-referrer"
          />
          
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display text-3xl font-medium tracking-tight text-white">{student.name}</h1>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                  student.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {t(`status.${student.status.toLowerCase()}`)}
                </span>
              </div>
              <p className="text-white/50 font-mono text-sm">{student.id}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-3 text-sm text-white/70">
                <Mail className="w-4 h-4 text-white/40" />
                {student.email}
              </div>
              {student.phone && (
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <Phone className="w-4 h-4 text-white/40" />
                  {student.phone}
                </div>
              )}
              {student.address && (
                <div className="flex items-center gap-3 text-sm text-white/70 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-white/40" />
                  {student.address}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content - Left 2 columns */}
        <div className="md:col-span-2 space-y-6">

          {/* Classes & Enrollment */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-display text-lg font-medium mb-4 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-400" />
              Classes &amp; Enrollment
            </h2>
            {classEnrollments.length === 0 ? (
              <p className="text-white/30 text-sm py-4 text-center">No class enrollments found.</p>
            ) : (
              <div className="space-y-2">
                {classEnrollments.map(ce => (
                  <div key={ce.classId} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div>
                      <div className="text-sm font-medium text-white/90">{ce.className}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">{ce.programName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/50">Enrolled</div>
                      <div className="text-xs text-white/70 font-medium">{ce.enrolledAt}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance Breakdown */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-display text-lg font-medium mb-4 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#fc0ce4]" />
              Attendance
            </h2>

            {attTotal === 0 ? (
              <p className="text-white/30 text-sm py-4 text-center">No attendance records.</p>
            ) : (
              <>
                {/* Summary stats */}
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-center">
                    <div className="text-lg font-display font-medium text-white">{attPct}%</div>
                    <div className="text-[10px] text-white/40 uppercase tracking-widest">Rate</div>
                  </div>
                  <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/15 text-center">
                    <div className="text-lg font-display font-medium text-emerald-400">{attPresent}</div>
                    <div className="text-[10px] text-emerald-400/60 uppercase tracking-widest">Present</div>
                  </div>
                  <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/15 text-center">
                    <div className="text-lg font-display font-medium text-amber-400">{attLate}</div>
                    <div className="text-[10px] text-amber-400/60 uppercase tracking-widest">Late</div>
                  </div>
                  <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/15 text-center">
                    <div className="text-lg font-display font-medium text-red-400">{attAbsent}</div>
                    <div className="text-[10px] text-red-400/60 uppercase tracking-widest">Absent</div>
                  </div>
                </div>

                {/* Record list */}
                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1.5">
                  {attendanceRecords.map((r, i) => {
                    const dateObj = new Date(`${r.date}T12:00:00`);
                    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    return (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                        <div className="flex items-center gap-3">
                          {r.status === 'present' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {r.status === 'late' && <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          {r.status === 'absent' && <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                          <div>
                            <span className="text-xs text-white/70">{dateStr}</span>
                            <span className="text-[11px] text-white/30 ml-2">{r.className}</span>
                          </div>
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                          r.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          r.status === 'late' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Final Project Grades */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-display text-lg font-medium mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#fc0ce4]" />
              Final Project Grades
            </h2>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-center">
                <div className="text-lg font-display font-medium text-white">{projectGrades.length}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest">Total</div>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/15 text-center">
                <div className="text-lg font-display font-medium text-emerald-400">{passedCount}</div>
                <div className="text-[10px] text-emerald-400/60 uppercase tracking-widest">Passed</div>
              </div>
              <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/15 text-center">
                <div className="text-lg font-display font-medium text-red-400">{failedCount}</div>
                <div className="text-[10px] text-red-400/60 uppercase tracking-widest">Failed</div>
              </div>
            </div>

            {projectGrades.length === 0 ? (
              <p className="text-white/30 text-sm py-4 text-center">No project grades recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {projectGrades.map((grade, i) => (
                  <button
                    key={i}
                    onClick={() => setGradeModal(grade)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#fc0ce4]/30 hover:bg-[#fc0ce4]/5 transition-all cursor-pointer text-left"
                  >
                    <div>
                      <div className="text-sm font-medium text-white/90">{grade.tableName}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">{grade.className} · {grade.gradedAt || 'Not graded'}</div>
                    </div>
                    <div>
                      {grade.passed === true && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> Passed · {grade.totalPoints} pts
                        </span>
                      )}
                      {grade.passed === false && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                          <XCircle className="w-3 h-3" /> Failed · {grade.totalPoints} pts
                        </span>
                      )}
                      {grade.passed == null && (
                        <span className="text-white/30 text-xs">Pending</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Status - This Month */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-display text-lg font-medium mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              Payment Status
            </h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            {paymentStatus === 'paid' ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-emerald-400">Paid</div>
                  <div className="text-[11px] text-emerald-400/60">Payment received this month</div>
                </div>
              </div>
            ) : paymentStatus === 'pending' ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/25">
                <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-amber-400">Pending</div>
                  <div className="text-[11px] text-amber-400/60">No payment recorded yet</div>
                </div>
              </div>
            ) : (
              <p className="text-white/30 text-sm text-center py-2">No payment data available</p>
            )}
          </div>

          {/* Quick Stats */}
          <div className="glass-card rounded-3xl p-6">
            <h2 className="font-display text-lg font-medium mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#949ce4]" />
              Quick Stats
            </h2>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                <span className="text-sm text-white/60">Degree</span>
                <span className="text-sm font-medium text-white">{student.program}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                <span className="text-sm text-white/60">Classes</span>
                <span className="text-sm font-medium text-white">{classEnrollments.length}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                <span className="text-sm text-white/60">Attendance</span>
                <span className={`text-sm font-medium ${attPct !== null ? (attPct >= 75 ? 'text-emerald-400' : attPct >= 50 ? 'text-amber-400' : 'text-red-400') : 'text-white/30'}`}>
                  {attPct !== null ? `${attPct}%` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                <span className="text-sm text-white/60">Pass Rate</span>
                <span className="text-sm font-medium text-white">
                  {projectGrades.length > 0 ? `${Math.round((passedCount / projectGrades.length) * 100)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal for info cards */}
      <AnimatePresence>
        {detailModal && (
          <>
            <motion.div
              key="detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              key="detail-modal"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-sm bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div className="flex items-center gap-2.5">
                    <BarChart2 className="w-4 h-4 text-[#fc0ce4]" />
                    <h2 className="text-sm font-bold text-white">{detailModal.title}</h2>
                  </div>
                  <button
                    onClick={() => setDetailModal(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-5 py-4 space-y-2.5">
                  {Object.entries(detailModal.content).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                      <span className="text-sm text-white/60">{label}</span>
                      <span className="text-sm font-bold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Grade Detail Modal */}
      <AnimatePresence>
        {gradeModal && (
          <>
            <motion.div
              key="grade-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGradeModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              key="grade-modal"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-sm bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-[#fc0ce4]" />
                    <div>
                      <h2 className="text-sm font-bold text-white">{gradeModal.tableName}</h2>
                      <p className="text-[11px] text-white/40 mt-0.5">{gradeModal.className}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setGradeModal(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-5 py-4 space-y-2.5">
                  {/* Result */}
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border" style={{
                    backgroundColor: gradeModal.passed === true ? 'rgba(16,185,129,0.08)' : gradeModal.passed === false ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
                    borderColor: gradeModal.passed === true ? 'rgba(16,185,129,0.15)' : gradeModal.passed === false ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                  }}>
                    <div className="flex items-center gap-2 text-sm">
                      {gradeModal.passed === true ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : gradeModal.passed === false ? <XCircle className="w-3.5 h-3.5 text-red-400" /> : <Clock className="w-3.5 h-3.5 text-white/40" />}
                      <span className={gradeModal.passed === true ? 'text-emerald-400' : gradeModal.passed === false ? 'text-red-400' : 'text-white/60'}>
                        Result
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${gradeModal.passed === true ? 'text-emerald-400' : gradeModal.passed === false ? 'text-red-400' : 'text-white/40'}`}>
                      {gradeModal.passed === true ? 'Passed' : gradeModal.passed === false ? 'Failed' : 'Pending'}
                    </span>
                  </div>
                  {/* Points */}
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                    <span className="text-sm text-white/60">Points</span>
                    <span className="text-sm font-bold text-white">{gradeModal.totalPoints != null ? gradeModal.totalPoints : '—'}</span>
                  </div>
                  {/* Teacher */}
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                    <span className="text-sm text-white/60">Teacher</span>
                    <span className="text-sm font-bold text-white">{gradeModal.teacherName}</span>
                  </div>
                  {/* Graded Date */}
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                    <span className="text-sm text-white/60">Graded At</span>
                    <span className="text-sm font-bold text-white">{gradeModal.gradedAt || 'Not graded yet'}</span>
                  </div>
                  {/* Note */}
                  {gradeModal.note && (
                    <div className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/8">
                      <div className="text-sm text-white/60 mb-1">Note</div>
                      <p className="text-sm text-white/90">{gradeModal.note}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Load a student's profile by their profile ID */
async function loadStudentProfile(profileId: string): Promise<StudentData> {
  const { supabase } = await import('../lib/supabase');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, location, avatar_url, role')
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) throw new Error('Profile not found');

  // Get enrollment info
  const { data: enrollment } = await supabase
    .from('class_enrollments')
    .select(`
      enrolled_at,
      class:classes!class_enrollments_class_id_fkey(
        title,
        program_id
      )
    `)
    .eq('student_id', profileId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  // program_id on classes stores the program name directly as text
  const enrollClass = enrollment?.class as any;
  const programName = enrollClass?.program_id || 'No Degree';

  // Get attendance rate
  const { data: attData } = await supabase
    .from('class_attendance')
    .select('status')
    .eq('student_id', profileId);

  let attendanceRate: number | null = null;
  if (attData && attData.length > 0) {
    const present = attData.filter((a: any) => a.status === 'present' || a.status === 'late').length;
    attendanceRate = Math.round((present / attData.length) * 100);
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return {
    id: profileId,
    name: `${profile.first_name} ${profile.last_name}`,
    email: profile.email || '',
    phone: profile.phone || '',
    address: profile.location || '',
    program: programName,
    status: 'Active',
    date: enrollment?.enrolled_at ? formatDate(enrollment.enrolled_at) : 'N/A',
    avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileId}`,
    attendance: attendanceRate,
  };
}

/** Load all class enrollments for a student */
async function loadClassEnrollments(profileId: string): Promise<ClassEnrollmentInfo[]> {
  const { supabase } = await import('../lib/supabase');

  const { data, error } = await supabase
    .from('class_enrollments')
    .select(`
      enrolled_at,
      class:classes!class_enrollments_class_id_fkey(
        id,
        title,
        program_id
      )
    `)
    .eq('student_id', profileId)
    .eq('status', 'active');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // program_id on classes stores the program name directly as text
  return (data as any[]).map(d => ({
    classId: d.class?.id || '',
    className: d.class?.title || 'Unknown',
    programName: d.class?.program_id || 'No Degree',
    enrolledAt: d.enrolled_at ? formatDate(d.enrolled_at) : 'N/A',
  }));
}
