import { ToolInputError } from './protocol'

/** Calls one procedure of the data server and resolves with its result. */
export type Rpc = (name: string, args: unknown[]) => Promise<unknown>

export function stringArg(args: Record<string, unknown>, name: string): string {
  const value = args[name]
  if (typeof value !== 'string' || value.trim() === '') throw new ToolInputError(`"${name}" must be a non-empty string`)
  return value
}

export function optionalString(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new ToolInputError(`"${name}" must be a string`)
  return value
}

export function indexArg(args: Record<string, unknown>, name: string): number {
  const value = args[name]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new ToolInputError(`"${name}" must be a whole number`)
  return value
}

/** A whole-number argument between 1 and `max`, or `fallback` when absent. */
export function limitArg(args: Record<string, unknown>, name: string, fallback: number, max: number): number {
  if (args[name] === undefined) return fallback
  const value = indexArg(args, name)
  if (value < 1 || value > max) throw new ToolInputError(`"${name}" must be from 1 to ${max}`)
  return value
}

export function stringListArg(args: Record<string, unknown>, name: string): string[] {
  const value = args[name]
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'string' && item.trim() !== '')) {
    throw new ToolInputError(`"${name}" must be a non-empty list of strings`)
  }
  return value as string[]
}

/** The JSON Schema of a tool input: an object with these properties, nothing else. */
export const schema = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})

/** A time in ms as an ISO string, or null for none. */
export const iso = (ms: number | null | undefined): string | null => (typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : null)
