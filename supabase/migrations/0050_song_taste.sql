create table public.song_taste (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 genres text not null default '' check(char_length(genres)<=160),
 languages text not null default '' check(char_length(languages)<=100),
 moods text not null default '' check(char_length(moods)<=160),
 artists text not null default '' check(char_length(artists)<=300),
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.song_taste enable row level security;
create policy song_taste_own on public.song_taste for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.song_taste to authenticated;
create table public.diary_auto_song_runs (
 user_id uuid references public.profiles(id) on delete cascade,
 day date not null, result text not null check(result in('added','no_match','already_set','no_page','retry')),
 updated_at timestamptz not null default now(), primary key(user_id,day)
);
alter table public.diary_auto_song_runs enable row level security;
create policy auto_song_result_own on public.diary_auto_song_runs for select to authenticated using(user_id=auth.uid());
grant select on public.diary_auto_song_runs to authenticated;
-- Only the scheduled service can apply a choice, rechecking settings/time/song
-- inside the same transaction. It cannot change text, photos or stickers.
create function public.apply_diary_auto_song(p_user uuid,p_song jsonb) returns text language plpgsql security definer set search_path=public as $$
declare oldsub text; oldclaims text; n int; outcome text;
begin
 perform pg_advisory_xact_lock(hashtext(p_user::text),hashtext(public.ist_today()::text));
 if public.ist_time()<time '21:50' or public.ist_time()>=time '22:00' then return 'outside_window';end if;
 if not exists(select from public.song_taste where user_id=p_user and enabled) then return 'disabled';end if;
 if exists(select from public.diary_auto_song_runs where user_id=p_user and day=public.ist_today() and result<>'retry')then return 'done';end if;
 if p_song is not null and (jsonb_typeof(p_song)<>'object' or not(p_song ?& array['id','name','artist','art','url']) or octet_length(p_song::text)>2000 or p_song->>'url' !~ '^https://[a-zA-Z0-9.-]+\.(apple|mzstatic)\.com/')then raise exception 'Invalid song';end if;
 oldsub:=current_setting('request.jwt.claim.sub',true);oldclaims:=current_setting('request.jwt.claims',true);
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user)::text,true);
 if not exists(select from public.diary_entries where user_id=p_user and entry_date=public.ist_today() and status='draft')then outcome:='no_page';
 elsif exists(select from public.diary_entries where user_id=p_user and entry_date=public.ist_today() and song is not null)then outcome:='already_set';
 elsif p_song is null then outcome:='no_match';
 else
  update public.diary_entries set song=p_song where user_id=p_user and entry_date=public.ist_today() and status='draft' and song is null;
  get diagnostics n=row_count;outcome:=case when n=1 then 'added' else 'already_set' end;
 end if;
 perform set_config('request.jwt.claim.sub',coalesce(oldsub,''),true);perform set_config('request.jwt.claims',coalesce(oldclaims,'{}'),true);
 insert into public.diary_auto_song_runs(user_id,day,result)values(p_user,public.ist_today(),outcome)on conflict(user_id,day)do update set result=excluded.result,updated_at=now();
 return outcome;
end$$;
revoke all on function public.apply_diary_auto_song(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_diary_auto_song(uuid,jsonb) to service_role;
-- Text/sticker autosaves must not erase a song added by the scheduler in a stale tab.
create function public.save_diary_draft(p_day date,p_text text,p_stickers jsonb,p_song jsonb,p_song_changed boolean default false) returns table(id uuid,song jsonb) language plpgsql security invoker set search_path=public as $$
begin
 return query insert into public.diary_entries as e(user_id,entry_date,content,stickers,song,status)
 values(auth.uid(),p_day,p_text,p_stickers,p_song,'draft')
 on conflict(user_id,entry_date)do update set content=excluded.content,stickers=excluded.stickers,song=case when p_song_changed then excluded.song else e.song end
 returning e.id,e.song;
end$$;
revoke all on function public.save_diary_draft(date,text,jsonb,jsonb,boolean)from public,anon;
grant execute on function public.save_diary_draft(date,text,jsonb,jsonb,boolean)to authenticated;
create function public.dispatch_diary_auto_song()returns void language plpgsql security definer set search_path=public as $$
declare secret text;
begin
 if public.ist_time()<time '21:50' or public.ist_time()>=time '22:00' then return;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='diary_push_cron' limit 1;
 if secret is null then return;end if;
 perform net.http_post(url:='https://etkjcywiaiiphsrthxqe.supabase.co/functions/v1/diary-auto-song',headers:=jsonb_build_object('Content-Type','application/json','x-diary-cron',secret),body:='{}'::jsonb,timeout_milliseconds:=15000);
end$$;
revoke all on function public.dispatch_diary_auto_song()from public,anon,authenticated;
select cron.schedule('diary-auto-song','20-29 16 * * *','select public.dispatch_diary_auto_song()');
