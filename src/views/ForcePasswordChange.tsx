'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useUser } from '../context/UserContext';

export default function ForcePasswordChange() {
  const { user, setUser } = useUser();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError('');

    if (!password || password.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.auth.changePassword(password);
      if (user) setUser({ ...user, mustChangePassword: false });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#050505] p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-panel p-8 rounded-3xl max-w-md w-full"
      >
        <div className="w-14 h-14 rounded-2xl bg-[#fc0ce4]/10 border border-[#fc0ce4]/20 flex items-center justify-center mb-5">
          <Lock className="w-7 h-7 text-[#fc0ce4]" />
        </div>

        <h1 className="font-display text-2xl font-medium tracking-tight mb-2">Update Your Password</h1>
        <p className="text-white/50 text-sm mb-6">
          For security, you must change your temporary password before continuing.
        </p>

        {done ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Password updated successfully. Loading your portal...
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20"
                placeholder="Minimum 8 characters"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-white/60 uppercase tracking-widest ml-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20"
                placeholder="Repeat new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-[#fc0ce4] to-[#949ce4] text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Set New Password
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
