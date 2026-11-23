-- Voice recordings stay private. A separate bucket preserves photo-only restrictions.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('chat-audio','chat-audio',false,5242880,array['audio/mp4','audio/webm','audio/ogg']) on conflict(id)do nothing;
alter table public.chat_messages add column audio jsonb;
create function public.valid_chat_audio(a jsonb,uid uuid) returns boolean language plpgsql immutable set search_path=public as $$
begin
 if a is null then return true;end if;
 if not(a ?& array['path','mime','duration','peaks']) or a->'path'='null'::jsonb or a->'mime'='null'::jsonb or a->'duration'='null'::jsonb or a->'peaks'='null'::jsonb or jsonb_typeof(a)<>'object' or a->>'path' is null or a->>'path' !~ ('^'||uid::text||'/[0-9a-f-]{36}\.(webm|m4a|ogg)$') or a->>'mime' not in('audio/webm','audio/mp4','audio/ogg') or jsonb_typeof(a->'duration')<>'number' or (a->>'duration')::numeric not between 0.5 and 120 or jsonb_typeof(a->'peaks')<>'array' or jsonb_array_length(a->'peaks')<>32 then return false;end if;
 if (a->>'mime'='audio/mp4' and a->>'path' not like '%.m4a')or(a->>'mime'='audio/webm' and a->>'path' not like '%.webm')or(a->>'mime'='audio/ogg' and a->>'path' not like '%.ogg')then return false;end if;
 if exists(select from jsonb_array_elements(a->'peaks')v where jsonb_typeof(v)<>'number' or v::text::numeric not between 0 and 1)then return false;end if;
 return true;
 exception when others then return false;
end$$;
alter table public.chat_messages add constraint chat_audio_valid check(audio is null or public.valid_chat_audio(audio,sender_id));
alter table public.chat_messages drop constraint chat_has_content;
alter table public.chat_messages add constraint chat_has_content check(char_length(btrim(body))>0 or sticker is not null or cardinality(images)>0 or gif_id is not null or audio is not null);
create policy chat_audio_select on storage.objects for select to authenticated using(bucket_id='chat-audio' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select from public.chat_messages m where m.audio->>'path'=name and (m.sender_id=auth.uid() or m.recipient_id=auth.uid()))));
create policy chat_audio_insert on storage.objects for insert to authenticated with check(bucket_id='chat-audio' and (storage.foldername(name))[1]=auth.uid()::text and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.(webm|m4a|ogg)$'));
create policy chat_audio_delete on storage.objects for delete to authenticated using(bucket_id='chat-audio' and (storage.foldername(name))[1]=auth.uid()::text);
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
 update public.chat_messages m set body=t,edited_at=now() where m.id=p_id and m.sender_id=uid and m.sticker is null and m.gif_id is null and m.audio is null and m.body<>t;
end$$;
-- Delete through Storage API, never directly remove storage.objects metadata.
create table public.chat_audio_cleanup(path text primary key,queued_at timestamptz not null default now());
alter table public.chat_audio_cleanup enable row level security;
revoke all on public.chat_audio_cleanup from public,anon,authenticated;
grant all on public.chat_audio_cleanup to service_role;
create function public.queue_chat_audio_delete() returns trigger language plpgsql security definer set search_path=public as $$begin
 if old.audio is not null then insert into public.chat_audio_cleanup(path)values(old.audio->>'path')on conflict do nothing;end if;return old;end$$;
create trigger chat_audio_after_delete after delete on public.chat_messages for each row execute function public.queue_chat_audio_delete();
create function public.chat_remove_voice(p_id uuid,p_path text) returns boolean language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();m public.chat_messages;
begin
 if uid is null or p_id is null or p_path is null or p_path !~ ('^'||uid::text||'/'||p_id::text||'\.(webm|m4a|ogg)$')then raise insufficient_privilege;end if;
 select * into m from public.chat_messages where id=p_id for update;
 if found then if m.sender_id<>uid or m.audio->>'path' is distinct from p_path then raise insufficient_privilege;end if;delete from public.chat_messages where id=p_id;end if;
 insert into public.chat_audio_cleanup(path)values(p_path)on conflict do nothing;return true;
end$$;
revoke all on function public.chat_remove_voice(uuid,text) from public,anon;
grant execute on function public.chat_remove_voice(uuid,text)to authenticated;
create function public.chat_audio_cleanup_tick()returns void language plpgsql security definer set search_path=public as $$declare secret text;begin
 insert into public.chat_audio_cleanup(path) select o.name from storage.objects o where o.bucket_id='chat-audio' and o.created_at<now()-interval '1 day' and not exists(select from public.chat_messages m where m.audio->>'path'=o.name) on conflict do nothing;
 select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron'limit 1;
 if secret is not null then perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/cleanup-chat-audio',headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:='{}'::jsonb,timeout_milliseconds:=10000);end if;
end$$;
revoke all on function public.chat_audio_cleanup_tick()from public,anon,authenticated;
select cron.schedule('chat-audio-cleanup','* * * * *','select public.chat_audio_cleanup_tick()');
