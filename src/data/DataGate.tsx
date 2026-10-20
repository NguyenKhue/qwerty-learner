import { subscribe } from './events'
import { reduceGate } from './gate'
import type { GateInfo, LegacyCounts } from './gate'
import { deleteLegacyCopy, detectLegacy, runMigration } from './legacy'
import { metaAtom } from './meta'
import { call } from './rpc'
import { useConnectionState } from './useConnection'
import Loading from '@/components/Loading'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardTitle } from '@/components/ui/card'
import { useSetAtom } from 'jotai'
import { useCallback, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'

const POLL_MS = 3000

const COUNT_LABELS: [string, string][] = [
  ['wordRecords', 'typed words'],
  ['chapterRecords', 'typed chapters'],
  ['reviewRecords', 'error-book reviews'],
  ['customDicts', 'sets of your own'],
  ['cardProgress', 'study cards'],
  ['reviewLog', 'review log entries'],
]

/** A short list of what a browser holds, for example "1,200 typed words, 40 typed chapters, 3 sets of your own". */
export function describeCounts(counts: LegacyCounts): string {
  const parts = COUNT_LABELS.filter(([key]) => (counts[key] ?? 0) > 0).map(
    ([key, label]) => `${counts[key].toLocaleString('en-US')} ${label}`,
  )
  return parts.length > 0 ? parts.join(', ') : 'no records'
}

async function readInfo(): Promise<{ info: GateInfo; meta: Record<string, string> }> {
  const response = await fetch('/api/health')
  if (!response.ok) throw new Error(`The data server answered ${response.status}`)
  const health = (await response.json()) as { empty: boolean; migrated: boolean }
  const meta = await call('meta.getAll')
  let migratedFrom: LegacyCounts | null = null
  try {
    const parsed: unknown = meta.migratedFrom ? JSON.parse(meta.migratedFrom) : null
    if (parsed && typeof parsed === 'object') migratedFrom = parsed as LegacyCounts
  } catch {
    migratedFrom = null
  }
  return { info: { empty: health.empty, migrated: health.migrated, migratedFrom }, meta }
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-lg">
        <CardBody className="space-y-4">
          <CardTitle>{title}</CardTitle>
          {children}
        </CardBody>
      </Card>
    </div>
  )
}

/**
 * Stands in front of the whole app. Until the data server answers nothing else is shown; it loads the flags that describe the data
 * (so no screen ever sees them half loaded), offers to move the data that an older version kept in this browser, and once the app is
 * running it shows a banner when the server stops answering.
 */
export default function DataGate({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduceGate, { kind: 'checking' })
  const setMeta = useSetAtom(metaAtom)
  const connection = useConnectionState()

  const check = useCallback(async () => {
    try {
      const { info, meta } = await readInfo()
      setMeta(meta)
      dispatch({ type: 'checked', info, legacy: await detectLegacy() })
    } catch {
      dispatch({ type: 'unreachable', at: Date.now() })
    }
  }, [setMeta])

  useEffect(() => {
    if (state.kind === 'checking') check()
  }, [state.kind, check])

  // While the server is unreachable keep trying, so the app appears as soon as it is started
  useEffect(() => {
    if (state.kind !== 'unreachable') return
    const timer = window.setInterval(() => dispatch({ type: 'retry' }), POLL_MS)
    return () => window.clearInterval(timer)
  }, [state.kind])

  // Opens the live stream, which is also how the banner learns that the server stopped
  useEffect(() => {
    if (state.kind !== 'ready') return
    return subscribe([], () => undefined)
  }, [state.kind])

  const migrate = useCallback(async () => {
    dispatch({ type: 'migrate-start' })
    try {
      await runMigration()
      await check()
      dispatch({ type: 'migrated' })
    } catch (error) {
      dispatch({ type: 'failed', message: error instanceof Error ? error.message : 'The move did not finish' })
    }
  }, [check])

  const deleteOldCopy = useCallback(
    async (what: string) => {
      if (!window.confirm(`Delete ${what}? This cannot be undone.`)) return
      await deleteLegacyCopy()
      dispatch({ type: 'continue' })
    },
    [dispatch],
  )

  switch (state.kind) {
    case 'checking':
      return <Loading />
    case 'unreachable':
      return (
        <Screen title="The data server is not running">
          <p className="text-sm text-muted-foreground">
            Your learning data lives in a folder on this computer and is served by a small program. Start it, and this page continues by
            itself.
          </p>
          <p className="text-sm text-muted-foreground">
            For development run <code className="rounded bg-muted px-1 py-0.5 text-xs">yarn dev:full</code>, for the stable build run{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">yarn stable:start</code>.
          </p>
          <Button onClick={() => dispatch({ type: 'retry' })}>Try again now</Button>
        </Screen>
      )
    case 'migrate':
      return (
        <Screen title="Move your data to the data folder">
          <p className="text-sm text-muted-foreground">This browser holds {describeCounts(state.found)}.</p>
          <p className="text-sm text-muted-foreground">
            Moving copies all of it into the data folder on this computer. This browser&apos;s copy is left untouched; you can delete it
            yourself later, once you are happy with the new place.
          </p>
          <Button onClick={migrate}>Move my data</Button>
        </Screen>
      )
    case 'migrating':
      return (
        <Screen title="Moving your data…">
          <p className="text-sm text-muted-foreground">Copying {describeCounts(state.found)}. Please keep this page open.</p>
        </Screen>
      )
    case 'failed':
      return (
        <Screen title="The move did not finish">
          <p className="text-sm text-destructive" role="alert">
            {state.message}
          </p>
          <p className="text-sm text-muted-foreground">
            Nothing was changed in the data folder, and this browser&apos;s data is untouched.
          </p>
          <Button onClick={() => dispatch({ type: 'retry' })}>Try again</Button>
        </Screen>
      )
    case 'old-copy':
      return (
        <Screen title="Your data is in the data folder now">
          <p className="text-sm text-muted-foreground">
            This browser still holds the old copy ({describeCounts(state.found)}). It is not used any more. Keep it for a while as a safety
            copy, or delete it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => dispatch({ type: 'continue' })}>Continue</Button>
            <Button variant="outline" onClick={() => deleteOldCopy("this browser's old copy")}>
              Delete the old copy
            </Button>
          </div>
        </Screen>
      )
    case 'blocked-other-browser':
      return (
        <Screen title="This browser holds data that is not in the data folder">
          <p className="text-sm text-muted-foreground">
            This browser holds {describeCounts(state.found)}, which is different from what the data folder was filled from. It will not be
            merged or overwritten automatically.
          </p>
          <p className="text-sm text-muted-foreground">
            To keep it, export it from the old version of the app (Setting, Data, Export) and import that file here. Otherwise you can
            continue without it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => dispatch({ type: 'continue' })}>Continue without it</Button>
            <Button variant="outline" onClick={() => deleteOldCopy("this browser's data")}>
              Delete this browser&apos;s data
            </Button>
          </div>
        </Screen>
      )
    case 'ready':
      return (
        <>
          {connection === 'down' && (
            <div
              role="alert"
              className="fixed inset-x-0 top-0 z-50 bg-destructive px-4 py-2 text-center text-sm text-destructive-foreground"
            >
              The data server stopped responding. Changes may not be saved until it is running again.
            </div>
          )}
          {children}
        </>
      )
  }
}
