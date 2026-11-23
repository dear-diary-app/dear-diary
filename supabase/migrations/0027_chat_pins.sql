create table public.chat_pins(
 message_id uuid primary key references public.chat_messages(id) on delete cascade,
 pinned_by uuid not null references public.profiles(id) on delete cascade,
 pinned_at timestamptz not null default now(),
 expires_at timestamptz
);
alter table public.chat_pins enable row level security;
create policy chat_pins_read on public.chat_pins for select to authenticated using((expires_at is null or expires_at>now()) and exists(select from public.chat_messages m where m.id=message_id and auth.uid() in(m.sender_id,m.recipient_id)));
grant select on public.chat_pins to authenticated;
create function public.chat_pin(p_id uuid,p_pin boolean,p_hours integer default null) returns boolean language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); m public.chat_messages; n int;
begin
 if uid is null then raise insufficient_privilege;end if;
 select * into m from public.chat_messages where id=p_id;
 if not found or uid not in(m.sender_id,m.recipient_id) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtext(least(m.sender_id::text,m.recipient_id::text)));
 if p_hours is not null and p_hours not in(24,168)then raise exception 'Invalid pin duration';end if;
 delete from public.chat_pins where expires_at<=now();
 if p_pin then
  if exists(select from public.chat_pins where message_id=p_id)then return true;end if;
  select count(*) into n from public.chat_pins p join public.chat_messages x on x.id=p.message_id where x.sender_id in(m.sender_id,m.recipient_id) and x.recipient_id in(m.sender_id,m.recipient_id);
  if n>=10 then raise exception 'You can pin up to 10 messages. Unpin one first.';end if;
  insert into public.chat_pins(message_id,pinned_by,expires_at)values(p_id,uid,case when p_hours is null then null else now()+make_interval(hours=>p_hours)end) on conflict do nothing;
 else delete from public.chat_pins where message_id=p_id;
 end if;return true;
end$$;
revoke all on function public.chat_pin(uuid,boolean,integer) from public,anon;
grant execute on function public.chat_pin(uuid,boolean,integer) to authenticated;
alter publication supabase_realtime add table public.chat_pins;

-- Visibility expires at the exact server time; cleanup runs even with both apps closed.
select cron.schedule('chat-expire-pins','* * * * *','delete from public.chat_pins where expires_at<=now()');
