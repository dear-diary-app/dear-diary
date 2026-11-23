-- Content-free counters only. No drafts, translations, names or chat identifiers.
create table public.translation_limits(user_id uuid primary key references auth.users(id)on delete cascade,day date not null,day_count int not null,window_start timestamptz not null,window_count int not null);
alter table public.translation_limits enable row level security;
revoke all on public.translation_limits from anon,authenticated;
create function public.claim_draft_translation(p_user uuid)returns boolean language plpgsql security definer set search_path=public as $$
declare r public.translation_limits;d date:=(now()at time zone 'UTC')::date;
begin
 if p_user is null or public.friend_id(p_user)is null then return false;end if;
 insert into public.translation_limits values(p_user,d,0,now(),0)on conflict do nothing;
 select * into r from public.translation_limits where user_id=p_user for update;
 if r.day<>d then r.day:=d;r.day_count:=0;end if;
 if r.window_start<=now()-interval '1 minute' then r.window_start:=now();r.window_count:=0;end if;
 if r.day_count>=30 or r.window_count>=5 then return false;end if;
 update public.translation_limits set day=r.day,day_count=r.day_count+1,window_start=r.window_start,window_count=r.window_count+1 where user_id=p_user;
 return true;
end$$;
revoke all on function public.claim_draft_translation(uuid)from public,anon,authenticated;
grant execute on function public.claim_draft_translation(uuid)to service_role;
