-- ============================================================================
-- Migration: Rename property storage buckets to snake_case
-- From:
--   property-images      -> property_images
--   property-documents   -> property_documents
-- This migration is safe to run multiple times; UPDATEs are no-ops if the
-- old IDs no longer exist.
-- ============================================================================

BEGIN;

-- Rename property-images bucket to property_images if it still exists
UPDATE storage.buckets
SET id = 'property_images',
    name = 'property_images'
WHERE id = 'property-images';

-- Rename property-documents bucket to property_documents if it still exists
UPDATE storage.buckets
SET id = 'property_documents',
    name = 'property_documents'
WHERE id = 'property-documents';

-- Ensure RLS is enabled on storage.objects (safe to run multiple times)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to upload images to the property_images bucket
DROP POLICY IF EXISTS "Allow authenticated upload property_images" ON storage.objects;
CREATE POLICY "Allow authenticated upload property_images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property_images');

-- Allow authenticated users to read from the property_images bucket
DROP POLICY IF EXISTS "Allow authenticated read property_images" ON storage.objects;
CREATE POLICY "Allow authenticated read property_images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'property_images');

-- Allow authenticated users to upload documents to the property_documents bucket
DROP POLICY IF EXISTS "Allow authenticated upload property_documents" ON storage.objects;
CREATE POLICY "Allow authenticated upload property_documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property_documents');

-- Allow authenticated users to read from the property_documents bucket
DROP POLICY IF EXISTS "Allow authenticated read property_documents" ON storage.objects;
CREATE POLICY "Allow authenticated read property_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'property_documents');

COMMIT;

