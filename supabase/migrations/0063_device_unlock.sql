-- Optional device authenticator. Only the authenticated edge service sees keys/challenges.
create table public.device_unlock_credentials(user_id uuid not null references auth.users(id)on delete cascade,id text not null,public_key text not null,counter bigint not null default 0,transports jsonb not null default '[]',created_at timestamptz not null default now(),primary key(user_id,id));
create table public.device_unlock_challenges(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id)on delete cascade,kind text not null check(kind in('register','authenticate')),challenge text not null,credential_id text,expires_at timestamptz not null default now()+interval '5 minutes');
alter table public.device_unlock_credentials enable row level security;
alter table public.device_unlock_challenges enable row level security;
revoke all on public.device_unlock_credentials,public.device_unlock_challenges from public,anon,authenticated;
grant all on public.device_unlock_credentials,public.device_unlock_challenges to service_role;

-- A diary PIN change revokes every optional shortcut for that account.
create function public.revoke_device_unlock_on_pin_change()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.pin_hash is distinct from old.pin_hash then delete from public.device_unlock_credentials where user_id=new.user_id;delete from public.device_unlock_challenges where user_id=new.user_id;end if;return new;end$$;
revoke all on function public.revoke_device_unlock_on_pin_change()from public,anon,authenticated;
create trigger revoke_device_unlock_on_pin_change after update of pin_hash on public.diary_pins for each row execute function public.revoke_device_unlock_on_pin_change();
