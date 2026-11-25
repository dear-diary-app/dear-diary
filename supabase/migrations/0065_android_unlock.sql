create table public.android_unlock_keys(user_id uuid not null references auth.users(id) on delete cascade,id text not null,public_key text not null,primary key(user_id,id));
create table public.android_unlock_challenges(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,key_id text not null,challenge text not null,expires_at timestamptz not null default now()+interval '2 minutes');
alter table public.android_unlock_keys enable row level security;
alter table public.android_unlock_challenges enable row level security;
revoke all on public.android_unlock_keys,public.android_unlock_challenges from public,anon,authenticated;
grant all on public.android_unlock_keys,public.android_unlock_challenges to service_role;
create function public.revoke_android_unlock_on_pin_change()returns trigger language plpgsql security definer set search_path=public as $$begin if new.pin_hash is distinct from old.pin_hash then delete from android_unlock_keys where user_id=new.user_id;delete from android_unlock_challenges where user_id=new.user_id;end if;return new;end$$;
revoke all on function public.revoke_android_unlock_on_pin_change()from public,anon,authenticated;
create trigger revoke_android_unlock_on_pin_change after update of pin_hash on public.diary_pins for each row execute function public.revoke_android_unlock_on_pin_change();
