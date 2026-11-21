-- Counts saved writing days without exposing draft content or dates.
-- This pure helper is private; accepting an explicit day makes boundary tests deterministic.
create or replace function public.diary_streak_count(days date[], as_of date)
returns integer language sql immutable set search_path = public as $$
  with ordered as (
    select day, row_number() over (order by day desc)::integer as n,
           max(day) over () as latest
    from (select distinct unnest(days) as day) d where day <= as_of
  )
  select count(*)::integer from ordered
  where latest >= as_of - 1 and day = latest - (n - 1);
$$;
revoke all on function public.diary_streak_count(date[], date) from public, anon, authenticated;

create or replace function public.diary_streaks()
returns table(username text, current_streak integer, wrote_today boolean)
language sql stable security definer set search_path = public as $$
  select p.username,
         public.diary_streak_count(array_agg(e.entry_date), public.ist_today()),
         coalesce(bool_or(e.entry_date = public.ist_today()), false)
  from public.profiles p
  left join public.diary_entries e on e.user_id = p.id
    and e.entry_date <= public.ist_today()
    and e.content ~ '[^[:space:]]'
  where auth.uid() is not null
    and (p.id = auth.uid() or p.id = public.friend_id(auth.uid()))
  group by p.id, p.username;
$$;
revoke all on function public.diary_streaks() from public, anon;
grant execute on function public.diary_streaks() to authenticated;
