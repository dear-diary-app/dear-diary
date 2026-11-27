-- Optional11PM IST daily-question reminder. No settings changed by this migration.
alter table public.push_deliveries drop constraint push_deliveries_event_check;
alter table public.push_deliveries add constraint push_deliveries_event_check check(event in ('open','writing','lock','published','ask'));
create or replace function public.claim_diary_reminders(p_at timestamptz default now(), p_only uuid default null) returns table(subscription_id uuid,endpoint text,p256dh text,auth text,event text,day date)
language sql security definer set search_path=public as $$
 with clock as (select p_at at time zone 'Asia/Kolkata' as t),
 due as (
 select s.id,s.endpoint,s.p256dh,s.auth,e.event,c.t::date as day
 from push_subscriptions s cross join clock c
 cross join (values ('open',time '06:00'),('writing',time '21:00'),('lock',time '21:45'),('published',time '22:00'),('ask',time '23:00')) as e(event,at)
 left join app_settings a on a.user_id=s.user_id
 where (p_only is null or s.id=p_only) and c.t::time >= e.at and c.t::time < e.at + interval '10 minutes'
 and coalesce((a.notifications->>e.event)::boolean,e.event not in ('writing','ask'))
 and (e.event<>'ask' or not exists(select from chat_question_days q where q.sender_id=s.user_id and q.day=c.t::date))
 ), claimed as (
 insert into push_deliveries(subscription_id,event,day)
 select id,event,day from due on conflict do nothing returning subscription_id,event,day
 )
 select d.id,d.endpoint,d.p256dh,d.auth,d.event,d.day from due d join claimed c on c.subscription_id=d.id and c.event=d.event and c.day=d.day;
$$;

create or replace function public.claim_android_reminders(p_at timestamptz default now()) returns table(token text,user_id uuid,event text,day date) language sql security definer set search_path=public as $$
with clock as(select p_at at time zone 'Asia/Kolkata' as t),due as(
 select s.token,s.user_id,e.event,c.t::date as day from android_push_tokens s cross join clock c
 cross join(values('open',time '06:00'),('writing',time '21:00'),('lock',time '21:45'),('published',time '22:00'),('ask',time '23:00'))e(event,at)
 left join app_settings a on a.user_id=s.user_id
 where c.t::time>=e.at and c.t::time<e.at+interval '10 minutes' and coalesce((a.notifications->>e.event)::boolean,e.event not in ('writing','ask'))
 and (e.event<>'ask' or not exists(select from chat_question_days q where q.sender_id=s.user_id and q.day=c.t::date))
),claimed as(insert into android_push_deliveries select token,event,day from due on conflict do nothing returning *)
select d.* from due d join claimed c using(token,event,day);
$$;
