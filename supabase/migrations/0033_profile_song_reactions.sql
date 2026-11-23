-- One linked visitor can react to the current share, never to an expired/replaced one.
create table public.profile_song_reactions(
 owner_id uuid not null references public.profile_songs(user_id) on delete cascade,
 reactor_id uuid not null references public.profiles(id) on delete cascade,
 share_expires_at timestamptz not null,
 emoji text not null check(emoji in('❤️','🔥','😍','🎧','👏')),
 updated_at timestamptz not null default now(),
 primary key(owner_id,reactor_id),check(owner_id<>reactor_id)
);
alter table public.profile_song_reactions enable row level security;
create policy song_reaction_read on public.profile_song_reactions for select to authenticated using(
 (auth.uid()=owner_id or auth.uid()=reactor_id) and public.friend_id(owner_id)=reactor_id
 and exists(select 1 from public.profile_songs s where s.user_id=owner_id and s.expires_at=share_expires_at and s.expires_at>now())
);
grant select on public.profile_song_reactions to authenticated;
create function public.clear_profile_song_reactions() returns trigger language plpgsql security definer set search_path=public as $$begin
 delete from public.profile_song_reactions where owner_id=new.user_id;return new;end$$;
revoke all on function public.clear_profile_song_reactions() from public,anon,authenticated;
create trigger profile_song_reactions_reset after update on public.profile_songs for each row execute function public.clear_profile_song_reactions();
create function public.react_profile_song(p_owner uuid,p_expires timestamptz,p_emoji text) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();s public.profile_songs;
begin
 if uid is null or uid=p_owner or public.friend_id(uid) is distinct from p_owner then raise insufficient_privilege;end if;
 if p_emoji is not null and p_emoji not in('❤️','🔥','😍','🎧','👏')then raise exception 'Invalid reaction';end if;
 select * into s from public.profile_songs where user_id=p_owner for update;
 if not found or s.expires_at<=now() or s.expires_at is distinct from p_expires then raise exception 'This song has changed or expired';end if;
 if p_emoji is null then delete from public.profile_song_reactions where owner_id=p_owner and reactor_id=uid;
 else insert into public.profile_song_reactions(owner_id,reactor_id,share_expires_at,emoji)values(p_owner,uid,s.expires_at,p_emoji)
 on conflict(owner_id,reactor_id)do update set emoji=excluded.emoji,share_expires_at=excluded.share_expires_at,updated_at=now();end if;
end$$;
revoke all on function public.react_profile_song(uuid,timestamptz,text) from public,anon;
grant execute on function public.react_profile_song(uuid,timestamptz,text) to authenticated;
