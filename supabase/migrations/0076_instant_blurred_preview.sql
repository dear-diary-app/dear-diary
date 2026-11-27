-- New sends may include a small pre-blurred JPEG preview. Not the full photo.
-- Same service-only access and lifetime as the unopened delivery.
alter table public.instants add column preview_jpeg text check(preview_jpeg is null or length(preview_jpeg)<=60000);
create or replace function public.claim_instant(p_id uuid,p_user uuid)returns setof public.instants language sql security definer set search_path=public as $$with claimed as(update public.instants set opened_at=clock_timestamp(),preview_jpeg=null where id=p_id and recipient_id=p_user and opened_at is null and expires_at>clock_timestamp()and public.friend_id(sender_id)=p_user returning *),queued as(insert into public.instant_cleanup(path)select path from claimed on conflict do nothing)select * from claimed;$$;
