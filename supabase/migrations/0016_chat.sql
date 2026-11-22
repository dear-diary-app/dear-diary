-- Private two-person chat. Separate from diary entries: no publish time, no edit lock.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  sticker text check (sticker is null or char_length(sticker) <= 40),
  reply_to uuid references public.chat_messages (id) on delete set null,
  reactions jsonb not null default '{}'::jsonb check (jsonb_typeof(reactions) = 'object' and octet_length(reactions::text) <= 2000),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  constraint chat_has_content check (char_length(btrim(body)) > 0 or sticker is not null),
  constraint chat_not_self check (sender_id <> recipient_id)
);
create index chat_messages_pair_time on public.chat_messages (created_at desc);
alter table public.chat_messages enable row level security;

-- The recipient is always the sender's friend; the client cannot choose it.
create function public.chat_set_recipient() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.recipient_id := public.friend_id(auth.uid());
  if new.recipient_id is null then raise insufficient_privilege using message = 'No chat partner'; end if;
  new.reactions := '{}'::jsonb;
  new.created_at := now();
  new.seen_at := null;
  if new.reply_to is not null and not exists (
    select 1 from public.chat_messages m where m.id = new.reply_to
      and ((m.sender_id = new.sender_id and m.recipient_id = new.recipient_id) or (m.sender_id = new.recipient_id and m.recipient_id = new.sender_id))
  ) then new.reply_to := null; end if;
  return new;
end $$;
create trigger chat_before_insert before insert on public.chat_messages for each row execute function public.chat_set_recipient();

create policy chat_select on public.chat_messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy chat_insert on public.chat_messages for insert to authenticated
  with check (sender_id = auth.uid() and recipient_id = public.friend_id(auth.uid()));
create policy chat_delete_own on public.chat_messages for delete to authenticated
  using (sender_id = auth.uid());

-- Either person can react to any message in their chat; nothing else can change.
create function public.chat_react(p_id uuid, p_emoji text) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise insufficient_privilege; end if;
  if p_emoji is not null and char_length(p_emoji) > 16 then raise exception 'Bad reaction'; end if;
  update public.chat_messages m
     set reactions = case when p_emoji is null or p_emoji = '' or m.reactions ->> uid::text = p_emoji
                          then m.reactions - uid::text
                          else m.reactions || jsonb_build_object(uid::text, p_emoji) end
   where m.id = p_id and (m.sender_id = uid or m.recipient_id = uid);
end $$;
revoke all on function public.chat_react(uuid, text) from public, anon;
grant execute on function public.chat_react(uuid, text) to authenticated;

-- The recipient marks their unseen incoming messages as seen. Nothing else can change.
create function public.chat_mark_seen() returns integer language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise insufficient_privilege; end if;
  update public.chat_messages set seen_at = now() where recipient_id = uid and seen_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.chat_mark_seen() from public, anon;
grant execute on function public.chat_mark_seen() to authenticated;

grant select, insert, delete on public.chat_messages to authenticated;
alter publication supabase_realtime add table public.chat_messages;
