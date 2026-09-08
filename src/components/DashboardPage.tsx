'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Clock3, Plus, UsersRound } from 'lucide-react';
import { DashboardLayout } from './DashboardLayout';
import { RoomCard } from './RoomCard';
import { RoomForms } from './RoomForms';
import { AuthPanel } from './AuthPanel';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { Room } from '@/lib/database.types';

export function DashboardPage() {
  const { session, user, loading: authLoading, error: authError, logout } = useAuth();
  const [rooms, setRooms] = useState<Array<Room & { memberCount: number }>>([]);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomError, setRoomError] = useState('');

  const loadRooms = useCallback(async () => {
    if (!user) return;
    setLoadingRooms(true); setRoomError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: roomData, error: roomsError } = await supabase.rpc('get_my_rooms');
      if (roomsError) throw roomsError;
      setRooms(roomData.map((room) => ({
        id: room.id,
        name: room.name,
        description: room.description,
        owner_id: room.host_id,
        invite_code: room.room_code,
        host_id: room.host_id,
        room_code: room.room_code,
        status: room.status,
        created_at: room.created_at,
        memberCount: room.member_count,
      })));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '';
      setRoomError(message.includes('get_my_rooms') || message.includes('PGRST202')
        ? 'The Supabase room function is not deployed yet. Run the latest supabase/schema.sql in the Supabase SQL Editor, then refresh this page.'
        : message || 'Unable to load rooms.');
    } finally { setLoadingRooms(false); }
  }, [user]);

  useEffect(() => { queueMicrotask(() => { void loadRooms(); }); }, [loadRooms]);

  if (authLoading) return <main className="grid min-h-screen place-items-center bg-[#071019] text-sm text-slate-400">Loading your workspace...</main>;
  if (!session || !user) {
    const message = authError?.message;
    return <><div className="pointer-events-none fixed left-5 top-5 z-10 text-xl font-semibold tracking-tight text-white">cora<span className="text-lime-300">.</span></div><div className="relative">{message && <p className="absolute inset-x-5 top-20 z-10 mx-auto max-w-md rounded-2xl border border-orange-300/20 bg-orange-300/10 px-4 py-3 text-center text-sm text-orange-100">{message}</p>}<AuthPanel /></div></>;
  }

  return <DashboardLayout user={user} onLogout={() => void logout()}><div className="animate-rise"><section className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="text-sm font-medium text-lime-300">Tuesday, September 8, 2026</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Good work starts<br /><span className="text-slate-500">with good space.</span></h1></div><button onClick={() => setShowRoomForm(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-lime-300 px-5 py-3.5 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-lime-200"><Plus size={17} />New room</button></section><section className="mt-12 grid gap-4 md:grid-cols-3"><div className="bento-panel md:col-span-2"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Your rhythm</p><p className="mt-3 text-3xl font-semibold text-white">4h 28m <span className="text-base font-normal text-slate-500">focused this week</span></p></div><span className="rounded-full bg-lime-300/10 px-3 py-1.5 text-xs font-semibold text-lime-300">+18%</span></div><div className="mt-8 flex h-16 items-end gap-2">{[35, 50, 44, 70, 53, 84, 62, 76, 92, 70, 58, 78, 66, 88].map((height, index) => <div key={index} className={`flex-1 rounded-t-md ${index > 10 ? 'bg-lime-300' : 'bg-white/10'}`} style={{ height: `${height}%` }} />)}</div><div className="mt-3 flex justify-between text-[10px] uppercase tracking-widest text-slate-600"><span>Mon</span><span>Today</span><span>Sun</span></div></div><div className="bento-panel flex flex-col justify-between"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Next up</p><Clock3 size={18} className="text-slate-500" /></div><div><p className="mt-7 text-lg font-semibold text-white">Weekly sync</p><p className="mt-1 text-sm text-slate-500">Today, 4:00 PM</p></div><button className="mt-6 flex items-center gap-2 text-sm font-semibold text-lime-300">View schedule <ArrowUpRight size={15} /></button></div></section><section className="mt-12"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Spaces you belong to</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Your rooms</h2></div><span className="flex items-center gap-2 text-sm text-slate-500"><UsersRound size={15} /> {rooms.length} total</span></div>{roomError && <p className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-300/10 px-4 py-3 text-sm text-orange-100">{roomError}</p>}{loadingRooms ? <p className="mt-6 text-sm text-slate-500">Loading rooms...</p> : rooms.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rooms.map((room, index) => <RoomCard key={room.id} room={room} accent={(['lime', 'blue', 'orange'] as const)[index % 3]} />)}</div> : <div className="mt-5 rounded-3xl border border-dashed border-white/15 px-6 py-12 text-center"><p className="text-white">Your first room is waiting.</p><p className="mt-2 text-sm text-slate-500">Create a room or join your team with an invite code.</p></div>}</section></div>{showRoomForm && <RoomForms userId={user.id} onCreated={() => { setShowRoomForm(false); void loadRooms(); }} onClose={() => setShowRoomForm(false)} />}</DashboardLayout>;
}
