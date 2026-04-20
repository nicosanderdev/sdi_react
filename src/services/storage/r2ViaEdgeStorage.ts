import { supabase } from '../../config/supabase'
import type { StorageService } from './types'

type PresignPutResponse = {
  method?: string
  url: string
  headers: Record<string, string>
  publicUrl: string
}

function inferContentType(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
  }
  return map[ext ?? ''] ?? 'application/octet-stream'
}

async function invokeStorageR2<T extends Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('storage-r2', {
    body,
  })
  if (error) throw error
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String((data as { error: unknown }).error))
  }
  return data as T
}

export const r2ViaEdgeStorage: StorageService = {
  async presignAndUpload(file, params) {
    const contentType = inferContentType(file)
    const presign = await invokeStorageR2<PresignPutResponse>({
      action: 'presignPut',
      bucket: params.bucket,
      key: params.key,
      contentType,
      contentLength: file.size,
    })

    if (!presign?.url || !presign.publicUrl) {
      throw new Error('Invalid presign response from storage-r2')
    }

    const putRes = await fetch(presign.url, {
      method: 'PUT',
      headers: presign.headers,
      body: file,
    })

    if (!putRes.ok) {
      const detail = await putRes.text().catch(() => '')
      throw new Error(
        `Upload to storage failed (${putRes.status}): ${detail || putRes.statusText}`,
      )
    }

    return { publicUrl: presign.publicUrl, key: params.key }
  },

  async deleteObject(params) {
    await invokeStorageR2<{ ok?: boolean }>({
      action: 'deleteObject',
      bucket: params.bucket,
      key: params.key,
    })
  },
}
