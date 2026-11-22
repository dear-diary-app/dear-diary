-- Explicit device opt-in only. No subscriptions are seeded for existing people.
create extension if not exists pg_net with schema extensions;
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint)<2048),
 p256dh text not null check(length(p256dh)<256),
 auth text not null check(length(auth)<128),
 created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_own on public.push_subscriptions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.push_subscriptions to authenticated;
create table public.push_deliveries (
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 event text not null check(event in ('open','lock','published')),
 day date not null,
 sent_at timestamptz not null default now(),
 primary key(subscription_id,event,day)
);
alter table public.push_deliveries enable row level security;
-- Service-only atomic claim prevents cron overlaps from sending twice.
create function public.claim_diary_reminders() returns table(subscription_id uuid,endpoint text,p256dh text,auth text,event text,day date)
language sql security definer set search_path=public as $$
 with clock as (select now() at time zone 'Asia/Kolkata' as t),
 due as (
 select s.id,s.endpoint,s.p256dh,s.auth,e.event,c.t::date as day
 from push_subscriptions s cross join clock c
 cross join (values ('open',time '06:00'),('lock',time '21:45'),('published',time '22:00')) as e(event,at)
 left join app_settings a on a.user_id=s.user_id
 where c.t::time >= e.at and c.t::time < e.at + interval '10 minutes'
 and coalesce((a.notifications->>e.event)::boolean,true)
 ), claimed as (
 insert into push_deliveries(subscription_id,event,day)
 select id,event,day from due on conflict do nothing returning subscription_id,event,day
 )
 select d.id,d.endpoint,d.p256dh,d.auth,d.event,d.day from due d join claimed c on c.subscription_id=d.id and c.event=d.event and c.day=d.day;
$$;
revoke all on function public.claim_diary_reminders() from public,anon,authenticated;
grant execute on function public.claim_diary_reminders() to service_role;
-- Cron credential is installed separately in Vault, never committed in source.
create function public.dispatch_diary_reminders() returns void language plpgsql security definer set search_path=public as $$
declare secret text;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron' limit 1;
 if secret is null then return; end if;
 perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/send-reminders',
 headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:='{}'::jsonb,timeout_milliseconds:=15000);
end;
$$;
revoke all on function public.dispatch_diary_reminders() from public,anon,authenticated;
select cron.schedule('diary-push-reminders','* * * * *','select public.dispatch_diary_reminders()');
