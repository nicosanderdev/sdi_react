export type { StorageBucketName, StorageService } from './types'
export { r2ViaEdgeStorage } from './r2ViaEdgeStorage'

import { r2ViaEdgeStorage } from './r2ViaEdgeStorage'
import type { StorageService } from './types'

/** Object storage (Cloudflare R2 via Supabase Edge Function). Swap implementation in one place if the provider changes. */
export const storageService: StorageService = r2ViaEdgeStorage
