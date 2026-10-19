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
import { parseExamples } from '@/utils/examples/format'
import { cn } from '@/utils/ui'
import { memo, useEffect, useRef, useState } from 'react'
import IconChevronDown from '~icons/tabler/chevron-down'
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
  const [examplesOpen, setExamplesOpen] = useState(false)
  const hasDetail = (row.detail ?? '').trim() !== ''
  const exampleCount = parseExamples(row.examples ?? '').length

  useEffect(() => {
    if (autoFocus) wordRef.current?.focus()
  }, [autoFocus])

  return (
    <div
      id={`word-card-${index}`}
      className={cn(
        'rounded-xl border bg-card p-4 shadow-1 transition-[box-shadow,border-color] duration-base ease-out focus-within:shadow-2 sm:p-5',
        issue ? 'border-destructive' : highlighted ? 'border-primary ring-2 ring-primary' : 'border-border focus-within:border-primary/50',
        // Only the card that was just added pops in; every other card renders in place
        autoFocus && 'animate-pop',
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="num inline-flex h-7 min-w-[28px] items-center justify-center rounded-md bg-muted px-2 text-xs font-semibold text-muted-foreground">
          {index + 1}
        </span>
        {issue !== null && (
          <span role="alert" className="min-w-0 flex-1 text-sm text-destructive">
            {issue}
          </span>
        )}
        <div className="-my-1.5 ml-auto">
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
      </div>

      {/* The word and its phonetics on the left, the longer meanings text on the right */}
      <div className="grid gap-x-5 gap-y-4 md:grid-cols-5">
        <div className="flex flex-col gap-4 md:col-span-2">
          <Field label="Word" htmlFor={`word-${index}`}>
            <Input
              id={`word-${index}`}
              ref={wordRef}
              value={row.name}
              placeholder="Word"
              className="text-base font-medium"
              onChange={(e) => onChange(index, { name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
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
        </div>
        <div className="md:col-span-3">
          <Field label="Meanings (one per line)" htmlFor={`meanings-${index}`}>
            <Textarea
              id={`meanings-${index}`}
              value={row.trans}
              rows={5}
              placeholder="One meaning per line"
              onChange={(e) => onChange(index, { trans: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={`detail-${index}`}
        onClick={() => setOpen(!open)}
        className="mt-4 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 text-sm font-medium text-foreground transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2">
          {open ? 'Hide detail' : hasDetail ? 'Edit detail' : 'Add detail'}
          {hasDetail && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">has detail</span>}
        </span>
        <IconChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform duration-base ease-out', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div id={`detail-${index}`} className="mt-3">
          <Field label="Detail (shown on the back of flashcards)" htmlFor={`detail-text-${index}`}>
            <Textarea
              id={`detail-text-${index}`}
              value={row.detail ?? ''}
              rows={8}
              placeholder="A longer explanation shown on the back of flashcards"
              onChange={(e) => onChange(index, { detail: e.target.value })}
            />
          </Field>
        </div>
      )}

      <button
        type="button"
        aria-expanded={examplesOpen}
        aria-controls={`examples-${index}`}
        onClick={() => setExamplesOpen(!examplesOpen)}
        className="mt-4 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 text-sm font-medium text-foreground transition-colors duration-fast hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2">
          {examplesOpen ? 'Hide examples' : exampleCount > 0 ? 'Edit examples' : 'Add examples'}
          {exampleCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {exampleCount} {exampleCount === 1 ? 'example' : 'examples'}
            </span>
          )}
        </span>
        <IconChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform duration-base ease-out', examplesOpen && 'rotate-180')}
          aria-hidden
        />
      </button>

      {examplesOpen && (
        <div id={`examples-${index}`} className="mt-3">
          <Field label="Example sentences (one per line: sentence | translation)" htmlFor={`examples-text-${index}`}>
            <Textarea
              id={`examples-text-${index}`}
              value={row.examples ?? ''}
              rows={4}
              placeholder="Enabling strict mode helps catch mistakes. | Bật chế độ nghiêm ngặt giúp phát hiện lỗi."
              onChange={(e) => onChange(index, { examples: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  )
}

export default memo(WordEditorCard)
