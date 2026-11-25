-- The scheduled Edge Function needs explicit REST privileges. RLS bypass does not grant table access.
grant select on public.song_taste to service_role;
grant select,insert,update on public.diary_auto_song_runs to service_role;
