import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, Plus, Filter, MoreHorizontal, FileText, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Download, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useDebounce } from '../hooks/useDebounce';
import { SlideOver } from '../components/SlideOver';
import { playPopSound } from '../utils/sound';

const STUDENTS = [
  { id: 'STU-001', name: 'Elena Rodriguez', email: 'elena.r@example.com', program: 'UI/UX Creative Designer', status: 'Active', date: 'Feb 23, 2026', avatar: 'https://picsum.photos/seed/elena/100/100' },
  { id: 'STU-002', name: 'Marcus Chen', email: 'marcus.c@example.com', program: 'Web Development', status: 'Pending', date: 'Feb 23, 2026', avatar: 'https://picsum.photos/seed/marcus/100/100' },
  { id: 'STU-003', name: 'Sarah Jenkins', email: 'sarah.j@example.com', program: 'Cybersecurity', status: 'Active', date: 'Feb 22, 2026', avatar: 'https://picsum.photos/seed/sarah/100/100' },
  { id: 'STU-004', name: 'David Kim', email: 'david.k@example.com', program: 'UAV Engineering', status: 'Suspended', date: 'Feb 20, 2026', avatar: 'https://picsum.photos/seed/david/100/100' },
  { id: 'STU-005', name: 'Aisha Patel', email: 'aisha.p@example.com', program: 'Digital Marketing with AI', status: 'Graduated', date: 'Feb 15, 2026', avatar: 'https://picsum.photos/seed/aisha/100/100' },
];

