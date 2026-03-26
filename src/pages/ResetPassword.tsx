import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, ArrowRight, CheckCircle, X, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Clear must_change_password flag if it was set
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id);
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)' }}>
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#fc0ce4]/5 blur-[120px] mix-blend-screen animate-blob" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#949ce4]/5 blur-[120px] mix-blend-screen animate-blob animation-delay-2000" />

      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md z-10"
        >
          {/* Modal card */}
          <div className="glass-panel rounded-[2rem] shadow-2xl shadow-black/60 border border-white/10 overflow-hidden">
            {/* Modal header */}
            <div className="relative px-8 pt-8 pb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#fc0ce4]/20 to-[#949ce4]/20 border border-white/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-[#fc0ce4]" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-medium tracking-tight">Reset Password</h2>
                    <p className="text-white/40 text-xs mt-0.5">Set a new password for your account</p>
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

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Modal body */}
            <div className="px-8 py-6">
              {success ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-4 space-y-4"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Password Updated Successfully</p>
                    <p className="text-white/40 text-xs mt-1">Your account is safe. Redirecting to login…</p>
                  </div>
                </motion.div>
              ) : !sessionReady ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-[#fc0ce4] rounded-full mx-auto mb-4" />
                  <p className="text-white/50 text-sm">Verifying your reset link…</p>
                  <p className="text-white/30 text-xs mt-2">
                    If this takes too long, the link may have expired.{' '}
                    <button onClick={() => navigate('/login')} className="text-[#fc0ce4] hover:underline">Go back</button>
                  </p>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleReset}>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* Email (read-only, pre-filled from recovery session) */}
                  <div className="space-y-2">
                    <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-white/30" />
                      </div>
                      <input
                        type="email"
                        value={userEmail}
                        readOnly
                        className="glass-input w-full pl-11 pr-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white/50 bg-white/[0.03] cursor-not-allowed border-white/5"
                      />
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">New Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="glass-input w-full pl-11 pr-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5"
                      />
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Confirm Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className={`h-4 w-4 transition-colors ${passwordsMatch ? 'text-emerald-400' : passwordMismatch ? 'text-red-400' : 'text-white/30 group-focus-within:text-[#fc0ce4]'}`} />
                      </div>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        className={`glass-input w-full pl-11 pr-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5 ${passwordMismatch ? 'border-red-500/50' : passwordsMatch ? 'border-emerald-500/50' : ''}`}
                      />
                    </div>
                    {passwordMismatch && (
                      <p className="text-red-400 text-[10px] ml-1">Passwords do not match</p>
                    )}
                    {passwordsMatch && (
                      <p className="text-emerald-400 text-[10px] ml-1">Passwords match</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !password || !confirmPassword}
                    className="w-full mt-2 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3.5 lg:py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Updating…' : 'Update Password'}
                    {!isLoading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              )}
            </div>

            {/* Modal footer */}
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
