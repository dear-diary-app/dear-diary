-- Push a "new message" notice to the recipient. Never blocks or fails a chat insert.
create or replace function public.chat_push_notify() returns trigger language plpgsql security definer set search_path=public as $$
declare secret text;
begin
 begin
  select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron' limit 1;
  if secret is not null then
   perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/send-chat-push',
    headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),
    body:=jsonb_build_object('id',new.id),timeout_milliseconds:=10000);
  end if;
 exception when others then null;
 end;
 return new;
end;
$$;
revoke all on function public.chat_push_notify() from public,anon,authenticated;
drop trigger if exists chat_push_after_insert on public.chat_messages;
create trigger chat_push_after_insert after insert on public.chat_messages for each row execute function public.chat_push_notify();
grant select on public.chat_messages to service_role;
