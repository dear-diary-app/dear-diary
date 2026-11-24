-- Legacy values remain valid for existing rows/edits, but new clients render them normally.
create function public.chat_emoji_only(t text)returns boolean language plpgsql stable security definer set search_path=public as $$
declare rest text:=regexp_replace(coalesce(t,''),'\s','','g');token text;begin
 if char_length(rest)=0 or char_length(rest)>2000 then return false;end if;
 while char_length(rest)>0 loop
  select emoji into token from public.chat_emoji where starts_with(rest,emoji) order by char_length(emoji)desc limit 1;
  if token is null then return false;end if;rest:=substr(rest,char_length(token)+1);
 end loop;return true;end$$;
revoke all on function public.chat_emoji_only(text)from public,anon;
grant execute on function public.chat_emoji_only(text)to authenticated,service_role;
alter table public.chat_messages drop constraint chat_effect_valid;
alter table public.chat_messages add constraint chat_effect_valid check (
 effect is null or (effect in ('invisible','slam','loud','gentle','blur','bubbles') and char_length(btrim(body))>0 and sticker is null and gif_id is null and audio is null and song is null and weather is null and cardinality(images)=0 and (effect<>'bubbles' or public.chat_emoji_only(body)))
);
create or replace function public.chat_edit(p_id uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();t text:=btrim(coalesce(p_body,''));begin
 if uid is null then raise insufficient_privilege;end if;
 if char_length(t)=0 or char_length(t)>2000 then raise exception 'Bad message';end if;
 update public.chat_messages m set body=t,effect=case when m.effect='bubbles'and not public.chat_emoji_only(t)then null else m.effect end,edited_at=now() where m.id=p_id and m.sender_id=uid and m.sticker is null and m.gif_id is null and m.audio is null and m.song is null and m.weather is null and m.body<>t;
end$$;
