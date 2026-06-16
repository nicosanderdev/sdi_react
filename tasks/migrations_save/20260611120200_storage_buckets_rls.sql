-- Local / hosted Supabase Storage buckets for property media and avatars.
-- Prod uploads may use Cloudflare R2 instead; these buckets support local dev (VITE_STORAGE_BACKEND=supabase).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'property-images',
    'property-images',
    true,
    52428800,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/svg+xml']::text[]
  ),
  ('property-documents', 'property-documents', true, 52428800, null),
  (
    'avatars',
    'avatars',
    true,
    8388608,
    array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (anon + authenticated) for public buckets
drop policy if exists "storage_property_images_select" on storage.objects;
create policy "storage_property_images_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'property-images');

drop policy if exists "storage_property_documents_select" on storage.objects;
create policy "storage_property_documents_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'property-documents');

drop policy if exists "storage_avatars_select" on storage.objects;
create policy "storage_avatars_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

-- Authenticated writes: property buckets under properties/*
drop policy if exists "storage_property_images_insert" on storage.objects;
create policy "storage_property_images_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-images'
    and name like 'properties/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_property_images_update" on storage.objects;
create policy "storage_property_images_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'property-images'
    and name like 'properties/%'
  )
  with check (
    bucket_id = 'property-images'
    and name like 'properties/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_property_images_delete" on storage.objects;
create policy "storage_property_images_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'property-images'
    and name like 'properties/%'
  );

drop policy if exists "storage_property_documents_insert" on storage.objects;
create policy "storage_property_documents_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-documents'
    and name like 'properties/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_property_documents_update" on storage.objects;
create policy "storage_property_documents_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'property-documents'
    and name like 'properties/%'
  )
  with check (
    bucket_id = 'property-documents'
    and name like 'properties/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_property_documents_delete" on storage.objects;
create policy "storage_property_documents_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'property-documents'
    and name like 'properties/%'
  );

-- Avatars: user-scoped prefix {auth.uid()}/
drop policy if exists "storage_avatars_insert" on storage.objects;
create policy "storage_avatars_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name like auth.uid()::text || '/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_avatars_update" on storage.objects;
create policy "storage_avatars_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and name like auth.uid()::text || '/%'
  )
  with check (
    bucket_id = 'avatars'
    and name like auth.uid()::text || '/%'
    and position('..' in name) = 0
  );

drop policy if exists "storage_avatars_delete" on storage.objects;
create policy "storage_avatars_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and name like auth.uid()::text || '/%'
  );
