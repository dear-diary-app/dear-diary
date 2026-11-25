select cron.unschedule(jobid) from cron.job where jobname='instant-cleanup';
drop function if exists public.instant_cleanup_tick();
drop function if exists public.claim_instant(uuid,uuid);
drop table if exists public.instants;
drop function if exists public.instant_removed();
drop table if exists public.instant_cleanup;
