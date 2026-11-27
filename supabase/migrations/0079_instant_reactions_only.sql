-- Emoji responses stay on the sender's saved instant. No Chat insert or push.
alter table public.instants add column response_key uuid;
create or replace function public.respond_to_instant(p_id uuid,p_text text,p_message uuid)returns uuid language plpgsql security definer set search_path=public as $$declare item public.instants;begin
 select * into item from public.instants where id=p_id for update;
 if auth.uid()is null or item.recipient_id is distinct from auth.uid()or item.opened_at is null or item.expires_at<=clock_timestamp()or public.friend_id(item.sender_id)is distinct from auth.uid()or p_message is null or p_text is null or btrim(p_text)not in('❤️','😍','😂','😮','🥹','🔥')then raise insufficient_privilege;end if;
 if item.responded then
 if item.response_key=p_message and exists(select from public.instant_archive where id=p_id and sender_id=item.sender_id and reaction=btrim(p_text))then return p_message;end if;
 raise exception 'Response already sent';end if;
 update public.instant_archive set reaction=btrim(p_text)where id=p_id and sender_id=item.sender_id;
 if not found then raise exception 'The saved instant is no longer available for reactions';end if;
 update public.instants set responded=true,response_key=p_message where id=p_id;
 return p_message;end$$;
