import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
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
    <Card className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <CardTitle>Copy a built-in dictionary</CardTitle>
        <p className="text-sm text-muted-foreground">Built-in dictionaries cannot be edited. Copy one into your sets to edit it.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {groups.map(([category, dicts]) => (
              <optgroup key={category} label={category}>
                {dicts.map((dict) => (
                  <option key={dict.id} value={dict.id}>
                    {dict.name} ({dict.length})
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <Button disabled={busy || !selectedId} onClick={onCopy}>
          {busy ? 'Copying…' : 'Copy'}
        </Button>
      </div>
      {message && <p className="text-sm text-primary">{message}</p>}
    </Card>
  )
}
