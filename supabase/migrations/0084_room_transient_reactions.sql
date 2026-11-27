-- Client Broadcast only: no reaction event or emoji is inserted into a table.
-- Do not change global public-channel settings: existing Chat uses public channels.
-- Access is scoped to this Room's linked pair, not arbitrary authenticated users.
create function public.can_react_in_watch_room(topic text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.watch_rooms r
 where topic='dd-room-reactions-'||r.id::text
 and auth.uid() in(r.host,r.guest)
 and public.friend_id(auth.uid())=case when auth.uid()=r.host then r.guest else r.host end)
$$;
revoke all on function public.can_react_in_watch_room(text) from public,anon;
grant execute on function public.can_react_in_watch_room(text) to authenticated;
create policy watch_reactions_receive on realtime.messages for select to authenticated
using(extension='broadcast' and public.can_react_in_watch_room((select realtime.topic())));
create policy watch_reactions_send on realtime.messages for insert to authenticated
with check(extension='broadcast' and public.can_react_in_watch_room((select realtime.topic())));
