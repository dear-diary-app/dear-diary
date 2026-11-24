-- Optional plain-text bubble effects. Existing partner RLS and insert grants apply.
alter table public.chat_messages add column effect text;
alter table public.chat_messages add constraint chat_effect_valid check (
 effect is null or (effect in ('invisible','slam','loud','gentle') and char_length(btrim(body))>0 and sticker is null and gif_id is null and audio is null and song is null and weather is null and cardinality(images)=0)
);
