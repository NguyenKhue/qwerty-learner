import { DEFAULT_NEW_PER_DAY } from '@/utils/srs/queue'
import { atomWithStorage } from 'jotai/utils'

/** How many new cards a day may be introduced. Always pass the value through `sanitizeNewPerDay` before using it. */
export const newCardsPerDayAtom = atomWithStorage<number>('srsNewPerDay', DEFAULT_NEW_PER_DAY)

/** When true the front of a card shows the meaning and the back shows the word. */
export const studyReverseAtom = atomWithStorage<boolean>('srsReverse', false)
