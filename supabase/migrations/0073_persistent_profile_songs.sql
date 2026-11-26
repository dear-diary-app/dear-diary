-- Profile songs persist until changed/removed. Inbox songs are untouched.
alter table public.profile_songs alter column expires_at drop not null;
alter table public.profile_songs alter column expires_at drop default;
alter table public.profile_song_reactions add column share_version timestamptz;
update public.profile_song_reactions r set share_version=s.updated_at from public.profile_songs s where s.user_id=r.owner_id and s.expires_at=r.share_expires_at;
-- Keep currently visible songs and reactions, but do not revive expired shares.
alter table public.profile_songs disable trigger profile_song_expiry;
alter table public.profile_songs disable trigger profile_song_reactions_reset;
update public.profile_songs set expires_at=null where expires_at>now();
alter table public.profile_songs enable trigger profile_song_expiry;
alter table public.profile_songs enable trigger profile_song_reactions_reset;
create or replace function public.profile_song_expiry() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=clock_timestamp();new.expires_at=null;return new;end$$;
drop policy profile_songs_read on public.profile_songs;
create policy profile_songs_read on public.profile_songs for select to authenticated using((user_id=auth.uid() or user_id=public.friend_id(auth.uid())) and (expires_at is null or expires_at>now()));
create or replace function public.set_profile_song(value jsonb) returns timestamptz language plpgsql security definer set search_path=public as $$
declare version timestamptz;begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if value is null then delete from public.profile_songs where user_id=auth.uid();return null;end if;
 if jsonb_typeof(value)<>'object' or octet_length(value::text)>2000 or not(value ?& array['id','name','artist','art','url','store']) then raise exception 'Invalid song';end if;
 insert into public.profile_songs(user_id,song) values(auth.uid(),value) on conflict(user_id) do update set song=excluded.song returning updated_at into version;
 return version;end$$;
drop policy song_reaction_read on public.profile_song_reactions;
create policy song_reaction_read on public.profile_song_reactions for select to authenticated using((auth.uid()=owner_id or auth.uid()=reactor_id) and public.friend_id(owner_id)=reactor_id and exists(select 1 from public.profile_songs s where s.user_id=owner_id and s.updated_at=share_version and (s.expires_at is null or s.expires_at>now())));
create function public.react_persistent_profile_song(p_owner uuid,p_version timestamptz,p_emoji text) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();s public.profile_songs;begin
 if uid is null or uid=p_owner or public.friend_id(uid) is distinct from p_owner then raise insufficient_privilege;end if;
 if p_emoji is not null and p_emoji not in('❤️','🔥','😍','🎧','👏')then raise exception 'Invalid reaction';end if;
 select * into s from public.profile_songs where user_id=p_owner for update;
 if not found or (s.expires_at is not null and s.expires_at<=now()) or s.updated_at is distinct from p_version then raise exception 'This song has changed';end if;
 if p_emoji is null then delete from public.profile_song_reactions where owner_id=p_owner and reactor_id=uid;
 else insert into public.profile_song_reactions(owner_id,reactor_id,share_expires_at,share_version,emoji)values(p_owner,uid,coalesce(s.expires_at,s.updated_at),s.updated_at,p_emoji) on conflict(owner_id,reactor_id)do update set emoji=excluded.emoji,share_expires_at=excluded.share_expires_at,share_version=excluded.share_version,updated_at=now();end if;end$$;
revoke all on function public.react_persistent_profile_song(uuid,timestamptz,text) from public,anon;
grant execute on function public.react_persistent_profile_song(uuid,timestamptz,text) to authenticated;
-- Retire the old expiry-token write path rather than allow stale reactions.
revoke execute on function public.react_profile_song(uuid,timestamptz,text) from authenticated;
