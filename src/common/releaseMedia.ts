export function safeReleaseMedia(
  value: string | undefined
): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value, 'https://www.releases.com')
    if (url.protocol !== 'https:' || url.username || url.password)
      return undefined
    if (
      ![
        'cdn.releases.com',
        'www.releases.com',
        'i.ytimg.com',
        'img.youtube.com',
        'www.youtube.com',
        'youtube.com',
        'youtu.be',
        'www.youtube-nocookie.com',
        'player.vimeo.com',
        'vimeo.com'
      ].includes(url.hostname)
    )
      return undefined
    return url.href
  } catch {
    return undefined
  }
}

export function releaseVideoEmbed(value: string): string | undefined {
  const safe = safeReleaseMedia(value)
  if (!safe) return undefined
  const url = new URL(safe)
  if (
    [
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtu.be'
    ].includes(url.hostname)
  ) {
    const id =
      url.hostname === 'youtu.be'
        ? url.pathname.slice(1)
        : url.pathname.startsWith('/embed/')
          ? url.pathname.split('/')[2]
          : url.searchParams.get('v')
    if (id && /^[\w-]{11}$/.test(id))
      return `https://www.youtube-nocookie.com/embed/${id}`
  }
  if (['player.vimeo.com', 'vimeo.com'].includes(url.hostname)) {
    const id = url.pathname.split('/').filter(Boolean).at(-1)
    if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`
  }
  return undefined
}

export function releaseVideoThumbnail(value: string): string | undefined {
  const embed = releaseVideoEmbed(value)
  if (!embed) return undefined
  const url = new URL(embed)
  if (url.hostname !== 'www.youtube-nocookie.com') return undefined
  return `https://i.ytimg.com/vi/${url.pathname.split('/').at(-1)}/hqdefault.jpg`
}
