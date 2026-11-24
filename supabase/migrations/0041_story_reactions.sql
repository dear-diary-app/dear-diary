create table public.story_reactions(owner_id uuid not null references public.stories(user_id)on delete cascade,reactor_id uuid not null references public.profiles(id)on delete cascade,story_expires_at timestamptz not null,emoji text not null check(emoji in('❤️','😍','😂','🔥','👏','😮','🥹','💯')),updated_at timestamptz not null default now(),primary key(owner_id,reactor_id),check(owner_id<>reactor_id));
alter table public.story_reactions enable row level security;
create policy story_reaction_read on public.story_reactions for select to authenticated using((auth.uid()=owner_id or auth.uid()=reactor_id)and public.friend_id(owner_id)=reactor_id and exists(select from public.stories s where s.user_id=owner_id and s.expires_at=story_expires_at and s.expires_at>now()));
grant select on public.story_reactions to authenticated;
create function public.story_clear_reactions()returns trigger language plpgsql security definer set search_path=public as $$begin delete from public.story_reactions where owner_id=new.user_id;return new;end$$;
revoke all on function public.story_clear_reactions()from public,anon,authenticated;
create trigger story_reactions_reset after update on public.stories for each row execute function public.story_clear_reactions();
create function public.story_react(p_owner uuid,p_expires timestamptz,p_emoji text)returns void language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();s public.stories;begin
 if uid is null or uid=p_owner or public.friend_id(uid)is distinct from p_owner then raise insufficient_privilege;end if;
 if p_emoji is null or p_emoji not in('❤️','😍','😂','🔥','👏','😮','🥹','💯')then raise exception 'Invalid reaction';end if;
 select * into s from public.stories where user_id=p_owner for update;
 if not found or s.expires_at<=now()or s.expires_at is distinct from p_expires then raise exception 'Story changed or expired';end if;
 insert into public.story_reactions(owner_id,reactor_id,story_expires_at,emoji)values(p_owner,uid,s.expires_at,p_emoji)on conflict(owner_id,reactor_id)do update set emoji=excluded.emoji,story_expires_at=excluded.story_expires_at,updated_at=now();end$$;
revoke all on function public.story_react(uuid,timestamptz,text)from public,anon;grant execute on function public.story_react(uuid,timestamptz,text)to authenticated;
