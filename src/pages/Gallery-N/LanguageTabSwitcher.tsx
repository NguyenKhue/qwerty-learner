import { GalleryContext } from '.'
import type { LanguageCategoryType } from '@/typings'
import { RadioGroup } from '@headlessui/react'
import { useCallback, useContext } from 'react'

export type LanguageTabOption = {
  id: LanguageCategoryType
  name: string
}

const options: LanguageTabOption[] = [
  { id: 'en', name: 'English' },
  { id: 'ja', name: 'Japanese' },
  { id: 'de', name: 'German' },
  { id: 'kk', name: 'Kazakh' },
  { id: 'id', name: 'Indonesian' },
  { id: 'code', name: 'Code' },
]

export function LanguageTabSwitcher() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { state, setState } = useContext(GalleryContext)!

  const onChangeTab = useCallback(
    (tab: string) => {
      setState((draft) => {
        draft.currentLanguageTab = tab as LanguageCategoryType
      })
    },
    [setState],
  )

  return (
    <RadioGroup value={state.currentLanguageTab} onChange={onChangeTab}>
      <div className="flex gap-1 overflow-x-auto">
        {options.map((option) => (
          <RadioGroup.Option
            key={option.id}
            value={option.id}
            className="shrink-0 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {({ checked }) => (
              <div
                className={`flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium transition-colors duration-fast ${
                  checked ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {option.name}
              </div>
            )}
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  )
}
