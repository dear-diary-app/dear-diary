-- Sender-only archive for opted-in NEW sends. Recipient claims stay view-once.
create table public.instant_archive(id uuid primary key,sender_id uuid not null references public.profiles(id) on delete cascade,path text unique not null,caption text not null default '',created_at timestamptz not null default clock_timestamp(),byte_size bigint not null check(byte_size>0 and byte_size<=716800),reaction text);
alter table public.instant_archive enable row level security;
revoke all on public.instant_archive from public,anon,authenticated;
grant all on public.instant_archive to service_role;
create index instant_archive_sender on public.instant_archive(sender_id,created_at desc);
create trigger instant_archive_removed after delete on public.instant_archive for each row execute function public.instant_removed();
create function public.add_instant_archive(p_id uuid,p_sender uuid,p_path text,p_caption text,p_bytes bigint)returns void language plpgsql security definer set search_path=public as $$declare r record;total bigint:=0;n int:=0;begin
 perform pg_advisory_xact_lock(hashtextextended(p_sender::text,17));
 insert into public.instant_archive(id,sender_id,path,caption,byte_size)values(p_id,p_sender,p_path,p_caption,p_bytes)on conflict(id)do nothing;
 for r in select id,byte_size from public.instant_archive where sender_id=p_sender order by created_at desc,id desc loop
 n:=n+1;total:=total+r.byte_size;
 if n>30 or total>26214400 then delete from public.instant_archive where id=r.id;end if;
 end loop;
end$$;
revoke all on function public.add_instant_archive(uuid,uuid,text,text,bigint)from public,anon,authenticated;grant execute on function public.add_instant_archive(uuid,uuid,text,text,bigint)to service_role;
create function public.list_instant_archive()returns table(id uuid,created_at timestamptz,byte_size bigint,reaction text)language sql stable security definer set search_path=public as $$select id,created_at,byte_size,reaction from public.instant_archive where sender_id=auth.uid()order by created_at desc,id desc limit 30$$;
revoke all on function public.list_instant_archive()from public,anon;grant execute on function public.list_instant_archive()to authenticated;
create or replace function public.instant_cleanup_tick()returns void language plpgsql security definer set search_path=public as $$declare secret text;begin
 delete from public.instants where expires_at<=now();
 insert into public.instant_cleanup(path)select o.name from storage.objects o where o.bucket_id='instants'and o.created_at<now()-interval '1 hour'and not exists(select from public.instants i where i.path=o.name and i.opened_at is null and i.expires_at>now())and not exists(select from public.instant_archive a where a.path=o.name)on conflict do nothing;
 select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron'limit 1;
 if secret is not null then perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/instant-media',headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:='{}'::jsonb,timeout_milliseconds:=10000);end if;end$$;
create or replace function public.respond_to_instant(p_id uuid,p_text text,p_message uuid)returns uuid language plpgsql security definer set search_path=public as $$declare item public.instants;msg text;begin
 select * into item from public.instants where id=p_id for update;
 if auth.uid() is null or item.recipient_id is distinct from auth.uid()or item.opened_at is null or item.expires_at<=now()or public.friend_id(item.sender_id)is distinct from auth.uid()or p_text is null or char_length(btrim(p_text))not between 1 and 500 then raise insufficient_privilege;end if;
 if exists(select from public.chat_messages where id=p_message and sender_id=auth.uid()and recipient_id=item.sender_id)then return p_message;end if;
 if item.responded then raise exception 'Response already sent';end if;
 msg:='Reply to your instant: '||btrim(p_text);
 insert into public.chat_messages(id,sender_id,recipient_id,body)values(p_message,auth.uid(),item.sender_id,msg);
 update public.instants set responded=true where id=p_id;
 if btrim(p_text)in('❤️','😍','😂','😮','🥹','🔥')then update public.instant_archive set reaction=btrim(p_text)where id=p_id and sender_id=item.sender_id;end if;
 return p_message;end$$;
