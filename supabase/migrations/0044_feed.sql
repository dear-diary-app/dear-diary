-- Permanent private pair feed. Media is served only after a fresh JWT and pair check.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('feed','feed',false,5242880,array['image/jpeg']);
create table public.feed_posts(id uuid primary key,owner_id uuid not null references public.profiles(id)on delete cascade,partner_id uuid not null references public.profiles(id)on delete cascade,paths text[] not null check(cardinality(paths)between 1 and 3),song jsonb check(public.valid_chat_song(song)),created_at timestamptz not null default now(),check(owner_id<>partner_id));
create index feed_time on public.feed_posts(created_at desc,id desc);
alter table public.feed_posts enable row level security;
create policy feed_pair_read on public.feed_posts for select to authenticated using((auth.uid()=owner_id or auth.uid()=partner_id)and public.friend_id(owner_id)=partner_id);
grant select on public.feed_posts to authenticated;grant all on public.feed_posts to service_role;
create table public.feed_cleanup(path text primary key,queued_at timestamptz not null default now());alter table public.feed_cleanup enable row level security;revoke all on public.feed_cleanup from public,anon,authenticated;grant all on public.feed_cleanup to service_role;
create function public.feed_removed()returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.feed_cleanup(path)select unnest(old.paths)on conflict do nothing;return old;end$$;
create trigger feed_removed after delete on public.feed_posts for each row execute function public.feed_removed();revoke all on function public.feed_removed()from public,anon,authenticated;
create function public.feed_delete(p_id uuid)returns void language plpgsql security definer set search_path=public as $$begin if auth.uid()is null then raise insufficient_privilege;end if;delete from public.feed_posts where id=p_id and owner_id=auth.uid();end$$;
revoke all on function public.feed_delete(uuid)from public,anon;grant execute on function public.feed_delete(uuid)to authenticated;
create function public.feed_cleanup_tick()returns void language plpgsql security definer set search_path=public as $$declare secret text;begin
 insert into public.feed_cleanup(path)select o.name from storage.objects o where o.bucket_id='feed'and o.created_at<now()-interval '1 hour'and not exists(select from public.feed_posts p where o.name=any(p.paths))on conflict do nothing;
 select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron'limit 1;
 if secret is not null then perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/feed-media',headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:='{}'::jsonb,timeout_milliseconds:=10000);end if;end$$;
revoke all on function public.feed_cleanup_tick()from public,anon,authenticated;
select cron.schedule('feed-cleanup','* * * * *','select public.feed_cleanup_tick()');
