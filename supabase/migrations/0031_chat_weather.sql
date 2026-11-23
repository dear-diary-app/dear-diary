-- Weather snapshots use existing chat permissions, without coordinates.
alter table public.chat_messages add column weather jsonb;
create function public.valid_chat_weather(w jsonb)returns boolean language plpgsql immutable set search_path=public as $$declare k text;n numeric;begin
 if w is null then return true;end if;
 if jsonb_typeof(w) is distinct from 'object' or not(w ?& array['place','region','country','temperature','feels','humidity','wind','precipitation','code','day','observedAt','fetchedAt']) or (select count(*) from jsonb_object_keys(w))<>12 then return false;end if;
 foreach k in array array['place','region','country']loop if jsonb_typeof(w->k) is distinct from 'string' or char_length(w->>k)>100 or (k='place' and char_length(btrim(w->>k))=0)then return false;end if;end loop;
 foreach k in array array['temperature','feels','humidity','wind','precipitation','code']loop
 if jsonb_typeof(w->k) is distinct from 'number'then return false;end if;n:=(w->>k)::numeric;
 if (k='temperature' and n not between -100 and 70)or(k='feels' and n not between -130 and 100)or(k='humidity' and n not between 0 and 100)or(k='wind' and n not between 0 and 500)or(k='precipitation' and n not between 0 and 1000)or(k='code' and(n not between 0 and 99 or n<>trunc(n)))then return false;end if;end loop;
 if jsonb_typeof(w->'day') is distinct from 'boolean'then return false;end if;
 foreach k in array array['observedAt','fetchedAt']loop if jsonb_typeof(w->k) is distinct from 'string' or w->>k !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$' then return false;end if;perform (w->>k)::timestamptz;end loop;
 return true;exception when others then return false;end$$;
alter table public.chat_messages add constraint chat_weather_valid check(weather is null or public.valid_chat_weather(weather));
alter table public.chat_messages drop constraint chat_has_content;
alter table public.chat_messages add constraint chat_has_content check(char_length(btrim(body))>0 or sticker is not null or cardinality(images)>0 or gif_id is not null or audio is not null or song is not null or weather is not null);
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
 update public.chat_messages m set body=t,edited_at=now() where m.id=p_id and m.sender_id=uid and m.sticker is null and m.gif_id is null and m.audio is null and m.song is null and m.weather is null and m.body<>t;
end$$;
