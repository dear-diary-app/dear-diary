-- Inbox-song reactions only. No chat message, notification or Profile-song write.
create table public.inbox_song_reactions(owner_id uuid not null references public.inbox_songs(user_id)on delete cascade,reactor_id uuid not null references public.profiles(id)on delete cascade,share_expires_at timestamptz not null,emoji text not null check(emoji in('😍','🥹','🔥','❤️')),updated_at timestamptz not null default clock_timestamp(),primary key(owner_id,reactor_id),check(owner_id<>reactor_id));
alter table public.inbox_song_reactions enable row level security;
revoke all on public.inbox_song_reactions from public,anon,authenticated;
grant select on public.inbox_song_reactions to authenticated;
create policy inbox_song_reactions_pair_read on public.inbox_song_reactions for select to authenticated using(auth.uid()in(owner_id,reactor_id)and public.friend_id(owner_id)=reactor_id and exists(select 1 from public.inbox_songs s where s.user_id=owner_id and s.expires_at=share_expires_at and s.expires_at>now()));
create function public.clear_inbox_song_reactions()returns trigger language plpgsql security definer set search_path=public as $$begin delete from public.inbox_song_reactions where owner_id=new.user_id;return new;end$$;
create trigger inbox_song_replaced after update on public.inbox_songs for each row execute function public.clear_inbox_song_reactions();
revoke all on function public.clear_inbox_song_reactions()from public,anon,authenticated;
create function public.react_inbox_song(p_owner uuid,p_expires timestamptz,p_emoji text)returns void language plpgsql security definer set search_path=public as $$declare deadline timestamptz;begin
 if auth.uid()is null or p_owner=auth.uid()or public.friend_id(auth.uid())is distinct from p_owner or p_emoji is null or p_emoji not in('😍','🥹','🔥','❤️')then raise insufficient_privilege;end if;
 select expires_at into deadline from public.inbox_songs where user_id=p_owner for update;
 if deadline is null or deadline<=clock_timestamp()or deadline is distinct from p_expires then raise exception 'Song changed or expired. Reopen it to react.';end if;
 insert into public.inbox_song_reactions(owner_id,reactor_id,share_expires_at,emoji)values(p_owner,auth.uid(),deadline,p_emoji)on conflict(owner_id,reactor_id)do update set share_expires_at=excluded.share_expires_at,emoji=excluded.emoji,updated_at=clock_timestamp();
end$$;
revoke all on function public.react_inbox_song(uuid,timestamptz,text)from public,anon;grant execute on function public.react_inbox_song(uuid,timestamptz,text)to authenticated;
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime')then alter publication supabase_realtime add table public.inbox_song_reactions;end if;end$$;
