insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-pictures','profile-pictures',false,1048576,array['image/jpeg'])
on conflict(id) do nothing;
create policy profile_picture_read on storage.objects for select to authenticated using (
 bucket_id='profile-pictures' and ((storage.foldername(name))[1]=auth.uid()::text
 or (storage.foldername(name))[1]=public.friend_id(auth.uid())::text));
create policy profile_picture_insert on storage.objects for insert to authenticated with check (
 bucket_id='profile-pictures' and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.profiles where id=auth.uid()));
create policy profile_picture_delete on storage.objects for delete to authenticated using (
 bucket_id='profile-pictures' and (storage.foldername(name))[1]=auth.uid()::text);
