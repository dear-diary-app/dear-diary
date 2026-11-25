-- Per-person hiding. Never removes the shared message, media, reactions or pins.
create table public.chat_hidden_messages(user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,message_id uuid not null references public.chat_messages(id) on delete cascade,hidden_at timestamptz not null default now(),primary key(user_id,message_id));
alter table public.chat_hidden_messages enable row level security;
create policy chat_hidden_read on public.chat_hidden_messages for select to authenticated using(user_id=auth.uid());
grant select on public.chat_hidden_messages to authenticated;
create function public.chat_delete_for_me(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not exists(select 1 from public.chat_messages m where m.id=p_id and uid in(m.sender_id,m.recipient_id)) then raise insufficient_privilege;end if;
 insert into public.chat_hidden_messages(user_id,message_id)values(uid,p_id)on conflict do nothing;
 return true;
end$$;
revoke all on function public.chat_delete_for_me(uuid) from public,anon;
grant execute on function public.chat_delete_for_me(uuid) to authenticated;
drop policy chat_select on public.chat_messages;
create policy chat_select on public.chat_messages for select to authenticated using((sender_id=auth.uid() or recipient_id=auth.uid())and not exists(select 1 from public.chat_hidden_messages h where h.user_id=auth.uid()and h.message_id=id));
