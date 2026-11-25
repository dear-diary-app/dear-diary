-- Keep legacy comma-separated names readable by the auto-song service.
alter table public.song_taste drop constraint song_taste_artists_check;
alter table public.song_taste add constraint song_taste_artists_check check(char_length(artists)<=2200);
alter table public.song_taste drop constraint song_taste_genres_check;
alter table public.song_taste add constraint song_taste_genres_check check(char_length(genres)<=1000);
alter table public.song_taste drop constraint song_taste_languages_check;
alter table public.song_taste add constraint song_taste_languages_check check(char_length(languages)<=1000);
alter table public.song_taste drop constraint song_taste_moods_check;
alter table public.song_taste add constraint song_taste_moods_check check(char_length(moods)<=1000);
create function public.valid_taste_artists(items jsonb)returns boolean language plpgsql immutable set search_path=public as $$
declare item jsonb;begin
 if items is null or jsonb_typeof(items)<>'array' then return false;end if;
 if jsonb_array_length(items)>20 then return false;end if;
 for item in select value from jsonb_array_elements(items)loop
 if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'name')is distinct from 'string' or char_length(btrim(item->>'name'))not between 1 and 100 or jsonb_typeof(item->'image')is distinct from 'string' or char_length(item->>'image')>500 or ((item->>'image')<>'' and (item->>'image')!~'^https://cdn-images\.dzcdn\.net/images/artist/')or jsonb_typeof(item->'id')is distinct from 'number' or (item->>'id')!~'^[0-9]{1,16}$' then return false;end if;
 end loop;return true;end$$;
alter table public.song_taste add column artist_selections jsonb not null default '[]' check(public.valid_taste_artists(artist_selections));
