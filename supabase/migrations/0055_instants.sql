insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('instants','instants',false,5242880,array['image/jpeg']);
create table public.instants(id uuid primary key,sender_id uuid not null references public.profiles(id)on delete cascade,recipient_id uuid not null references public.profiles(id)on delete cascade,path text not null unique,created_at timestamptz not null default now(),opened_at timestamptz,check(sender_id<>recipient_id));
create index instants_recipient on public.instants(recipient_id,created_at desc);
alter table public.instants enable row level security;
create policy instant_pair_read on public.instants for select to authenticated using(auth.uid()in(sender_id,recipient_id)and public.friend_id(sender_id)=recipient_id);
grant select on public.instants to authenticated;grant all on public.instants to service_role;
create table public.instant_cleanup(path text primary key);alter table public.instant_cleanup enable row level security;revoke all on public.instant_cleanup from public,anon,authenticated;grant all on public.instant_cleanup to service_role;
create function public.claim_instant(p_id uuid,p_user uuid)returns setof public.instants language sql security definer set search_path=public as $$with claimed as(update public.instants set opened_at=clock_timestamp()where id=p_id and recipient_id=p_user and opened_at is null and public.friend_id(sender_id)=p_user returning *),queued as(insert into public.instant_cleanup(path)select path from claimed on conflict do nothing)select * from claimed;$$;
revoke all on function public.claim_instant(uuid,uuid)from public,anon,authenticated;grant execute on function public.claim_instant(uuid,uuid)to service_role;
create function public.instant_removed()returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.instant_cleanup(path)values(old.path)on conflict do nothing;return old;end$$;
create trigger instant_removed after delete on public.instants for each row execute function public.instant_removed();revoke all on function public.instant_removed()from public,anon,authenticated;
create function public.instant_cleanup_tick()returns void language plpgsql security definer set search_path=public as $$declare secret text;begin
insert into public.instant_cleanup(path)select o.name from storage.objects o where o.bucket_id='instants'and o.created_at<now()-interval '1 hour'and not exists(select from public.instants i where i.path=o.name and i.opened_at is null)on conflict do nothing;
select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron'limit 1;
if secret is not null then perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/instant-media',headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:='{}'::jsonb,timeout_milliseconds:=10000);end if;end$$;
revoke all on function public.instant_cleanup_tick()from public,anon,authenticated;
select cron.schedule('instant-cleanup','* * * * *','select public.instant_cleanup_tick()');
