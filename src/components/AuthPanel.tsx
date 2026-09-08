'use client';

import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function AuthPanel() {
  const { login, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setMessage(''); const result = isRegistering ? await register(email, password, fullName) : await login(email, password); setSaving(false); setMessage(result.error ? result.error.message : isRegistering ? 'Check your inbox to confirm your account.' : 'Welcome back.'); }
  return <main className="grid min-h-screen place-items-center bg-[#071019] px-5 py-10"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-300 text-slate-950"><Sparkles size={21} /></div><p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-lime-300">Team workspace</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{isRegistering ? 'Build your space.' : 'Welcome back.'}</h1><p className="mt-3 text-sm leading-6 text-slate-400">{isRegistering ? 'Bring your best thinking into one calm, focused place.' : 'Pick up where your team left off.'}</p><form onSubmit={submit} className="mt-8 space-y-4">{isRegistering && <input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none focus:border-lime-300/60" />}<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Work email" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none focus:border-lime-300/60" /><input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none focus:border-lime-300/60" />{message && <p className="text-sm text-slate-300">{message}</p>}<button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 py-3.5 text-sm font-bold text-slate-950 hover:bg-lime-200 disabled:opacity-60">{saving ? 'Working...' : isRegistering ? 'Create account' : 'Sign in'}<ArrowRight size={17} /></button></form><button onClick={() => setIsRegistering(!isRegistering)} className="mt-6 w-full text-center text-sm text-slate-500 hover:text-white">{isRegistering ? 'Already have an account? Sign in' : 'New here? Create an account'}</button></div></main>;
}
