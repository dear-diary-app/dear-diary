-- Optional profile details are separate from locked diary entries.
create table public.profile_details (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 bio text not null default '' check(char_length(bio)<=160),
 mood text not null default '' check(mood in ('','😊','💛','🌧️','🌙','📚','☕','🎵','🌿')),
 updated_at timestamptz not null default now()
);
alter table public.profile_details enable row level security;
create policy profile_details_read on public.profile_details for select to authenticated using(user_id=auth.uid() or user_id=public.friend_id(auth.uid()));
create policy profile_details_insert on public.profile_details for insert to authenticated with check(user_id=auth.uid());
create policy profile_details_update on public.profile_details for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create trigger profile_details_touch before update on public.profile_details for each row execute function public.touch_updated_at();
grant select,insert,update on public.profile_details to authenticated;
