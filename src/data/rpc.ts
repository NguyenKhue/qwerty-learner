import { topicsOf } from './contract'
import type { DataErrorCode, ProcedureName, Procedures } from './contract'
import { notifyLocal, reportReachable, reportUnreachable } from './events'

const KNOWN_CODES: DataErrorCode[] = ['BAD_REQUEST', 'NOT_FOUND', 'CONFLICT', 'INTERNAL', 'UNREACHABLE']

export class DataError extends Error {
  readonly code: DataErrorCode

  constructor(code: DataErrorCode, message: string) {
    super(message)
    this.name = 'DataError'
    this.code = code
  }
}

/**
 * Calls one operation of the data server. A failure to reach the server is `UNREACHABLE`; an answer that is an error becomes a
 * `DataError` with the server's code. A successful write refreshes the screens that show the topics it changed.
 */
export async function call<N extends ProcedureName>(name: N, ...args: Procedures[N]['args']): Promise<Procedures[N]['result']> {
  const sent: unknown[] = [...args]
  // JSON turns an undefined into null: an omitted trailing argument is simply not sent
  while (sent.length > 0 && sent[sent.length - 1] === undefined) sent.pop()

  let response: Response
  try {
    response = await fetch(`/api/rpc/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ args: sent }),
    })
  } catch (error) {
    reportUnreachable()
    throw new DataError('UNREACHABLE', error instanceof Error ? error.message : 'The data server cannot be reached')
  }
  reportReachable()

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new DataError('INTERNAL', `The data server answered ${response.status} without a readable body`)
  }
  if (!response.ok) {
    const failure = (body as { error?: { code?: string; message?: string } } | null)?.error
    const code = KNOWN_CODES.indexOf(failure?.code as DataErrorCode) !== -1 ? (failure?.code as DataErrorCode) : 'INTERNAL'
    throw new DataError(code, failure?.message ?? `The data server answered ${response.status}`)
  }

  const topics = topicsOf(name, sent)
  if (topics.length > 0) notifyLocal(topics)
  return (body as { result: Procedures[N]['result'] }).result
}
