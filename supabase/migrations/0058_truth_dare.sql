-- Challenge text is not part of chat_messages and stays server-hidden until accepted.
create table public.chat_truth_dares(
 message_id uuid primary key references public.chat_messages(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 question text not null check(char_length(btrim(question)) between 1 and 1000),
 options text[] not null default '{}',status text not null default 'pending' check(status in('pending','accepted','declined')),
 answer_index integer,created_at timestamptz not null default now(),responded_at timestamptz,answered_at timestamptz,
 check(cardinality(options)=0 or cardinality(options) between 2 and 4),
 check(answer_index is null or(status='accepted' and answer_index>=0 and answer_index<cardinality(options)))
);
alter table public.chat_truth_dares enable row level security;
revoke all on public.chat_truth_dares from public,anon,authenticated;
create function public.truth_dare_send(p_id uuid,p_question text,p_options text[] default '{}',p_reply uuid default null)returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();friend uuid;opts text[];q public.chat_truth_dares;
begin
 friend:=public.friend_id(uid);if uid is null or friend is null or p_id is null then raise insufficient_privilege;end if;
 if char_length(btrim(coalesce(p_question,'')))not between 1 and 1000 then raise exception 'Write a challenge of 1 to 1000 characters';end if;
 select coalesce(array_agg(btrim(x)),'{}')into opts from unnest(coalesce(p_options,'{}'))x;
 if cardinality(opts)not in(0,2,3,4) or exists(select 1 from unnest(opts)x where x is null or char_length(x)not between 1 and 150) or (select count(distinct lower(x))from unnest(opts)x)<>cardinality(opts)then raise exception 'Use 2 to 4 different, non-empty options, up to 150 characters each';end if;
 select * into q from public.chat_truth_dares where message_id=p_id;
 if found then if q.sender_id=uid and q.question=btrim(p_question) and q.options=opts then return p_id;else raise insufficient_privilege;end if;end if;
 insert into public.chat_messages(id,body,reply_to)values(p_id,'/truthdare',p_reply);
 insert into public.chat_truth_dares(message_id,sender_id,recipient_id,question,options)values(p_id,uid,friend,btrim(p_question),opts);return p_id;
end$$;
create function public.truth_dare_get(p_id uuid)returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.chat_truth_dares;uid uuid:=auth.uid();reveal boolean;
begin
 select * into q from public.chat_truth_dares where message_id=p_id;
 if uid is null or not found or uid not in(q.sender_id,q.recipient_id)or public.friend_id(q.sender_id)is distinct from q.recipient_id then raise insufficient_privilege;end if;
 reveal:=uid=q.sender_id or q.status='accepted';
 return jsonb_build_object('status',q.status,'question',case when reveal then q.question else null end,'options',case when reveal then to_jsonb(q.options) else '[]'::jsonb end,'answer_index',q.answer_index);
end$$;
create function public.truth_dare_respond(p_id uuid,p_accept boolean)returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.chat_truth_dares;begin
 select * into q from public.chat_truth_dares where message_id=p_id for update;
 if auth.uid()is null or not found or q.recipient_id<>auth.uid()or public.friend_id(q.sender_id)is distinct from auth.uid()or p_accept is null then raise insufficient_privilege;end if;
 if q.status='pending' then update public.chat_truth_dares set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now()where message_id=p_id;
 elsif q.status<>(case when p_accept then 'accepted' else 'declined' end) then raise exception 'This decision is final';end if;
 return public.truth_dare_get(p_id);
end$$;
create function public.truth_dare_answer(p_id uuid,p_index integer)returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.chat_truth_dares;begin
 select * into q from public.chat_truth_dares where message_id=p_id for update;
 if auth.uid()is null or not found or q.recipient_id<>auth.uid()or public.friend_id(q.sender_id)is distinct from auth.uid()then raise insufficient_privilege;end if;
 if q.status<>'accepted' or cardinality(q.options)=0 or p_index is null or p_index<0 or p_index>=cardinality(q.options)then raise exception 'Accept and choose one of the provided answers';end if;
 if q.answer_index is null then update public.chat_truth_dares set answer_index=p_index,answered_at=now()where message_id=p_id;
 elsif q.answer_index<>p_index then raise exception 'This answer is final';end if;
 return public.truth_dare_get(p_id);
end$$;
create function public.truth_dare_no_edit()returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.body is distinct from old.body and (old.body='/truthdare' or new.body='/truthdare' or exists(select 1 from public.chat_truth_dares where message_id=old.id))then raise exception 'Challenges cannot be edited';end if;return new;end$$;
create trigger truth_dare_no_edit before update on public.chat_messages for each row execute function public.truth_dare_no_edit();
revoke all on function public.truth_dare_send(uuid,text,text[],uuid),public.truth_dare_get(uuid),public.truth_dare_respond(uuid,boolean),public.truth_dare_answer(uuid,integer),public.truth_dare_no_edit()from public,anon,authenticated;
grant execute on function public.truth_dare_send(uuid,text,text[],uuid),public.truth_dare_get(uuid),public.truth_dare_respond(uuid,boolean),public.truth_dare_answer(uuid,integer)to authenticated;
