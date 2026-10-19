import WordEditorCard from './WordEditorCard'
import { Panel } from '@/components/ModePage'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { seededPersonalSetsAtom } from '@/store/personal'
import { rowIssues } from '@/utils/custom-dict/issues'
import { rowsToWords, wordsToRows } from '@/utils/custom-dict/parse'
import type { EditableRow } from '@/utils/custom-dict/parse'
import { PAGE_SIZE, filterIndexes, visibleCount } from '@/utils/custom-dict/search'
import { CUSTOM_DICT_PREFIX, createCustomDict, customViewPath, getCustomDict, updateCustomDict } from '@/utils/db/custom-dict'
import { isPersonalSeedPending } from '@/utils/db/personal-seed'
import { useAtomValue } from 'jotai'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import IconPlus from '~icons/tabler/plus'
import IconSearch from '~icons/tabler/search'

// The key keeps each card's own state (detail open, pop-in) with its word when a word is inserted above it
type Row = EditableRow & { key: number }

let nextKey = 0
const withKey = (row: EditableRow): Row => ({ ...row, key: nextKey++ })
const emptyRow = (): Row => withKey({ name: '', trans: '', usphone: '', ukphone: '', detail: '', examples: '' })

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
  const [rows, setRows] = useState<Row[]>([emptyRow()])
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
        setRows(wordsToRows(record.words).map(withKey))
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

  // A new word goes in at the given position, in view and focused
  const insertRow = useCallback((at: number) => {
    setDirty(true)
    setRows((prev) => [...prev.slice(0, at), emptyRow(), ...prev.slice(at)])
    setShown((prev) => (at + 1 > prev ? at + 1 : prev))
    setFocusIndex(at)
  }, [])

  // The top button also leaves the search filter, so the new word is not hidden by it
  const addRow = useCallback(() => {
    setQuery('')
    setShown(PAGE_SIZE)
    insertRow(0)
  }, [insertRow])

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
      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            to={listPath}
            aria-label="Back"
            className="inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground transition-colors duration-fast hover:text-foreground"
          >
            <span aria-hidden>←</span>
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="text-heading">{isNew ? 'New set' : 'Edit set'}</h1>
            {/* On a phone the counter and the badge would push the buttons onto a second line, so they only show from the sm breakpoint */}
            <span className="num hidden text-sm text-muted-foreground sm:inline">{rows.length} words</span>
          </div>
          {dirty && (
            <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary lg:inline">
              Unsaved changes
            </span>
          )}
          <div className="relative order-last w-full md:order-none md:ml-auto md:w-64">
            <IconSearch
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <label htmlFor="set-editor-search" className="sr-only">
              Search words in this set
            </label>
            <Input
              id="set-editor-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search words in this set"
              aria-label="Search words in this set"
              className="pl-10"
            />
          </div>
          <div className="ml-auto flex gap-2 md:ml-0">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={onSave}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
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
              <Field label="Name" htmlFor="set-editor-name">
                <Input id="set-editor-name" value={name} onChange={(e) => onChangeName(e.target.value)} placeholder="Set name" />
              </Field>
              <Field label="Description (optional)" htmlFor="set-editor-description">
                <Input
                  id="set-editor-description"
                  value={description}
                  onChange={(e) => onChangeDescription(e.target.value)}
                  placeholder="Description (optional)"
                />
              </Field>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Put one meaning per line. Phonetics, the detail and example sentences are optional; the detail is shown on the back of
              flashcards and example sentences are shown on the set page.
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
                <div className="flex flex-col">
                  {visible.map((wordIndex, i) => (
                    <Fragment key={rows[wordIndex].key}>
                      {/* While searching the cards are not neighbours in the list, so there is nowhere clear to insert */}
                      {i > 0 && !isSearching ? <InsertGap at={wordIndex} onInsert={insertRow} /> : i > 0 && <div className="h-3" />}
                      <WordEditorCard
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
                    </Fragment>
                  ))}
                  {!isSearching && (
                    <button
                      type="button"
                      onClick={() => insertRow(visible[visible.length - 1] + 1)}
                      className="mt-3 flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground transition-colors duration-fast hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <IconPlus className="h-4 w-4" aria-hidden />
                      {indexes.length > shown ? `Add word after word ${shown}` : 'Add word at the end'}
                    </button>
                  )}
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

// The space between two cards: a faint line that shows an insert button on hover or keyboard focus,
// always visible on touch screens where there is no hover
function InsertGap({ at, onInsert }: { at: number; onInsert: (at: number) => void }) {
  return (
    <div className="group relative z-10 -my-2.5 flex h-8 items-center justify-center">
      <div
        aria-hidden
        className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-primary/40 opacity-0 transition-opacity duration-fast group-focus-within:opacity-100 group-hover:opacity-100"
      />
      <button
        type="button"
        onClick={() => onInsert(at)}
        aria-label={`Insert a word before word ${at + 1}`}
        title="Insert a word here"
        className="relative inline-flex h-7 items-center gap-1 rounded-full border border-primary/40 bg-background px-2.5 text-xs font-medium text-primary opacity-0 shadow-1 transition-opacity duration-fast hover:bg-primary/10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 [@media(hover:none)]:opacity-60"
      >
        <IconPlus className="h-3.5 w-3.5" aria-hidden />
        Insert
      </button>
    </div>
  )
}
