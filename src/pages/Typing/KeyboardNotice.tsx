import { buildNavItems } from '@/components/AppShell/navItems'
import { currentDictInfoAtom } from '@/store'
import { useAtomValue } from 'jotai'
import { Link } from 'react-router-dom'

export default function KeyboardNotice() {
  const dict = useAtomValue(currentDictInfoAtom)
  const modes = buildNavItems(dict.id).filter((item) => item.id === 'study' || item.id === 'quiz' || item.id === 'match')
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        <h2 className="text-lg font-semibold text-card-foreground">Typing needs a keyboard</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Typing practice works best with a physical keyboard. On a phone you can use Flashcards, Quiz and Match.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {modes.map((mode) => (
            <Link
              key={mode.id}
              to={mode.to}
              className="flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {mode.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
