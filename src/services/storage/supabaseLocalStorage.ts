import { supabase } from '../../config/supabase'
import { supabaseBucketId } from './bucketNames'
import { inferContentType } from './contentType'
import type { StorageBucketName, StorageService } from './types'

function assertSafeObjectKey(key: string): void {
  if (!key || key.startsWith('/') || key.includes('..')) {
    throw new Error('Invalid object key')
  }
}

export const supabaseLocalStorage: StorageService = {
  async presignAndUpload(file, params) {
    assertSafeObjectKey(params.key)

    const bucket = supabaseBucketId(params.bucket)
    const contentType = inferContentType(file)

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(params.key, file, { upsert: true, contentType })

    if (uploadError) {
      throw new Error(uploadError.message || 'Upload to Supabase Storage failed')
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(params.key)
    if (!data?.publicUrl) {
      throw new Error('Could not resolve public URL for uploaded object')
    }

    return { publicUrl: data.publicUrl, key: params.key }
  },

  async deleteObject(params) {
    assertSafeObjectKey(params.key)
    const bucket = supabaseBucketId(params.bucket)
    const { error } = await supabase.storage.from(bucket).remove([params.key])
    if (error) {
      throw new Error(error.message || 'Delete from Supabase Storage failed')
    }
  },
}
