-- Store only the GIPHY ID, never cached media URLs or rehosted GIF copies.
alter table public.chat_messages add column gif_id text check (gif_id is null or gif_id ~ '^[A-Za-z0-9]{1,80}$');
alter table public.chat_messages drop constraint chat_has_content;
alter table public.chat_messages add constraint chat_has_content check (char_length(btrim(body)) > 0 or sticker is not null or cardinality(images) > 0 or gif_id is not null);

create or replace function public.chat_set_recipient() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.recipient_id := public.friend_id(auth.uid());
  if new.recipient_id is null then raise insufficient_privilege using message = 'No chat partner'; end if;
  new.reactions := '{}'::jsonb;
  new.created_at := now();
  new.seen_at := null;
  new.edited_at := null;
  if new.gif_id is not null then
    if new.gif_id !~ '^[A-Za-z0-9]{1,80}$' then raise exception 'Bad GIF'; end if;
    new.body := ''; new.sticker := null; new.images := '{}';
  end if;
  new.images := coalesce(new.images, '{}');
  if new.sticker is not null then new.images := '{}'; end if;
  -- Every photo path must sit in the sender's own folder.
  if exists (select 1 from unnest(new.images) p where p !~ ('^' || new.sender_id::text || '/[A-Za-z0-9._-]{1,80}\.(jpg|png|webp)$')) then
    raise exception 'Bad photo';
  end if;
  if new.reply_to is not null and not exists (
    select 1 from public.chat_messages m where m.id = new.reply_to
      and ((m.sender_id = new.sender_id and m.recipient_id = new.recipient_id) or (m.sender_id = new.recipient_id and m.recipient_id = new.sender_id))
  ) then new.reply_to := null; end if;
  return new;
end $$;

create or replace function public.chat_edit(p_id uuid, p_body text) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text := btrim(coalesce(p_body, ''));
begin
  if uid is null then raise insufficient_privilege; end if;
  if char_length(t) = 0 or char_length(t) > 2000 then raise exception 'Bad message'; end if;
  update public.chat_messages m
     set body = t, edited_at = now()
   where m.id = p_id and m.sender_id = uid and m.sticker is null and m.gif_id is null and m.body <> t;
end $$;
revoke all on function public.chat_edit(uuid, text) from public, anon;
grant execute on function public.chat_edit(uuid, text) to authenticated;
