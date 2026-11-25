-- Private release metadata, only served to authenticated app sessions by the Edge Function.
create table if not exists public.android_releases (
 version_code integer primary key check(version_code>0), version_name text not null,
 notes text not null check(length(notes)<12000), object_path text not null unique,
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'), bytes bigint not null check(bytes>0 and bytes<30000000),
 published_at timestamptz not null default now(), active boolean not null default true
);
alter table public.android_releases enable row level security;
revoke all on public.android_releases from anon,authenticated;
grant select on public.android_releases to service_role;
