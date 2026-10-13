import WordCard from './WordCard'
import { Button } from '@/components/ui/button'
import { currentChapterAtom, currentDictIdAtom } from '@/store'
import { seededPersonalSetsAtom } from '@/store/personal'
import type { Word } from '@/typings'
import { PAGE_SIZE, filterIndexes, visibleCount } from '@/utils/custom-dict/search'
import { CUSTOM_DICT_PREFIX, customEditPath, getCustomDict } from '@/utils/db/custom-dict'
import { isPersonalSeedPending } from '@/utils/db/personal-seed'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import IconSearch from '~icons/tabler/search'

// Stable identity, so filtering never re-runs because of a throwaway empty array
const noWords: Word[] = []

// Keyed by id so that moving between two sets (browser back/forward) starts from a clean page
export default function SetDetailRoute() {
  const { id = '' } = useParams()
  return <SetDetail key={id} id={id} />
}

function SetDetail({ id }: { id: string }) {
  const navigate = useNavigate()
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)
  const data = useLiveQuery(async () => ({ record: (await getCustomDict(id)) ?? null }), [id])
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)

  // The built-in My Vocabulary becomes this set at the first start: until then a missing record is "still coming", not "gone"
  const waitingForSeed = isPersonalSeedPending(id, useAtomValue(seededPersonalSetsAtom))
  // `undefined` while the record is still being read, `null` once we know the set is gone (deleted on another page)
  const record = data === undefined || (data.record === null && waitingForSeed) ? undefined : data.record

  useEffect(() => {
    if (record === null) navigate('/my-sets', { replace: true })
  }, [record, navigate])

  // A new search starts again from the first page
  useEffect(() => {
    setShown(PAGE_SIZE)
  }, [query])

  const words = record ? record.words : noWords
  const indexes = useMemo(() => filterIndexes(words, query), [words, query])

  // Every mode reads the current set, so opening one has to make this set the current one first
  const startMode = (path: string) => {
    setCurrentDictId(CUSTOM_DICT_PREFIX + id)
    setCurrentChapter(0)
    navigate(path)
  }

  const editPath = customEditPath(CUSTOM_DICT_PREFIX + id) ?? '/my-sets'
  const openEditor = (name: string) => navigate(`${editPath}?word=${encodeURIComponent(name)}`)

  if (record === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }
  if (record === null) return null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8">
      <Link to="/my-sets" className="inline-flex min-h-[44px] items-center text-sm text-muted-foreground hover:text-foreground">
        ← My sets
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{record.name}</h1>
        {record.description && <p className="text-sm text-muted-foreground">{record.description}</p>}
        <p className="text-sm text-muted-foreground">{record.words.length} words</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => startMode('/study')}>Flashcards</Button>
        <Button variant="outline" onClick={() => startMode('/quiz')}>
          Quiz
        </Button>
        <Button variant="outline" onClick={() => startMode('/match')}>
          Match
        </Button>
        <Button variant="outline" onClick={() => startMode('/typing')}>
          Typing
        </Button>
        <Button variant="outline" onClick={() => navigate(editPath)}>
          Edit
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="set-detail-search" className="sr-only">
            Search words
          </label>
          <input
            id="set-detail-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search words, meanings or details"
            aria-label="Search words"
            className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {query !== '' && (
          <p className="text-xs text-muted-foreground">
            Showing {shown < indexes.length ? shown : indexes.length} of {record.words.length} words
          </p>
        )}
      </div>

      {record.words.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">This set has no words yet.</p>
          <Button variant="outline" onClick={() => navigate(editPath)}>
            Add words
          </Button>
        </div>
      ) : indexes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No words match &quot;{query}&quot;.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {indexes.slice(0, shown).map((wordIndex) => (
              <li key={record.words[wordIndex].name + wordIndex}>
                <WordCard word={record.words[wordIndex]} onEdit={() => openEditor(record.words[wordIndex].name)} />
              </li>
            ))}
          </ul>
          {indexes.length > shown && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setShown((s) => visibleCount(s, indexes.length))}>
                Show more ({indexes.length - shown} left)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
