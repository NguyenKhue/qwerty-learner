import { TypingContext } from '../../store'
import InfoBox from './InfoBox'
import { useContext } from 'react'

export default function Speed() {
  // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
  const { state } = useContext(TypingContext)!
  const seconds = state.timerData.time % 60
  const minutes = Math.floor(state.timerData.time / 60)
  const secondsString = seconds < 10 ? '0' + seconds : seconds + ''
  const minutesString = minutes < 10 ? '0' + minutes : minutes + ''
  const inputNumber = state.chapterData.correctCount + state.chapterData.wrongCount

  return (
    <div className="flex w-3/5 gap-3 opacity-50 transition-opacity duration-base">
      <InfoBox info={`${minutesString}:${secondsString}`} description="Time" />
      <InfoBox info={inputNumber + ''} description="Inputs" />
      <InfoBox info={state.timerData.wpm + ''} description="WPM" />
      <InfoBox info={state.chapterData.correctCount + ''} description="Correct" />
      <InfoBox info={state.timerData.accuracy + ''} description="Accuracy" />
    </div>
  )
}
