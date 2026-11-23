-- Voluntary chat availability, readable only by self and the linked friend.
create table public.chat_status (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 status text not null default '' check(char_length(status)<=60 and status !~ '[[:cntrl:]]'),
 updated_at timestamptz not null default now()
);
alter table public.chat_status enable row level security;
create policy chat_status_read on public.chat_status for select to authenticated using(user_id=auth.uid() or user_id=public.friend_id(auth.uid()));
create policy chat_status_insert on public.chat_status for insert to authenticated with check(user_id=auth.uid());
create policy chat_status_update on public.chat_status for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create trigger chat_status_touch before update on public.chat_status for each row execute function public.touch_updated_at();
grant select,insert,update on public.chat_status to authenticated;
alter publication supabase_realtime add table public.chat_status;
