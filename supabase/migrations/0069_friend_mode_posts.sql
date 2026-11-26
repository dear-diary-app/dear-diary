-- Old posts remain private-only. No changes to existing pair read permissions.
alter table public.feed_posts add column friend_mode boolean not null default false;
create function public.friend_mode_posts() returns table(id uuid,photo_count integer) language sql stable security definer set search_path=public as $$
 select p.id,cardinality(p.paths) from public.feed_posts p where p.owner_id=auth.uid() and p.friend_mode=true order by p.created_at desc,p.id desc limit 30;
$$;
revoke all on function public.friend_mode_posts() from public,anon;
grant execute on function public.friend_mode_posts() to authenticated;
