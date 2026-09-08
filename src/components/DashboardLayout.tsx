'use client';

import { BarChart3, CalendarDays, Command, Home, Layers3, Settings2, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { NavigationHeader } from './NavigationHeader';
import type { User } from '@supabase/supabase-js';

type DashboardLayoutProps = { children: ReactNode; user?: User; onLogout?: () => void };

const links = [{ label: 'Overview', href: '/', icon: Home }, { label: 'Rooms', href: '/rooms', icon: Layers3 }, { label: 'Schedule', href: '/schedule', icon: CalendarDays }, { label: 'Insights', href: '/insights', icon: BarChart3 }];

export function DashboardLayout({ children, user, onLogout }: DashboardLayoutProps) {
  return <div className="min-h-screen bg-[#071019] text-slate-100"><aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/10 bg-[#09131d] px-5 py-7 lg:flex"><div className="flex items-center gap-3 px-3 text-lg font-semibold tracking-tight text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-lime-300 text-slate-950"><Sparkles size={18} /></span>cora</div><p className="mb-4 mt-14 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Workspace</p><nav className="space-y-1">{links.map(({ label, href, icon: Icon }) => <Link href={href} key={label} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-slate-500 transition hover:bg-white/5 hover:text-slate-200"><Icon size={17} />{label}</Link>)}</nav><div className="mt-auto rounded-3xl border border-lime-300/20 bg-lime-300/[0.07] p-4"><Command className="mb-5 text-lime-300" size={20} /><p className="text-sm font-medium text-white">Make space for good work.</p><p className="mt-2 text-xs leading-5 text-slate-500">Your team has 3 open threads waiting for attention.</p></div><Link href="/settings" className="mt-5 flex items-center gap-3 px-3 text-sm text-slate-500 hover:text-white"><Settings2 size={17} />Settings</Link></aside><div className="lg:pl-64"><NavigationHeader user={user} onLogout={onLogout} /><main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">{children}</main></div></div>;
}
