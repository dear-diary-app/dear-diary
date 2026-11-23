alter table public.chat_messages add column scheduled boolean not null default false;
create table public.chat_scheduled (
 id uuid primary key,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 send_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','delivering','sent','cancelled','failed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index chat_scheduled_due on public.chat_scheduled(send_at) where state='pending';
alter table public.chat_scheduled enable row level security;
create policy schedule_owner_read on public.chat_scheduled for select to authenticated using(sender_id=auth.uid());
grant select on public.chat_scheduled to authenticated;
-- Intentionally absent from realtime publication. Pending text never enters chat_messages.
create function public.chat_schedule(p_id uuid,p_body text,p_at timestamptz) returns void language plpgsql security definer set search_path=public as $$
declare existing public.chat_scheduled; uid uuid:=auth.uid();
begin
 if uid is null then raise insufficient_privilege;end if;
 if p_at<now()+interval '1 minute' or p_at>now()+interval '30 days' then raise exception 'Choose a time between one minute and 30 days from now';end if;
 if p_id is null or char_length(btrim(coalesce(p_body,''))) not between 1 and 2000 or public.friend_id(uid) is null then raise exception 'Invalid scheduled message';end if;
 perform pg_advisory_xact_lock(hashtext(uid::text));
 select * into existing from public.chat_scheduled where id=p_id for update;
 if found then
  if existing.sender_id<>uid then raise insufficient_privilege;end if;
  if existing.state not in ('pending','failed') then raise exception 'This message has already sent or been cancelled';end if;
  update public.chat_scheduled set body=btrim(p_body),send_at=p_at,state='pending',updated_at=now() where id=p_id;
 else
  if(select count(*) from public.chat_scheduled where sender_id=uid and state in ('pending','failed'))>=20 then raise exception 'You can keep up to 20 scheduled messages';end if;
  insert into public.chat_scheduled(id,sender_id,recipient_id,body,send_at)values(p_id,uid,public.friend_id(uid),btrim(p_body),p_at);
 end if;
end$$;
create function public.chat_cancel_schedule(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare n int;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 update public.chat_scheduled set state='cancelled',updated_at=now() where id=p_id and sender_id=auth.uid() and state in ('pending','failed');get diagnostics n=row_count;return n=1;
end$$;
create function public.chat_deliver_scheduled() returns integer language plpgsql security definer set search_path=public as $$
declare r public.chat_scheduled; previous_sub text:=current_setting('request.jwt.claim.sub',true); previous_claims text:=current_setting('request.jwt.claims',true); n int:=0;
begin
 for r in select * from public.chat_scheduled where state='pending' and send_at<=now() order by send_at for update skip locked limit 50 loop
  begin
   if public.friend_id(r.sender_id) is distinct from r.recipient_id then raise exception 'Partner changed';end if;
   update public.chat_scheduled set state='delivering',updated_at=now() where id=r.id;
   perform set_config('request.jwt.claim.sub',r.sender_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',r.sender_id)::text,true);
   insert into public.chat_messages(id,body)values(r.id,r.body);
   update public.chat_scheduled set state='sent',updated_at=now() where id=r.id;n:=n+1;
  exception when others then
   update public.chat_scheduled set state='failed',updated_at=now() where id=r.id;
  end;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
 return n;
end$$;
revoke all on function public.chat_schedule(uuid,text,timestamptz),public.chat_cancel_schedule(uuid),public.chat_deliver_scheduled() from public,anon,authenticated;
grant execute on function public.chat_schedule(uuid,text,timestamptz),public.chat_cancel_schedule(uuid) to authenticated;
-- Mark only inserts atomically released by the private delivery worker.
create function public.chat_scheduled_marker() returns trigger language plpgsql security definer set search_path=public as $$begin
 new.scheduled:=exists(select from public.chat_scheduled q where q.id=new.id and q.sender_id=new.sender_id and q.recipient_id=new.recipient_id and q.state='delivering');return new;
end$$;
revoke all on function public.chat_scheduled_marker() from public,anon,authenticated;
create trigger chat_scheduled_marker before insert on public.chat_messages for each row execute function public.chat_scheduled_marker();
select cron.schedule('chat-deliver-scheduled','* * * * *','select public.chat_deliver_scheduled()');

-- Confirmation uses the existing app push/inbox path only after delivery commits.
create function public.chat_schedule_confirmation() returns trigger language plpgsql security definer set search_path=public as $$
declare secret text;
begin
 if new.state='sent' and old.state<>'sent' then
  begin
   select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron' limit 1;
   if secret is not null then perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/send-chat-push',headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:=jsonb_build_object('id',new.id,'scheduled_ack',true),timeout_milliseconds:=10000);end if;
  exception when others then null;end;
 end if;return new;
end$$;
revoke all on function public.chat_schedule_confirmation() from public,anon,authenticated;
create trigger chat_schedule_confirmation after update on public.chat_scheduled for each row execute function public.chat_schedule_confirmation();
