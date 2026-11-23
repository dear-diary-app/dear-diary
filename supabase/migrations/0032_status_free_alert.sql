-- Status notifications are a separate, strictly opt-in recipient preference.
create table public.chat_status_alerts (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 claimed_at timestamptz
);
alter table public.chat_status_alerts enable row level security;
revoke all on public.chat_status_alerts from public,anon,authenticated;
grant select,update,delete on public.chat_status_alerts to service_role;

create function public.chat_status_free_notify() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; secret text; event_id uuid;
begin
 if lower(btrim(old.status))='free' or lower(btrim(new.status))<>'free' then return new;end if;
 recipient:=public.friend_id(new.user_id);
 if recipient is null or not exists(select 1 from public.app_settings a where a.user_id=recipient and a.notifications->'friendFree'='true'::jsonb and a.notifications->'chat' is distinct from 'false'::jsonb)then return new;end if;
 -- An outbox ID gives overlapping/replayed HTTP calls only one dispatch attempt.
 insert into public.chat_status_alerts(sender_id,recipient_id)values(new.user_id,recipient)returning id into event_id;
 begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron' limit 1;
  if secret is not null then perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/send-status-push',headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:=jsonb_build_object('id',event_id),timeout_milliseconds:=10000);end if;
 exception when others then null;end;
 delete from public.chat_status_alerts where created_at<now()-interval '7 days';
 return new;
end$$;
revoke all on function public.chat_status_free_notify() from public,anon,authenticated;
create trigger chat_status_free_notify after update on public.chat_status for each row execute function public.chat_status_free_notify();

-- Check opt-in, friendship and current Free status again at dispatch, not just at save.
create function public.claim_chat_status_alert(p_id uuid) returns setof public.chat_status_alerts language sql security definer set search_path=public as $$
 update public.chat_status_alerts e set claimed_at=clock_timestamp()
 where e.id=p_id and e.claimed_at is null and e.created_at>now()-interval '2 minutes'
 and public.friend_id(e.sender_id)=e.recipient_id
 and exists(select 1 from public.chat_status s where s.user_id=e.sender_id and lower(btrim(s.status))='free' and s.updated_at<=e.created_at)
 and exists(select 1 from public.app_settings a where a.user_id=e.recipient_id and a.notifications->'friendFree'='true'::jsonb and a.notifications->'chat' is distinct from 'false'::jsonb)
 returning e.*;
$$;
revoke all on function public.claim_chat_status_alert(uuid) from public,anon,authenticated;
grant execute on function public.claim_chat_status_alert(uuid) to service_role;
