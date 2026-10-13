import { TypingContext } from '../../store'
import { useContext, useEffect, useState } from 'react'

export default function Progress({ className }: { className?: string }) {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState(0)

  const colorSwitcher: { [key: number]: string } = {
    0: 'bg-primary/40',
    1: 'bg-primary/70',
    2: 'bg-primary',
  }

  useEffect(() => {
    const newProgress = Math.floor((state.chapterData.index / state.chapterData.words.length) * 100)
    setProgress(newProgress)
    const colorPhase = Math.floor(newProgress / 33.4)
    setPhase(colorPhase)
  }, [state.chapterData.index, state.chapterData.words.length])

  return (
    <div className={`relative w-1/4 pt-1 ${className}`}>
      <div className="mb-4 flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          style={{ transform: `scaleX(${progress / 100})` }}
          className={`h-full w-full origin-left rounded-full transition-transform duration-base ease-out ${
            colorSwitcher[phase] ?? 'bg-primary/40'
          }`}
        ></div>
      </div>
    </div>
  )
}
