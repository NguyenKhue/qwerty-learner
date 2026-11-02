import { TypingContext, TypingStateActionType } from '../../store'
import HandPositionIllustration from '../HandPositionIllustration'
import LoopWordSwitcher from '../LoopWordSwitcher'
import Setting from '../Setting'
import SoundSwitcher from '../SoundSwitcher'
import WordDictationSwitcher from '../WordDictationSwitcher'
import Tooltip from '@/components/Tooltip'
import { CTRL } from '@/utils'
import { useContext } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import IconLanguage from '~icons/tabler/language'
import IconLanguageOff from '~icons/tabler/language-off'

function Divider() {
  return <span aria-hidden className="mx-1 h-6 w-px bg-border" />
}

export default function Switcher() {
  const { state, dispatch } = useContext(TypingContext) ?? {}

  const changeTransVisibleState = () => {
    if (dispatch) {
      dispatch({ type: TypingStateActionType.TOGGLE_TRANS_VISIBLE })
    }
  }

  useHotkeys(
    'ctrl+shift+v',
    () => {
      changeTransVisibleState()
    },
    { enableOnFormTags: true, preventDefault: true },
    [],
  )

  return (
    <div className="flex items-center justify-center gap-1">
      <Divider />
      <Tooltip content="Sound settings">
        <SoundSwitcher />
      </Tooltip>

      <Tooltip content="Loop a single word">
        <LoopWordSwitcher />
      </Tooltip>

      <Tooltip content={`Toggle dictation mode (${CTRL} + V)`}>
        <WordDictationSwitcher />
      </Tooltip>
      <Tooltip content={`Toggle definition display (${CTRL} + Shift + V)`}>
        <button
          className={`flex h-9 w-9 items-center justify-center rounded-md ${
            state?.isTransVisible ? 'text-primary' : 'text-muted-foreground'
          } text-lg transition-colors duration-300 ease-in-out hover:bg-primary hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          type="button"
          onClick={(e) => {
            changeTransVisibleState()
            e.currentTarget.blur()
          }}
          aria-label={`Toggle definition display (${CTRL} + Shift + V)`}
        >
          {state?.isTransVisible ? <IconLanguage /> : <IconLanguageOff />}
        </button>
      </Tooltip>

      <Divider />
      <Tooltip content="Hand position guide">
        <HandPositionIllustration></HandPositionIllustration>
      </Tooltip>
      <Tooltip content="Settings">
        <Setting />
      </Tooltip>
      <Divider />
    </div>
  )
}
