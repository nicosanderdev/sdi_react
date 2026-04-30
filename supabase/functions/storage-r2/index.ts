import { corsHeaders } from '../_shared/cors.ts'
import {
  authenticateUser,
  createUnauthorizedResponse,
} from '../_shared/auth.ts'
import {
  type R2BucketName,
  R2_BUCKETS,
  buildPublicUrl,
  deleteObjectR2,
  presignPut,
} from '../_shared/r2Client.ts'

const MAX_AVATAR_BYTES = 8 * 1024 * 1024
const MAX_PROPERTY_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_PROPERTY_DOCUMENT_BYTES = 50 * 1024 * 1024

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isSafeObjectKey(key: string): boolean {
  if (!key || key.startsWith('/') || key.includes('..')) return false
  return true
}

function isAllowedBucket(name: string): name is R2BucketName {
  return (R2_BUCKETS as readonly string[]).includes(name)
}

function validateContentType(bucket: R2BucketName, contentType: string): boolean {
  const ct = contentType.trim().toLowerCase()
  if (ct.length < 3 || ct.length > 200 || !ct.includes('/')) return false
  const [major, minor] = ct.split('/')
  if (!major || !minor || minor.includes('/')) return false
  if (!/^[\w!#$&^+.-]+$/.test(major) || !/^[\w!#$&^+.-]+$/.test(minor)) {
    return false
  }
  if (bucket === 'avatars' || bucket === 'property_images') {
    return major === 'image'
  }
  // property_documents: common office / pdf / images / text
  return true
}

function maxBytesForBucket(bucket: R2BucketName): number {
  if (bucket === 'avatars') return MAX_AVATAR_BYTES
  if (bucket === 'property_images') return MAX_PROPERTY_IMAGE_BYTES
  return MAX_PROPERTY_DOCUMENT_BYTES
}

function validateKeyForBucket(
  bucket: R2BucketName,
  key: string,
  userId: string,
): boolean {
  if (!isSafeObjectKey(key)) return false
  if (bucket === 'avatars') {
    return key.startsWith(`${userId}/`)
  }
  return key.startsWith('properties/')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authResult = await authenticateUser(req)
  if (authResult.error || !authResult.user) {
    return createUnauthorizedResponse(authResult.error ?? 'Authentication failed')
  }
  const user = authResult.user

  try {
    const body = (await req.json()) as {
      action?: string
      bucket?: string
      key?: string
      contentType?: string
      contentLength?: number
    }

    const action = body.action
    if (action !== 'presignPut' && action !== 'deleteObject') {
      return jsonResponse({ error: 'Invalid or missing action' }, 400)
    }

    const bucket = body.bucket
    const key = body.key
    if (!bucket || !key) {
      return jsonResponse({ error: 'bucket and key are required' }, 400)
    }
    if (!isAllowedBucket(bucket)) {
      return jsonResponse({ error: 'Invalid bucket' }, 400)
    }
    if (!validateKeyForBucket(bucket, key, user.id)) {
      return jsonResponse({ error: 'Invalid object key for this bucket' }, 403)
    }

    if (action === 'deleteObject') {
      await deleteObjectR2({ bucket, key })
      return jsonResponse({ ok: true })
    }

    // presignPut
    const contentType = body.contentType?.trim()
    if (!contentType) {
      return jsonResponse({ error: 'contentType is required' }, 400)
    }
    if (!validateContentType(bucket, contentType)) {
      return jsonResponse({ error: 'Unsupported content type for this bucket' }, 400)
    }

    const contentLength = body.contentLength
    if (
      typeof contentLength !== 'number' ||
      !Number.isFinite(contentLength) ||
      contentLength <= 0
    ) {
      return jsonResponse({ error: 'contentLength must be a positive number' }, 400)
    }

    const maxBytes = maxBytesForBucket(bucket)
    if (contentLength > maxBytes) {
      return jsonResponse(
        { error: `File too large (max ${maxBytes} bytes for ${bucket})` },
        400,
      )
    }

    const { url, headers } = await presignPut({
      bucket,
      key,
      contentType,
    })
    const publicUrl = buildPublicUrl(bucket, key)

    return jsonResponse({
      method: 'PUT',
      url,
      headers,
      publicUrl,
    })
  } catch (e) {
    console.error('storage-r2 error:', e)
    const message = e instanceof Error ? e.message : 'Internal error'
    return jsonResponse({ error: message }, 500)
  }
})
