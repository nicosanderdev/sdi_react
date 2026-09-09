export type { StorageBucketName, StorageService } from './types'
export { r2ViaEdgeStorage } from './r2ViaEdgeStorage'
export { supabaseLocalStorage } from './supabaseLocalStorage'

import { r2ViaEdgeStorage } from './r2ViaEdgeStorage'
import { supabaseLocalStorage } from './supabaseLocalStorage'
import type { StorageService } from './types'

const backend = import.meta.env.VITE_STORAGE_BACKEND ?? 'r2'

/** Object storage: Cloudflare R2 (prod) or Supabase Storage (local dev). */
export const storageService: StorageService =
  backend === 'supabase' ? supabaseLocalStorage : r2ViaEdgeStorage
