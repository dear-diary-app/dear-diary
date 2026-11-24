alter table public.feed_posts add column caption text not null default '' check(char_length(caption)<=1000);
