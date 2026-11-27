-- Narrow send-only device capability. Never a diary/session token.
create table public.reel_share_devices(token_hash text primary key check(token_hash~'^[a-f0-9]{64}$'),user_id uuid not null references public.profiles(id)on delete cascade,recipient_id uuid not null references public.profiles(id)on delete cascade,expires_at timestamptz not null default now()+interval '90 days');
alter table public.reel_share_devices enable row level security;
revoke all on public.reel_share_devices from anon,authenticated;
create table public.reel_share_sends(request_id uuid primary key,token_hash text not null references public.reel_share_devices(token_hash)on delete cascade,url text not null,created_at timestamptz not null default now());
alter table public.reel_share_sends enable row level security;
revoke all on public.reel_share_sends from anon,authenticated;
create or replace function public.reel_share_enable(p_token text)returns jsonb language plpgsql security definer set search_path=public as $$declare who uuid:=auth.uid();target uuid;digest text;begin
 if who is null or p_token is null or p_token!~'^[a-f0-9]{64}$' then raise insufficient_privilege;end if;
 target:=public.friend_id(who);if target is null then raise insufficient_privilege;end if;
 digest:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 delete from public.reel_share_devices where user_id=who and expires_at<now();
 if(select count(*)from public.reel_share_devices where user_id=who)>=10 then raise exception 'Too many quick-share devices. Disable old devices first.';end if;
 insert into public.reel_share_devices(token_hash,user_id,recipient_id)values(digest,who,target);
 return jsonb_build_object('ok',true,'recipient',target,'expires',now()+interval '90 days');end$$;
create or replace function public.reel_share_disable()returns void language sql security definer set search_path=public as $$delete from public.reel_share_devices where user_id=auth.uid();$$;
revoke all on function public.reel_share_enable(text),public.reel_share_disable()from public,anon;
grant execute on function public.reel_share_enable(text),public.reel_share_disable()to authenticated;
create or replace function public.reel_share_send(p_token text,p_url text,p_request uuid)returns boolean language plpgsql security definer set search_path=public as $$declare device public.reel_share_devices;previous public.reel_share_sends;begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' or p_request is null or p_url is null or p_url!~'^https://www[.]instagram[.]com/reel/[A-Za-z0-9_-]{1,100}/$' then raise insufficient_privilege;end if;
 select * into device from public.reel_share_devices where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')for update;
 if not found or device.expires_at<=now()or public.friend_id(device.user_id)is distinct from device.recipient_id then raise insufficient_privilege;end if;
 select * into previous from public.reel_share_sends where request_id=p_request;
 if found then return previous.token_hash=device.token_hash and previous.url=p_url;end if;
 if(select count(*)from public.reel_share_sends where token_hash=device.token_hash and created_at>now()-interval '1 minute')>=10 or(select count(*)from public.reel_share_sends where token_hash=device.token_hash and created_at>now()-interval '1 day')>=100 then raise exception 'Quick-share limit reached';end if;
 -- Existing chat recipient/content/push triggers run under this fixed owner identity.
 perform set_config('request.jwt.claim.sub',device.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',device.user_id,'role','authenticated')::text,true);
 insert into public.chat_messages(id,body)values(p_request,p_url);
 insert into public.reel_share_sends(request_id,token_hash,url)values(p_request,device.token_hash,p_url);
 return true;end$$;
revoke all on function public.reel_share_send(text,text,uuid)from public,anon,authenticated;
grant execute on function public.reel_share_send(text,text,uuid)to service_role;
