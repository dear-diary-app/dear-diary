-- A second, independent slot. Existing video stories and their expiry stay untouched.
create table public.post_stories(user_id uuid primary key references public.profiles(id)on delete cascade,post_id uuid not null references public.feed_posts(id)on delete cascade,photo_index integer not null check(photo_index between 0 and 2),song jsonb,created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '24 hours'),check(expires_at=created_at+interval '24 hours'));
alter table public.post_stories enable row level security;
create policy post_story_read on public.post_stories for select to authenticated using(expires_at>now()and(user_id=auth.uid()or user_id=public.friend_id(auth.uid()))and exists(select from public.feed_posts p where p.id=post_id and auth.uid()in(p.owner_id,p.partner_id)));
grant select on public.post_stories to authenticated;grant all on public.post_stories to service_role;
create function public.post_story_publish(p_post uuid,p_index integer)returns void language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();p public.feed_posts;begin
 if uid is null or p_index is null or p_index not between 0 and 2 then raise insufficient_privilege;end if;
 select * into p from public.feed_posts where id=p_post for share;
 if not found or uid not in(p.owner_id,p.partner_id)or public.friend_id(uid)not in(p.owner_id,p.partner_id)or public.friend_id(uid)is null or p.paths[p_index+1]is null then raise insufficient_privilege;end if;
 insert into public.post_stories(user_id,post_id,photo_index,song)values(uid,p.id,p_index,p.song)on conflict(user_id)do update set post_id=excluded.post_id,photo_index=excluded.photo_index,song=excluded.song,created_at=now(),expires_at=now()+interval '24 hours';end$$;
revoke all on function public.post_story_publish(uuid,integer)from public,anon;grant execute on function public.post_story_publish(uuid,integer)to authenticated;
create function public.post_story_delete()returns void language plpgsql security definer set search_path=public as $$begin if auth.uid()is null then raise insufficient_privilege;end if;delete from public.post_stories where user_id=auth.uid();end$$;
revoke all on function public.post_story_delete()from public,anon;grant execute on function public.post_story_delete()to authenticated;
create table public.post_story_reactions(owner_id uuid not null references public.post_stories(user_id)on delete cascade,reactor_id uuid not null references public.profiles(id)on delete cascade,story_expires_at timestamptz not null,emoji text not null check(emoji in('❤️','😍','😂','🔥','👏','😮','🥹','💯')),updated_at timestamptz not null default now(),primary key(owner_id,reactor_id),check(owner_id<>reactor_id));
create table public.post_story_views(owner_id uuid not null references public.post_stories(user_id)on delete cascade,viewer_id uuid not null references public.profiles(id)on delete cascade,story_expires_at timestamptz not null,viewed_at timestamptz not null default now(),primary key(owner_id,viewer_id),check(owner_id<>viewer_id));
alter table public.post_story_reactions enable row level security;alter table public.post_story_views enable row level security;
create policy post_story_reaction_read on public.post_story_reactions for select to authenticated using((auth.uid()=owner_id or auth.uid()=reactor_id)and public.friend_id(owner_id)=reactor_id and exists(select from public.post_stories s where s.user_id=owner_id and s.expires_at=story_expires_at and s.expires_at>now()));
create policy post_story_view_read on public.post_story_views for select to authenticated using((auth.uid()=owner_id or auth.uid()=viewer_id)and public.friend_id(owner_id)=viewer_id and exists(select from public.post_stories s where s.user_id=owner_id and s.expires_at=story_expires_at and s.expires_at>now()));
grant select on public.post_story_reactions,public.post_story_views to authenticated;grant all on public.post_story_reactions,public.post_story_views to service_role;
create function public.post_story_reset()returns trigger language plpgsql security definer set search_path=public as $$begin delete from public.post_story_reactions where owner_id=new.user_id;delete from public.post_story_views where owner_id=new.user_id;return new;end$$;
revoke all on function public.post_story_reset()from public,anon,authenticated;
create trigger post_story_reset after update on public.post_stories for each row execute function public.post_story_reset();
create function public.post_story_view(p_owner uuid,p_expires timestamptz)returns void language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();s public.post_stories;begin
 if uid is null or uid=p_owner or public.friend_id(uid)is distinct from p_owner then raise insufficient_privilege;end if;
 select * into s from public.post_stories where user_id=p_owner for update;if not found or s.expires_at<=now()or s.expires_at is distinct from p_expires then raise exception 'Story changed or expired';end if;
 insert into public.post_story_views(owner_id,viewer_id,story_expires_at)values(p_owner,uid,s.expires_at)on conflict(owner_id,viewer_id)do nothing;end$$;
create function public.post_story_react(p_owner uuid,p_expires timestamptz,p_emoji text)returns void language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();s public.post_stories;begin
 if uid is null or uid=p_owner or public.friend_id(uid)is distinct from p_owner then raise insufficient_privilege;end if;
 if p_emoji is null or p_emoji not in('❤️','😍','😂','🔥','👏','😮','🥹','💯')then raise exception 'Invalid reaction';end if;
 select * into s from public.post_stories where user_id=p_owner for update;if not found or s.expires_at<=now()or s.expires_at is distinct from p_expires then raise exception 'Story changed or expired';end if;
 insert into public.post_story_views(owner_id,viewer_id,story_expires_at)values(p_owner,uid,s.expires_at)on conflict(owner_id,viewer_id)do nothing;
 insert into public.post_story_reactions(owner_id,reactor_id,story_expires_at,emoji)values(p_owner,uid,s.expires_at,p_emoji)on conflict(owner_id,reactor_id)do update set emoji=excluded.emoji,story_expires_at=excluded.story_expires_at,updated_at=now();end$$;
revoke all on function public.post_story_view(uuid,timestamptz),public.post_story_react(uuid,timestamptz,text)from public,anon;grant execute on function public.post_story_view(uuid,timestamptz),public.post_story_react(uuid,timestamptz,text)to authenticated;
create function public.post_story_cleanup_tick()returns void language sql security definer set search_path=public as $$delete from public.post_stories where expires_at<=now();$$;
revoke all on function public.post_story_cleanup_tick()from public,anon,authenticated;
select cron.schedule('post-story-cleanup','* * * * *','select public.post_story_cleanup_tick()');
