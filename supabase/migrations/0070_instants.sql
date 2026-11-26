-- Private camera-only Instants. Media never has client storage access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('instants','instants',false,5242880,array['image/jpeg']) on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg'];
create table public.instants(id uuid primary key,sender_id uuid not null references public.profiles(id)on delete cascade,recipient_id uuid not null references public.profiles(id)on delete cascade,path text not null unique,caption text not null default '' check(char_length(caption)<=200),created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '24 hours'),opened_at timestamptz,responded boolean not null default false,check(sender_id<>recipient_id));
create index instants_pair on public.instants(recipient_id,created_at desc);
alter table public.instants enable row level security;
revoke all on public.instants from public,anon,authenticated;grant all on public.instants to service_role;
create table public.instant_cleanup(path text primary key);alter table public.instant_cleanup enable row level security;revoke all on public.instant_cleanup from public,anon,authenticated;grant all on public.instant_cleanup to service_role;
create function public.list_instants()returns table(id uuid,sender_id uuid,recipient_id uuid,created_at timestamptz,opened_at timestamptz)language sql stable security definer set search_path=public as $$select i.id,i.sender_id,i.recipient_id,i.created_at,i.opened_at from public.instants i where auth.uid()in(i.sender_id,i.recipient_id)and public.friend_id(i.sender_id)=i.recipient_id and i.expires_at>now() order by i.created_at desc limit 80$$;
revoke all on function public.list_instants()from public,anon;grant execute on function public.list_instants()to authenticated;
create function public.claim_instant(p_id uuid,p_user uuid)returns setof public.instants language sql security definer set search_path=public as $$with claimed as(update public.instants set opened_at=clock_timestamp()where id=p_id and recipient_id=p_user and opened_at is null and expires_at>clock_timestamp()and public.friend_id(sender_id)=p_user returning *),queued as(insert into public.instant_cleanup(path)select path from claimed on conflict do nothing)select * from claimed;$$;
revoke all on function public.claim_instant(uuid,uuid)from public,anon,authenticated;grant execute on function public.claim_instant(uuid,uuid)to service_role;
create function public.instant_removed()returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.instant_cleanup(path)values(old.path)on conflict do nothing;return old;end$$;
create trigger instant_removed after delete on public.instants for each row execute function public.instant_removed();revoke all on function public.instant_removed()from public,anon,authenticated;
create function public.instant_cleanup_tick()returns void language plpgsql security definer set search_path=public as $$declare secret text;begin
 delete from public.instants where expires_at<=now();
 insert into public.instant_cleanup(path)select o.name from storage.objects o where o.bucket_id='instants'and o.created_at<now()-interval '1 hour'and not exists(select from public.instants i where i.path=o.name and i.opened_at is null and i.expires_at>now())on conflict do nothing;
 select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron'limit 1;
 if secret is not null then perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/instant-media',headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:='{}'::jsonb,timeout_milliseconds:=10000);end if;end$$;
revoke all on function public.instant_cleanup_tick()from public,anon,authenticated;
select cron.schedule('instant-cleanup','* * * * *','select public.instant_cleanup_tick()');
create function public.respond_to_instant(p_id uuid,p_text text,p_message uuid)returns uuid language plpgsql security definer set search_path=public as $$declare item public.instants;msg text;begin
 select * into item from public.instants where id=p_id for update;
 if auth.uid() is null or item.recipient_id is distinct from auth.uid()or item.opened_at is null or item.expires_at<=now()or public.friend_id(item.sender_id)is distinct from auth.uid()or p_text is null or char_length(btrim(p_text))not between 1 and 500 then raise insufficient_privilege;end if;
 if exists(select from public.chat_messages where id=p_message and sender_id=auth.uid()and recipient_id=item.sender_id)then return p_message;end if;
 if item.responded then raise exception 'Response already sent';end if;
 msg:='Reply to your instant: '||btrim(p_text);
 insert into public.chat_messages(id,sender_id,recipient_id,body)values(p_message,auth.uid(),item.sender_id,msg);
 update public.instants set responded=true where id=p_id;
 return p_message;end$$;
revoke all on function public.respond_to_instant(uuid,text,uuid)from public,anon;grant execute on function public.respond_to_instant(uuid,text,uuid)to authenticated;
