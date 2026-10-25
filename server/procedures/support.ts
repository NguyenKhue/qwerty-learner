import type { Db } from '../adapter'
import type { DictationService } from '../dictation/service'

/** Everything a handler needs: the database, the clock (the browser sends its own times) and the dictation jobs. */
export type Ctx = { db: Db; now: () => number; dictation?: DictationService }

/** A procedure handler: validates the raw arguments and returns the result of the contract. */
export type Handler = (ctx: Ctx, args: unknown[]) => unknown

export type ProcedureErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL'

/** An error the HTTP layer turns into the status code and error body of the contract. */
export class ProcedureError extends Error {
  readonly code: ProcedureErrorCode

  constructor(code: ProcedureErrorCode, message: string) {
    super(message)
    this.name = 'ProcedureError'
    this.code = code
  }
}

/** Throws the contract's BAD_REQUEST for an argument of the wrong shape. */
function badArgument(index: number, name: string, expected: string): never {
  throw new ProcedureError('BAD_REQUEST', `Argument ${index} (${name}) must be ${expected}`)
}

/** Reads a string argument. */
export function argString(args: unknown[], index: number, name: string): string {
  const value = args[index]
  if (typeof value !== 'string') return badArgument(index, name, 'a string')
  return value
}

/** Reads a finite number argument. */
export function argNumber(args: unknown[], index: number, name: string): number {
  const value = args[index]
  if (typeof value !== 'number' || !Number.isFinite(value)) return badArgument(index, name, 'a finite number')
  return value
}

/** Reads an optional finite number; `undefined` and `null` both mean absent. */
export function argOptionalNumber(args: unknown[], index: number, name: string): number | undefined {
  const value = args[index]
  if (value === undefined || value === null) return undefined
  return argNumber(args, index, name)
}

/** Reads a boolean argument. */
export function argBoolean(args: unknown[], index: number, name: string): boolean {
  const value = args[index]
  if (typeof value !== 'boolean') return badArgument(index, name, 'a boolean')
  return value
}

/** Reads an array argument. */
export function argArray(args: unknown[], index: number, name: string): unknown[] {
  const value = args[index]
  if (!Array.isArray(value)) return badArgument(index, name, 'an array')
  return value
}

/** Reads a non-null, non-array object argument. */
export function argObject(args: unknown[], index: number, name: string): Record<string, unknown> {
  const value = args[index]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return badArgument(index, name, 'an object')
  return value as Record<string, unknown>
}
