create or replace function public.story_react(p_owner uuid,p_expires timestamptz,p_emoji text)returns void language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();s public.stories;begin
 if uid is null or uid=p_owner or public.friend_id(uid)is distinct from p_owner then raise insufficient_privilege;end if;
 if p_emoji is null or p_emoji not in('❤️','😍','😂','🔥','👏','😮','🥹','💯')then raise exception 'Invalid reaction';end if;
 select * into s from public.stories where user_id=p_owner for update;
 if not found or s.expires_at<=now()or s.expires_at is distinct from p_expires then raise exception 'Story changed or expired';end if;
 insert into public.story_views(owner_id,viewer_id,story_expires_at)values(p_owner,uid,s.expires_at)on conflict(owner_id,viewer_id)do nothing;
 insert into public.story_reactions(owner_id,reactor_id,story_expires_at,emoji)values(p_owner,uid,s.expires_at,p_emoji)on conflict(owner_id,reactor_id)do update set emoji=excluded.emoji,story_expires_at=excluded.story_expires_at,updated_at=now();end$$;

-- Existing reactions are sufficient evidence of a view for that same story.
insert into public.story_views(owner_id,viewer_id,story_expires_at,viewed_at) select r.owner_id,r.reactor_id,r.story_expires_at,r.updated_at from public.story_reactions r join public.stories s on s.user_id=r.owner_id and s.expires_at=r.story_expires_at where s.expires_at>now()on conflict(owner_id,viewer_id)do nothing;
