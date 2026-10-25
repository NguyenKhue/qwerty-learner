const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']
const PATH_KINDS = ['shorts', 'embed', 'live', 'v']

/** True for a string that is exactly one YouTube video id: the only form that may reach a command or a file name. */
export function isVideoId(value: string): boolean {
  return VIDEO_ID.test(value)
}

/** Reads the video id from a YouTube link (watch, youtu.be, shorts, embed) or a bare id; anything else is null. */
export function parseVideoId(input: string): string | null {
  const text = input.trim()
  if (isVideoId(text)) return text
  if (text === '') return null

  let url: URL
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const segments = url.pathname.split('/').filter(Boolean)
  let candidate: string | null = null
  if (url.hostname === 'youtu.be') {
    candidate = segments.length === 1 ? segments[0] : null
  } else if (HOSTS.indexOf(url.hostname) !== -1) {
    if (segments.length === 1 && segments[0] === 'watch') candidate = url.searchParams.get('v')
    else if (segments.length === 2 && PATH_KINDS.indexOf(segments[0]) !== -1) candidate = segments[1]
  }
  return candidate !== null && isVideoId(candidate) ? candidate : null
}
