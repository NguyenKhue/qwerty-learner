import styles from './index.module.css'
import { isIgnoreCaseAtom, isShowAnswerOnHoverAtom, isShowPrevAndNextWordAtom, isTextSelectableAtom, randomConfigAtom } from '@/store'
import { Switch } from '@headlessui/react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useAtom } from 'jotai'
import { useCallback } from 'react'

export default function AdvancedSetting() {
  const [randomConfig, setRandomConfig] = useAtom(randomConfigAtom)
  const [isShowPrevAndNextWord, setIsShowPrevAndNextWord] = useAtom(isShowPrevAndNextWordAtom)
  const [isIgnoreCase, setIsIgnoreCase] = useAtom(isIgnoreCaseAtom)
  const [isTextSelectable, setIsTextSelectable] = useAtom(isTextSelectableAtom)
  const [isShowAnswerOnHover, setIsShowAnswerOnHover] = useAtom(isShowAnswerOnHoverAtom)

  const onToggleRandom = useCallback(
    (checked: boolean) => {
      setRandomConfig((prev) => ({
        ...prev,
        isOpen: checked,
      }))
    },
    [setRandomConfig],
  )

  const onToggleLastAndNextWord = useCallback(
    (checked: boolean) => {
      setIsShowPrevAndNextWord(checked)
    },
    [setIsShowPrevAndNextWord],
  )

  const onToggleIgnoreCase = useCallback(
    (checked: boolean) => {
      setIsIgnoreCase(checked)
    },
    [setIsIgnoreCase],
  )

  const onToggleTextSelectable = useCallback(
    (checked: boolean) => {
      setIsTextSelectable(checked)
    },
    [setIsTextSelectable],
  )
  const onToggleShowAnswerOnHover = useCallback(
    (checked: boolean) => {
      setIsShowAnswerOnHover(checked)
    },
    [setIsShowAnswerOnHover],
  )

  return (
    <ScrollArea.Root className="flex-1 select-none overflow-y-auto ">
      <ScrollArea.Viewport className="h-full w-full px-3">
        <div className="flex w-full flex-col items-start justify-start overflow-y-auto pb-40 pl-6 pr-9 pt-8">
          <div className="flex w-full flex-col items-start gap-4 border-b border-border py-3 last:border-0">
            <span className="text-sm font-medium text-foreground">Shuffle words</span>
            <span className="text-sm text-muted-foreground">
              When enabled, the words in each chapter are shuffled randomly. Takes effect from the next chapter
            </span>
            <div className={styles.switchBlock}>
              <Switch checked={randomConfig.isOpen} onChange={onToggleRandom} className="switch-root">
                <span aria-hidden="true" className="switch-thumb" />
              </Switch>
              <span className="text-right text-xs font-normal leading-tight text-muted-foreground">{`Shuffle ${
                randomConfig.isOpen ? 'on' : 'off'
              }`}</span>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4 border-b border-border py-3 last:border-0">
            <span className="text-sm font-medium text-foreground">Show the previous / next word while practicing</span>
            <span className="text-sm text-muted-foreground">When enabled, the previous / next word is shown above during practice</span>
            <div className={styles.switchBlock}>
              <Switch checked={isShowPrevAndNextWord} onChange={onToggleLastAndNextWord} className="switch-root">
                <span aria-hidden="true" className="switch-thumb" />
              </Switch>
              <span className="text-right text-xs font-normal leading-tight text-muted-foreground">{`Word preview ${
                isShowPrevAndNextWord ? 'on' : 'off'
              }`}</span>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4 border-b border-border py-3 last:border-0">
            <span className="text-sm font-medium text-foreground">Ignore case</span>
            <span className="text-sm text-muted-foreground">
              When enabled, typing is case-insensitive, so both &quot;hello&quot; and &quot;Hello&quot; are counted as correct
            </span>
            <div className={styles.switchBlock}>
              <Switch checked={isIgnoreCase} onChange={onToggleIgnoreCase} className="switch-root">
                <span aria-hidden="true" className="switch-thumb" />
              </Switch>
              <span className="text-right text-xs font-normal leading-tight text-muted-foreground">{`Ignore case ${
                isIgnoreCase ? 'on' : 'off'
              }`}</span>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4 border-b border-border py-3 last:border-0">
            <span className="text-sm font-medium text-foreground">Allow text selection</span>
            <span className="text-sm text-muted-foreground">When enabled, you can select text with the mouse </span>
            <div className={styles.switchBlock}>
              <Switch checked={isTextSelectable} onChange={onToggleTextSelectable} className="switch-root">
                <span aria-hidden="true" className="switch-thumb" />
              </Switch>
              <span className="text-right text-xs font-normal leading-tight text-muted-foreground">{`Text selection ${
                isTextSelectable ? 'on' : 'off'
              }`}</span>
            </div>
          </div>
          <div className="flex w-full flex-col items-start gap-4 border-b border-border py-3 last:border-0">
            <span className="text-sm font-medium text-foreground">Show hints in dictation mode</span>
            <span className="text-sm text-muted-foreground">
              When enabled, hover over a word with the mouse to reveal the correct answer{' '}
            </span>
            <div className={styles.switchBlock}>
              <Switch checked={isShowAnswerOnHover} onChange={onToggleShowAnswerOnHover} className="switch-root">
                <span aria-hidden="true" className="switch-thumb" />
              </Switch>
              <span className="text-right text-xs font-normal leading-tight text-muted-foreground">{`Hints ${
                isShowAnswerOnHover ? 'on' : 'off'
              }`}</span>
            </div>
          </div>
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent " orientation="vertical"></ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}
