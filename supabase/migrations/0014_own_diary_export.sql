-- Fresh, read-only export. The caller cannot select another account.
create function public.export_my_diary() returns jsonb
language plpgsql stable security invoker set search_path=public as $$
declare owner_id uuid := auth.uid(); result jsonb;
begin
 if owner_id is null then raise insufficient_privilege using message='Sign in to export your diary'; end if;
 select jsonb_build_object(
  'app','Dear Diary','schema_version',1,
  'exported_at',statement_timestamp(),
  'export_date',to_char(statement_timestamp() at time zone 'Asia/Kolkata','YYYY-MM-DD'),
  'timezone','Asia/Kolkata',
  'account',jsonb_build_object('username',p.username),
  'scope','Own saved diary entries only. Photo metadata is included; image files are not embedded.',
  'entries',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('photos',
   coalesce((select jsonb_agg(to_jsonb(ph)-'entry_id' order by ph.sort_order,ph.id) from public.entry_photos ph where ph.entry_id=e.id),'[]'::jsonb)
  ) order by e.entry_date,e.id) from public.diary_entries e where e.user_id=owner_id),'[]'::jsonb)
 ) into result from public.profiles p where p.id=owner_id;
 if result is null then raise insufficient_privilege using message='Your diary profile is unavailable'; end if;
 return result;
end;
$$;
revoke all on function public.export_my_diary() from public,anon;
grant execute on function public.export_my_diary() to authenticated;
