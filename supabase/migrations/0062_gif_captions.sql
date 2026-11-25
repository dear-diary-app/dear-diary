create or replace function public.chat_set_recipient() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.recipient_id := public.friend_id(auth.uid());
  if new.recipient_id is null then raise insufficient_privilege using message = 'No chat partner'; end if;
  new.reactions := '{}'::jsonb;
  new.created_at := now();
  new.seen_at := null;
  new.edited_at := null;
  if new.weather is not null and (new.body<>'' or new.sticker is not null or new.gif_id is not null or new.audio is not null or new.song is not null or cardinality(new.images)>0)then raise exception 'Weather must be a separate message';end if;
  if new.song is not null and (new.body<>'' or new.sticker is not null or new.gif_id is not null or new.audio is not null or cardinality(new.images)>0) then raise exception 'Song must be a separate message';end if;
  if new.gif_id is not null then
    if new.gif_id !~ '^[A-Za-z0-9]{1,80}$' then raise exception 'Bad GIF'; end if;
    new.body:=btrim(coalesce(new.body,'')); new.sticker := null; new.images := '{}';
  end if;
  if new.audio is not null then
    if new.body<>'' or new.sticker is not null or new.gif_id is not null or cardinality(new.images)>0 then raise exception 'Voice must be a separate message'; end if;
    if new.audio->>'path' !~ ('^'||new.sender_id::text||'/'||new.id::text||'\.(webm|m4a|ogg)$') or not public.valid_chat_audio(new.audio,new.sender_id) then raise exception 'Bad voice note';end if;
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
create or replace function public.chat_question_insert()returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.gif_id is null and new.body ~* '^/ask[[:space:]]' then
  if char_length(btrim(substring(new.body from 6)))not between 1 and 300 or new.sticker is not null or new.gif_id is not null or new.audio is not null or new.song is not null or new.weather is not null or cardinality(new.images)>0 then raise exception 'Write a question of 1 to 300 characters';end if;
  begin insert into public.chat_question_days values(new.sender_id,(now()at time zone 'Asia/Kolkata')::date,new.id);exception when unique_violation then raise exception 'You have already asked your daily question. Try after midnight IST.';end;
  insert into public.chat_questions(message_id,sender_id,recipient_id)values(new.id,new.sender_id,new.recipient_id);
 end if;return new;
end$$;

