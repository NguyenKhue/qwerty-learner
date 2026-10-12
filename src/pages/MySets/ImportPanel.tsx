import { Panel } from '@/components/ModePage'
import { Button } from '@/components/ui/button'
import { hasReplacementChars, parseWordsFile } from '@/utils/custom-dict/parse'
import type { ParseResult } from '@/utils/custom-dict/parse'
import { createCustomDict } from '@/utils/db/custom-dict'
import { useState } from 'react'

const MAX_LISTED_ERRORS = 20

export default function ImportPanel() {
  const [name, setName] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [warning, setWarning] = useState('')
  const [reading, setReading] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setReading(true)
    setMessage('')
    try {
      const text = await file.text()
      setName(file.name.replace(/\.[^.]+$/, ''))
      setResult(parseWordsFile(file.name, text))
      setWarning(
        hasReplacementChars(text)
          ? 'This file does not look like UTF-8 (some characters could not be read). In Excel choose "CSV UTF-8" when saving, then import again.'
          : '',
      )
    } catch (e) {
      setResult(null)
      setWarning('')
      setMessage(e instanceof Error ? e.message : 'Could not read the file')
    } finally {
      setReading(false)
    }
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
    <Panel className="w-full">
      <h2 className="mb-1 text-lg font-medium">Import a set</h2>
      <p className="mb-4 text-sm text-muted-foreground">
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
        disabled={reading}
        className="text-sm text-foreground"
      />
      {warning && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">{warning}</p>}

      {result && (
        <div className="mt-4 space-y-3 text-sm text-foreground">
          <p>
            {result.words.length} valid words, {result.errors.length} skipped rows
            {result.duplicates.length > 0 && `, ${result.duplicates.length} duplicate words merged`}.
          </p>
          {result.errors.length > 0 && (
            <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-destructive">
              {result.errors.slice(0, MAX_LISTED_ERRORS).map((error, i) => (
                <li key={i}>
                  Row {error.line}: {error.message}
                </li>
              ))}
              {result.errors.length > MAX_LISTED_ERRORS && <li>…and {result.errors.length - MAX_LISTED_ERRORS} more</li>}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Set name"
              className="h-11 w-full max-w-xs rounded-lg border border-border bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button disabled={busy || result.words.length === 0 || !name.trim()} onClick={onCreate}>
              Create set
            </Button>
          </div>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-primary">{message}</p>}
    </Panel>
  )
}
