import DetailText from '@/components/DetailText'
import { WordPronunciationIcon } from '@/components/WordPronunciationIcon'
import type { Word } from '@/typings'
import { memo, useState } from 'react'
import IconPencil from '~icons/tabler/pencil'

type WordCardProps = {
  word: Word
  onEdit: () => void
}

function WordCard({ word, onEdit }: WordCardProps) {
  const [open, setOpen] = useState(false)
  const phonetic = word.usphone || word.ukphone

  return (
    <div className="relative rounded-xl border border-border bg-card p-4 shadow-1 md:p-5">
      <button
        type="button"
        aria-label={`Edit ${word.name}`}
        onClick={onEdit}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconPencil className="h-5 w-5" aria-hidden />
      </button>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* pr-10 keeps a long word away from the pencil button in the corner */}
        <div className="min-w-0 pr-10">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">{word.name}</span>
            <WordPronunciationIcon word={word} lang="en" iconClassName="h-5 w-5" />
          </div>
          {phonetic && <p className="mt-1 text-sm text-muted-foreground">[{phonetic}]</p>}
        </div>
        <div className="min-w-0">
          <ul className="space-y-1 text-sm text-foreground">
            {word.trans.map((meaning, index) => (
              <li key={index}>{meaning}</li>
            ))}
          </ul>
        </div>
      </div>

      {word.detail && (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary hover:underline"
          >
            {open ? 'Hide detail' : 'Show detail'}
          </button>
          {open && (
            <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3">
              <DetailText text={word.detail} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(WordCard)
