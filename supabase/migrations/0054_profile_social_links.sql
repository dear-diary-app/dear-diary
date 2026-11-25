create function public.valid_profile_links(v jsonb)returns boolean language plpgsql immutable as $$declare x jsonb;begin
if jsonb_typeof(v)<>'array' or jsonb_array_length(v)>3 then return false;end if;
for x in select * from jsonb_array_elements(v)loop
 if jsonb_typeof(x)<>'object' or jsonb_typeof(x->'label')is distinct from 'string' or jsonb_typeof(x->'url')is distinct from 'string' or char_length(btrim(x->>'label'))not between 1 and 40 or char_length(x->>'url')not between 1 and 500 or (x->>'url')!~'^https?://[^[:space:]/@]+([/:?#][^[:space:]]*)?$' or (x->>'url')~'^https?://[^/]*@' then return false;end if;
end loop;return true;end$$;
create table public.profile_social_links(user_id uuid primary key references public.profiles(id)on delete cascade,links jsonb not null default '[]'::jsonb check(public.valid_profile_links(links)));
alter table public.profile_social_links enable row level security;
create policy profile_links_read on public.profile_social_links for select to authenticated using(user_id=auth.uid()or user_id=public.friend_id(auth.uid()));
create policy profile_links_insert on public.profile_social_links for insert to authenticated with check(user_id=auth.uid());
create policy profile_links_update on public.profile_social_links for update to authenticated using(user_id=auth.uid())with check(user_id=auth.uid());
grant select,insert,update on public.profile_social_links to authenticated;
