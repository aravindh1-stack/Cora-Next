'use client';

import { Bell, LogOut, Search, Sparkles } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

type NavigationHeaderProps = { user?: User; onLogout?: () => void };

export function NavigationHeader({ user, onLogout }: NavigationHeaderProps) {
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'CO';
  return (
    <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-8 lg:px-10">
      <div className="flex items-center gap-3 text-sm font-semibold tracking-tight text-white lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-xl bg-lime-300 text-slate-950"><Sparkles size={16} /></span>cora</div>
      <div className="relative hidden max-w-sm flex-1 lg:block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><input aria-label="Search rooms" className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-lime-300/50" placeholder="Search rooms, people, or updates" /></div>
      <div className="ml-auto flex items-center gap-3"><button aria-label="Notifications" className="rounded-full border border-white/10 p-2.5 text-slate-400 hover:bg-white/10 hover:text-white"><Bell size={17} /></button><div className="hidden text-right sm:block"><p className="text-sm font-medium text-white">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest'}</p><p className="text-xs text-slate-500">Workspace member</p></div><div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-lime-300 to-cyan-300 text-xs font-bold text-slate-950">{initials}</div>{onLogout && <button aria-label="Sign out" onClick={onLogout} className="rounded-full p-2 text-slate-500 hover:bg-white/10 hover:text-white"><LogOut size={16} /></button>}</div>
    </header>
  );
}
