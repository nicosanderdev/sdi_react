const R2_LEGACY_HOST = /\.r2\.cloudflarestorage\.com\//i

const R2_BUCKET_PUBLIC_BASE: Record<string, string | undefined> = {
  'property-images': import.meta.env.VITE_R2_PUBLIC_BASE_PROPERTY_IMAGES,
  'staging-property-images': import.meta.env.VITE_R2_PUBLIC_BASE_PROPERTY_IMAGES,
  'property-documents': import.meta.env.VITE_R2_PUBLIC_BASE_PROPERTY_DOCUMENTS,
  'staging-property-documents': import.meta.env.VITE_R2_PUBLIC_BASE_PROPERTY_DOCUMENTS,
  avatars: import.meta.env.VITE_R2_PUBLIC_BASE_AVATARS,
  'staging-avatars': import.meta.env.VITE_R2_PUBLIC_BASE_AVATARS,
}

/** Map legacy private R2 S3 API URLs to the configured public custom-domain base. */
export function rewriteLegacyR2Url(url: string): string {
  if (!R2_LEGACY_HOST.test(url)) return url

  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0)
    if (segments.length < 2) return url

    const bucket = segments[0]
    const publicBase = R2_BUCKET_PUBLIC_BASE[bucket]?.replace(/\/$/, '')
    if (!publicBase) return url

    const objectKey = segments.slice(1).join('/')
    const encodedKey = objectKey
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/')

    return `${publicBase}/${encodedKey}`
  } catch {
    return url
  }
}

export function resolveAssetUrl(
  url: string | undefined,
  base = import.meta.env.VITE_API_BASE_FILES_URL ?? '',
): string {
  if (!url) return ''
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  if (/^https?:\/\//i.test(url)) return rewriteLegacyR2Url(url)
  if (url.startsWith('/')) return `${base}${url}`
  return `${base}/${url}`
}
