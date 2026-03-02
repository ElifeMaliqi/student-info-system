import { useState, useEffect, FormEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Upload, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

interface RegistrationFormData {
  firstName: string;
  lastName: string;
  parentFirstName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  programId: string;
  idDocument?: File;
}

interface PublicRegistrationProps {
  onBack: () => void;
}

export default function PublicRegistration({ onBack }: PublicRegistrationProps) {
  const [formData, setFormData] = useState<RegistrationFormData>({
    firstName: '',
    lastName: '',
    parentFirstName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    programId: '',
  });
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'pending' | 'rejected' | 'already_approved'>('idle');

  const programs = [
    'Web Development',
    'Digital Marketing with AI',
    'UI/UX Creative Designer',
    'Internet of Things (UAV/IoT)',
    'UAV Engineering Degree',
    'Cybersecurity',
    '3D Creative Artist',
    'Entrepreneurship'
  ];

  const [programsData, setProgramsData] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    api.programs.getAll().then(progs => {
      setProgramsData(progs.map(p => ({ id: p.id, name: p.name })));
    }).catch(err => {
      console.error('Failed to load programs:', err);
    });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024;

      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid file (JPG, PNG, or PDF)');
        return;
      }

      if (file.size > maxSize) {
        setError('File size must be less than 5MB');
        return;
      }

      setIdDocument(file);
      setError('');
    }
  };

  const validateForm = (): boolean => {
    if (!formData.firstName.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required');
      return false;
    }
    if (!formData.parentFirstName.trim()) {
      setError("Parent's first name is required");
      return false;
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!formData.programId) {
      setError('Please select a program');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await api.auth.register({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        parentFirstName: formData.parentFirstName,
        passwordHash: formData.password,
        role: 'student',
        programId: formData.programId,
        phone: formData.phone,
      });

      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';

      if (errorMessage.includes('already registered')) {
        setStatus('already_approved');
      } else if (errorMessage.includes('already pending')) {
        setStatus('pending');
      } else if (errorMessage.includes('denied') || errorMessage.includes('rejected')) {
        setStatus('rejected');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'pending') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#050505] p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-8 rounded-3xl max-w-md w-full text-center"
        >
          <div className="w-16 h-16 rounded-full bg-amber-400/10 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
          <h2 className="font-display text-2xl font-medium mb-3">Application Pending</h2>
          <p className="text-white/60 mb-6">
            Your application is currently under review. You will receive an email once your application has been processed.
          </p>
          <button onClick={onBack} className="btn-primary w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </motion.div>
      </div>
    );
  }

  if (status === 'already_approved') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#050505] p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-8 rounded-3xl max-w-md w-full text-center"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="font-display text-2xl font-medium mb-3">Registration Approved</h2>
          <p className="text-white/60 mb-6">
            Your registration has been approved. Please sign in with your credentials.
          </p>
          <button onClick={onBack} className="btn-primary w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to Sign In
          </button>
        </motion.div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#050505] p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-8 rounded-3xl max-w-md w-full text-center"
        >
          <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="font-display text-2xl font-medium mb-3">Registration Denied</h2>
          <p className="text-white/60 mb-6">
            Unfortunately, your registration application has been denied. Please contact the admissions office for more information.
          </p>
          <button onClick={onBack} className="btn-primary w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </motion.div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#050505] p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-8 rounded-3xl max-w-md w-full text-center"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="font-display text-2xl font-medium mb-3">Application Submitted!</h2>
          <p className="text-white/60 mb-6">
            Your application has been successfully submitted and is now under review. You will receive an email notification once your application has been processed.
          </p>
          <button onClick={onBack} className="btn-primary w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#050505] selection:bg-white/20">
      <div className="relative hidden lg:flex lg:w-[45%] flex-col justify-between p-12 overflow-hidden bg-mesh border-r border-white/5">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#fc0ce4]/10 blur-[120px] mix-blend-screen animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#949ce4]/10 blur-[120px] mix-blend-screen animate-blob animation-delay-2000" />

        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <img
              src="https://futureminds.io/assets/imgs/logo/site-logo-white-2.png"
              alt="Future Minds Logo"
              className="h-8 object-contain"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>

        <div className="relative z-10 max-w-2xl">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-5xl xl:text-6xl font-medium leading-[1.05] tracking-tight mb-8"
          >
            Join Future Minds <br />
            <span className="text-gradient">Academy Today</span>
          </motion.h1>
        </div>

        <div className="relative z-10 text-[11px] text-white/30 font-mono uppercase tracking-widest">
          <span>Secure Registration</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 relative bg-grid">
        <div className="absolute top-8 left-8 lg:hidden">
          <img
            src="https://futureminds.io/assets/imgs/logo/site-logo-white-2.png"
            alt="Future Minds Logo"
            className="h-6 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="w-full max-w-[500px] relative z-10 mt-16 lg:mt-0">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="mb-8 text-center lg:text-left">
              <h2 className="font-display text-3xl font-medium mb-2 tracking-tight">Apply for Admission</h2>
              <p className="text-white/50 text-sm">Complete the form below to submit your application.</p>
            </div>

            <div className="glass-panel p-6 lg:p-8 rounded-[2rem] shadow-2xl shadow-black/50">
              <form className="space-y-4" onSubmit={handleSubmit}>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center"
                  >
                    {error}
                  </motion.div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="glass-input w-full px-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5"
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="glass-input w-full px-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                    Parent's First Name *
                  </label>
                  <input
                    type="text"
                    name="parentFirstName"
                    value={formData.parentFirstName}
                    onChange={handleInputChange}
                    className="glass-input w-full px-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5"
                    placeholder="Parent's name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="glass-input w-full px-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5"
                    placeholder="john@example.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="glass-input w-full px-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="glass-input w-full px-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="glass-input w-full px-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5"
                    placeholder="+20 123 456 7890"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                    Program *
                  </label>
                  <select
                    name="programId"
                    value={formData.programId}
                    onChange={handleInputChange}
                    className="glass-select w-full px-4 py-3 rounded-2xl text-sm appearance-none"
                    required
                  >
                    <option value="">Select a program...</option>
                    {programs.map((programName) => {
                      const programData = programsData.find(p => p.name === programName);
                      return (
                        <option key={programName} value={programData?.id || programName}>
                          {programName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">
                    ID Document (Optional)
                  </label>
                  <label className="glass-input w-full px-4 py-3 rounded-2xl text-sm cursor-pointer hover:bg-white/10 transition-colors flex items-center gap-2">
                    <Upload className="w-4 h-4 text-white/40" />
                    <span className={idDocument ? 'text-white' : 'text-white/40'}>
                      {idDocument ? idDocument.name : 'Upload ID (JPG, PNG, or PDF)'}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="text-xs text-white/30 ml-1">Maximum file size: 5MB</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-6 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Application</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-white/40">
                Already have an account?{' '}
                <button onClick={onBack} className="text-white font-medium hover:text-[#fc0ce4] hover:underline underline-offset-4 transition-all">
                  Sign In
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
