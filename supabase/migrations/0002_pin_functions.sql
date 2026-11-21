-- PIN hash helpers used by the verify-pin Edge Function (service role only).

-- Constant-time-ish hash check via pgcrypto crypt; callable only by service role.
create or replace function public.check_pin(p_user uuid, p_pin text)
returns boolean language sql stable security definer
set search_path = public, extensions as $$
  select pin_hash = crypt(p_pin, pin_hash)
  from public.diary_pins
  where user_id = p_user;
$$;

create or replace function public.hash_pin(p_pin text)
returns text language sql volatile
set search_path = public, extensions as $$
  select crypt(p_pin, gen_salt('bf'));
$$;

revoke all on function public.check_pin(uuid, text) from public, anon, authenticated;
revoke all on function public.hash_pin(text) from public, anon, authenticated;
grant execute on function public.check_pin(uuid, text) to service_role;
grant execute on function public.hash_pin(text) to service_role;
