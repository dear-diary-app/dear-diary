alter table public.chat_scheduled add column audio jsonb,add column reply_to uuid,add column attempts integer not null default 0,add column next_attempt_at timestamptz;
alter table public.chat_scheduled drop constraint chat_scheduled_body_check;
alter table public.chat_scheduled add constraint scheduled_content check((audio is null and char_length(btrim(body)) between 1 and 2000)or(audio is not null and body='' and effect is null and public.valid_chat_audio(audio,sender_id) and audio->>'path' ~ ('^'||sender_id::text||'/'||id::text||'\.(webm|m4a|ogg)$')));
create function public.chat_schedule_voice(p_id uuid,p_audio jsonb,p_at timestamptz,p_reply uuid default null)returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();existing public.chat_scheduled;partner uuid:=public.friend_id(uid);
begin
 if uid is null or partner is null then raise insufficient_privilege;end if;
 if p_at is null or p_at<now()+interval '1 minute' or p_at>now()+interval '30 days' then raise exception 'Choose a time between one minute and 30 days';end if;
 if p_id is null or p_audio is null or not public.valid_chat_audio(p_audio,uid) or p_audio->>'path' !~ ('^'||uid::text||'/'||p_id::text||'\.(webm|m4a|ogg)$')then raise exception 'Invalid voice';end if;
 perform pg_advisory_xact_lock(hashtext(uid::text));
 select * into existing from public.chat_scheduled where id=p_id for update;
 if found then
  if existing.sender_id<>uid then raise insufficient_privilege;end if;
  if existing.state not in('pending','failed')or existing.audio is distinct from p_audio then raise exception 'Voice already sent, cancelled or changed';end if;
  update public.chat_scheduled set send_at=p_at,state='pending',attempts=0,next_attempt_at=null,updated_at=now() where id=p_id;
 else
  if exists(select from public.chat_messages where id=p_id)then raise exception 'Already sent';end if;
  if(select count(*)from public.chat_scheduled where sender_id=uid and state in('pending','failed'))>=20 then raise exception 'Up to 20 scheduled messages';end if;
  if not exists(select from storage.objects where bucket_id='chat-audio'and name=p_audio->>'path')then raise exception 'Upload voice first';end if;
  if p_reply is not null and not exists(select from public.chat_messages where id=p_reply and ((sender_id=uid and recipient_id=partner)or(sender_id=partner and recipient_id=uid)))then raise exception 'Invalid reply';end if;
  insert into public.chat_scheduled(id,sender_id,recipient_id,body,audio,send_at,reply_to)values(p_id,uid,partner,'',p_audio,p_at,p_reply);
 end if;
 delete from public.chat_audio_cleanup where path=p_audio->>'path';
end$$;
revoke all on function public.chat_schedule_voice(uuid,jsonb,timestamptz,uuid)from public,anon;
grant execute on function public.chat_schedule_voice(uuid,jsonb,timestamptz,uuid)to authenticated;
-- Text rescheduling must never turn a pending voice into text.
create function public.guard_scheduled_voice()returns trigger language plpgsql set search_path=public as $$begin
 if old.audio is not null and(new.audio is distinct from old.audio or new.body<>''or new.effect is not null)then raise exception 'Cannot replace scheduled voice';end if;
 if new.state='cancelled'and old.audio is not null then insert into public.chat_audio_cleanup(path)values(old.audio->>'path')on conflict do nothing;end if;return new;end$$;
create trigger guard_scheduled_voice before update on public.chat_scheduled for each row execute function public.guard_scheduled_voice();
create function public.queue_scheduled_voice_delete()returns trigger language plpgsql security definer set search_path=public as $$begin
 if old.audio is not null then insert into public.chat_audio_cleanup(path)values(old.audio->>'path')on conflict do nothing;end if;return old;end$$;
create trigger scheduled_voice_delete after delete on public.chat_scheduled for each row execute function public.queue_scheduled_voice_delete();
create or replace function public.chat_deliver_scheduled()returns integer language plpgsql security definer set search_path=public as $$
declare r public.chat_scheduled;previous_sub text:=current_setting('request.jwt.claim.sub',true);previous_claims text:=current_setting('request.jwt.claims',true);n int:=0;
begin
 for r in select * from public.chat_scheduled where state='pending'and send_at<=now()and(next_attempt_at is null or next_attempt_at<=now())order by send_at for update skip locked limit 50 loop
  begin
   if public.friend_id(r.sender_id)is distinct from r.recipient_id then raise exception 'Partner changed';end if;
   if r.audio is not null and not exists(select from storage.objects where bucket_id='chat-audio'and name=r.audio->>'path')then raise exception 'Audio unavailable';end if;
   update public.chat_scheduled set state='delivering',updated_at=now()where id=r.id;
   perform set_config('request.jwt.claim.sub',r.sender_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',r.sender_id)::text,true);
   insert into public.chat_messages(id,body,effect,audio,reply_to)values(r.id,r.body,r.effect,r.audio,r.reply_to);
   update public.chat_scheduled set state='sent',updated_at=now(),next_attempt_at=null where id=r.id;n:=n+1;
  exception when others then
   update public.chat_scheduled set attempts=attempts+1,state=case when r.audio is not null and r.attempts<4 and public.friend_id(r.sender_id)=r.recipient_id then 'pending'else 'failed'end,next_attempt_at=now()+make_interval(mins=>least(15,1+r.attempts*2)),updated_at=now()where id=r.id;
  end;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);return n;
end$$;
-- Protect scheduled audio throughout the 30-day window, including retries.
create or replace function public.chat_audio_cleanup_tick()returns void language plpgsql security definer set search_path=public as $$declare secret text;begin
 insert into public.chat_audio_cleanup(path)select o.name from storage.objects o where o.bucket_id='chat-audio'and o.created_at<now()-interval '1 day'and not exists(select from public.chat_messages m where m.audio->>'path'=o.name)and not exists(select from public.chat_scheduled s where s.audio->>'path'=o.name and s.state in('pending','delivering','failed'))on conflict do nothing;
 select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron'limit 1;
 if secret is not null then perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/cleanup-chat-audio',headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:='{}'::jsonb,timeout_milliseconds:=10000);end if;end$$;
revoke all on function public.guard_scheduled_voice(),public.queue_scheduled_voice_delete()from public,anon,authenticated;
