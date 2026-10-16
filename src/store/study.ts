import { DEFAULT_NEW_PER_DAY } from '@/utils/srs/queue'
import type { ExtraNew } from '@/utils/srs/queue'
import { atomWithStorage } from 'jotai/utils'

/** How many new cards a day may be introduced. Always pass the value through `sanitizeNewPerDay` before using it. */
export const newCardsPerDayAtom = atomWithStorage<number>('srsNewPerDay', DEFAULT_NEW_PER_DAY)

/** When true the front of a card shows the meaning and the back shows the word. */
export const studyReverseAtom = atomWithStorage<boolean>('srsReverse', false)

/** Per set: extra new cards asked for today with "Learn more". Read it through `extraNewToday`, so an old day counts as none. */
export const extraNewCardsAtom = atomWithStorage<Record<string, ExtraNew>>('srsExtraNew', {})
