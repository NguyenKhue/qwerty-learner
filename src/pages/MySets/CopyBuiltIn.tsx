import { Button } from '@/components/ui/button'
import { dictionaries } from '@/resources/dictionary'
import { duplicateDictionaryAsCustom } from '@/utils/db/copy-dict'
import groupBy from '@/utils/groupBy'
import { useMemo, useState } from 'react'

export default function CopyBuiltIn() {
  const englishDicts = useMemo(() => dictionaries.filter((dict) => dict.language === 'en'), [])
  const groups = useMemo(() => Object.entries(groupBy(englishDicts, (dict) => dict.category)), [englishDicts])
  const [selectedId, setSelectedId] = useState(englishDicts[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const onCopy = async () => {
    const dict = englishDicts.find((d) => d.id === selectedId)
    if (!dict) return
    setBusy(true)
    setMessage('')
    try {
      const record = await duplicateDictionaryAsCustom(dict)
      setMessage(`Copied "${dict.name}" into "${record.name}" (${record.words.length} words)`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Copy failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="w-full rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <h2 className="mb-1 text-lg font-medium text-gray-800 dark:text-gray-200">Copy a built-in dictionary</h2>
      <p className="mb-4 text-sm text-gray-500">Built-in dictionaries cannot be edited. Copy one into your sets to edit it.</p>
      <div className="flex items-center gap-3">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-80 rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
        >
          {groups.map(([category, dicts]) => (
            <optgroup key={category} label={category}>
              {dicts.map((dict) => (
                <option key={dict.id} value={dict.id}>
                  {dict.name} ({dict.length})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Button disabled={busy || !selectedId} onClick={onCopy}>
          {busy ? 'Copying…' : 'Copy'}
        </Button>
      </div>
      {message && <p className="mt-3 text-sm text-indigo-600">{message}</p>}
    </section>
  )
}
