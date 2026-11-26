-- Separate inbox songs. Profile songs and chat status are unchanged.
create table public.inbox_songs (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 song jsonb not null check(jsonb_typeof(song)='object' and octet_length(song::text)<=2000),
 expires_at timestamptz not null default(now()+interval '24 hours')
);
alter table public.inbox_songs enable row level security;
revoke all on public.inbox_songs from public,anon,authenticated;
grant select on public.inbox_songs to authenticated;
create policy inbox_songs_pair_read on public.inbox_songs for select to authenticated using((user_id=auth.uid() or user_id=public.friend_id(auth.uid())) and expires_at>now());
create function public.set_inbox_song(value jsonb) returns timestamptz language plpgsql security definer set search_path=public as $$
declare deadline timestamptz:=clock_timestamp()+interval '24 hours';begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if value is null then delete from public.inbox_songs where user_id=auth.uid();return null;end if;
 if jsonb_typeof(value)<>'object' or octet_length(value::text)>2000 or not(value ?& array['id','name','artist','art','url']) or jsonb_typeof(value->'name') is distinct from 'string' or jsonb_typeof(value->'artist') is distinct from 'string' or jsonb_typeof(value->'art') is distinct from 'string' or jsonb_typeof(value->'url') is distinct from 'string' or jsonb_typeof(value->'id') is distinct from 'number' or (value->>'id')::numeric<=0 or char_length(value->>'name') not between 1 and 120 or char_length(value->>'artist') not between 1 and 120 or value->>'art' !~ '^https://[a-zA-Z0-9.-]+\.(mzstatic|apple)\.com/' or value->>'url' !~ '^https://[a-zA-Z0-9.-]+\.(mzstatic|apple)\.com/' then raise exception 'Invalid song';end if;
 insert into public.inbox_songs(user_id,song,expires_at) values(auth.uid(),value,deadline) on conflict(user_id) do update set song=excluded.song,expires_at=excluded.expires_at;
 return deadline;end$$;
revoke all on function public.set_inbox_song(jsonb) from public,anon;
grant execute on function public.set_inbox_song(jsonb) to authenticated;
