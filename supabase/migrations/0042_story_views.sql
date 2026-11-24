create table public.story_views(owner_id uuid not null references public.stories(user_id)on delete cascade,viewer_id uuid not null references public.profiles(id)on delete cascade,story_expires_at timestamptz not null,viewed_at timestamptz not null default now(),primary key(owner_id,viewer_id),check(owner_id<>viewer_id));
alter table public.story_views enable row level security;
create policy story_view_read on public.story_views for select to authenticated using((auth.uid()=owner_id or auth.uid()=viewer_id)and public.friend_id(owner_id)=viewer_id and exists(select from public.stories s where s.user_id=owner_id and s.expires_at=story_expires_at and s.expires_at>now()));
grant select on public.story_views to authenticated;
create function public.story_clear_views()returns trigger language plpgsql security definer set search_path=public as $$begin delete from public.story_views where owner_id=new.user_id;return new;end$$;
revoke all on function public.story_clear_views()from public,anon,authenticated;
create trigger story_views_reset after update on public.stories for each row execute function public.story_clear_views();
create function public.story_view(p_owner uuid,p_expires timestamptz)returns void language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();s public.stories;begin
 if uid is null or uid=p_owner or public.friend_id(uid)is distinct from p_owner then raise insufficient_privilege;end if;
 select * into s from public.stories where user_id=p_owner for update;
 if not found or s.expires_at<=now()or s.expires_at is distinct from p_expires then raise exception 'Story changed or expired';end if;
 insert into public.story_views(owner_id,viewer_id,story_expires_at)values(p_owner,uid,s.expires_at)on conflict(owner_id,viewer_id)do nothing;end$$;
revoke all on function public.story_view(uuid,timestamptz)from public,anon;grant execute on function public.story_view(uuid,timestamptz)to authenticated;
