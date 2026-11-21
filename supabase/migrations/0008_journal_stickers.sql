-- Stickers stay on their parent entry: same RLS, same nightly publication and edit lock.
alter table public.diary_entries add column if not exists stickers jsonb not null default '[]'::jsonb;
alter table public.diary_entries add constraint diary_stickers_array check (jsonb_typeof(stickers) = 'array' and jsonb_array_length(stickers) <= 16 and octet_length(stickers::text) <= 12000);
