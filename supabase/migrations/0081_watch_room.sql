-- Pair-only Room. Staged, not deployed. Idle lock policy is unchanged.
create table public.watch_rooms (
 id uuid primary key default gen_random_uuid(), host uuid not null references public.profiles(id) on delete cascade,
 guest uuid not null references public.profiles(id) on delete cascade, pair text unique not null,
 video text check(video ~ '^[A-Za-z0-9_-]{11}$'), playing boolean not null default false,
 position double precision not null default 0 check(position>=0 and position<=86400),
 version bigint not null default 0, changed_at timestamptz not null default clock_timestamp(),
 active_at timestamptz not null default clock_timestamp(), check(host<>guest));
create table public.watch_members (
 room uuid not null references public.watch_rooms(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
 session uuid not null, seen timestamptz not null default clock_timestamp(), primary key(room,user_id));
create table public.watch_messages (
 id uuid primary key, room uuid not null references public.watch_rooms(id) on delete cascade,
 sender uuid not null references public.profiles(id) on delete cascade, body text not null check(length(body) between 1 and 2000),
 created_at timestamptz not null default clock_timestamp());
create index on public.watch_messages(room,created_at);
alter table public.watch_rooms enable row level security;
alter table public.watch_members enable row level security;
alter table public.watch_messages enable row level security;
revoke all on public.watch_rooms,public.watch_members,public.watch_messages from public,anon,authenticated;
create function public.watch_room(p_action text default 'peek',p_room uuid default null,p_session uuid default null,p_version bigint default null,p_video text default null,p_position double precision default null,p_playing boolean default null,p_body text default null,p_message uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); partner uuid; r public.watch_rooms; t timestamptz; own public.watch_members; both_here boolean; mine boolean; msgs jsonb;
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
 -- Detect lost presence before refreshing it. A returning device never silently resumes.
 select count(*)=2 into both_here from public.watch_members where room=r.id and user_id in(uid,partner)and seen>t-interval '15 seconds';
 if r.playing and not both_here then
 r.position:=least(86400,r.position+greatest(0,extract(epoch from(t-r.changed_at))));r.playing:=false;r.version:=r.version+1;r.changed_at:=t;
 end if;
 if p_action in ('create','join')then
 if p_session is null then raise exception 'Room session missing';end if;
 insert into public.watch_members(room,user_id,session,seen)values(r.id,uid,p_session,t)on conflict(room,user_id)do update set session=excluded.session,seen=t;
 -- Joining/replacing a device pauses both.
 if r.playing then r.position:=least(86400,r.position+greatest(0,extract(epoch from(t-r.changed_at))));end if;
 r.playing:=false;r.version:=r.version+1;r.changed_at:=t;r.active_at:=t;
 elsif p_action<>'peek' then
 if own.session is distinct from p_session or p_session is null then raise exception 'Join this Room on this device first';end if;
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
 if p_playing and not both_here then raise exception 'Wait for both people to join';end if;
 if p_video is not null and p_video!~'^[A-Za-z0-9_-]{11}$'then raise exception 'Invalid YouTube video';end if;
 r.video:=coalesce(p_video,r.video);if r.video is null then raise exception 'Choose a video first';end if;
 r.position:=p_position;r.playing:=p_playing;r.version:=r.version+1;r.changed_at:=t;
 elsif p_action='message' then
 if p_body is null or length(trim(p_body))not between 1 and 2000 or p_message is null then raise exception 'Message must be 1 to 2000 characters';end if;
 if(select count(*)from public.watch_messages where room=r.id)>=500 then raise exception 'Room has 500 messages. End it and start a new Room.';end if;
 if(select count(*)from public.watch_messages where room=r.id and sender=uid and created_at>t-interval '1 minute')>=30 then raise exception 'Please slow down';end if;
 insert into public.watch_messages(id,room,sender,body)values(p_message,r.id,uid,trim(p_body))on conflict(id)do nothing;
 end if;
 end if;
 end if;
 update public.watch_rooms set video=r.video,playing=r.playing,position=r.position,version=r.version,changed_at=r.changed_at,active_at=r.active_at where id=r.id;
 select exists(select from public.watch_members where room=r.id and user_id=uid and session=p_session)into mine;
 if mine then select coalesce(jsonb_agg(to_jsonb(m)order by m.created_at,m.id),'[]'::jsonb)into msgs from(select id,sender,body,created_at from public.watch_messages where room=r.id order by created_at,id)m;else msgs:='[]'::jsonb;end if;
 return jsonb_build_object('id',r.id,'host',r.host=uid,'video',r.video,'playing',r.playing,'position',r.position,'version',r.version,'changed_at',r.changed_at,'server_now',t,'joined',mine,'partner_online',exists(select from public.watch_members where room=r.id and user_id=partner and seen>t-interval '15 seconds'),'messages',msgs);
end$$;
revoke all on function public.watch_room(text,uuid,uuid,bigint,text,double precision,boolean,text,uuid)from public,anon;
grant execute on function public.watch_room(text,uuid,uuid,bigint,text,double precision,boolean,text,uuid)to authenticated;
-- Physical deletion, including messages through cascade. 24h policy needs owner confirmation before release.
create function public.watch_room_cleanup()returns void language sql security definer set search_path=public as $$delete from public.watch_rooms where active_at<clock_timestamp()-interval '24 hours';$$;
revoke all on function public.watch_room_cleanup()from public,anon,authenticated;
select cron.schedule('watch-room-cleanup','*/10 * * * *','select public.watch_room_cleanup()');
