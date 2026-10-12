import { Button } from '@/components/ui/button'
import { parseWordsFile } from '@/utils/custom-dict/parse'
import type { ParseResult } from '@/utils/custom-dict/parse'
import { createCustomDict } from '@/utils/db/custom-dict'
import { useState } from 'react'

const MAX_LISTED_ERRORS = 20

export default function ImportPanel() {
  const [name, setName] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setName(file.name.replace(/\.[^.]+$/, ''))
    setResult(parseWordsFile(file.name, text))
    setMessage('')
  }

  const onCreate = async () => {
    if (!result || result.words.length === 0 || !name.trim()) return
    setBusy(true)
    try {
      await createCustomDict({ name, words: result.words })
      setMessage(`Created "${name.trim()}" with ${result.words.length} words`)
      setResult(null)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="w-full rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <h2 className="mb-1 text-lg font-medium text-gray-800 dark:text-gray-200">Import a set</h2>
      <p className="mb-4 text-sm text-gray-500">
        CSV with columns <code>name,trans,usphone,ukphone</code> (separate meanings with <code>;</code>), or a JSON file in the same format
        as the built-in dictionaries.
      </p>
      <input
        type="file"
        accept=".csv,.json,text/csv,application/json"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
        className="text-sm text-gray-700 dark:text-gray-300"
      />

      {result && (
        <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <p>
            {result.words.length} valid words, {result.errors.length} skipped rows
            {result.duplicates.length > 0 && `, ${result.duplicates.length} duplicate words merged`}.
          </p>
          {result.errors.length > 0 && (
            <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-red-600">
              {result.errors.slice(0, MAX_LISTED_ERRORS).map((error, i) => (
                <li key={i}>
                  Row {error.line}: {error.message}
                </li>
              ))}
              {result.errors.length > MAX_LISTED_ERRORS && <li>…and {result.errors.length - MAX_LISTED_ERRORS} more</li>}
            </ul>
          )}
          <div className="flex items-center gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Set name"
              className="w-64 rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
            />
            <Button disabled={busy || result.words.length === 0 || !name.trim()} onClick={onCreate}>
              Create set
            </Button>
          </div>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-indigo-600">{message}</p>}
    </section>
  )
}
