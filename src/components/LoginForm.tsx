'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setError(error.message); return; }
        router.replace('/');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) { setError(error.message); return; }
        setInfo('Check your email to confirm your account, then sign in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sa-bg px-4">
        <div className="w-full max-w-sm bg-sa-card border border-sa-border rounded-xl p-6">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded bg-sa-accent flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              AI
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">Tokenomics</div>
              <div className="text-sa-muted text-xs leading-tight">AI Value Chain Model</div>
            </div>
          </div>
          <h1 className="text-sm font-semibold text-white mb-2">Authentication isn&rsquo;t configured yet</h1>
          <p className="text-xs text-sa-muted leading-relaxed">
            Set <code className="text-slate-300">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="text-slate-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see <code className="text-slate-300">.env.example</code>)
            to enable sign-in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sa-bg px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-sa-card border border-sa-border rounded-xl p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded bg-sa-accent flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            AI
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Tokenomics</div>
            <div className="text-sa-muted text-xs leading-tight">AI Value Chain Model</div>
          </div>
        </div>

        <h1 className="text-sm font-semibold text-white mb-4">
          {mode === 'signin' ? 'Sign in to continue' : 'Create an account'}
        </h1>

        <label className="text-xs text-slate-400 mb-1 block">Email</label>
        <input
          type="email" required value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full text-sm mb-3" autoComplete="email" autoFocus
        />

        <label className="text-xs text-slate-400 mb-1 block">Password</label>
        <input
          type="password" required minLength={6} value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full text-sm mb-4"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />

        {error && <p className="text-xs text-sa-red mb-3">{error}</p>}
        {info && <p className="text-xs text-sa-green mb-3">{info}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full py-2 rounded-lg bg-sa-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>

        <button
          type="button"
          onClick={() => { setMode(m => (m === 'signin' ? 'signup' : 'signin')); setError(null); setInfo(null); }}
          className="w-full text-center text-xs text-sa-muted hover:text-sa-accent mt-4 transition-colors"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
