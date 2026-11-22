-- Foreground app presence, not a permanent connection label or a last-seen history.
-- Separate short-lived sessions prevent one tab/device from taking another offline.
create table public.chat_presence_sessions (
    user_id uuid not null references public.profiles(id) on delete cascade,
    session_id uuid not null,
    expires_at timestamptz not null,
    primary key (user_id, session_id)
);
alter table public.chat_presence_sessions enable row level security;
revoke all on public.chat_presence_sessions from public, anon, authenticated;

create function public.chat_presence(p_session uuid, p_online boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
    if uid is null then raise insufficient_privilege; end if;
    if p_session is null or p_online is null then raise exception 'Presence session required'; end if;
    delete from public.chat_presence_sessions where user_id = uid and expires_at <= now();
    if p_online then
        insert into public.chat_presence_sessions(user_id, session_id, expires_at)
        values (uid, p_session, now() + interval '35 seconds')
        on conflict (user_id, session_id) do update set expires_at = excluded.expires_at;
    else
        delete from public.chat_presence_sessions where user_id = uid and session_id = p_session;
    end if;
    return exists (
        select 1 from public.chat_presence_sessions
        where user_id = public.friend_id(uid) and expires_at > now()
    );
end $$;
revoke all on function public.chat_presence(uuid, boolean) from public, anon;
grant execute on function public.chat_presence(uuid, boolean) to authenticated;
