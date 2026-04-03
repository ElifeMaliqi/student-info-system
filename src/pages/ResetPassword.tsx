import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, ArrowRight, CheckCircle, X, ShieldCheck, User, Users, Phone, AlertTriangle } from 'lucide-react';

type Step = 'verify' | 'choose' | 'newPassword' | 'success';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // The secret token from the email link (?t=...)
  const accessToken = searchParams.get('t') ?? '';

  // Step state
  const [step, setStep] = useState<Step>('verify');

  // Verify fields
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');

  // Password fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // -------- Step 1: Verify identity --------
  const handleVerify = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@') || !firstName || !lastName || !parentName || !phone) {
      setError('All fields are required.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/verify-identity-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, lastName, parentName, phone, accessToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed.');
      }
      setStep('choose');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------- Step 3: Submit new password --------
  const handleChangePassword = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/verify-identity-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, lastName, parentName, phone, accessToken, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to change password.');
      }
      setStep('success');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const stepLabel: Record<Step, string> = {
    verify: 'Verify your identity to proceed',
    choose: 'Identity verified — what would you like to do?',
    newPassword: 'Set a new password for your account',
    success: '',
  };

  // Guard: no valid token in URL → don't show the form at all
  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)' }}>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#fc0ce4]/5 blur-[120px] mix-blend-screen animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#949ce4]/5 blur-[120px] mix-blend-screen animate-blob animation-delay-2000" />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative w-full max-w-md z-10">
          <div className="glass-panel rounded-[2rem] shadow-2xl shadow-black/60 border border-white/10 overflow-hidden">
            <div className="px-8 pt-8 pb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-medium tracking-tight">Invalid Reset Link</h2>
                  <p className="text-white/40 text-xs mt-0.5">This page requires a secure link from your email</p>
                </div>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="px-8 py-6 space-y-4">
              <p className="text-white/60 text-sm leading-relaxed">
                You cannot access the password reset page directly. Please use the <strong className="text-white/80">Forgot?</strong> link on the login page and follow the link sent to your email.
              </p>
              <button onClick={() => navigate('/login')} className="w-full bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]">
                Go to Login
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)' }}>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#fc0ce4]/5 blur-[120px] mix-blend-screen animate-blob" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#949ce4]/5 blur-[120px] mix-blend-screen animate-blob animation-delay-2000" />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md z-10"
        >
          <div className="glass-panel rounded-[2rem] shadow-2xl shadow-black/60 border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="relative px-8 pt-8 pb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#fc0ce4]/20 to-[#949ce4]/20 border border-white/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-[#fc0ce4]" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-medium tracking-tight">Reset Password</h2>
                    <p className="text-white/40 text-xs mt-0.5">{stepLabel[step]}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Body */}
            <div className="px-8 py-6">

              {/* ── SUCCESS ── */}
              {step === 'success' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Password Updated Successfully</p>
                    <p className="text-white/40 text-xs mt-1">Redirecting to login…</p>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 1: VERIFY IDENTITY ── */}
              {step === 'verify' && (
                <form className="space-y-3.5" onSubmit={handleVerify}>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* First Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">First Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                      </div>
                      <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John" className="glass-input w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5" />
                    </div>
                  </div>

                  {/* Last Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Last Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                      </div>
                      <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe" className="glass-input w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5" />
                    </div>
                  </div>

                  {/* Parent Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Parent Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Users className="h-4 w-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                      </div>
                      <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)}
                        placeholder="Parent's first name" className="glass-input w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5" />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                      </div>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@futureminds.edu" className="glass-input w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5" />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Phone Number</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                      </div>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="+383 44 123 456" className="glass-input w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5" />
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading}
                    className="w-full mt-2 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3.5 lg:py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Verifying…' : 'Verify Identity'}
                    {!isLoading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              )}

              {/* ── STEP 2: CHOOSE ── */}
              {step === 'choose' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
                    Identity verified successfully.
                  </div>

                  <button
                    onClick={() => { setError(''); setStep('newPassword'); }}
                    className="w-full bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3.5 lg:py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)]"
                  >
                    Change to a New Password
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => navigate('/login')}
                    className="w-full py-3.5 rounded-2xl border border-white/10 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Keep Current Password & Go Back
                  </button>
                </div>
              )}

              {/* ── STEP 3: NEW PASSWORD ── */}
              {step === 'newPassword' && (
                <form className="space-y-4" onSubmit={handleChangePassword}>
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">New Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                      </div>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters" className="glass-input w-full pl-11 pr-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Confirm Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className={`h-4 w-4 transition-colors ${passwordsMatch ? 'text-emerald-400' : passwordMismatch ? 'text-red-400' : 'text-white/30 group-focus-within:text-[#fc0ce4]'}`} />
                      </div>
                      <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        className={`glass-input w-full pl-11 pr-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5 ${passwordMismatch ? 'border-red-500/50' : passwordsMatch ? 'border-emerald-500/50' : ''}`} />
                    </div>
                    {passwordMismatch && <p className="text-red-400 text-[10px] ml-1">Passwords do not match</p>}
                    {passwordsMatch && <p className="text-emerald-400 text-[10px] ml-1">Passwords match</p>}
                  </div>

                  <button type="submit" disabled={isLoading || !password || !confirmPassword}
                    className="w-full mt-2 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3.5 lg:py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Updating…' : 'Update Password'}
                    {!isLoading && <ArrowRight className="w-4 h-4" />}
                  </button>

                  <button type="button" onClick={() => { setError(''); setStep('choose'); }}
                    className="w-full py-3 rounded-2xl border border-white/10 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Go Back
                  </button>
                </form>
              )}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="px-8 py-4 text-center">
              <p className="text-white/30 text-[10px]">
                Your account data and information remain completely safe.
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
