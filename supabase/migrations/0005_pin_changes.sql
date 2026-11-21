create or replace function public.pin_attempt(p_user uuid, p_pin text, p_new_pin text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r public.diary_pins%rowtype; n integer; until_time timestamptz;
begin
  select * into r from public.diary_pins where user_id=p_user for update;
  if not found then return jsonb_build_object('error','no_pin'); end if;
  if r.locked_until > now() then
    return jsonb_build_object('error','locked','locked_until',r.locked_until);
  end if;
  if p_new_pin is not null and p_new_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('error','pin_format');
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' or not public.check_pin(p_user,p_pin) then
    n := coalesce(r.failed_attempts,0)+1;
    if n >= 5 then until_time := now()+interval '15 minutes'; end if;
    update public.diary_pins set failed_attempts=case when until_time is null then n else 0 end,
      locked_until=until_time where user_id=p_user;
    if until_time is not null then return jsonb_build_object('error','locked','locked_until',until_time); end if;
    return jsonb_build_object('ok',false,'error','wrong','attempts_left',5-n);
  end if;
  if p_new_pin is not null then
    update public.diary_pins set pin_hash=public.hash_pin(p_new_pin), failed_attempts=0,locked_until=null where user_id=p_user;
  else
    update public.diary_pins set failed_attempts=0,locked_until=null where user_id=p_user;
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.pin_attempt(uuid,text,text) from public, anon, authenticated;
grant execute on function public.pin_attempt(uuid,text,text) to service_role;
