'use client';

import { ArrowUpRight, BarChart3, CalendarDays, Layers3, Settings2 } from 'lucide-react';
import { AuthPanel } from './AuthPanel';
import { DashboardLayout } from './DashboardLayout';
import { useAuth } from '@/hooks/useAuth';

type WorkspaceSection = 'rooms' | 'schedule' | 'insights' | 'settings';

const content: Record<WorkspaceSection, { eyebrow: string; title: string; description: string; icon: typeof Layers3 }> = {
  rooms: { eyebrow: 'Workspace', title: 'Your rooms', description: 'Open a focused space, invite your team, and keep every conversation moving.', icon: Layers3 },
  schedule: { eyebrow: 'Planning', title: 'Schedule', description: 'Keep your important conversations and team rituals visible in one calm place.', icon: CalendarDays },
  insights: { eyebrow: 'Signals', title: 'Insights', description: 'See the patterns behind your team’s focus and make better decisions with context.', icon: BarChart3 },
  settings: { eyebrow: 'Workspace', title: 'Settings', description: 'Manage your account and workspace preferences.', icon: Settings2 },
};

export function WorkspaceView({ section }: { section: WorkspaceSection }) {
  const { session, user, loading, error, logout } = useAuth();
  const selected = content[section];
  const Icon = selected.icon;

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#071019] text-sm text-slate-400">Loading your workspace...</main>;
  if (!session || !user) return <AuthPanel />;

  return <DashboardLayout user={user} onLogout={() => void logout()}><div className="animate-rise"><div className="max-w-2xl"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-300 text-slate-950"><Icon size={21} /></div><p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-lime-300">{selected.eyebrow}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{selected.title}</h1><p className="mt-4 text-base leading-7 text-slate-400">{selected.description}</p></div>{error && <p className="mt-8 rounded-2xl border border-orange-300/20 bg-orange-300/10 px-4 py-3 text-sm text-orange-100">{error.message}</p>}<section className="mt-12 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8"><p className="text-lg font-semibold text-white">This view is ready for your workspace data.</p><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Connect the next workflow here without leaving the shared navigation and authentication context.</p><button className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-lime-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-lime-200">Open overview <ArrowUpRight size={16} /></button></section></div></DashboardLayout>;
}