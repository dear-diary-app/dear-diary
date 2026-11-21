-- 0003: server-side daily schedule enforcement (Prompt 3).
-- All write rules are enforced in the database, so no client or stale tab can bypass them.

-- IST helpers (Asia/Kolkata is the official timezone).
create or replace function public.ist_today() returns date language sql stable
set search_path = public as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

create or replace function public.ist_time() returns time language sql stable
set search_path = public as $$ select (now() at time zone 'Asia/Kolkata')::time $$;

-- Writing window: 6:00 AM - 10:00 PM IST.
create or replace function public.writing_open() returns boolean language sql stable
set search_path = public as $$
  select (now() at time zone 'Asia/Kolkata')::time >= time '06:00'
     and (now() at time zone 'Asia/Kolkata')::time <  time '22:00';
$$;

-- Publish drafts whose 10 PM IST deadline has passed. Runs via pg_cron and may
-- also be invoked manually; only callable by service role.
create or replace function public.publish_due_entries() returns integer language plpgsql security definer
set search_path = public as $$
declare n int;
begin
  update public.diary_entries
     set status = 'published', updated_at = now()
   where status = 'draft'
     and (entry_date < public.ist_today()
          or (entry_date = public.ist_today() and public.ist_time() >= time '22:00'));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.publish_due_entries() from public, anon, authenticated;
grant execute on function public.publish_due_entries() to service_role;

-- Entry write rules.
create or replace function public.enforce_entry_rules() returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if new.user_id is distinct from auth.uid() then raise exception 'entries belong to their author'; end if;
    if new.status <> 'draft' then raise exception 'new entries start as drafts'; end if;
    if new.entry_date <> public.ist_today() then raise exception 'entries can only be written for today'; end if;
    if not public.writing_open() then raise exception 'writing is closed (6 AM - 10 PM IST)'; end if;
    return new;
  elsif TG_OP = 'UPDATE' then
    -- Scheduler publish: draft -> published only when no user JWT is present.
    if new.status = 'published' and old.status = 'draft' then
      if auth.uid() is not null then raise exception 'entries publish automatically at 10 PM IST'; end if;
      return new;
    end if;
    if new.status is distinct from old.status then raise exception 'entry status cannot change'; end if;
    if old.status <> 'draft' then raise exception 'this entry is locked'; end if;
    if new.entry_date is distinct from old.entry_date or new.user_id is distinct from old.user_id then
      raise exception 'entries cannot be moved';
    end if;
    if new.entry_date <> public.ist_today() or not public.writing_open() then
      raise exception 'editing is closed (6 AM - 10 PM IST)';
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    if old.status <> 'draft' then raise exception 'this entry is locked'; end if;
    if not public.writing_open() then raise exception 'writing is closed (6 AM - 10 PM IST)'; end if;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists diary_entries_rules on public.diary_entries;
create trigger diary_entries_rules before insert or update or delete on public.diary_entries
  for each row execute function public.enforce_entry_rules();

-- Photo write rules mirror the parent entry: allowed only while the entry is a
-- draft for today inside the writing window.
create or replace function public.enforce_photo_rules() returns trigger language plpgsql security definer
set search_path = public as $$
declare e public.diary_entries;
begin
  if TG_OP = 'DELETE' then
    select * into e from public.diary_entries where id = old.entry_id;
  else
    select * into e from public.diary_entries where id = new.entry_id;
  end if;
  if e.id is null then raise exception 'entry not found'; end if;
  if e.status <> 'draft' then raise exception 'this entry is locked'; end if;
  if e.entry_date <> public.ist_today() or not public.writing_open() then
    raise exception 'photos can only change during writing hours (6 AM - 10 PM IST)';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists entry_photos_rules on public.entry_photos;
create trigger entry_photos_rules before insert or update or delete on public.entry_photos
  for each row execute function public.enforce_photo_rules();

-- Nightly publish at 10:00 PM IST (16:30 UTC).
create extension if not exists pg_cron with schema extensions;
select cron.schedule('publish-due-entries', '30 16 * * *', $$select public.publish_due_entries()$$)
where not exists (select 1 from cron.job where jobname = 'publish-due-entries');
