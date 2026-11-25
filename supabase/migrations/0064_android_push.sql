create table public.android_push_tokens(token text primary key check(length(token) between 20 and 4096),user_id uuid not null references auth.users(id) on delete cascade,updated_at timestamptz not null default now());
alter table public.android_push_tokens enable row level security;
revoke all on public.android_push_tokens from public,anon,authenticated;
grant all on public.android_push_tokens to service_role;
create table public.android_push_deliveries(token text not null references public.android_push_tokens(token) on delete cascade,event text not null,day date not null,primary key(token,event,day));
alter table public.android_push_deliveries enable row level security;
revoke all on public.android_push_deliveries from public,anon,authenticated;
grant all on public.android_push_deliveries to service_role;
create function public.claim_android_reminders(p_at timestamptz default now()) returns table(token text,user_id uuid,event text,day date) language sql security definer set search_path=public as $$
with clock as(select p_at at time zone 'Asia/Kolkata' as t),due as(
 select s.token,s.user_id,e.event,c.t::date as day from android_push_tokens s cross join clock c
 cross join(values('open',time '06:00'),('writing',time '21:00'),('lock',time '21:45'),('published',time '22:00'))e(event,at)
 left join app_settings a on a.user_id=s.user_id
 where c.t::time>=e.at and c.t::time<e.at+interval '10 minutes' and coalesce((a.notifications->>e.event)::boolean,e.event<>'writing')
),claimed as(insert into android_push_deliveries select token,event,day from due on conflict do nothing returning *)
select d.* from due d join claimed c using(token,event,day);
$$;
revoke all on function public.claim_android_reminders(timestamptz) from public,anon,authenticated;
grant execute on function public.claim_android_reminders(timestamptz) to service_role;
