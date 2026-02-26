import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Mail, Lock, Fingerprint, Sparkles } from 'lucide-react';
import StudentWaitingPage from './StudentWaitingPage';

export default function Login({ onLogin }: { onLogin: (role: string) => void }) {
  const [role, setRole] = useState<'student' | 'teacher' | 'admin'>('admin');
  const [isHoveringBtn, setIsHoveringBtn] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    // Simulate API call
    onLogin(role);
  };

  if (isWaiting) {
    return <StudentWaitingPage onBack={() => { setIsWaiting(false); setIsApplying(false); }} />;
  }

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
            {['Web Development', 'AI & Digital Marketing', 'UI/UX Design', 'UAV Engineering', 'Cybersecurity'].map((program) => (
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
            src="https://futureminds.io/assets/imgs/logo/site-logo-white-2.png" 
            alt="Future Minds Logo" 
            className="h-6 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="w-full max-w-[400px] relative z-10">
          <AnimatePresence mode="wait">
            {!isApplying ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <div className="mb-8 lg:mb-10 text-center lg:text-left">
                  <h2 className="font-display text-3xl font-medium mb-2 lg:mb-3 tracking-tight">Welcome back</h2>
                  <p className="text-white/50 text-sm">Enter your credentials to access the portal.</p>
                </div>

                <div className="glass-panel p-6 lg:p-8 rounded-[2rem] shadow-2xl shadow-black/50">
                  {/* Role Selector */}
                  <div className="flex p-1 bg-white/5 rounded-2xl mb-6 lg:mb-8 border border-white/5">
                    {(['student', 'teacher', 'admin'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRole(r)}
                        className={`flex-1 py-2 lg:py-2.5 text-[10px] lg:text-[11px] font-semibold uppercase tracking-widest rounded-xl transition-all duration-300 ${
                          role === r 
                            ? 'bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white shadow-lg' 
                            : 'text-white/40 hover:text-white/80'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

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
                      <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Email Address</label>
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
                        <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest">Password</label>
                        <a href="#" className="text-[10px] lg:text-[11px] font-medium text-white/40 hover:text-[#fc0ce4] transition-colors">Forgot?</a>
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
                      className="w-full mt-6 lg:mt-8 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3.5 lg:py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all relative overflow-hidden group shadow-[0_0_20px_rgba(252,12,228,0.2)]"
                      onMouseEnter={() => setIsHoveringBtn(true)}
                      onMouseLeave={() => setIsHoveringBtn(false)}
                    >
                      <span>Sign In to Portal</span>
                      <motion.div
                        animate={{ x: isHoveringBtn ? 4 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </motion.div>
                    </button>
                  </form>

                  <div className="mt-6 lg:mt-8 pt-6 border-t border-white/5 flex flex-col gap-4">
                    <button className="w-full py-3 lg:py-3.5 rounded-2xl border border-white/10 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center gap-2 bg-white/5">
                      <Fingerprint className="w-4 h-4 text-white/40" />
                      Sign in with Passkey
                    </button>
                  </div>
                </div>

                <div className="mt-6 lg:mt-8 text-center pb-8 lg:pb-0">
                  <p className="text-sm text-white/40">
                    Don't have an account?{' '}
                    <button onClick={() => setIsApplying(true)} className="text-white font-medium hover:text-[#fc0ce4] hover:underline underline-offset-4 transition-all">
                      Apply for Admission
                    </button>
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="apply"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <div className="mb-8 lg:mb-10 text-center lg:text-left">
                  <h2 className="font-display text-3xl font-medium mb-2 lg:mb-3 tracking-tight">Apply for Admission</h2>
                  <p className="text-white/50 text-sm">Join Future Minds Academy today.</p>
                </div>

                <div className="glass-panel p-6 lg:p-8 rounded-[2rem] shadow-2xl shadow-black/50">
                  <form className="space-y-4 lg:space-y-5" onSubmit={(e) => { e.preventDefault(); setIsWaiting(true); }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">First Name</label>
                        <input type="text" className="glass-input w-full px-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5" placeholder="John" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Last Name</label>
                        <input type="text" className="glass-input w-full px-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5" placeholder="Doe" required />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Email Address</label>
                      <input type="email" className="glass-input w-full px-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white placeholder:text-white/20 bg-white/5" placeholder="john@example.com" required />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] lg:text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Program of Interest</label>
                      <select className="glass-input w-full px-4 py-3 lg:py-3.5 rounded-2xl text-sm text-white bg-[#0a0a0a] appearance-none" required>
                        <option value="">Select a program...</option>
                        <option>UI/UX Creative Designer</option>
                        <option>Web Development</option>
                        <option>Cybersecurity</option>
                      </select>
                    </div>

                    <button 
                      type="submit"
                      className="w-full mt-6 lg:mt-8 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3.5 lg:py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all relative overflow-hidden group shadow-[0_0_20px_rgba(252,12,228,0.2)]"
                      onMouseEnter={() => setIsHoveringBtn(true)}
                      onMouseLeave={() => setIsHoveringBtn(false)}
                    >
                      <span>Submit Application</span>
                      <motion.div
                        animate={{ x: isHoveringBtn ? 4 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </motion.div>
                    </button>
                  </form>
                </div>

                <div className="mt-6 lg:mt-8 text-center pb-8 lg:pb-0">
                  <p className="text-sm text-white/40">
                    Already have an account?{' '}
                    <button onClick={() => setIsApplying(false)} className="text-white font-medium hover:text-[#fc0ce4] hover:underline underline-offset-4 transition-all">
                      Sign In
                    </button>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
