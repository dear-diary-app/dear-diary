-- Server-authoritative single-question GK rounds. No message/push side effects.
create table public.gk_bank(id integer primary key,question text not null,options jsonb not null check(jsonb_array_length(options)=4),correct integer not null check(correct between 0 and 3),source text not null,category text not null);
create table public.gk_rounds(id uuid primary key default gen_random_uuid(),host uuid not null references public.profiles(id) on delete cascade,guest uuid not null references public.profiles(id) on delete cascade,question_id integer not null references public.gk_bank(id),state text not null default 'invite' check(state in ('invite','arming','playing','cancelled')),created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '60 seconds',host_ready timestamptz,guest_ready timestamptz,starts_at timestamptz,ends_at timestamptz,host_answer integer check(host_answer between 0 and 3),guest_answer integer check(guest_answer between 0 and 3),check(host<>guest));
alter table public.gk_bank enable row level security;
alter table public.gk_rounds enable row level security;
revoke all on public.gk_bank,public.gk_rounds from public,anon,authenticated;
create function public.gk_duel(p_action text default 'peek',p_id uuid default null,p_choice integer default null)returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); partner uuid; r public.gk_rounds; b public.gk_bank; t timestamptz:=clock_timestamp(); pair text;
begin
 if uid is null then raise insufficient_privilege;end if;
 partner:=public.friend_id(uid);if partner is null then raise exception 'No linked partner';end if;
 pair:=least(uid::text,partner::text)||greatest(uid::text,partner::text);perform pg_advisory_xact_lock(hashtextextended(pair,0));t:=clock_timestamp();
 if p_action not in ('peek','invite','accept','ready','answer','cancel') then raise exception 'Unknown quiz action';end if;
 if p_id is not null then
 select * into r from public.gk_rounds where id=p_id and ((host=uid and guest=partner)or(host=partner and guest=uid)) for update;
 if not found then raise insufficient_privilege;end if;
 else
 select * into r from public.gk_rounds where ((host=uid and guest=partner)or(host=partner and guest=uid)) and state<>'cancelled' and ((ends_at is null and expires_at>t)or ends_at>t-interval '5 minutes') order by created_at desc limit 1 for update;
 end if;
 if p_action='invite' then
 if r.id is not null and ((r.ends_at is not null and r.ends_at>t)or(r.ends_at is null and r.expires_at>t)) then raise exception 'A quiz is already waiting or playing';end if;
 if not exists(select from chat_presence_sessions where user_id=uid and expires_at>t)or not exists(select from chat_presence_sessions where user_id=partner and expires_at>t)then raise exception 'Both players must be online';end if;
 insert into public.gk_rounds(host,guest,question_id)select uid,partner,id from public.gk_bank order by case when id in(select question_id from public.gk_rounds where host in(uid,partner)and guest in(uid,partner)order by created_at desc limit 10)then 1 else 0 end,random()limit 1 returning * into r;
 if r.id is null then raise exception 'Question bank unavailable';end if;
 elsif p_action<>'peek' then
 if r.id is null or r.state='cancelled' then raise exception 'Quiz unavailable';end if;
 if p_action='cancel' then
 if r.starts_at is not null and t>=r.starts_at then raise exception 'The round has started';end if;
 r.state:='cancelled';
 elsif p_action='accept' then
 if r.guest<>uid or r.state<>'invite' or t>=r.expires_at then raise exception 'Invite unavailable';end if;
 if not exists(select from chat_presence_sessions where user_id=partner and expires_at>t)then raise exception 'Your friend is offline';end if;
 r.state:='arming';r.expires_at:=t+interval '30 seconds';
 elsif p_action='ready' then
 if r.state='arming' and t<r.expires_at then
 if not exists(select from chat_presence_sessions where user_id=uid and expires_at>t)or not exists(select from chat_presence_sessions where user_id=partner and expires_at>t)then raise exception 'Both players must be online';end if;
 if uid=r.host then r.host_ready:=t;else r.guest_ready:=t;end if;
 if r.host_ready>t-interval '8 seconds' and r.guest_ready>t-interval '8 seconds' then r.state:='playing';r.starts_at:=t+interval '3 seconds';r.ends_at:=r.starts_at+interval '10 seconds';end if;
 end if;
 elsif p_action='answer' then
 if r.state<>'playing' or t<r.starts_at or t>=r.ends_at or p_choice is null or p_choice not between 0 and 3 then raise exception 'Answer window closed';end if;
 if uid=r.host then if r.host_answer is not null then raise exception 'Answer locked';end if;r.host_answer:=p_choice;
 else if r.guest_answer is not null then raise exception 'Answer locked';end if;r.guest_answer:=p_choice;end if;
 end if;
 update public.gk_rounds set state=r.state,expires_at=r.expires_at,host_ready=r.host_ready,guest_ready=r.guest_ready,starts_at=r.starts_at,ends_at=r.ends_at,host_answer=r.host_answer,guest_answer=r.guest_answer where id=r.id;
 end if;
 if r.id is null then return jsonb_build_object('server_now',t);end if;
 select * into b from public.gk_bank where id=r.question_id;
 return jsonb_build_object('id',r.id,'host',r.host=uid,'state',case when r.state='cancelled' then 'cancelled' when r.ends_at is not null and t>=r.ends_at then 'result' when r.ends_at is null and t>=r.expires_at then 'expired' else r.state end,'server_now',t,'expires_at',r.expires_at,'starts_at',r.starts_at,'ends_at',r.ends_at,'question',case when t>=r.starts_at then b.question else null end,'options',case when t>=r.starts_at then b.options else null end,'mine',case when uid=r.host then r.host_answer else r.guest_answer end,'theirs',case when t>=r.ends_at then case when uid=r.host then r.guest_answer else r.host_answer end else null end,'correct',case when t>=r.ends_at then b.correct else null end,'source',case when t>=r.ends_at then b.source else null end,'category',b.category);
