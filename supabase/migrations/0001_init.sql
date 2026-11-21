-- Dear Diary, Prompt 2: auth + database foundation
-- Two-user private diary for Joydeep and Aruba.

create extension if not exists pgcrypto;

-- 1. profiles: one row per auth user (Joydeep, Aruba)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2. friendship: exactly one row connecting the two users
create table public.friendship (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references public.profiles (id) on delete cascade,
  user2_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friendship_pair_unique unique (user1_id, user2_id),
  constraint friendship_no_self check (user1_id <> user2_id)
);

-- 3. diary_entries: one entry per user per calendar date
create table public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_date date not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published')),
  constraint diary_entries_one_per_day unique (user_id, entry_date)
);

-- 4. entry_photos: private-storage photos attached to an entry
create table public.entry_photos (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.diary_entries (id) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 5. reactions: one emoji reaction per user per entry
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.diary_entries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now(),
  unique (entry_id, user_id)
);

-- 6. diary_pins: hashed PINs, service-role access only (verified via Edge Function)
create table public.diary_pins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- 7. app_settings: per-user display + notification preferences
create table public.app_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'light',
  font text not null default 'serif',
  accent_color text not null default 'blush',
  notifications jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_entries_touch before update on public.diary_entries
  for each row execute function public.touch_updated_at();
create trigger trg_pins_touch before update on public.diary_pins
  for each row execute function public.touch_updated_at();
create trigger trg_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- helper: the other member of my friendship
create or replace function public.friend_id(of_user uuid)
returns uuid language sql stable security definer
set search_path = public as $$
  select case when f.user1_id = of_user then f.user2_id else f.user1_id end
  from public.friendship f
  where f.user1_id = of_user or f.user2_id = of_user
  limit 1;
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.friendship enable row level security;
alter table public.diary_entries enable row level security;
alter table public.entry_photos enable row level security;
alter table public.reactions enable row level security;
alter table public.diary_pins enable row level security;
alter table public.app_settings enable row level security;

-- profiles: friends can see each other's profiles; only you can edit yours
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or id = public.friend_id(auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- friendship: members can read their own friendship row; only service role writes it
create policy friendship_select on public.friendship for select to authenticated
  using (user1_id = auth.uid() or user2_id = auth.uid());

-- diary_entries: you manage your own entries; your friend reads only published ones
create policy entries_select_own on public.diary_entries for select to authenticated
  using (user_id = auth.uid());
create policy entries_select_friend on public.diary_entries for select to authenticated
  using (user_id = public.friend_id(auth.uid()) and status = 'published');
create policy entries_insert_own on public.diary_entries for insert to authenticated
  with check (user_id = auth.uid() and status = 'draft');
create policy entries_update_own on public.diary_entries for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy entries_delete_own on public.diary_entries for delete to authenticated
  using (user_id = auth.uid());

-- entry_photos: follows entry visibility; only the entry owner manages photos
create policy photos_select on public.entry_photos for select to authenticated
  using (exists (
    select 1 from public.diary_entries e
    where e.id = entry_id
      and (e.user_id = auth.uid() or (e.user_id = public.friend_id(auth.uid()) and e.status = 'published'))
  ));
create policy photos_insert on public.entry_photos for insert to authenticated
  with check (exists (
    select 1 from public.diary_entries e where e.id = entry_id and e.user_id = auth.uid()
  ));
create policy photos_delete on public.entry_photos for delete to authenticated
  using (exists (
    select 1 from public.diary_entries e where e.id = entry_id and e.user_id = auth.uid()
  ));

-- reactions: readable wherever the entry is; you manage only your own reaction
create policy reactions_select on public.reactions for select to authenticated
  using (exists (
    select 1 from public.diary_entries e
    where e.id = entry_id
      and (e.user_id = auth.uid() or (e.user_id = public.friend_id(auth.uid()) and e.status = 'published'))
  ));
create policy reactions_insert on public.reactions for insert to authenticated
  with check (user_id = auth.uid());
create policy reactions_update on public.reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reactions_delete on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- diary_pins: no direct table access at all; the Edge Function uses the service role
-- (RLS enabled above with zero policies = deny all for anon/authenticated)

-- app_settings: private to each user
create policy settings_select on public.app_settings for select to authenticated
  using (user_id = auth.uid());
create policy settings_insert on public.app_settings for insert to authenticated
  with check (user_id = auth.uid());
create policy settings_update on public.app_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- private photo storage bucket
insert into storage.buckets (id, name, public)
values ('diary-photos', 'diary-photos', false)
on conflict (id) do nothing;

create policy photos_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'diary-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'diary-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'diary-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'diary-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- friend read access to photos of published entries happens via signed URLs
-- minted by the Edge Function / owner path, not by opening the bucket.
