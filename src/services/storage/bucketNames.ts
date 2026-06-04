import type { StorageBucketName } from './types'

/** Supabase Storage bucket id (same hyphenated names as R2 physical buckets). */
export function supabaseBucketId(logical: StorageBucketName): string {
  const map: Record<StorageBucketName, string> = {
    property_images: 'property-images',
    property_documents: 'property-documents',
    avatars: 'avatars',
  }
  return map[logical]
}
