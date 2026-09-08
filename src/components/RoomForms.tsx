'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Hash, Plus, X } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type RoomFormsProps = { userId: string; onCreated?: () => void; onClose?: () => void };

function makeInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export function RoomForms({ userId, onCreated, onClose }: RoomFormsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === 'create') {
        if (!name.trim()) throw new Error('Give your room a name first.');
        let room: { id: string } | null = null;
        let createdRoomCode = '';
        let createError: { code?: string; message: string } | null = null;

        for (let attempt = 0; attempt < 3 && !room; attempt += 1) {
          const roomId = crypto.randomUUID();
          const roomCode = makeInviteCode();
          const { error } = await supabase.from('rooms').insert({
            id: roomId,
            name: name.trim(),
            description: description.trim() || null,
            owner_id: userId,
            invite_code: roomCode,
            host_id: userId,
            room_code: roomCode,
            status: 'ACTIVE',
          });

          if (!error) {
            room = { id: roomId };
            createdRoomCode = roomCode;
          }
          if (error?.code === '23505') {
            createError = error;
            continue;
          }
          if (error) throw error;
        }
        if (!room) throw createError ?? new Error('Unable to create a room. Please try again.');
        const { error: memberError } = await supabase.from('room_members').upsert(
          { room_id: room.id, user_id: userId, role: 'owner' },
          { onConflict: 'room_id,user_id', ignoreDuplicates: true },
        );
        if (memberError) throw memberError;
        router.push(`/rooms/${createdRoomCode}`);
        return;
      } else {
        const code = inviteCode.trim().toUpperCase();
        if (!code) throw new Error('Enter an invite code to join a room.');
        const { data: rooms, error: roomError } = await supabase.rpc('find_room_by_invite_code', { code });
        const room = rooms?.[0];
        if (roomError || !room) throw new Error('That invite code does not match an active room.');
        const { error: memberError } = await supabase.from('room_members').upsert(
          { room_id: room.id, user_id: userId, role: 'member' },
          { onConflict: 'room_id,user_id', ignoreDuplicates: true },
        );
        if (memberError) throw memberError;
        router.push(`/rooms/${code}`);
        return;
      }
      setName(''); setDescription(''); setInviteCode(''); onCreated?.();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Something went wrong.'); } finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-20 grid place-items-center bg-slate-950/80 p-5 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#101d28] p-6 shadow-2xl shadow-black/40"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">Workspace action</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{mode === 'create' ? 'Create a new room' : 'Join a room'}</h2></div><button aria-label="Close" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-white/10 hover:text-white"><X size={18} /></button></div><div className="mt-6 grid grid-cols-2 rounded-2xl bg-black/20 p-1 text-sm"><button onClick={() => setMode('create')} className={`rounded-xl py-2.5 ${mode === 'create' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>Create room</button><button onClick={() => setMode('join')} className={`rounded-xl py-2.5 ${mode === 'join' ? 'bg-white/10 text-white' : 'text-slate-500'}`}>Join with code</button></div><form onSubmit={submit} className="mt-6 space-y-4">{mode === 'create' ? <><label className="block text-sm text-slate-300">Room name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-lime-300/60" placeholder="Product strategy" /></label><label className="block text-sm text-slate-300">Description <span className="text-slate-600">optional</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-lime-300/60" placeholder="What will this room help your team do?" /></label></> : <label className="block text-sm text-slate-300">Invite code<div className="relative mt-2"><Hash className="absolute left-4 top-3.5 text-slate-500" size={17} /><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm uppercase tracking-[0.2em] text-white outline-none focus:border-lime-300/60" placeholder="ABC123" /></div></label>}{error && <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}<button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving...' : mode === 'create' ? <><Plus size={17} />Create room</> : <><ArrowRight size={17} />Join room</>}</button></form></div></div>;
}
