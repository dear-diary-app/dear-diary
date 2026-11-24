-- Match private image access to the parent diary's published-photo visibility.
-- Never grant a friend access merely because an object is in their folder.
alter policy photos_storage_select on storage.objects to authenticated
using (
  bucket_id = 'diary-photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.entry_photos ph
      join public.diary_entries e on e.id = ph.entry_id
      where ph.storage_path = storage.objects.name
        and e.user_id = public.friend_id(auth.uid())
        and (storage.foldername(storage.objects.name))[1] = e.user_id::text
        and e.status = 'published'
        and (e.entry_date + time '22:00') at time zone 'Asia/Kolkata' <= now()
    )
  )
);
