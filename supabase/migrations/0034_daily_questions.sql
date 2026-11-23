-- The daily quota survives unsend; question/answer content follows message deletion.
create table public.chat_question_days(sender_id uuid not null references public.profiles(id)on delete cascade,day date not null,message_id uuid not null,primary key(sender_id,day));
alter table public.chat_question_days enable row level security;
create table public.chat_questions(message_id uuid primary key references public.chat_messages(id)on delete cascade,sender_id uuid not null references public.profiles(id)on delete cascade,recipient_id uuid not null references public.profiles(id)on delete cascade,created_at timestamptz not null default now(),answer boolean,answered_at timestamptz);
alter table public.chat_questions enable row level security;
create policy question_read on public.chat_questions for select to authenticated using((auth.uid()=sender_id or auth.uid()=recipient_id)and public.friend_id(sender_id)=recipient_id);
grant select on public.chat_questions to authenticated;
create function public.chat_question_insert()returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.body ~* '^/ask[[:space:]]' then
  if char_length(btrim(substring(new.body from 6)))not between 1 and 300 or new.sticker is not null or new.gif_id is not null or new.audio is not null or new.song is not null or new.weather is not null or cardinality(new.images)>0 then raise exception 'Write a question of 1 to 300 characters';end if;
  begin insert into public.chat_question_days values(new.sender_id,(now()at time zone 'Asia/Kolkata')::date,new.id);exception when unique_violation then raise exception 'You have already asked your daily question. Try after midnight IST.';end;
  insert into public.chat_questions(message_id,sender_id,recipient_id)values(new.id,new.sender_id,new.recipient_id);
 end if;return new;
end$$;
create trigger chat_question_insert after insert on public.chat_messages for each row execute function public.chat_question_insert();
create function public.chat_question_no_edit()returns trigger language plpgsql security definer set search_path=public as $$begin
 if old.body is distinct from new.body and (exists(select 1 from public.chat_questions where message_id=old.id)or new.body ~* '^/ask[[:space:]]')then raise exception 'Daily questions cannot be edited';end if;return new;end$$;
create trigger chat_question_no_edit before update on public.chat_messages for each row execute function public.chat_question_no_edit();
create function public.answer_chat_question(p_id uuid,p_answer boolean)returns void language plpgsql security definer set search_path=public as $$
declare q public.chat_questions;
begin
 if auth.uid()is null or p_answer is null then raise insufficient_privilege;end if;
 select * into q from public.chat_questions where message_id=p_id for update;
 if not found or q.recipient_id<>auth.uid()or public.friend_id(q.sender_id)is distinct from auth.uid()then raise insufficient_privilege;end if;
 if q.answer is not null then raise exception 'This question has already been answered';end if;
 update public.chat_questions set answer=p_answer,answered_at=now()where message_id=p_id;
end$$;
create function public.ask_chat_question(p_id uuid,p_question text,p_reply uuid default null)returns uuid language plpgsql security definer set search_path=public as $$
begin
 if auth.uid()is null then raise insufficient_privilege;end if;
 if char_length(btrim(coalesce(p_question,'')))not between 1 and 300 then raise exception 'Write a question of 1 to 300 characters';end if;
 -- The normal chat trigger derives sender/recipient and validates reply scope.
 insert into public.chat_messages(id,body,reply_to)values(p_id,'/ask '||btrim(p_question),p_reply);return p_id;
end$$;
revoke all on public.chat_question_days from public,anon,authenticated;
revoke all on function public.chat_question_insert(),public.chat_question_no_edit(),public.answer_chat_question(uuid,boolean),public.ask_chat_question(uuid,text,uuid)from public,anon,authenticated;
grant execute on function public.answer_chat_question(uuid,boolean),public.ask_chat_question(uuid,text,uuid)to authenticated;
