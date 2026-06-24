import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from 'npm:@aws-sdk/client-s3@3.693.0'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.693.0'

export const R2_BUCKETS = [
  'property_images',
  'property_documents',
  'avatars',
] as const

export type R2BucketName = (typeof R2_BUCKETS)[number]

/** S3 bucket name from a path-style public base URL (final pathname segment). */
export function physicalBucketFromPublicBase(publicBase: string): string {
  let parsed: URL
  try {
    parsed = new URL(publicBase)
  } catch {
    throw new Error(`Invalid R2 public base URL: ${publicBase}`)
  }
  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0)
  if (segments.length === 0) {
    throw new Error(
      `R2 public base URL must include the bucket name as the final path segment ` +
        `(e.g. https://<account>.r2.cloudflarestorage.com/staging-avatars). Got: ${publicBase}`,
    )
  }
  return segments[segments.length - 1]
}

/** R2 bucket name in Cloudflare (S3 `Bucket`); derived from `R2_PUBLIC_BASE_*` env vars. */
export function physicalR2BucketName(logical: R2BucketName): string {
  return physicalBucketFromPublicBase(publicBaseForBucket(logical))
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing required environment variable: ${name}`)
  return v
}

export function getR2S3Client(): S3Client {
  const endpoint = requireEnv('R2_ENDPOINT')
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID')
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY')
  const region = Deno.env.get('R2_REGION') ?? 'auto'

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
}

export function publicBaseForBucket(bucket: R2BucketName): string {
  const envName =
    bucket === 'property_images'
      ? 'R2_PUBLIC_BASE_PROPERTY_IMAGES'
      : bucket === 'property_documents'
        ? 'R2_PUBLIC_BASE_PROPERTY_DOCUMENTS'
        : 'R2_PUBLIC_BASE_AVATARS'
  const base = requireEnv(envName).replace(/\/$/, '')
  return base
}

export function buildPublicUrl(bucket: R2BucketName, key: string): string {
  const base = publicBaseForBucket(bucket)
  const encodedKey = key
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${base}/${encodedKey}`
}

export async function presignPut(params: {
  bucket: R2BucketName
  key: string
  contentType: string
}): Promise<{ url: string; headers: Record<string, string> }> {
  const client = getR2S3Client()
  const command = new PutObjectCommand({
    Bucket: physicalR2BucketName(params.bucket),
    Key: params.key,
    ContentType: params.contentType,
  })

  const url = await getSignedUrl(client, command, { expiresIn: 900 })
  return {
    url,
    headers: { 'Content-Type': params.contentType },
  }
}

export async function deleteObjectR2(params: {
  bucket: R2BucketName
  key: string
}): Promise<void> {
  const client = getR2S3Client()
  await client.send(
    new DeleteObjectCommand({
      Bucket: physicalR2BucketName(params.bucket),
      Key: params.key,
    }),
  )
}
