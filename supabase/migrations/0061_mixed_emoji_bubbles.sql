-- Bubbles animate extracted emoji while retaining the entire text message.
create function public.chat_has_emoji(t text)returns boolean language sql stable security definer set search_path=public as $$select t is not null and char_length(t) between 1 and 2000 and exists(select from public.chat_emoji e where strpos(t,e.emoji)>0)$$;
revoke all on function public.chat_has_emoji(text)from public,anon;
grant execute on function public.chat_has_emoji(text)to authenticated,service_role;
alter table public.chat_scheduled drop constraint chat_scheduled_effect_valid;
alter table public.chat_scheduled add constraint chat_scheduled_effect_valid check(effect is null or(effect in('blur','bubbles')and(effect<>'bubbles'or public.chat_has_emoji(body))));
alter table public.chat_messages drop constraint chat_effect_valid;
alter table public.chat_messages add constraint chat_effect_valid check (
 effect is null or (effect in ('invisible','slam','loud','gentle','blur','bubbles') and char_length(btrim(body))>0 and sticker is null and gif_id is null and audio is null and song is null and weather is null and cardinality(images)=0 and (effect<>'bubbles' or public.chat_has_emoji(body)))
);
create or replace function public.chat_edit(p_id uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();t text:=btrim(coalesce(p_body,''));begin
 if uid is null then raise insufficient_privilege;end if;
 if char_length(t)=0 or char_length(t)>2000 then raise exception 'Bad message';end if;
 update public.chat_messages m set body=t,effect=case when m.effect='bubbles'and not public.chat_has_emoji(t)then null else m.effect end,edited_at=now() where m.id=p_id and m.sender_id=uid and m.sticker is null and m.gif_id is null and m.audio is null and m.song is null and m.weather is null and m.body<>t;
end$$;
create or replace function public.chat_schedule(p_id uuid,p_body text,p_at timestamptz,p_effect text default null) returns void language plpgsql security definer set search_path=public as $$
declare existing public.chat_scheduled; uid uuid:=auth.uid();
begin
 if p_effect is not null and (p_effect not in ('blur','bubbles') or (p_effect='bubbles' and not public.chat_has_emoji(p_body))) then raise exception 'Invalid scheduled effect';end if;
 if uid is null then raise insufficient_privilege;end if;
 if p_at<now()+interval '1 minute' or p_at>now()+interval '30 days' then raise exception 'Choose a time between one minute and 30 days from now';end if;
 if p_id is null or char_length(btrim(coalesce(p_body,''))) not between 1 and 2000 or public.friend_id(uid) is null then raise exception 'Invalid scheduled message';end if;
 perform pg_advisory_xact_lock(hashtext(uid::text));
 select * into existing from public.chat_scheduled where id=p_id for update;
 if found then
  if existing.sender_id<>uid then raise insufficient_privilege;end if;
  if existing.state not in ('pending','failed') then raise exception 'This message has already sent or been cancelled';end if;
  update public.chat_scheduled set body=btrim(p_body),effect=p_effect,send_at=p_at,state='pending',updated_at=now() where id=p_id;
 else
  if(select count(*) from public.chat_scheduled where sender_id=uid and state in ('pending','failed'))>=20 then raise exception 'You can keep up to 20 scheduled messages';end if;
  insert into public.chat_scheduled(id,sender_id,recipient_id,body,send_at,effect)values(p_id,uid,public.friend_id(uid),btrim(p_body),p_at,p_effect);
 end if;
end$$;
