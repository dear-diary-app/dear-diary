-- Each sheet may carry sixteen stickers. Missing page means the first sheet,
-- keeping previously saved sticker entries readable without rewriting them.
alter table public.diary_entries drop constraint if exists diary_stickers_array;
alter table public.diary_entries add constraint diary_stickers_array check (jsonb_typeof(stickers) = 'array' and jsonb_array_length(stickers) <= 1600 and octet_length(stickers::text) <= 256000);
