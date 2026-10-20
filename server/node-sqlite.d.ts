// @types/node 18 predates `node:sqlite`; this is the part of its API the adapter uses (Node 22.13 or newer).
declare module 'node:sqlite' {
  export type SQLInputValue = null | number | bigint | string | Uint8Array
  export class StatementSync {
    run(...params: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint }
    get(...params: SQLInputValue[]): Record<string, unknown> | undefined
    all(...params: SQLInputValue[]): Record<string, unknown>[]
  }
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
}
