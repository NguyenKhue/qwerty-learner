import DictationResult from './Result'
import DictationRun from './Run'
import DictationSetup from './Setup'
import { ModeFrame, ModePage, PageMessage } from '@/components/ModePage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { call } from '@/data/rpc'
import { useLive } from '@/data/useLive'
import { toItems } from '@/utils/dictation/items'
import type { DictationItem } from '@/utils/dictation/items'
import type { DictationStatus, DictationVideo } from '@/utils/dictation/types'
import { isVideoId } from '@/utils/dictation/videoId'
import { canGoBack } from '@/utils/history'
import { retryItems, summarize } from '@/utils/sentences/session'
import type { SentenceSession, SentenceSummary } from '@/utils/sentences/session'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const STEP_LABEL: Record<NonNullable<DictationStatus['step']>, string> = {
  subtitles: 'Fetching the subtitles…',
  sentences: 'Splitting the subtitles into sentences…',
  translating: 'Translating into Vietnamese…',
}

/** `/dictation` chooses a video; `/dictation/:videoId` prepares it if needed and runs it. */
export default function DictationPage() {
  const { videoId } = useParams()
  const navigate = useNavigate()
  const back = useCallback(() => (canGoBack() ? navigate(-1) : navigate('/')), [navigate])

  if (!videoId) return <DictationSetup onOpen={(id) => navigate(`/dictation/${id}`)} onBack={back} />
  if (!isVideoId(videoId)) {
    return (
      <ModeFrame>
        <PageMessage text="That is not a YouTube video." tone="error" />
      </ModeFrame>
    )
  }
  return <VideoScreen key={videoId} id={videoId} onBack={() => navigate('/dictation')} />
}

type Phase =
  | { kind: 'intro' }
  | { kind: 'run'; items: DictationItem[]; practice: boolean; base: { correct: number; wrong: number }; key: number }
  | { kind: 'result'; summary: SentenceSummary<DictationItem>; retry: DictationItem[] }

function VideoScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const video = useLive(() => call('dictation.get', id), [`dictation:${id}`], [id])
  const status = useLive(() => call('dictation.status', id), [`dictation:${id}`], [id])
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [startError, setStartError] = useState('')
  const runKey = useRef(0)

  const prepare = useCallback(() => {
    setStartError('')
    call('dictation.prepare', id).catch((error: unknown) => setStartError(error instanceof Error ? error.message : 'Could not start'))
  }, [id])

  // A video that is not cached yet is prepared as soon as it is opened
  const missing = video === null
  useEffect(() => {
    if (missing) prepare()
  }, [missing, prepare])

  const start = (video: DictationVideo, from: number, items?: DictationItem[], practice = false) => {
    const base = from > 0 && video.progress ? { correct: video.progress.correct, wrong: video.progress.wrong } : { correct: 0, wrong: 0 }
    const list = items ?? toItems(video.sentences, from)
    if (list.length === 0) return
    runKey.current += 1
    setPhase({ kind: 'run', items: list, practice, base, key: runKey.current })
  }

  if (video === undefined || status === undefined) return <ModeFrame>{null}</ModeFrame>

  if (video === null) {
    const failed = status.state === 'error' ? status.error : undefined
    return (
      <ModeFrame>
        <ModePage title="Preparing the video" onBack={onBack}>
          <Card className="space-y-4 p-6">
            {failed ? (
              <>
                <p role="alert" className="text-destructive">
                  {failed.message}
                </p>
                <div className="flex gap-2">
                  <Button onClick={prepare}>Try again</Button>
                  <Button variant="outline" onClick={onBack}>
                    Choose another video
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground" aria-live="polite">
                {status.step ? STEP_LABEL[status.step] : 'Starting…'} The first time takes a little while; after that the video opens at
                once.
              </p>
            )}
            {startError && (
              <p role="alert" className="text-sm text-destructive">
                {startError}
              </p>
            )}
          </Card>
        </ModePage>
      </ModeFrame>
    )
  }

  if (phase.kind === 'run') {
    const save = (session: SentenceSession<DictationItem>) => {
      if (phase.practice || session.results.length === 0) return
      const last = session.results[session.results.length - 1].item
      const done = session.index >= session.items.length
      const totals = summarize(session)
      call('dictation.saveProgress', id, {
        position: done ? video.sentences.length : last.index + 1,
        correct: phase.base.correct + totals.typed,
        wrong: phase.base.wrong + totals.wrong,
        finished: done,
      }).catch(() => undefined)
    }
    return (
      <DictationRun
        key={phase.key}
        videoId={id}
        items={phase.items}
        total={video.sentences.length}
        onExit={() => setPhase({ kind: 'intro' })}
        onProgress={save}
        onFinish={(session) => setPhase({ kind: 'result', summary: summarize(session), retry: retryItems(session) })}
      />
    )
  }

  if (phase.kind === 'result') {
    return (
      <DictationResult
        summary={phase.summary}
        onPractiseMistakes={() => start(video, 0, phase.retry, true)}
        onReplayVideo={() => start(video, 0)}
        onBack={onBack}
      />
    )
  }

  const progress = video.progress
  const resumeAt =
    progress && !progress.finished && progress.position > 0 && progress.position < video.sentences.length ? progress.position : 0
  return (
    <ModeFrame>
      <ModePage title={video.title} onBack={onBack}>
        <Card className="space-y-4 p-6">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {video.channel} · {video.sentences.length} sentences ·{' '}
              {video.subtitleKind === 'manual' ? 'subtitles by people' : 'automatic subtitles'}
            </p>
            {video.subtitleKind === 'auto' && (
              <p>Automatic subtitles can contain mistakes: when a sentence sounds different, trust your ears.</p>
            )}
            {video.note && <p>{video.note}</p>}
            {progress?.finished && <p>You finished this video.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {resumeAt > 0 ? (
              <>
                <Button onClick={() => start(video, resumeAt)}>Continue at sentence {resumeAt + 1}</Button>
                <Button variant="outline" onClick={() => start(video, 0)}>
                  Start over
                </Button>
              </>
            ) : (
              <Button onClick={() => start(video, 0)}>{progress?.finished ? 'Start again' : 'Start'}</Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                if (!window.confirm('Remove this video and your progress in it?')) return
                // Leave first: once the cache is gone this screen would start preparing the video again
                onBack()
                call('dictation.remove', id).catch(() => undefined)
              }}
            >
              Remove
            </Button>
          </div>
        </Card>
      </ModePage>
    </ModeFrame>
  )
}
