-- Song metadata only. Existing two-person chat RLS remains unchanged.
alter table public.chat_messages add column song jsonb;
create function public.valid_chat_song(s jsonb)returns boolean language plpgsql immutable set search_path=public as $$begin
 if s is null then return true;end if;
 if jsonb_typeof(s) is distinct from 'object' or not(s ?& array['id','title','artist','artwork','preview','url']) then return false;end if;
 if jsonb_typeof(s->'id') is distinct from 'number' or (s->>'id') !~ '^[0-9]{1,15}$' or (s->>'id')::bigint<1 then return false;end if;
 if jsonb_typeof(s->'title') is distinct from 'string' or char_length(btrim(s->>'title')) not between 1 and 200 or jsonb_typeof(s->'artist') is distinct from 'string' or char_length(btrim(s->>'artist')) not between 1 and 200 then return false;end if;
 if jsonb_typeof(s->'artwork') is distinct from 'string' or s->>'artwork' !~ '^https://[a-zA-Z0-9.-]+\.mzstatic\.com/' or char_length(s->>'artwork')>2000 then return false;end if;
 if jsonb_typeof(s->'preview') is distinct from 'string' or ((s->>'preview')<>'' and s->>'preview' !~ '^https://[a-zA-Z0-9.-]+\.(itunes\.apple|mzstatic)\.com/') or char_length(s->>'preview')>2000 then return false;end if;
 if jsonb_typeof(s->'url') is distinct from 'string' or s->>'url' !~ '^https://(music|itunes)\.apple\.com/' or char_length(s->>'url')>2000 then return false;end if;
 return true;exception when others then return false;end$$;
alter table public.chat_messages add constraint chat_song_valid check(song is null or public.valid_chat_song(song));
alter table public.chat_messages drop constraint chat_has_content;
alter table public.chat_messages add constraint chat_has_content check(char_length(btrim(body))>0 or sticker is not null or cardinality(images)>0 or gif_id is not null or audio is not null or song is not null);
create or replace function public.chat_set_recipient() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.recipient_id := public.friend_id(auth.uid());
  if new.recipient_id is null then raise insufficient_privilege using message = 'No chat partner'; end if;
  new.reactions := '{}'::jsonb;
  new.created_at := now();
  new.seen_at := null;
  new.edited_at := null;
  if new.song is not null and (new.body<>'' or new.sticker is not null or new.gif_id is not null or new.audio is not null or cardinality(new.images)>0) then raise exception 'Song must be a separate message';end if;
  if new.gif_id is not null then
    if new.gif_id !~ '^[A-Za-z0-9]{1,80}$' then raise exception 'Bad GIF'; end if;
    new.body := ''; new.sticker := null; new.images := '{}';
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


create or replace function public.chat_edit(p_id uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();t text:=btrim(coalesce(p_body,''));begin
 if uid is null then raise insufficient_privilege;end if;
 if char_length(t)=0 or char_length(t)>2000 then raise exception 'Bad message';end if;
 update public.chat_messages m set body=t,edited_at=now() where m.id=p_id and m.sender_id=uid and m.sticker is null and m.gif_id is null and m.audio is null and m.song is null and m.body<>t;
end$$;
