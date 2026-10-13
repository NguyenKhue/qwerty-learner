import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { EditableRow } from '@/utils/custom-dict/parse'
import { cn } from '@/utils/ui'
import { memo, useEffect, useRef, useState } from 'react'
import IconDots from '~icons/tabler/dots'

type WordEditorCardProps = {
  row: EditableRow
  index: number
  issue: string | null
  canMove: boolean
  isFirst: boolean
  isLast: boolean
  autoFocus?: boolean
  highlighted?: boolean
  onChange: (index: number, patch: Partial<EditableRow>) => void
  onMove: (index: number, delta: number) => void
  onRemove: (index: number) => void
}

function WordEditorCard({
  row,
  index,
  issue,
  canMove,
  isFirst,
  isLast,
  autoFocus,
  highlighted,
  onChange,
  onMove,
  onRemove,
}: WordEditorCardProps) {
  const wordRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const hasDetail = (row.detail ?? '').trim() !== ''

  useEffect(() => {
    if (autoFocus) wordRef.current?.focus()
  }, [autoFocus])

  return (
    <div
      id={`word-card-${index}`}
      className={cn(
        'rounded-xl border bg-card p-4 shadow-1 transition-shadow',
        issue ? 'border-destructive' : highlighted ? 'ring-2 ring-primary' : 'border-border',
        // Only the card that was just added pops in; every other card renders in place
        autoFocus && 'animate-pop',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
          {issue !== null && (
            <span role="alert" className="text-sm text-destructive">
              {issue}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for word ${index + 1}`}>
              <IconDots className="h-5 w-5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem disabled={!canMove || isFirst} onSelect={() => onMove(index, -1)}>
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canMove || isLast} onSelect={() => onMove(index, 1)}>
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onSelect={() => onRemove(index)}>
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Word" htmlFor={`word-${index}`}>
          <Input
            id={`word-${index}`}
            ref={wordRef}
            value={row.name}
            placeholder="Word"
            onChange={(e) => onChange(index, { name: e.target.value })}
          />
        </Field>
        <Field label="Meanings (one per line)" htmlFor={`meanings-${index}`}>
          <Textarea
            id={`meanings-${index}`}
            value={row.trans}
            rows={3}
            placeholder="One meaning per line"
            onChange={(e) => onChange(index, { trans: e.target.value })}
          />
        </Field>
        <Field label="US phonetic" htmlFor={`us-${index}`}>
          <Input
            id={`us-${index}`}
            value={row.usphone}
            placeholder="US phonetic"
            onChange={(e) => onChange(index, { usphone: e.target.value })}
          />
        </Field>
        <Field label="UK phonetic" htmlFor={`uk-${index}`}>
          <Input
            id={`uk-${index}`}
            value={row.ukphone}
            placeholder="UK phonetic"
            onChange={(e) => onChange(index, { ukphone: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`detail-${index}`}
          onClick={() => setOpen(!open)}
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary hover:underline"
        >
          {open ? 'Hide detail' : hasDetail ? 'Edit detail' : 'Add detail'}
        </button>
        {hasDetail && <span className="text-xs text-primary">• has detail</span>}
      </div>

      {open && (
        <div className="mt-1">
          <Field label="Detail (shown on the back of flashcards)" htmlFor={`detail-${index}`}>
            <Textarea
              id={`detail-${index}`}
              value={row.detail ?? ''}
              rows={8}
              placeholder="A longer explanation shown on the back of flashcards"
              onChange={(e) => onChange(index, { detail: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  )
}

export default memo(WordEditorCard)
