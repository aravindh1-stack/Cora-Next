create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  owner_id uuid not null references public.users(id) on delete cascade,
  invite_code text not null unique,
  host_id uuid references public.users(id) on delete cascade,
  room_code text unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz not null default now()
);

alter table public.rooms add column if not exists host_id uuid references public.users(id) on delete cascade;
alter table public.rooms add column if not exists room_code text;
alter table public.rooms add column if not exists status text not null default 'ACTIVE';
update public.rooms set host_id = owner_id where host_id is null;
update public.rooms set room_code = invite_code where room_code is null;
alter table public.rooms drop constraint if exists rooms_status_check;
alter table public.rooms add constraint rooms_status_check check (status in ('ACTIVE', 'ARCHIVED'));
create unique index if not exists rooms_room_code_key on public.rooms(room_code);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.room_states (
  room_code text primary key,
  current_url text,
  media_type text check (media_type in ('youtube', 'spotify')),
  title text,
  is_playing boolean not null default false,
  "timestamp" double precision not null default 0,
  playback_rate double precision not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.room_states add column if not exists playback_rate double precision not null default 1;

alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_states enable row level security;

drop policy if exists "Users can view their profile" on public.users;
drop policy if exists "Users can create their profile" on public.users;
drop policy if exists "Users can update their profile" on public.users;
drop policy if exists "Members can view their rooms" on public.rooms;
drop policy if exists "Users can create rooms" on public.rooms;
drop policy if exists "Owners can update rooms" on public.rooms;
drop policy if exists "Members can view memberships" on public.room_members;
drop policy if exists "Users can join rooms" on public.room_members;
drop policy if exists "Users can leave rooms" on public.room_members;
drop policy if exists "Members can view room states" on public.room_states;
drop policy if exists "Members can insert room states" on public.room_states;
drop policy if exists "Members can update room states" on public.room_states;

create policy "Users can view their profile" on public.users for select using (auth.uid() = id);
create policy "Users can create their profile" on public.users for insert with check (auth.uid() = id);
create policy "Users can update their profile" on public.users for update using (auth.uid() = id);

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = target_room_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_room_owner(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms
    where id = target_room_id and (host_id = auth.uid() or owner_id = auth.uid())
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
revoke all on function public.is_room_owner(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.is_room_owner(uuid) to authenticated;

create policy "Members can view their rooms" on public.rooms for select using (
  public.is_room_owner(id) or public.is_room_member(id)
);
create policy "Users can create rooms" on public.rooms for insert with check (owner_id = auth.uid());
create policy "Owners can update rooms" on public.rooms for update using (owner_id = auth.uid());

create policy "Members can view memberships" on public.room_members for select using (
  user_id = auth.uid() or public.is_room_member(room_id) or public.is_room_owner(room_id)
);
create policy "Users can join rooms" on public.room_members for insert with check (user_id = auth.uid());
create policy "Users can leave rooms" on public.room_members for delete using (user_id = auth.uid());

create or replace function public.can_access_room_code(target_room_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms
    where room_code = upper(trim(target_room_code))
      and (host_id = auth.uid() or owner_id = auth.uid() or public.is_room_member(id))
  );
$$;

revoke all on function public.can_access_room_code(text) from public;
grant execute on function public.can_access_room_code(text) to authenticated;

create policy "Members can view room states" on public.room_states for select using (public.can_access_room_code(room_code));
create policy "Members can insert room states" on public.room_states for insert with check (public.can_access_room_code(room_code));
create policy "Members can update room states" on public.room_states for update using (public.can_access_room_code(room_code)) with check (public.can_access_room_code(room_code));

create or replace function public.find_room_by_invite_code(code text)
returns table (id uuid)
language sql
security definer
set search_path = public
as $$
  select rooms.id
  from public.rooms
  where auth.uid() is not null and (rooms.room_code = upper(trim(code)) or rooms.invite_code = upper(trim(code)))
  limit 1;
$$;

revoke all on function public.find_room_by_invite_code(text) from public;
grant execute on function public.find_room_by_invite_code(text) to authenticated;

drop function if exists public.get_my_rooms();
create or replace function public.get_my_rooms()
returns table (
  id uuid,
  name text,
  description text,
  host_id uuid,
  room_code text,
  status text,
  created_at timestamptz,
  member_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    rooms.id,
    rooms.name,
    rooms.description,
    coalesce(rooms.host_id, rooms.owner_id),
    coalesce(rooms.room_code, rooms.invite_code),
    rooms.status,
    rooms.created_at,
    count(room_members.id)::bigint as member_count
  from public.rooms
  join public.room_members on room_members.room_id = rooms.id
  where public.is_room_member(rooms.id) or public.is_room_owner(rooms.id)
  group by rooms.id
  order by rooms.created_at desc;
$$;

revoke all on function public.get_my_rooms() from public;
grant execute on function public.get_my_rooms() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

notify pgrst, 'reload schema';
