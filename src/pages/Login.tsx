import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Mail, Lock, Fingerprint } from 'lucide-react';
import { PROGRAMS } from '../constants/programs';
import { api } from '../services/api';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [isHoveringBtn, setIsHoveringBtn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setUser } = useUser();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reset-access-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Always show success regardless of whether the email exists
      setResetSent(true);
    } catch {
      // Silently succeed to avoid email enumeration
      setResetSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      setIsLoading(false);
      return;
    }

    try {
      console.log('[Login] handleLogin called, email:', email);
      const result = await api.auth.login(email, password);
      console.log('[Login] api.auth.login returned, user:', result.user.id, result.user.role);
      setUser({
        ...result.user,
        mustChangePassword: !!result.user.mustChangePassword,
      });
      console.log('[Login] setUser called, calling onLogin()');
      onLogin();
      console.log('[Login] onLogin() finished');
    } catch (err) {
      console.error('[Login] login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
      console.log('[Login] handleLogin complete, isLoading=false');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#050505] selection:bg-white/20 font-sans">
      {/* Left Side - Atmospheric Branding */}
      <div className="relative hidden lg:flex lg:w-[55%] flex-col justify-between p-12 overflow-hidden bg-mesh border-r border-white/5">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#fc0ce4]/10 blur-[120px] mix-blend-screen animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#949ce4]/10 blur-[120px] mix-blend-screen animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-[#1e277a]/20 blur-[120px] mix-blend-screen animate-blob animation-delay-4000" />
        
        <div className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3"
          >
            <img 
              src="/site-logo.png" 
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
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-6xl xl:text-7xl font-medium leading-[1.05] tracking-tight mb-8"
          >
            Architecting the <br />
            <span className="text-gradient">next generation</span> <br />
            of innovators.
          </motion.h1>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap gap-2 mt-12"
          >
            {PROGRAMS.map((program) => (
              <div key={program} className="px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-[11px] font-medium tracking-wider text-white/70 uppercase">
                {program}
              </div>
            ))}
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[11px] text-white/30 font-mono uppercase tracking-widest">
          <span>System v2.0.4</span>
          <span>SaaS Platform</span>
        </div>
      </div>

      {/* Right Side - Login Interface */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 relative bg-grid min-h-screen lg:min-h-0 pt-24 lg:pt-12">
        {/* Mobile Header */}
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-3">
          <img 
            src="/site-logo.png" 
            alt="Future Minds Logo" 
            className="h-6 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="w-full max-w-[400px] relative z-10">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
                <div className="mb-8 lg:mb-10 text-center lg:text-left">
                  <h2 className="font-display text-3xl font-medium mb-2 lg:mb-3 tracking-tight">{forgotMode ? t('login.reset_title') : t('login.welcome_title')}</h2>
                  <p className="text-white/50 text-sm">{forgotMode ? t('login.reset_subtitle') : t('login.login_subtitle')}</p>
                </div>

                <div className="glass-panel p-6 lg:p-8 rounded-[2rem] shadow-2xl shadow-black/50">
                  {forgotMode ? (
                    resetSent ? (
                      <div className="space-y-5">
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
                          {t('login.reset_success')}
                        </div>
                        <button type="button" onClick={() => { setForgotMode(false); setResetSent(false); setError(''); }}
                          className="w-full py-3.5 rounded-2xl border border-white/10 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors">
                          {t('login.back_signin')}
                        </button>
                      </div>
                    ) : (
                      <form className="space-y-4 lg:space-y-5" onSubmit={handleForgotPassword}>
                        {error && (
                          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center">
                            {error}
                          </motion.div>
                        )}
                        <div className="space-y-2">
                          <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('login.email_label')}</label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <Mail className="h-4 w-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                            </div>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                              placeholder="name@futureminds.edu"
                              className="glass-input w-full pl-11 pr-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5" />
                          </div>
                        </div>
                        <button type="submit" disabled={isLoading}
                          className="w-full mt-2 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3.5 lg:py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-[0_0_20px_rgba(252,12,228,0.2)] disabled:opacity-50 disabled:cursor-not-allowed">
                          {isLoading ? t('login.sending') : t('login.send_reset')}
                        </button>
                        <button type="button" onClick={() => { setForgotMode(false); setError(''); }}
                          className="w-full py-3 rounded-2xl border border-white/10 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors">
                          {t('login.back_signin')}
                        </button>
                      </form>
                    )
                  ) : (
                  <>
                  <form className="space-y-4 lg:space-y-5" onSubmit={handleLogin}>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center"
                      >
                        {error}
                      </motion.div>
                    )}
                    
                    <div className="space-y-2">
                      <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">{t('login.email_label')}</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-white">
                          <Mail className="h-4 w-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                        </div>
                        <input 
                          type="email" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@futureminds.edu" 
                          className={`glass-input w-full pl-11 pr-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5 ${error && !email.includes('@') ? 'border-red-500/50 focus:border-red-500/50 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.1)]' : ''}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest">{t('login.password_label')}</label>
                        <button type="button" onClick={() => { setForgotMode(true); setError(''); }} className="text-[10px] lg:text-[11px] font-medium text-white/40 hover:text-[#fc0ce4] transition-colors">{t('login.forgot')}</button>
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-white">
                          <Lock className="h-4 w-4 text-white/30 group-focus-within:text-[#fc0ce4] transition-colors" />
                        </div>
                        <input 
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••" 
                          className={`glass-input w-full pl-11 pr-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5 ${error && password.length < 6 ? 'border-red-500/50 focus:border-red-500/50 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.1)]' : ''}`}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full mt-6 lg:mt-8 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3.5 lg:py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all relative overflow-hidden group shadow-[0_0_20px_rgba(252,12,228,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                      onMouseEnter={() => setIsHoveringBtn(true)}
                      onMouseLeave={() => setIsHoveringBtn(false)}
                    >
                      <span>{isLoading ? t('login.signin_loading') : t('login.signin_button')}</span>
                      {!isLoading && (
                        <motion.div
                          animate={{ x: isHoveringBtn ? 4 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </motion.div>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 lg:mt-8 pt-6 border-t border-white/5 flex flex-col gap-4">
                    <button className="w-full py-3 lg:py-3.5 rounded-2xl border border-white/10 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center gap-2 bg-white/5">
                      <Fingerprint className="w-4 h-4 text-white/40" />
                      {t('login.passkey')}
                    </button>
                  </div>
                  </>
                  )}
                </div>

            <div className="mt-6 lg:mt-8 text-center pb-8 lg:pb-0">
              <p className="text-sm text-white/40">
                Don't have an account?{' '}
                <button onClick={() => navigate('/register')} className="text-white font-medium hover:text-[#fc0ce4] hover:underline underline-offset-4 transition-all">
                  Apply for Admission
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
