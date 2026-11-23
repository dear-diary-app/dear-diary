create table public.profile_songs (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 song jsonb not null check(jsonb_typeof(song)='object' and octet_length(song::text)<=2000),
 expires_at timestamptz not null default(now()+interval '24 hours'),
 updated_at timestamptz not null default now()
);
create function public.profile_song_expiry() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=now();new.expires_at=now()+interval '24 hours';return new;end$$;
create trigger profile_song_expiry before insert or update on public.profile_songs for each row execute function public.profile_song_expiry();
alter table public.profile_songs enable row level security;
create policy profile_songs_read on public.profile_songs for select to authenticated using((user_id=auth.uid() or user_id=public.friend_id(auth.uid())) and expires_at>now());
grant select on public.profile_songs to authenticated;
create function public.set_profile_song(value jsonb) returns timestamptz language plpgsql security definer set search_path=public as $$
declare deadline timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if value is null then delete from public.profile_songs where user_id=auth.uid();return null;end if;
 if jsonb_typeof(value) <> 'object' or octet_length(value::text)>2000 or not(value ?& array['id','name','artist','art','url','store']) then raise exception 'Invalid song';end if;
 insert into public.profile_songs(user_id,song) values(auth.uid(),value) on conflict(user_id) do update set song=excluded.song returning expires_at into deadline;
 return deadline;
end$$;
revoke all on function public.set_profile_song(jsonb) from public,anon;
grant execute on function public.set_profile_song(jsonb) to authenticated;
