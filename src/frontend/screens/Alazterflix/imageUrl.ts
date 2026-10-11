export function getMediaImageUrl(url?: string): string | undefined {
  if (!url) return undefined
  if (
    url.startsWith('imagecache://') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:')
  ) {
    return url
  }
  if (/^[a-zA-Z]:[\\/]/.test(url)) {
    return `imagecache://localhost/${encodeURIComponent(url)}`
  }
  return url
}
