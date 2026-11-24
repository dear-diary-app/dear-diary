alter table public.chat_scheduled add column effect text default null;
alter table public.chat_scheduled add constraint chat_scheduled_effect_valid check(effect is null or (effect in ('blur','bubbles') and (effect<>'bubbles' or public.chat_emoji_only(body))));
drop function public.chat_schedule(uuid,text,timestamptz);
create function public.chat_schedule(p_id uuid,p_body text,p_at timestamptz,p_effect text default null) returns void language plpgsql security definer set search_path=public as $$
declare existing public.chat_scheduled; uid uuid:=auth.uid();
begin
 if p_effect is not null and (p_effect not in ('blur','bubbles') or (p_effect='bubbles' and not public.chat_emoji_only(p_body))) then raise exception 'Invalid scheduled effect';end if;
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
create or replace function public.chat_deliver_scheduled() returns integer language plpgsql security definer set search_path=public as $$
declare r public.chat_scheduled; previous_sub text:=current_setting('request.jwt.claim.sub',true); previous_claims text:=current_setting('request.jwt.claims',true); n int:=0;
begin
 for r in select * from public.chat_scheduled where state='pending' and send_at<=now() order by send_at for update skip locked limit 50 loop
  begin
   if public.friend_id(r.sender_id) is distinct from r.recipient_id then raise exception 'Partner changed';end if;
   update public.chat_scheduled set state='delivering',updated_at=now() where id=r.id;
   perform set_config('request.jwt.claim.sub',r.sender_id::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',r.sender_id)::text,true);
   insert into public.chat_messages(id,body,effect)values(r.id,r.body,r.effect);
   update public.chat_scheduled set state='sent',updated_at=now() where id=r.id;n:=n+1;
  exception when others then
   update public.chat_scheduled set state='failed',updated_at=now() where id=r.id;
  end;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
 return n;
end$$;
revoke all on function public.chat_schedule(uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.chat_schedule(uuid,text,timestamptz,text) to authenticated;
