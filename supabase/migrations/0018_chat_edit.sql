-- Edit your own chat message. Only the sender can change the text; the other person sees an "edited" label.
alter table public.chat_messages add column edited_at timestamptz;

create or replace function public.chat_set_recipient() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.recipient_id := public.friend_id(auth.uid());
  if new.recipient_id is null then raise insufficient_privilege using message = 'No chat partner'; end if;
  new.reactions := '{}'::jsonb;
  new.created_at := now();
  new.seen_at := null;
  new.edited_at := null;
  if new.reply_to is not null and not exists (
    select 1 from public.chat_messages m where m.id = new.reply_to
      and ((m.sender_id = new.sender_id and m.recipient_id = new.recipient_id) or (m.sender_id = new.recipient_id and m.recipient_id = new.sender_id))
  ) then new.reply_to := null; end if;
  return new;
end $$;

create function public.chat_edit(p_id uuid, p_body text) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text := btrim(coalesce(p_body, ''));
begin
  if uid is null then raise insufficient_privilege; end if;
  if char_length(t) = 0 or char_length(t) > 2000 then raise exception 'Bad message'; end if;
  update public.chat_messages m
     set body = t, edited_at = now()
   where m.id = p_id and m.sender_id = uid and m.sticker is null and m.body <> t;
end $$;
revoke all on function public.chat_edit(uuid, text) from public, anon;
grant execute on function public.chat_edit(uuid, text) to authenticated;
