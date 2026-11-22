-- One optional song per entry: title, artist and a 30-second Apple preview link.
-- Same RLS, nightly publication and edit lock as the rest of the entry.
alter table public.diary_entries add column if not exists song jsonb;
alter table public.diary_entries drop constraint if exists diary_song_object;
alter table public.diary_entries add constraint diary_song_object check (song is null or (jsonb_typeof(song) = 'object' and octet_length(song::text) <= 2000));
