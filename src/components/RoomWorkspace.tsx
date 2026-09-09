'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Hash, Pause, Play, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AuthPanel } from './AuthPanel';
import { DashboardLayout } from './DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type Provider = 'youtube' | 'spotify';
type MediaItem = { provider: Provider; title: string; mediaUrl: string; embedUrl: string; externalUrl: string };
type PlaybackTarget = { isPlaying: boolean; timestamp: number; playbackRate: number };
type RoomStateRow = { room_code: string; current_url: string | null; media_type: Provider | null; title: string | null; is_playing: boolean; timestamp: number; playback_rate?: number };
type MediaChangePayload = { mediaUrl: string; title: string; mediaType: Provider };
type PlayPausePayload = { isPlaying: boolean; currentTime: number; playbackRate?: number };
type SeekPayload = { currentTime: number };

export function RoomWorkspace({ roomCode }: { roomCode: string }) {
  const { session, user, loading, logout } = useAuth();
  const [provider, setProvider] = useState<Provider>('youtube');
  const [query, setQuery] = useState('');
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTimestamp, setPlaybackTimestamp] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [searchError, setSearchError] = useState('');
  const [channelError, setChannelError] = useState('');
  const [copied, setCopied] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelReadyRef = useRef(false);
  const remoteUpdateRef = useRef(false);
  const mediaRef = useRef<MediaItem | null>(null);
  const providerRef = useRef<Provider>('youtube');
  const isPlayingRef = useRef(false);
  const timestampRef = useRef(0);
  const playbackRateRef = useRef(1);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerReadyRef = useRef(false);
  const pendingTargetRef = useRef<PlaybackTarget | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryStartRef = useRef<number | null>(null);
  const suppressPlayerEventsUntilRef = useRef(0);

  useEffect(() => {
    mediaRef.current = media;
    providerRef.current = provider;
    isPlayingRef.current = isPlaying;
    timestampRef.current = playbackTimestamp;
    playbackRateRef.current = playbackRate;
  }, [media, provider, isPlaying, playbackTimestamp, playbackRate]);

  function sendPlayerCommands(target: PlaybackTarget, includeSeek: boolean) {
    const frame = iframeRef.current;
    if (!playerReadyRef.current || !frame?.contentWindow) return;
    const post = (func: string, args: unknown[] = []) => {
      frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args, id: Date.now() }), 'https://www.youtube.com');
    };
    if (includeSeek) post('seekTo', [Math.max(0, target.timestamp), true]);
    post('setPlaybackRate', [target.playbackRate]);
    post(target.isPlaying ? 'playVideo' : 'pauseVideo');
  }

  function reconcilePlayer(target: PlaybackTarget) {
    pendingTargetRef.current = target;
    if (retryTimerRef.current) window.clearInterval(retryTimerRef.current);
    if (retryStartRef.current) window.clearTimeout(retryStartRef.current);

    retryStartRef.current = window.setTimeout(() => {
      sendPlayerCommands(target, true);
      retryTimerRef.current = window.setInterval(() => sendPlayerCommands(target, false), 500);
      window.setTimeout(() => {
        if (retryTimerRef.current) window.clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }, 3000);
    }, 200);
  }

  function handlePlayerReady() {
    playerReadyRef.current = true;
    const frame = iframeRef.current?.contentWindow;
    const send = (message: object) => frame?.postMessage(JSON.stringify(message), 'https://www.youtube.com');
    send({ event: 'listening', id: 1 });
    send({ event: 'command', func: 'addEventListener', args: ['onStateChange'] });
    send({ event: 'command', func: 'addEventListener', args: ['onPlaybackRateChange'] });
    send({ event: 'command', func: 'addEventListener', args: ['infoDelivery'] });
    if (pendingTargetRef.current) sendPlayerCommands(pendingTargetRef.current, true);
  }

  function handlePlayerMessage(event: MessageEvent) {
    if (!event.origin.includes('youtube.com') || typeof event.data !== 'string') return;
    let message: { event?: string; info?: unknown };
    try { message = JSON.parse(event.data) as { event?: string; info?: unknown }; } catch { return; }
    if (message.event !== 'onStateChange' && message.event !== 'onPlaybackRateChange' && message.event !== 'infoDelivery') return;

    if (message.event === 'onPlaybackRateChange' && typeof message.info === 'number') {
      const nextRate = message.info;
      setPlaybackRate(nextRate);
      if (Date.now() < suppressPlayerEventsUntilRef.current) return;
      broadcast('play_pause', { isPlaying: isPlayingRef.current, currentTime: timestampRef.current, playbackRate: nextRate });
      void saveRoomState({ room_code: roomCode, current_url: mediaRef.current?.mediaUrl ?? null, media_type: mediaRef.current?.provider ?? null, title: mediaRef.current?.title ?? null, is_playing: isPlayingRef.current, timestamp: timestampRef.current, playback_rate: nextRate });
      return;
    }

    const info = message.info as { currentTime?: number } | undefined;
    const playerState = typeof message.info === 'number' ? message.info : undefined;
    if (message.event === 'infoDelivery' && typeof info?.currentTime === 'number') {
      setPlaybackTimestamp(info.currentTime);
      timestampRef.current = info.currentTime;
    }
    if (message.event === 'onStateChange' && (playerState === 1 || playerState === 2)) {
      const nextPlaying = playerState === 1;
      setIsPlaying(nextPlaying);
      if (Date.now() < suppressPlayerEventsUntilRef.current) return;
      broadcast('play_pause', { isPlaying: nextPlaying, currentTime: timestampRef.current, playbackRate: playbackRateRef.current });
      void saveRoomState({ room_code: roomCode, current_url: mediaRef.current?.mediaUrl ?? null, media_type: mediaRef.current?.provider ?? null, title: mediaRef.current?.title ?? null, is_playing: nextPlaying, timestamp: timestampRef.current, playback_rate: playbackRateRef.current });
    }
  }

  async function saveRoomState(nextState: RoomStateRow) {
    const { error } = await getSupabaseBrowserClient().from('room_states').upsert(nextState, { onConflict: 'room_code' });
    if (error) setChannelError(`Playback state could not be saved: ${error.message}`);
  }

  useEffect(() => {
    if (!session) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`room:${roomCode}`);
    channelRef.current = channel;

    function applyRoomState(nextState: RoomStateRow) {
      const nextMedia = nextState.current_url && nextState.media_type
        ? nextState.media_type === 'youtube' ? parseYouTube(nextState.current_url) : parseSpotify(nextState.current_url)
        : null;
      remoteUpdateRef.current = true;
      setMedia(nextMedia ? { ...nextMedia, title: nextState.title || nextMedia.title } : null);
      setProvider(nextState.media_type || 'youtube');
      setIsPlaying(nextState.is_playing);
      setPlaybackTimestamp(nextState.timestamp);
      setPlaybackRate(nextState.playback_rate ?? 1);
      suppressPlayerEventsUntilRef.current = Date.now() + 1500;
      reconcilePlayer({ isPlaying: nextState.is_playing, timestamp: nextState.timestamp, playbackRate: nextState.playback_rate ?? 1 });
      window.setTimeout(() => { remoteUpdateRef.current = false; }, 0);
    }

    channel
      .on('broadcast', { event: 'media_change' }, ({ payload }: { payload: MediaChangePayload }) => {
        if (!payload?.mediaUrl || !payload.title || !payload.mediaType) return;
        const nextMedia = payload.mediaType === 'youtube' ? parseYouTube(payload.mediaUrl) : parseSpotify(payload.mediaUrl);
        if (!nextMedia || (mediaRef.current?.mediaUrl === nextMedia.mediaUrl && providerRef.current === payload.mediaType)) return;
        applyRoomState({ room_code: roomCode, current_url: payload.mediaUrl, media_type: payload.mediaType, title: payload.title, is_playing: true, timestamp: 0 });
      })
      .on('broadcast', { event: 'play_pause' }, ({ payload }: { payload: PlayPausePayload }) => {
        if (!payload || typeof payload.isPlaying !== 'boolean' || typeof payload.currentTime !== 'number') return;
        if (payload.isPlaying === isPlayingRef.current && payload.currentTime === timestampRef.current && (payload.playbackRate ?? 1) === playbackRateRef.current) return;
        applyRoomState({ room_code: roomCode, current_url: mediaRef.current?.mediaUrl ?? null, media_type: mediaRef.current?.provider ?? null, title: mediaRef.current?.title ?? null, is_playing: payload.isPlaying, timestamp: payload.currentTime, playback_rate: payload.playbackRate ?? 1 });
      })
      .on('broadcast', { event: 'seek' }, ({ payload }: { payload: SeekPayload }) => {
        if (!payload || typeof payload.currentTime !== 'number' || payload.currentTime === timestampRef.current) return;
        applyRoomState({ room_code: roomCode, current_url: mediaRef.current?.mediaUrl ?? null, media_type: mediaRef.current?.provider ?? null, title: mediaRef.current?.title ?? null, is_playing: isPlayingRef.current, timestamp: payload.currentTime });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          channelReadyRef.current = false;
          setChannelError('Live playback sync is unavailable.');
        }
        if (status === 'SUBSCRIBED') {
          channelReadyRef.current = true;
          setChannelError('');
          void supabase.from('room_states').select('room_code,current_url,media_type,title,is_playing,timestamp,playback_rate').eq('room_code', roomCode).maybeSingle().then(({ data, error }) => {
            if (error) setChannelError(`Room sync state could not be loaded: ${error.message}`);
            else if (data) applyRoomState(data as RoomStateRow);
          });
        }
      });

      window.addEventListener('message', handlePlayerMessage);

    return () => {
        window.removeEventListener('message', handlePlayerMessage);
      channelReadyRef.current = false;
      channelRef.current = null;
      playerReadyRef.current = false;
      if (retryTimerRef.current) window.clearInterval(retryTimerRef.current);
      if (retryStartRef.current) window.clearTimeout(retryStartRef.current);
      void supabase.removeChannel(channel);
    };
    // Refs intentionally keep this room channel stable while playback changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, session]);

  function broadcast(event: 'media_change' | 'play_pause' | 'seek', payload: object) {
    if (remoteUpdateRef.current || !channelReadyRef.current || !channelRef.current) return;
    void channelRef.current.send({ type: 'broadcast', event, payload });
  }

  function addMedia(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchError('');
    const parsed = provider === 'youtube' ? parseYouTube(query.trim()) : parseSpotify(query.trim());
    if (!parsed) {
      setSearchError(provider === 'youtube' ? 'Paste a YouTube video URL or ID.' : 'Paste a Spotify track URL or ID.');
      return;
    }
    setMedia(parsed);
    setProvider(parsed.provider);
    setIsPlaying(true);
    setPlaybackTimestamp(0);
    setPlaybackRate(1);
    reconcilePlayer({ isPlaying: true, timestamp: 0, playbackRate: 1 });
    void saveRoomState({ room_code: roomCode, current_url: parsed.mediaUrl, media_type: parsed.provider, title: parsed.title, is_playing: true, timestamp: 0, playback_rate: 1 });
    broadcast('media_change', { mediaUrl: parsed.mediaUrl, title: parsed.title, mediaType: parsed.provider });
    broadcast('play_pause', { isPlaying: true, currentTime: 0, playbackRate: 1 });
    }

  function togglePlayback() {
    if (!media) return;
    const nextIsPlaying = !isPlaying;
    setIsPlaying(nextIsPlaying);
    reconcilePlayer({ isPlaying: nextIsPlaying, timestamp: playbackTimestamp, playbackRate });
    void saveRoomState({ room_code: roomCode, current_url: media.mediaUrl, media_type: media.provider, title: media.title, is_playing: nextIsPlaying, timestamp: playbackTimestamp, playback_rate: playbackRate });
    broadcast('play_pause', { isPlaying: nextIsPlaying, currentTime: playbackTimestamp, playbackRate });
  }

  function seekMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const currentTime = Number(event.target.value);
    setPlaybackTimestamp(currentTime);
    reconcilePlayer({ isPlaying, timestamp: currentTime, playbackRate });
    if (media) void saveRoomState({ room_code: roomCode, current_url: media.mediaUrl, media_type: media.provider, title: media.title, is_playing: isPlaying, timestamp: currentTime, playback_rate: playbackRate });
    broadcast('seek', { currentTime });
  }

  async function copyRoomCode() {
    await navigator.clipboard?.writeText(roomCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#071019] text-sm text-slate-400">Loading your workspace...</main>;
  if (!session || !user) return <AuthPanel />;

  const playerUrl = media ? buildEmbedUrl(media) : '';

  return (
    <DashboardLayout user={user} onLogout={() => void logout()}>
      <div className="animate-rise">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white"><ArrowLeft size={16} />Back to overview</Link>
            <div className="mt-8 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-300 text-slate-950"><Sparkles size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-300">Active room</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">Watch together</h1></div></div>
          </div>
          <button aria-label="Copy room code" onClick={() => void copyRoomCode()} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10">{copied ? <Check size={16} className="text-lime-300" /> : <Copy size={16} />}{copied ? 'Copied' : roomCode}</button>
        </div>
        {channelError && <p className="mt-6 rounded-2xl border border-orange-300/20 bg-orange-300/10 px-4 py-3 text-sm text-orange-100">{channelError}</p>}
        <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.75fr)]">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-black/25 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Now playing</p><h2 className="mt-1 font-semibold text-white">{media?.title ?? 'Your shared screen'}</h2></div>{media && <div className="flex items-center gap-2"><button aria-label={isPlaying ? 'Pause playback' : 'Play playback'} onClick={togglePlayback} className="rounded-full bg-lime-300 p-2 text-slate-950 hover:bg-lime-200">{isPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button><a href={media.externalUrl} target="_blank" rel="noreferrer" className="rounded-full p-2 text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Open media externally"><ExternalLink size={16} /></a></div>}</div>
            <div className="relative aspect-video bg-[#03070a]">{media ? <iframe key={media.mediaUrl} ref={iframeRef} onLoad={handlePlayerReady} className="h-full w-full" src={playerUrl} title={media.title} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen /> : <div className="grid h-full place-items-center p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-600"><Play size={23} /></div><p className="mt-5 text-sm font-medium text-slate-300">Choose something to play</p><p className="mt-2 text-xs leading-5 text-slate-600">Add a YouTube video or Spotify track from the panel.</p></div></div>}</div>
          </section>
          <aside className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl"><div className="flex items-center gap-2"><Search size={17} className="text-lime-300" /><h2 className="font-semibold text-white">Add to player</h2></div><div className="mt-5 grid grid-cols-2 rounded-2xl bg-black/20 p-1"><button onClick={() => { setProvider('youtube'); setQuery(''); }} className={`rounded-xl py-2.5 text-sm ${provider === 'youtube' ? 'bg-white/10 font-semibold text-white' : 'text-slate-500'}`}>YouTube</button><button onClick={() => { setProvider('spotify'); setQuery(''); }} className={`rounded-xl py-2.5 text-sm ${provider === 'spotify' ? 'bg-white/10 font-semibold text-white' : 'text-slate-500'}`}>Spotify</button></div><form onSubmit={addMedia} className="mt-5"><label className="text-xs font-medium text-slate-400">{provider === 'youtube' ? 'Video URL or ID' : 'Track URL or ID'}<div className="mt-2 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={provider === 'youtube' ? 'youtube.com/watch?v=...' : 'open.spotify.com/track/...'} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-lime-300/60" /><button aria-label="Play media" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lime-300 text-slate-950 hover:bg-lime-200"><Play size={16} fill="currentColor" /></button></div></label>{searchError && <p className="mt-3 rounded-2xl border border-red-300/20 bg-red-300/10 px-3 py-2 text-xs leading-5 text-red-200">{searchError}</p>}</form>{media && <label className="mt-6 block text-xs font-medium text-slate-400">Seek to <span className="font-mono text-slate-500">{playbackTimestamp}s</span><input aria-label="Seek media" type="range" min="0" max="3600" step="1" value={playbackTimestamp} onChange={seekMedia} className="mt-3 w-full accent-lime-300" /></label>}<p className="mt-6 text-xs leading-5 text-slate-600">Playback state is shared with everyone in this room.</p></aside>
        </div>
        <section className="mt-4 grid gap-4 md:grid-cols-3"><div className="bento-panel md:col-span-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Room code</p><div className="mt-3 flex items-center gap-3"><Hash size={18} className="text-lime-300" /><span className="font-mono text-xl tracking-[0.25em] text-white">{roomCode}</span></div></div><div className="bento-panel"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Playback</p><p className="mt-3 text-sm text-slate-400">{media ? `${media.provider} ${isPlaying ? 'playing' : 'paused'} at ${playbackTimestamp}s` : 'Waiting for a selection'}</p></div></section>
      </div>
    </DashboardLayout>
  );
}

function buildEmbedUrl(media: MediaItem) {
  if (media.provider !== 'youtube') return `${media.embedUrl}?autoplay=0`;
  const origin = typeof window === 'undefined' ? '' : `&origin=${encodeURIComponent(window.location.origin)}`;
  return `${media.embedUrl}?enablejsapi=1&autoplay=0&controls=1${origin}`;
}

function parseYouTube(value: string): MediaItem | null {
  const id = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1] ?? (value.match(/^[\w-]{11}$/) ? value : null);
  return id ? { provider: 'youtube', title: 'YouTube video', mediaUrl: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube.com/embed/${id}`, externalUrl: `https://www.youtube.com/watch?v=${id}` } : null;
}

function parseSpotify(value: string): MediaItem | null {
  const id = value.match(/open\.spotify\.com\/track\/([\w-]+)/)?.[1] ?? (value.match(/^[\w-]{22}$/) ? value : null);
  return id ? { provider: 'spotify', title: 'Spotify track', mediaUrl: `https://open.spotify.com/track/${id}`, embedUrl: `https://open.spotify.com/embed/track/${id}`, externalUrl: `https://open.spotify.com/track/${id}` } : null;
}
