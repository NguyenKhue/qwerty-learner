import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { rowsToWords } from '@/utils/custom-dict/parse'
import type { EditableRow } from '@/utils/custom-dict/parse'
import { createCustomDict, getCustomDict, updateCustomDict } from '@/utils/db/custom-dict'
import { memo, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const emptyRow = (): EditableRow => ({ name: '', trans: '', usphone: '', ukphone: '' })
const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900'
const gridClass = 'grid grid-cols-[2fr_4fr_1.5fr_1.5fr_auto] gap-2'

type RowEditorProps = {
  row: EditableRow
  index: number
  onChange: (index: number, patch: Partial<EditableRow>) => void
  onMove: (index: number, delta: number) => void
  onRemove: (index: number) => void
}

// Memoised so that typing in one row does not re-render thousands of rows in a large set
const RowEditor = memo(function RowEditor({ row, index, onChange, onMove, onRemove }: RowEditorProps) {
  return (
    <div className={`${gridClass} items-start`}>
      <input value={row.name} onChange={(e) => onChange(index, { name: e.target.value })} className={inputClass} />
      <textarea value={row.trans} rows={2} onChange={(e) => onChange(index, { trans: e.target.value })} className={inputClass} />
      <input value={row.usphone} onChange={(e) => onChange(index, { usphone: e.target.value })} className={inputClass} />
      <input value={row.ukphone} onChange={(e) => onChange(index, { ukphone: e.target.value })} className={inputClass} />
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => onMove(index, -1)} title="Move up">
          ↑
        </Button>
        <Button size="sm" variant="outline" onClick={() => onMove(index, 1)} title="Move down">
          ↓
        </Button>
        <Button size="sm" variant="outline" onClick={() => onRemove(index)} title="Remove row">
          ✕
        </Button>
      </div>
    </div>
  )
})

// Keyed by id so that moving between /my-sets/new and /my-sets/<id> (browser back/forward) starts from a clean editor
export default function SetEditorRoute() {
  const { id = 'new' } = useParams()
  return <SetEditor key={id} id={id} />
}

function SetEditor({ id }: { id: string }) {
  const isNew = id === 'new'
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<EditableRow[]>([emptyRow()])
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    getCustomDict(id)
      .then((record) => {
        if (cancelled) return
        if (!record) {
          navigate('/my-sets', { replace: true })
          return
        }
        setName(record.name)
        setDescription(record.description)
        setRows(record.words.map((w) => ({ name: w.name, trans: w.trans.join('\n'), usphone: w.usphone, ukphone: w.ukphone })))
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
  }, [id, isNew, navigate])

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

  const onCancel = () => {
    if (dirty && !window.confirm('Discard your changes?')) return
    navigate('/my-sets')
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
      if (isNew) await createCustomDict({ name, description, words: result.words })
      else await updateCustomDict(id, { name, description, words: result.words })
      navigate('/my-sets')
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Failed to save'])
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="flex w-full flex-1 flex-col items-center overflow-y-auto px-20 pb-10 pt-16">
        <div className="flex w-full max-w-5xl flex-col gap-4">
          <h1 className="text-2xl font-medium text-gray-800 dark:text-gray-200">{isNew ? 'New set' : 'Edit set'}</h1>
          {loadError ? (
            <>
              <p className="text-red-600">{loadError}</p>
              <div>
                <Button variant="outline" onClick={() => navigate('/my-sets')}>
                  Back to my sets
                </Button>
              </div>
            </>
          ) : loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={name}
                  onChange={(e) => {
                    setDirty(true)
                    setName(e.target.value)
                  }}
                  placeholder="Set name"
                  className={inputClass}
                />
                <input
                  value={description}
                  onChange={(e) => {
                    setDirty(true)
                    setDescription(e.target.value)
                  }}
                  placeholder="Description (optional)"
                  className={inputClass}
                />
              </div>

              <p className="text-sm text-gray-500">Put one meaning per line. Phonetics are optional.</p>
              <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <div className={`mb-2 ${gridClass} text-xs font-medium uppercase text-gray-500`}>
                  <span>Word</span>
                  <span>Meanings</span>
                  <span>US phonetic</span>
                  <span>UK phonetic</span>
                  <span />
                </div>
                <div className="flex flex-col gap-2">
                  {rows.map((row, index) => (
                    <RowEditor key={index} row={row} index={index} onChange={changeRow} onMove={moveRow} onRemove={removeRow} />
                  ))}
                </div>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDirty(true)
                      setRows((prev) => prev.concat(emptyRow()))
                    }}
                  >
                    Add word
                  </Button>
                </div>
              </div>

              {errors.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-red-600">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              )}

              <div className="flex gap-3">
                <Button disabled={saving} onClick={onSave}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
