import { handlers as cardsHandlers } from './cards'
import { handlers as metaHandlers } from './meta'
import { handlers as personalHandlers } from './personal'
import { handlers as reviewsHandlers } from './reviews'
import { handlers as setsHandlers } from './sets'
import type { Handler } from './support'
import { handlers as typingHandlers } from './typing'
import type { ProcedureName } from '@/data/contract'

export type { Ctx, Handler } from './support'
export { argArray, argBoolean, argNumber, argObject, argOptionalNumber, argString, ProcedureError } from './support'

/** Every procedure handler by name; `registry.test.ts` checks that none of the contract's names is missing. */
export const handlers: Partial<Record<ProcedureName, Handler>> = {
  ...cardsHandlers,
  ...setsHandlers,
  ...personalHandlers,
  ...typingHandlers,
  ...reviewsHandlers,
  ...metaHandlers,
}
