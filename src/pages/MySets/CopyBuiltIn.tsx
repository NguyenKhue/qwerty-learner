import { Panel } from '@/components/ModePage'
import { Button } from '@/components/ui/button'
import { dictionaries } from '@/resources/dictionary'
import { seededPersonalSetsAtom } from '@/store/personal'
import { duplicateDictionaryAsCustom } from '@/utils/db/copy-dict'
import groupBy from '@/utils/groupBy'
import { useAtomValue } from 'jotai'
import { useMemo, useState } from 'react'

export default function CopyBuiltIn() {
  const moved = useAtomValue(seededPersonalSetsAtom)
  const englishDicts = useMemo(() => dictionaries.filter((dict) => dict.language === 'en' && moved.indexOf(dict.id) === -1), [moved])
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
    <Panel className="w-full">
      <h2 className="mb-1 text-lg font-medium">Copy a built-in dictionary</h2>
      <p className="mb-4 text-sm text-muted-foreground">Built-in dictionaries cannot be edited. Copy one into your sets to edit it.</p>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-11 w-full max-w-xs rounded-lg border border-border bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      {message && <p className="mt-3 text-sm text-primary">{message}</p>}
    </Panel>
  )
}
