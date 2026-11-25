-- Extend video stories without changing expiry, media size or pair access.
alter table public.stories drop constraint stories_duration_check;
alter table public.stories add constraint stories_duration_check check(duration>0 and duration<=90);
create or replace function public.story_publish(p_user uuid,p_path text,p_duration numeric)returns void language plpgsql security definer set search_path=public as $$begin
 if p_user is null or public.friend_id(p_user)is null or p_path!~('^'||p_user::text||'/[0-9a-f-]{36}\.mp4$') or p_duration is null or p_duration<=0 or p_duration>90 then raise exception 'Invalid story';end if;
 if not exists(select from storage.objects where bucket_id='stories'and name=p_path and (metadata->>'size')::bigint between 1 and 20971520)then raise exception 'Missing upload';end if;
 insert into public.stories(user_id,path,duration)values(p_user,p_path,p_duration)on conflict(user_id)do update set path=excluded.path,duration=excluded.duration,created_at=now(),expires_at=now()+interval '24 hours';end$$;
