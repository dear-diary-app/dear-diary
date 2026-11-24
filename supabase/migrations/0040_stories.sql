insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('stories','stories',false,20971520,array['video/mp4']);
create table public.stories(user_id uuid primary key references public.profiles(id)on delete cascade,path text unique not null, duration numeric not null check(duration>0 and duration<=60),created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '24 hours'),check(expires_at=created_at+interval '24 hours'));
alter table public.stories enable row level security;
create policy story_pair_read on public.stories for select to authenticated using(expires_at>now() and (user_id=auth.uid()or user_id=public.friend_id(auth.uid())));
grant select on public.stories to authenticated;grant all on public.stories to service_role;
create table public.story_cleanup(path text primary key,queued_at timestamptz not null default now());
alter table public.story_cleanup enable row level security;revoke all on public.story_cleanup from public,anon,authenticated;grant all on public.story_cleanup to service_role;
create function public.story_queue_old()returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_op='DELETE' or old.path<>new.path then insert into public.story_cleanup(path)values(old.path)on conflict do nothing;end if;return old;end$$;
create trigger story_removed after delete or update on public.stories for each row execute function public.story_queue_old();
revoke all on function public.story_queue_old()from public,anon,authenticated;
-- Only the server media validator may publish. User ID comes from verified JWT, never the form.
create function public.story_publish(p_user uuid,p_path text,p_duration numeric)returns void language plpgsql security definer set search_path=public as $$begin
 if p_user is null or public.friend_id(p_user)is null or p_path!~('^'||p_user::text||'/[0-9a-f-]{36}\.mp4$') or p_duration is null or p_duration<=0 or p_duration>60 then raise exception 'Invalid story';end if;
 if not exists(select from storage.objects where bucket_id='stories'and name=p_path and (metadata->>'size')::bigint between 1 and 20971520)then raise exception 'Missing upload';end if;
 insert into public.stories(user_id,path,duration)values(p_user,p_path,p_duration)on conflict(user_id)do update set path=excluded.path,duration=excluded.duration,created_at=now(),expires_at=now()+interval '24 hours';end$$;
revoke all on function public.story_publish(uuid,text,numeric)from public,anon,authenticated;grant execute on function public.story_publish(uuid,text,numeric)to service_role;
create function public.story_delete()returns void language plpgsql security definer set search_path=public as $$begin if auth.uid()is null then raise insufficient_privilege;end if;delete from public.stories where user_id=auth.uid();end$$;
revoke all on function public.story_delete()from public,anon;grant execute on function public.story_delete()to authenticated;
-- No insert/update policies on storage: validated server upload only. No signed URL route in the app.
create function public.story_cleanup_tick()returns void language plpgsql security definer set search_path=public as $$declare secret text;begin
 delete from public.stories where expires_at<=now();
 insert into public.story_cleanup(path)select o.name from storage.objects o where o.bucket_id='stories'and o.created_at<now()-interval '1 hour'and not exists(select from public.stories s where s.path=o.name)on conflict do nothing;
 select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron'limit 1;
 if secret is not null then perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/story-media',headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:='{}'::jsonb,timeout_milliseconds:=10000);end if;end$$;
revoke all on function public.story_cleanup_tick()from public,anon,authenticated;
select cron.schedule('story-cleanup','* * * * *','select public.story_cleanup_tick()');
