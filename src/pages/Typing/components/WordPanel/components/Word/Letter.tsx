import { EXPLICIT_SPACE } from '@/constants'
import { fontSizeConfigAtom } from '@/store'
import { useAtomValue } from 'jotai'
import React from 'react'

export type LetterState = 'normal' | 'correct' | 'wrong'

const stateClassNameMap: Record<string, Record<LetterState, string>> = {
  true: {
    normal: 'text-muted-foreground',
    correct: 'text-green-400 dark:text-green-700',
    wrong: 'text-red-400 dark:text-red-600 animate-shake',
  },
  false: {
    normal: 'text-foreground',
    // Not only a different hue: wrong letters are underlined, and the light-theme green is dark enough for 3:1 against the page
    correct: 'text-green-700 dark:text-green-400',
    wrong: 'text-red-600 underline decoration-2 underline-offset-4 dark:text-red-400 animate-shake',
  },
}

export type LetterProps = {
  letter: string
  state?: LetterState
  visible?: boolean
}

const Letter: React.FC<LetterProps> = ({ letter, state = 'normal', visible = true }) => {
  const fontSizeConfig = useAtomValue(fontSizeConfigAtom)
  return (
    <span
      className={`m-0 p-0 font-mono font-normal ${
        stateClassNameMap[(letter === EXPLICIT_SPACE) as unknown as string][state]
      } pr-0.8 transition-colors duration-fast `}
      style={{ fontSize: fontSizeConfig.foreignFont.toString() + 'px' }}
    >
      {visible ? letter : '_'}
    </span>
  )
}

export default React.memo(Letter)
