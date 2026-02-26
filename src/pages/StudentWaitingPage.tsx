import { motion } from 'motion/react';
import { Clock, CheckCircle, ArrowLeft } from 'lucide-react';

interface StudentWaitingPageProps {
  onBack: () => void;
}

export default function StudentWaitingPage({ onBack }: StudentWaitingPageProps) {
  return (
    <div className="min-h-screen w-full bg-[#050505] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#fc0ce4]/10 blur-[120px] mix-blend-screen animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#949ce4]/10 blur-[120px] mix-blend-screen animate-blob animation-delay-2000" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-panel w-full max-w-md p-8 md:p-12 rounded-[2rem] relative z-10 text-center"
      >
        <div className="w-20 h-20 mx-auto bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 mb-8 relative">
          <Clock className="w-10 h-10 text-amber-400" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#050505] rounded-full flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <h1 className="font-display text-3xl font-medium tracking-tight mb-4">Application Received</h1>
        <p className="text-white/60 text-sm leading-relaxed mb-8">
          Thank you for applying to Future Minds Academy. Your application is currently <strong className="text-white">under review from administrators</strong>. 
          We will notify you via email once your account has been approved.
        </p>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 mb-8 text-left">
          <div className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Next Steps</div>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fc0ce4] mt-1.5 shrink-0" />
              <span>Administrators will review your submitted documents.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fc0ce4] mt-1.5 shrink-0" />
              <span>You may be contacted for a brief interview.</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fc0ce4] mt-1.5 shrink-0" />
              <span>Upon approval, you will receive an email with login instructions.</span>
            </li>
          </ul>
        </div>

        <button 
          onClick={onBack}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors text-white/60 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Login
        </button>
      </motion.div>
    </div>
  );
}
