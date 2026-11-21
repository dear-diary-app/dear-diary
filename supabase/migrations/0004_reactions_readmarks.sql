-- 0004: Prompt 5 hardening - reaction rules and persistent read marks.

-- Reactions: only on the partner's published entries, from the fixed emoji set.
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.diary_entries e
    where e.id = entry_id
      and e.status = 'published'
      and e.user_id = public.friend_id(auth.uid())
  ));

alter table public.reactions
  add constraint reactions_emoji_check
  check (reaction_type in ('❤️','🥺','😭','😂','✨','🫂','🤍','😊','🌸','🫶'));

-- Per-user record of which entries they have opened (drives the unread dot).
alter table public.app_settings
  add column if not exists read_entries jsonb not null default '{}'::jsonb;
