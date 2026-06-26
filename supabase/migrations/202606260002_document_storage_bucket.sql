insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'strata-documents',
  'strata-documents',
  false,
  52428800,
  array[
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "active members upload strata document objects" on storage.objects;
drop policy if exists "active members read visible strata document objects" on storage.objects;

create policy "active members upload strata document objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'strata-documents'
  and exists (
    select 1
    from public.members m
    where m.committee_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
);

create policy "active members read visible strata document objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'strata-documents'
  and exists (
    select 1
    from public.members m
    where m.committee_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
  and exists (
    select 1
    from public.documents d
    where d.committee_id::text = (storage.foldername(name))[1]
      and d.id::text = (storage.foldername(name))[2]
      and (
        d.visibility = 'all'
        or (
          d.visibility in ('admins', 'custom')
          and app_private.member_role(d.committee_id) in ('admin', 'chair', 'secretary', 'treasurer')
        )
      )
  )
);
