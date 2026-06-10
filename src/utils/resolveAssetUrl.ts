export function resolveAssetUrl(
  url: string | undefined,
  base = import.meta.env.VITE_API_BASE_FILES_URL ?? '',
): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${base}${url}`
  return `${base}/${url}`
}
