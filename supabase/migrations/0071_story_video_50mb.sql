-- Video only. Photos retain the existing 20 MiB server validation.
update storage.buckets set file_size_limit=50000000 where id='story-items';
create or replace function public.story_item_publish(p_user uuid,p_path text,p_kind text,p_duration numeric,p_song jsonb default null)returns uuid language plpgsql security definer set search_path=public as $$declare stamp timestamptz:=clock_timestamp();result uuid;begin
 if p_user is null or public.friend_id(p_user)is null or p_kind not in('photo','video')or p_path!~('^'||p_user::text||'/[0-9a-f-]{36}\.'||case when p_kind='photo'then 'jpg'else 'mp4'end||'$')or not public.valid_chat_song(p_song)or p_duration is null or p_duration<=0 or p_duration>90 then raise exception 'Invalid story';end if;
 if not exists(select from storage.objects where bucket_id='story-items'and name=p_path and(metadata->>'size')::bigint between 1 and case when p_kind='video' then 50000000 else 20971520 end)then raise exception 'Missing upload';end if;
 insert into public.story_items(user_id,kind,path,duration,song,created_at,expires_at)values(p_user,p_kind,p_path,p_duration,p_song,stamp,stamp+interval '24 hours')returning id into result;return result;end$$;
