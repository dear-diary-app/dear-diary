-- Optional service-only clock/single-device inputs make schedule verification isolated.
drop function public.claim_diary_reminders();
create function public.claim_diary_reminders(p_at timestamptz default now(), p_only uuid default null) returns table(subscription_id uuid,endpoint text,p256dh text,auth text,event text,day date)
language sql security definer set search_path=public as $$
 with clock as (select p_at at time zone 'Asia/Kolkata' as t),
 due as (
 select s.id,s.endpoint,s.p256dh,s.auth,e.event,c.t::date as day
 from push_subscriptions s cross join clock c
 cross join (values ('open',time '06:00'),('lock',time '21:45'),('published',time '22:00')) as e(event,at)
 left join app_settings a on a.user_id=s.user_id
 where (p_only is null or s.id=p_only) and c.t::time >= e.at and c.t::time < e.at + interval '10 minutes'
 and coalesce((a.notifications->>e.event)::boolean,true)
 ), claimed as (
 insert into push_deliveries(subscription_id,event,day)
 select id,event,day from due on conflict do nothing returning subscription_id,event,day
 )
 select d.id,d.endpoint,d.p256dh,d.auth,d.event,d.day from due d join claimed c on c.subscription_id=d.id and c.event=d.event and c.day=d.day;
$$;
revoke all on function public.claim_diary_reminders(timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.claim_diary_reminders(timestamptz,uuid) to service_role;
