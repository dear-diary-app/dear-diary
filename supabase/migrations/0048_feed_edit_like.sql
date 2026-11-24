create function public.feed_edit_caption(p_id uuid,p_caption text)returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid()is null then raise insufficient_privilege;end if;
 if p_caption is null or char_length(p_caption)>1000 then raise exception 'Caption must be 1000 characters or fewer';end if;
 update public.feed_posts set caption=btrim(p_caption)where id=p_id and owner_id=auth.uid();if not found then raise insufficient_privilege;end if;
end$$;
create function public.feed_like(p_id uuid)returns void language plpgsql security definer set search_path=public as $$declare uid uuid:=auth.uid();p public.feed_posts;begin
 select * into p from public.feed_posts where id=p_id for update;if uid is null or p.id is null or uid not in(p.owner_id,p.partner_id)or public.friend_id(p.owner_id)is distinct from p.partner_id then raise insufficient_privilege;end if;
 insert into public.feed_reactions(post_id,user_id,emoji)values(p_id,uid,'❤️')on conflict(post_id,user_id)do update set emoji='❤️',created_at=now()where public.feed_reactions.emoji<>'❤️';
end$$;
revoke all on function public.feed_edit_caption(uuid,text),public.feed_like(uuid)from public,anon;grant execute on function public.feed_edit_caption(uuid,text),public.feed_like(uuid)to authenticated;
