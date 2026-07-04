'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ai-tokenomics-auth-v1';

// This is a static site (output: 'export', no server) — there is no backend to
// verify a password against. NEXT_PUBLIC_* vars are inlined into the shipped JS
// bundle at build time, so this credential is visible to anyone who reads the
// bundle. This gate is a soft access deterrent for a shared dashboard, not
// real authentication — do not put sensitive data behind it.
const USERNAME = process.env.NEXT_PUBLIC_APP_USERNAME || 'admin';
const PASSWORD = process.env.NEXT_PUBLIC_APP_PASSWORD || 'tokenomics2026';

export default function LoginGate({ children }: { children: (logout: () => void) => React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === USERNAME && password === PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      setAuthed(true);
    } else {
      setError(true);
    }
  };

  // Avoid a flash of the login form while sessionStorage is being checked.
  if (authed === null) return null;

  if (!authed) {
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

          <h1 className="text-sm font-semibold text-white mb-4">Sign in to continue</h1>

          <label className="text-xs text-slate-400 mb-1 block">Username</label>
          <input
            value={username}
            onChange={e => { setUsername(e.target.value); setError(false); }}
            className="w-full text-sm mb-3"
            autoFocus
            autoComplete="username"
          />

          <label className="text-xs text-slate-400 mb-1 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false); }}
            className="w-full text-sm mb-4"
            autoComplete="current-password"
          />

          {error && <p className="text-xs text-sa-red mb-3">Incorrect username or password.</p>}

          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-sa-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign In
          </button>

          <p className="text-xs text-sa-muted mt-4 leading-relaxed">
            This is a static site with no backend — this gate is a basic access deterrent, not secure authentication.
          </p>
        </form>
      </div>
    );
  }

  return <>{children(logout)}</>;
}