end$$;
revoke all on function public.gk_duel(text,uuid,integer)from public,anon;
grant execute on function public.gk_duel(text,uuid,integer)to authenticated;

insert into public.gk_bank(id,question,options,correct,source,category)values
(1,'Which planet is number 1 from the Sun?','["Mercury", "Mars", "Earth", "Venus"]'::jsonb,0,'https://science.nasa.gov/solar-system/planets/','Space'),
(2,'Which planet is number 2 from the Sun?','["Earth", "Venus", "Mars", "Jupiter"]'::jsonb,1,'https://science.nasa.gov/solar-system/planets/','Space'),
(3,'Which planet is number 3 from the Sun?','["Mars", "Jupiter", "Saturn", "Earth"]'::jsonb,3,'https://science.nasa.gov/solar-system/planets/','Space'),
(4,'Which planet is number 4 from the Sun?','["Mercury", "Mars", "Earth", "Venus"]'::jsonb,1,'https://science.nasa.gov/solar-system/planets/','Space'),
(5,'Which planet is number 5 from the Sun?','["Earth", "Venus", "Jupiter", "Mars"]'::jsonb,2,'https://science.nasa.gov/solar-system/planets/','Space'),
(6,'Which planet is number 6 from the Sun?','["Saturn", "Jupiter", "Mars", "Earth"]'::jsonb,0,'https://science.nasa.gov/solar-system/planets/','Space'),
(7,'Which planet is number 7 from the Sun?','["Earth", "Uranus", "Venus", "Mercury"]'::jsonb,1,'https://science.nasa.gov/solar-system/planets/','Space'),
(8,'Which planet is number 8 from the Sun?','["Mars", "Venus", "Neptune", "Earth"]'::jsonb,2,'https://science.nasa.gov/solar-system/planets/','Space'),
(9,'Which is the largest planet in our solar system?','["Earth", "Jupiter", "Saturn", "Neptune"]'::jsonb,1,'https://science.nasa.gov/solar-system/planets/','Space'),
(10,'Which is the smallest planet in our solar system?','["Mercury", "Venus", "Earth", "Mars"]'::jsonb,0,'https://science.nasa.gov/solar-system/planets/','Space'),
(11,'How many planets are in our solar system?','["8", "7", "9", "10"]'::jsonb,0,'https://science.nasa.gov/solar-system/planets/','Space'),
(12,'In which year was Pluto reclassified as a dwarf planet?','["1969", "1996", "2016", "2006"]'::jsonb,3,'https://science.nasa.gov/solar-system/planets/','Space'),
(13,'Which dwarf planet is in the asteroid belt between Mars and Jupiter?','["Makemake", "Ceres", "Eris", "Pluto"]'::jsonb,1,'https://science.nasa.gov/solar-system/planets/','Space'),
(14,'Which pair are gas giants?','["Earth and Mars", "Venus and Mercury", "Jupiter and Saturn", "Uranus and Neptune"]'::jsonb,2,'https://science.nasa.gov/solar-system/planets/','Space'),
(15,'Which pair are ice giants?','["Jupiter and Saturn", "Mercury and Mars", "Uranus and Neptune", "Earth and Venus"]'::jsonb,2,'https://science.nasa.gov/solar-system/planets/','Space'),
(16,'What is a planet beyond our solar system called?','["Meteor", "Comet", "Exoplanet", "Asteroid"]'::jsonb,2,'https://science.nasa.gov/solar-system/planets/','Space'),
(17,'Which planet is the second largest in our solar system?','["Neptune", "Saturn", "Earth", "Uranus"]'::jsonb,1,'https://science.nasa.gov/solar-system/planets/','Space'),
(18,'Which planet is third largest in our solar system?','["Earth", "Neptune", "Uranus", "Saturn"]'::jsonb,2,'https://science.nasa.gov/solar-system/planets/','Space'),
(19,'What is the SI base unit of time?','["kilogram", "ampere", "second", "metre"]'::jsonb,2,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(20,'Which symbol represents the SI base unit second?','["kg", "m", "A", "s"]'::jsonb,3,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(21,'What is the SI base unit of length?','["metre", "ampere", "kilogram", "second"]'::jsonb,0,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(22,'Which symbol represents the SI base unit metre?','["kg", "A", "s", "m"]'::jsonb,3,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(23,'What is the SI base unit of mass?','["second", "kilogram", "ampere", "metre"]'::jsonb,1,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(24,'Which symbol represents the SI base unit kilogram?','["m", "A", "kg", "s"]'::jsonb,2,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(25,'What is the SI base unit of electric current?','["kilogram", "second", "metre", "ampere"]'::jsonb,3,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(26,'Which symbol represents the SI base unit ampere?','["s", "kg", "m", "A"]'::jsonb,3,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(27,'What is the SI base unit of thermodynamic temperature?','["kelvin", "metre", "kilogram", "second"]'::jsonb,0,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(28,'Which symbol represents the SI base unit kelvin?','["kg", "s", "K", "m"]'::jsonb,2,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(29,'What is the SI base unit of amount of substance?','["mole", "metre", "second", "kilogram"]'::jsonb,0,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(30,'Which symbol represents the SI base unit mole?','["kg", "mol", "s", "m"]'::jsonb,1,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(31,'What is the SI base unit of luminous intensity?','["metre", "second", "candela", "kilogram"]'::jsonb,2,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(32,'Which symbol represents the SI base unit candela?','["cd", "m", "s", "kg"]'::jsonb,0,'https://www.bipm.org/en/measurement-units/si-base-units','Science'),
(33,'How many official languages does the United Nations have?','["4", "6", "5", "8"]'::jsonb,1,'https://www.un.org/en/our-work/official-languages','World'),
(34,'Which is an official language of the United Nations?','["Arabic", "Bengali", "German", "Hindi"]'::jsonb,0,'https://www.un.org/en/our-work/official-languages','World');
