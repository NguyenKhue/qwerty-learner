import { ModeFrame, ModePage } from '@/components/ModePage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { call } from '@/data/rpc'
import { useLive } from '@/data/useLive'
import type { DictationVideoSummary } from '@/utils/dictation/types'
import { parseVideoId } from '@/utils/dictation/videoId'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

/** A suggested video of the built-in list (`public/dictation/videos.json`). */
type Suggestion = { id: string; title: string; channel: string; category: string }

type Props = { onOpen: (videoId: string) => void; onBack: () => void }

function progressLabel(video: DictationVideoSummary): string {
  if (video.progress?.finished) return 'Finished'
  const done = Math.min(video.progress?.position ?? 0, video.sentenceCount)
  return `${done} of ${video.sentenceCount} sentences`
}

/** Choosing a video: paste a link, continue a prepared video, or pick a suggestion. */
export default function DictationSetup({ onOpen, onBack }: Props) {
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState('')
  const prepared = useLive(() => call('dictation.videos'), ['dictation'], [])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/dictation/videos.json')
      .then((response) => (response.ok ? response.json() : []))
      .then((list: unknown) => {
        if (!cancelled && Array.isArray(list)) setSuggestions(list as Suggestion[])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const id = parseVideoId(link)
    if (!id) {
      setLinkError('That is not a YouTube video link')
      return
    }
    setLinkError('')
    onOpen(id)
  }

  const preparedIds = new Set((prepared ?? []).map((video) => video.id))
  const categories = Array.from(new Set(suggestions.map((s) => s.category)))

  return (
    <ModeFrame>
      <ModePage title="Dictation" onBack={onBack}>
        <Card className="space-y-3 p-6">
          <p className="text-sm text-muted-foreground">
            Listen to a YouTube video one sentence at a time and type what you hear. The Vietnamese meaning is shown as a hint.
          </p>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a YouTube link"
              aria-label="YouTube link"
              aria-invalid={linkError !== ''}
            />
            <Button type="submit">Open</Button>
          </form>
          {linkError && (
            <p role="alert" className="text-sm text-destructive">
              {linkError}
            </p>
          )}
        </Card>

        {prepared && prepared.length > 0 && (
          <Card className="space-y-2 p-6">
            <p className="text-sm font-medium text-muted-foreground">Your videos</p>
            <ul className="divide-y divide-border">
              {prepared.map((video) => (
                <li key={video.id}>
                  <button
                    className="flex w-full items-center justify-between gap-4 py-3 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onOpen(video.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{video.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">{video.channel}</span>
                    </span>
                    <span className="num shrink-0 text-sm text-muted-foreground">{progressLabel(video)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {categories.map((category) => (
          <Card key={category} className="space-y-2 p-6">
            <p className="text-sm font-medium text-muted-foreground">{category}</p>
            <ul className="divide-y divide-border">
              {suggestions
                .filter((s) => s.category === category)
                .map((s) => (
                  <li key={s.id}>
                    <button
                      className="flex w-full items-center justify-between gap-4 py-3 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onOpen(s.id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.title}</span>
                        <span className="block truncate text-sm text-muted-foreground">{s.channel}</span>
                      </span>
                      {preparedIds.has(s.id) && <span className="shrink-0 text-sm text-muted-foreground">Prepared</span>}
                    </button>
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </ModePage>
    </ModeFrame>
  )
}
