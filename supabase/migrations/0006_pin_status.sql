-- Non-secret PIN status uses the same authenticated connection as the diary.
-- Never expose PIN hashes, and only allow the owner or their connected partner.
create or replace function public.diary_pin_status(p_person text)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare target_id uuid; until_time timestamptz; exists_pin boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into target_id from public.profiles where username=p_person;
  if target_id is null then raise exception 'Unknown diary'; end if;
  if target_id <> auth.uid() and not exists (
    select 1 from public.friendship
    where (user1_id=auth.uid() and user2_id=target_id)
       or (user2_id=auth.uid() and user1_id=target_id)
  ) then raise exception 'Not allowed'; end if;
  select locked_until into until_time from public.diary_pins where user_id=target_id;
  exists_pin := found;
  return jsonb_build_object('hasPin',exists_pin,'locked',coalesce(until_time > now(),false));
end;
$$;
revoke all on function public.diary_pin_status(text) from public,anon;
grant execute on function public.diary_pin_status(text) to authenticated;
