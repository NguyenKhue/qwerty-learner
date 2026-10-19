import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { FileDrop } from '@/components/ui/file-drop'
import { Input } from '@/components/ui/input'
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

  // Several files at once: every file becomes its own set, named after the file; a file that cannot be read or has no valid word is skipped
  const onFiles = async (files: File[]) => {
    if (files.length === 1) return onFile(files[0])
    setReading(true)
    setResult(null)
    setWarning('')
    setMessage('')
    let created = 0
    const skipped: string[] = []
    for (const file of files) {
      try {
        const parsed = parseWordsFile(file.name, await file.text())
        if (parsed.words.length === 0) {
          skipped.push(file.name)
          continue
        }
        await createCustomDict({ name: file.name.replace(/\.[^.]+$/, ''), words: parsed.words })
        created += 1
      } catch {
        skipped.push(file.name)
      }
    }
    setMessage(
      `Created ${created} ${created === 1 ? 'set' : 'sets'}` +
        (skipped.length > 0 ? `; skipped ${skipped.length} (${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''})` : ''),
    )
    setReading(false)
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
    <Card className="flex w-full flex-col gap-4">
      <CardTitle>Import a set</CardTitle>
      <FileDrop accept=".csv,.json,text/csv,application/json" onFile={(file) => onFile(file)} onFiles={onFiles} disabled={reading} />
      <details className="text-sm">
        <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-medium text-primary marker:text-muted-foreground [&::-webkit-details-marker]:text-muted-foreground">
          Format help
        </summary>
        <p className="mt-2 text-sm text-muted-foreground">
          CSV with columns <code className="rounded bg-muted px-1 py-0.5 text-xs">name,trans,usphone,ukphone,detail</code> (separate
          meanings with <code className="rounded bg-muted px-1 py-0.5 text-xs">;</code>; the{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">detail</code> column is optional and may contain line breaks if the cell is
          quoted; the header row may name the columns in any order, including{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">detail</code>; the optional{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">examples</code> column holds one{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">sentence | translation</code> per line inside the cell, quoted if it has
          line breaks), or a JSON file in the same format as the built-in dictionaries (an optional{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">detail</code> string per word and an optional{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">examples</code> array of{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{ text, trans }'}</code>).
        </p>
      </details>
      {warning && <p className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>}

      {result && (
        <div className="space-y-3 text-sm text-foreground">
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
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Set name" className="max-w-xs" />
            <Button disabled={busy || result.words.length === 0 || !name.trim()} onClick={onCreate}>
              Create set
            </Button>
          </div>
        </div>
      )}
      {message && <p className="text-sm text-primary">{message}</p>}
    </Card>
  )
}
