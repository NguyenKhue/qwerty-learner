import WordEditorCard from './WordEditorCard'
import { Panel } from '@/components/ModePage'
import { Button } from '@/components/ui/button'
import { seededPersonalSetsAtom } from '@/store/personal'
import { rowIssues } from '@/utils/custom-dict/issues'
import { rowsToWords, wordsToRows } from '@/utils/custom-dict/parse'
import type { EditableRow } from '@/utils/custom-dict/parse'
import { PAGE_SIZE, filterIndexes, visibleCount } from '@/utils/custom-dict/search'
import { CUSTOM_DICT_PREFIX, createCustomDict, customViewPath, getCustomDict, updateCustomDict } from '@/utils/db/custom-dict'
import { isPersonalSeedPending } from '@/utils/db/personal-seed'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import IconSearch from '~icons/tabler/search'

const emptyRow = (): EditableRow => ({ name: '', trans: '', usphone: '', ukphone: '', detail: '' })
const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const labelClass = 'text-xs font-medium text-muted-foreground'

// Keyed by id so that moving between /my-sets/new and /my-sets/<id> (browser back/forward) starts from a clean editor
export default function SetEditorRoute() {
  const { id = 'new' } = useParams()
  return <SetEditor key={id} id={id} />
}

function SetEditor({ id }: { id: string }) {
  const isNew = id === 'new'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<EditableRow[]>([emptyRow()])
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  // The ?word= deep link must only fire once, when the rows of the set are on screen
  const deepLinkDone = useRef(false)

  const seeded = useAtomValue(seededPersonalSetsAtom)
  const listPath = isNew ? '/my-sets' : customViewPath(CUSTOM_DICT_PREFIX + id) ?? '/my-sets'

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    getCustomDict(id)
      .then((record) => {
        if (cancelled) return
        if (!record) {
          // First start: My Vocabulary is still being created from the built-in set; this effect runs again when it is done
          if (isPersonalSeedPending(id, seeded)) return
          navigate('/my-sets', { replace: true })
          return
        }
        setName(record.name)
        setDescription(record.description)
        setRows(wordsToRows(record.words))
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : 'Could not load this set')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew, navigate, seeded])

  const changeRow = useCallback((index: number, patch: Partial<EditableRow>) => {
    setDirty(true)
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }, [])

  const removeRow = useCallback((index: number) => {
    setDirty(true)
    setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)))
  }, [])

  const moveRow = useCallback((index: number, delta: number) => {
    setDirty(true)
    setRows((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = prev.slice()
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }, [])

  const onChangeName = useCallback((value: string) => {
    setDirty(true)
    setName(value)
  }, [])

  const onChangeDescription = useCallback((value: string) => {
    setDirty(true)
    setDescription(value)
  }, [])

  // A new word goes to the top, out of the search filter and in view
  const addRow = useCallback(() => {
    setDirty(true)
    setRows((prev) => [emptyRow()].concat(prev))
    setQuery('')
    setShown(PAGE_SIZE)
    setFocusIndex(0)
  }, [])

  // A new search starts again from the first page
  useEffect(() => {
    setShown(PAGE_SIZE)
  }, [query])

  // The card that was asked for gets the focus, then is brought into view
  useEffect(() => {
    if (focusIndex === null) return
    const card = document.getElementById(`word-card-${focusIndex}`)
    if (card) card.scrollIntoView({ block: 'center' })
    setFocusIndex(null)
  }, [focusIndex])

  // ?word=<name> comes from the set page, so the named card is revealed and marked
  useEffect(() => {
    if (loading || deepLinkDone.current) return
    const wanted = (searchParams.get('word') ?? '').trim().toLowerCase()
    if (wanted === '') return
    deepLinkDone.current = true
    const target = rows.findIndex((row) => row.name.trim().toLowerCase() === wanted)
    if (target < 0) return
    if (query.trim() === '') setShown((prev) => (target + 1 > prev ? target + 1 : prev))
    setHighlightIndex(target)
  }, [loading, query, rows, searchParams])

  useEffect(() => {
    if (highlightIndex === null) return
    const card = document.getElementById(`word-card-${highlightIndex}`)
    if (card) card.scrollIntoView({ block: 'center' })
  }, [highlightIndex])

  useEffect(() => {
    if (highlightIndex === null) return
    const timer = window.setTimeout(() => setHighlightIndex(null), 2500)
    return () => window.clearTimeout(timer)
  }, [highlightIndex])

  // Losing the tab with unsaved edits asks first
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const onCancel = () => {
    if (dirty && !window.confirm('Discard your changes?')) return
    navigate(listPath)
  }

  const onSave = async () => {
    const problems: string[] = []
    if (!name.trim()) problems.push('Set name is required')
    const result = rowsToWords(rows)
    result.errors.forEach((error) => problems.push(`Row ${error.line}: ${error.message}`))
    if (result.words.length === 0 && result.errors.length === 0) problems.push('Add at least one word')
    setErrors(problems)
    if (problems.length > 0) return

    setSaving(true)
    try {
      if (isNew) {
        const record = await createCustomDict({ name, description, words: result.words })
        navigate(`/my-sets/${record.id}`)
      } else {
        await updateCustomDict(id, { name, description, words: result.words })
        navigate(`/my-sets/${id}`)
      }
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Failed to save'])
      setSaving(false)
    }
  }

  const issues = useMemo(() => rowIssues(rows), [rows])
  const indexes = useMemo(() => filterIndexes(rows, query), [rows, query])
  const isSearching = query.trim() !== ''
  const visible = indexes.slice(0, shown)
  const left = indexes.length - shown

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-10 md:px-8">
      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex items-center gap-x-3">
          <Link
            to={listPath}
            aria-label="Back"
            className="inline-flex min-h-[44px] items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <span aria-hidden>←</span>
            <span className="hidden sm:inline"> Back</span>
          </Link>
          <h1 className="text-xl font-semibold">{isNew ? 'New set' : 'Edit set'}</h1>
          {/* On a phone the counter and the badge would push the buttons onto a second line, so they only show from the sm breakpoint */}
          <span className="hidden text-sm text-muted-foreground sm:inline">{rows.length} words</span>
          {dirty && (
            <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary sm:inline">
              Unsaved changes
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={onSave}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
        <div className="relative mt-3">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="set-editor-search" className="sr-only">
            Search words in this set
          </label>
          <input
            id="set-editor-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search words in this set"
            aria-label="Search words in this set"
            className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {loadError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-destructive">{loadError}</p>
          <Button variant="outline" onClick={() => navigate('/my-sets')}>
            Back to my sets
          </Button>
        </div>
      ) : loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Panel className="p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="set-editor-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="set-editor-name"
                  value={name}
                  onChange={(e) => onChangeName(e.target.value)}
                  placeholder="Set name"
                  className={`${inputClass} h-11`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="set-editor-description" className={labelClass}>
                  Description (optional)
                </label>
                <input
                  id="set-editor-description"
                  value={description}
                  onChange={(e) => onChangeDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className={`${inputClass} h-11`}
                />
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Put one meaning per line. Phonetics and the detail are optional; the detail is shown on the back of flashcards.
            </p>
          </Panel>

          {errors.length > 0 && (
            <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ul className="list-disc pl-5">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Words</h2>
              <Button variant="outline" onClick={addRow}>
                Add word
              </Button>
            </div>

            {isSearching && (
              <p className="text-xs text-muted-foreground">
                Showing {shown < indexes.length ? shown : indexes.length} of {rows.length} words
              </p>
            )}

            {indexes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No words match &quot;{query}&quot;.</p>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {visible.map((wordIndex) => (
                    <WordEditorCard
                      key={wordIndex}
                      row={rows[wordIndex]}
                      index={wordIndex}
                      issue={issues[wordIndex]}
                      canMove={!isSearching}
                      isFirst={wordIndex === 0}
                      isLast={wordIndex === rows.length - 1}
                      autoFocus={focusIndex === wordIndex}
                      highlighted={highlightIndex === wordIndex}
                      onChange={changeRow}
                      onMove={moveRow}
                      onRemove={removeRow}
                    />
                  ))}
                </div>
                {indexes.length > shown && (
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={() => setShown(visibleCount(shown, indexes.length))}>
                      Show more ({left} left)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
