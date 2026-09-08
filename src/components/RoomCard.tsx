'use client';

import { ArrowUpRight, Users } from 'lucide-react';
import type { Room } from '@/lib/database.types';

type RoomCardProps = {
  room: Room & { memberCount?: number };
  accent?: 'lime' | 'blue' | 'orange';
  onOpen?: (room: Room) => void;
};

const accents = {
  lime: 'bg-lime-300 text-slate-950',
  blue: 'bg-sky-300 text-slate-950',
  orange: 'bg-orange-300 text-slate-950',
};

export function RoomCard({ room, accent = 'lime', onOpen }: RoomCardProps) {
  return (
    <article className="group relative flex min-h-52 flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.1]">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/[0.04] blur-2xl transition group-hover:bg-white/[0.08]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${accents[accent]}`}>
            Active room
          </span>
          <h3 className="mt-5 max-w-[14rem] text-xl font-semibold tracking-tight text-white">{room.name}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{room.description || 'A focused space for your team to think together.'}</p>
        </div>
        <button aria-label={`Open ${room.name}`} onClick={() => onOpen?.(room)} className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white hover:text-slate-950">
          <ArrowUpRight size={17} />
        </button>
      </div>
      <div className="relative mt-8 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-2"><Users size={15} /> {room.memberCount ?? 1} members</span>
        <span className="font-mono text-[11px] tracking-widest text-slate-500">{room.room_code ?? room.invite_code}</span>
      </div>
    </article>
  );
}
