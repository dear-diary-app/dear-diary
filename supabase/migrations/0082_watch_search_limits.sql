-- Durable pair-authorized rate limit, not per-worker in-memory state. No queries stored.
create table public.watch_search_limits(user_id uuid primary key references public.profiles(id)on delete cascade,minute_at timestamptz not null,minute_count integer not null,day_at date not null,day_count integer not null);
alter table public.watch_search_limits enable row level security;
revoke all on public.watch_search_limits from public,anon,authenticated;
create function public.watch_search_allow()returns boolean language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); t timestamptz:=clock_timestamp(); r public.watch_search_limits;
begin
 if uid is null or public.friend_id(uid)is null then return false;end if;
 insert into public.watch_search_limits values(uid,t,0,(t at time zone 'UTC')::date,0)on conflict do nothing;
 select * into r from public.watch_search_limits where user_id=uid for update;
 if r.minute_at<t-interval '1 minute' then r.minute_at:=t;r.minute_count:=0;end if;
 if r.day_at<>(t at time zone 'UTC')::date then r.day_at:=(t at time zone 'UTC')::date;r.day_count:=0;end if;
 if r.minute_count>=6 or r.day_count>=10000 then return false;end if;
 update public.watch_search_limits set minute_at=r.minute_at,minute_count=r.minute_count+1,day_at=r.day_at,day_count=r.day_count+1 where user_id=uid;return true;
end$$;
revoke all on function public.watch_search_allow()from public,anon;
grant execute on function public.watch_search_allow()to authenticated;