export default function Students() {
  const [view, setView] = useState<'list' | 'add'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedStudentForPanel, setSelectedStudentForPanel] = useState<any | null>(null);
  const itemsPerPage = 5;
  const navigate = useNavigate();
  
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { t } = useLanguage();

  const filteredStudents = useMemo(() => {
    return STUDENTS.filter(student => 
      student.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      student.email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      student.id.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [debouncedSearch]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudents(paginatedStudents.map(s => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    playPopSound();
    alert(`Exporting ${selectedStudents.length > 0 ? selectedStudents.length : filteredStudents.length} students to CSV...`);
  };

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAddStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');
    
    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const program = formData.get('program') as string;

    if (!firstName || !lastName) {
      setFormError('First and Last name are required.');
      return;
    }

    if (!email || !email.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (!program || program === 'Select Program') {
      setFormError('Please select a program.');
      return;
    }

    // Simulate success
    setView('list');
  };

  if (view === 'add') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('students.new_registration')}</h1>
            <p className="text-white/50 text-sm">{t('students.new_registration_desc')}</p>
          </div>
          <button 
            onClick={() => setView('list')}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            {t('students.cancel')}
          </button>
        </div>

        <div className="glass-card rounded-3xl p-6 lg:p-8">
          <form className="space-y-8" onSubmit={handleAddStudent}>
            {formError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium"
              >
                {formError}
              </motion.div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.first_name')}</label>
                <input name="firstName" type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="John" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.last_name')}</label>
                <input name="lastName" type="text" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="Doe" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.email')}</label>
                <input name="email" type="email" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.phone')}</label>
                <input name="phone" type="tel" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.parent_phone')}</label>
                <input name="parentPhone" type="tel" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20" placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.gender')}</label>
                <select name="gender" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white bg-[#0a0a0a] appearance-none">
                  <option>{t('students.select_gender')}</option>
                  <option>{t('students.male')}</option>
                  <option>{t('students.female')}</option>
                  <option>{t('students.other')}</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('students.select_program')}</label>
                <select name="program" className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white bg-[#0a0a0a] appearance-none">
                  <option value="">Select Program</option>
                  <option value="Web Development">Web Development</option>
                  <option value="Digital Marketing with AI">Digital Marketing with AI</option>
                  <option value="UI/UX Creative Designer">UI/UX Creative Designer</option>
                  <option value="Internet of Things (UAV/IoT)">Internet of Things (UAV/IoT)</option>
                  <option value="Cybersecurity">Cybersecurity</option>
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <h3 className="text-sm font-medium mb-4">{t('students.doc_upload')}</h3>
              <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center hover:bg-white/5 hover:border-[#fc0ce4]/30 transition-colors cursor-pointer">
                <FileText className="w-8 h-8 text-white/30 mx-auto mb-3" />
                <p className="text-sm text-white/70">{t('students.drag_drop')}</p>
                <p className="text-[11px] text-white/40 mt-1">{t('students.doc_types')}</p>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-white/5">
              <button type="button" className="px-6 py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors">
                {t('students.save_draft')}
              </button>
              <button type="submit" className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]">
                {t('students.register')}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight mb-1">{t('students.title')}</h1>
          <p className="text-white/50 text-sm">{t('students.desc')}</p>
        </div>
        <button 
          onClick={() => setView('add')}
          className="bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {t('students.add_new')}
        </button>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
        <div className="flex flex-col md:flex-row gap-4 justify-between mb-6 shrink-0">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              placeholder={t('students.search')} 
              className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#fc0ce4]/40 focus:bg-[#fc0ce4]/5 focus:shadow-[0_0_15px_rgba(252,12,228,0.1)] transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExport}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {t('students.filter')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-4 custom-scrollbar flex-1 -mx-6 px-6">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-widest text-white/30">
                <th className="pb-3 pl-4 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-white/20 bg-transparent text-[#fc0ce4] focus:ring-[#fc0ce4]/50"
                    checked={paginatedStudents.length > 0 && selectedStudents.length === paginatedStudents.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="pb-3 font-medium">{t('attendance.student_info')}</th>
                <th className="pb-3 font-medium">{t('table.program')}</th>
                <th className="pb-3 font-medium">{t('table.status')}</th>
                <th className="pb-3 font-medium">{t('students.enrollment_date')}</th>
                <th className="pb-3 font-medium text-right">{t('table.action')}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((student) => (
                  <tr 
                    key={student.id} 
                    className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors group cursor-pointer ${selectedStudents.includes(student.id) ? 'bg-white/5' : ''}`}
                    onClick={() => { playPopSound(); setSelectedStudentForPanel(student); }}
                  >
                    <td className="py-4 pl-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="rounded border-white/20 bg-transparent text-[#fc0ce4] focus:ring-[#fc0ce4]/50"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => handleSelectOne(student.id)}
                      />
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <img src={student.avatar} alt={student.name} className="w-10 h-10 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                        <div>
                          <div className="font-medium text-white/90 group-hover:text-white transition-colors">{student.name}</div>
                          <div className="text-[11px] text-white/40 font-mono mt-0.5">{student.id} • {student.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-white/60">{student.program}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                        student.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        student.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        student.status === 'Graduated' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {student.status === 'Active' && <CheckCircle className="w-3 h-3" />}
                        {student.status === 'Pending' && <Clock className="w-3 h-3" />}
                        {student.status === 'Suspended' && <XCircle className="w-3 h-3" />}
                        {t(`status.${student.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td className="py-4 text-white/40 text-xs">{student.date}</td>
                    <td className="py-4 text-right">
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-white/40 text-sm">
                    No students found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
            <div className="text-xs text-white/40">
              Showing <span className="text-white/80 font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-white/80 font-medium">{Math.min(currentPage * itemsPerPage, filteredStudents.length)}</span> of <span className="text-white/80 font-medium">{filteredStudents.length}</span> students
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      currentPage === i + 1 
                        ? 'bg-[#fc0ce4]/20 text-[#fc0ce4] border border-[#fc0ce4]/30' 
                        : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <SlideOver 
        isOpen={!!selectedStudentForPanel} 
        onClose={() => setSelectedStudentForPanel(null)} 
        title="Student Details"
      >
        {selectedStudentForPanel && (
          <div className="space-y-8">
            <div className="flex flex-col items-center text-center">
              <img 
                src={selectedStudentForPanel.avatar} 
                alt={selectedStudentForPanel.name} 
                className="w-24 h-24 rounded-full border-4 border-white/10 mb-4" 
                referrerPolicy="no-referrer" 
              />
              <h3 className="text-xl font-display font-medium text-white">{selectedStudentForPanel.name}</h3>
              <p className="text-sm text-white/50 font-mono mt-1">{selectedStudentForPanel.id}</p>
              
              <span className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider border ${
                selectedStudentForPanel.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                selectedStudentForPanel.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                selectedStudentForPanel.status === 'Graduated' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {selectedStudentForPanel.status}
              </span>
            </div>

            <div className="space-y-4">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">{t('profile.program')}</div>
                <div className="text-sm text-white/90">{selectedStudentForPanel.program}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">{t('profile.email')}</div>
                <div className="text-sm text-white/90">{selectedStudentForPanel.email}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">{t('profile.enrollment_date')}</div>
                <div className="text-sm text-white/90">{selectedStudentForPanel.date}</div>
              </div>
            </div>

            <button 
              onClick={() => {
                playPopSound();
                navigate(`/students/${selectedStudentForPanel.id}`);
              }}
              className="w-full py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              View Full Profile
            </button>
          </div>
        )}
      </SlideOver>
    </motion.div>
  );
}
