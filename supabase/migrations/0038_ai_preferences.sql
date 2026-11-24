-- Per-account controls. No prompts or answers are stored.
create table public.ai_preferences(user_id uuid primary key default auth.uid() references auth.users(id)on delete cascade,translate_enabled boolean not null default true,ddai_enabled boolean not null default false);
alter table public.ai_preferences enable row level security;
create policy ai_preferences_own on public.ai_preferences for all to authenticated using(user_id=auth.uid())with check(user_id=auth.uid());
grant select,insert,update on public.ai_preferences to authenticated;
