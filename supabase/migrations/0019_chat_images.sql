-- Photos in chat: up to 3 per message, stored privately. Only the two chat users can read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- You can add files only to your own folder; you can read your folder and your friend's; you can delete your own.
create policy chat_img_select on storage.objects for select to authenticated
  using (bucket_id = 'chat-images' and ((storage.foldername(name))[1] = auth.uid()::text or (storage.foldername(name))[1] = public.friend_id(auth.uid())::text));
create policy chat_img_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy chat_img_delete on storage.objects for delete to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.chat_messages add column images text[] not null default '{}';
alter table public.chat_messages add constraint chat_images_max check (cardinality(images) <= 3);
alter table public.chat_messages drop constraint chat_has_content;
alter table public.chat_messages add constraint chat_has_content check (char_length(btrim(body)) > 0 or sticker is not null or cardinality(images) > 0);

create or replace function public.chat_set_recipient() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.sender_id := auth.uid();
  new.recipient_id := public.friend_id(auth.uid());
  if new.recipient_id is null then raise insufficient_privilege using message = 'No chat partner'; end if;
  new.reactions := '{}'::jsonb;
  new.created_at := now();
  new.seen_at := null;
  new.edited_at := null;
  new.images := coalesce(new.images, '{}');
  if new.sticker is not null then new.images := '{}'; end if;
  -- Every photo path must sit in the sender's own folder.
  if exists (select 1 from unnest(new.images) p where p !~ ('^' || new.sender_id::text || '/[A-Za-z0-9._-]{1,80}\.(jpg|png|webp)$')) then
    raise exception 'Bad photo';
  end if;
  if new.reply_to is not null and not exists (
    select 1 from public.chat_messages m where m.id = new.reply_to
      and ((m.sender_id = new.sender_id and m.recipient_id = new.recipient_id) or (m.sender_id = new.recipient_id and m.recipient_id = new.sender_id))
  ) then new.reply_to := null; end if;
  return new;
end $$;
