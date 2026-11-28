-- Reply rows remain Room-only and cascade-delete with the Room.
alter table public.watch_messages add column reply_to uuid references public.watch_messages(id) on delete set null;
drop function public.watch_room(text,uuid,uuid,bigint,text,double precision,boolean,text,uuid);
-- Pause once per departure, allow explicit solo playback, non-disruptive rejoin.
create or replace function public.watch_room(p_action text default 'peek',p_room uuid default null,p_session uuid default null,p_version bigint default null,p_video text default null,p_position double precision default null,p_playing boolean default null,p_body text default null,p_message uuid default null,p_reply uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); partner uuid; r public.watch_rooms; t timestamptz; own public.watch_members; both_here boolean; mine boolean; msgs jsonb; expired_count integer;
begin
 if uid is null then raise insufficient_privilege;end if;
 partner:=public.friend_id(uid);if partner is null then raise insufficient_privilege;end if;
 if p_action not in ('peek','create','join','beat','control','leave','end','message') then raise exception 'Unknown Room action';end if;
 perform pg_advisory_xact_lock(hashtextextended(least(uid::text,partner::text)||greatest(uid::text,partner::text),17));t:=clock_timestamp();
 select * into r from public.watch_rooms where pair=least(uid::text,partner::text)||greatest(uid::text,partner::text) for update;
 if r.id is not null and r.active_at<t-interval '24 hours' then delete from public.watch_rooms where id=r.id;r:=null;end if;
 if p_room is not null and r.id is distinct from p_room then return jsonb_build_object('ended',true,'server_now',t);end if;
 if p_action='create' and r.id is null then
 insert into public.watch_rooms(host,guest,pair)values(uid,partner,least(uid::text,partner::text)||greatest(uid::text,partner::text))returning * into r;
 end if;
 if r.id is null then return jsonb_build_object('server_now',t);end if;
 if not ((r.host=uid and r.guest=partner)or(r.host=partner and r.guest=uid))then raise insufficient_privilege;end if;
 select * into own from public.watch_members where room=r.id and user_id=uid;
 -- Expiry is an edge, not a permanent fewer-than-two gate. Remove once.
 delete from public.watch_members where room=r.id and seen<=t-interval '15 seconds';
 get diagnostics expired_count = row_count;
 if expired_count>0 and r.playing then
 r.position:=least(86400,r.position+greatest(0,extract(epoch from(t-r.changed_at))));r.playing:=false;r.version:=r.version+1;r.changed_at:=t;
 end if;
 if p_action in ('create','join')then
 if p_session is null then raise exception 'Room session missing';end if;
 insert into public.watch_members(room,user_id,session,seen)values(r.id,uid,p_session,t)on conflict(room,user_id)do update set session=excluded.session,seen=t;
 -- Returning partner never interrupts the person already watching.
 -- Replacing this person's device is a departure of the old active device.
 if own.session is not null and own.session<>p_session and r.playing then
 r.position:=least(86400,r.position+greatest(0,extract(epoch from(t-r.changed_at))));r.playing:=false;r.version:=r.version+1;r.changed_at:=t;
 end if;
 r.active_at:=t;
 elsif p_action<>'peek' then
 if own.session is distinct from p_session or p_session is null or not exists(select from public.watch_members where room=r.id and user_id=uid and session=p_session)then raise exception 'Join this Room on this device first';end if;
 if p_action='end' then delete from public.watch_rooms where id=r.id;return jsonb_build_object('ended',true,'server_now',t);end if;
 if p_action='leave' then
 delete from public.watch_members where room=r.id and user_id=uid and session=p_session;
 if r.playing then r.position:=least(86400,r.position+greatest(0,extract(epoch from(t-r.changed_at))));end if;
 r.playing:=false;r.version:=r.version+1;r.changed_at:=t;
 else
 update public.watch_members set seen=t where room=r.id and user_id=uid and session=p_session;r.active_at:=t;
 if p_action='control' then
 if p_version is distinct from r.version then raise exception 'Room changed. Sync again and retry.';end if;
 if p_position is null or p_position<0 or p_position>86400 or p_position::text in('NaN','Infinity','-Infinity')or p_playing is null then raise exception 'Invalid playback command';end if;
 select count(*)=2 into both_here from public.watch_members where room=r.id and user_id in(uid,partner)and seen>t-interval '15 seconds';
 -- A fresh explicit Play is permitted while alone after a departure pause.
 if p_video is not null and p_video!~'^[A-Za-z0-9_-]{11}$'then raise exception 'Invalid YouTube video';end if;
 r.video:=coalesce(p_video,r.video);if r.video is null then raise exception 'Choose a video first';end if;
 r.position:=p_position;r.playing:=p_playing;r.version:=r.version+1;r.changed_at:=t;
 elsif p_action='message' then
 if p_body is null or length(trim(p_body))not between 1 and 2000 or p_message is null then raise exception 'Message must be 1 to 2000 characters';end if;
 if(select count(*)from public.watch_messages where room=r.id)>=500 then raise exception 'Room has 500 messages. End it and start a new Room.';end if;
 if(select count(*)from public.watch_messages where room=r.id and sender=uid and created_at>t-interval '1 minute')>=30 then raise exception 'Please slow down';end if;
 if p_reply is not null and not exists(select 1 from public.watch_messages where id=p_reply and room=r.id)then raise exception 'Reply message is not in this Room';end if;
 insert into public.watch_messages(id,room,sender,body,reply_to)values(p_message,r.id,uid,trim(p_body),p_reply)on conflict(id)do nothing;
 end if;
 end if;
 end if;
 update public.watch_rooms set video=r.video,playing=r.playing,position=r.position,version=r.version,changed_at=r.changed_at,active_at=r.active_at where id=r.id;
 select exists(select from public.watch_members where room=r.id and user_id=uid and session=p_session)into mine;
 if mine then select coalesce(jsonb_agg(to_jsonb(m)order by m.created_at,m.id),'[]'::jsonb)into msgs from(select m.id,m.sender,m.body,m.created_at,m.reply_to,p.body as reply_body,p.sender as reply_sender from public.watch_messages m left join public.watch_messages p on p.id=m.reply_to and p.room=m.room where m.room=r.id order by m.created_at,m.id)m;else msgs:='[]'::jsonb;end if;
 return jsonb_build_object('id',r.id,'host',r.host=uid,'video',r.video,'playing',r.playing,'position',r.position,'version',r.version,'changed_at',r.changed_at,'server_now',t,'joined',mine,'partner_online',exists(select from public.watch_members where room=r.id and user_id=partner and seen>t-interval '15 seconds'),'messages',msgs);
end$$;
revoke all on function public.watch_room(text,uuid,uuid,bigint,text,double precision,boolean,text,uuid,uuid)from public,anon;
grant execute on function public.watch_room(text,uuid,uuid,bigint,text,double precision,boolean,text,uuid,uuid)to authenticated;

create or replace function public.can_react_in_watch_room(topic text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.watch_rooms r where topic in('dd-room-reactions-'||r.id::text,'dd-room-live-'||r.id::text)
 and auth.uid() in(r.host,r.guest) and public.friend_id(auth.uid())=case when auth.uid()=r.host then r.guest else r.host end)
$$;
