-- Read current partner lease without writing another heartbeat. Same friend-only scope.
create function public.chat_partner_online()returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select from public.chat_presence_sessions where user_id=public.friend_id(auth.uid())and expires_at>now());
$$;
revoke all on function public.chat_partner_online()from public,anon;
grant execute on function public.chat_partner_online()to authenticated;
