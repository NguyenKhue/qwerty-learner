export type Batch = { rows: Record<string, unknown>[]; lastKey: IDBValidKey | undefined }

/**
 * Reads up to `size` rows of a table, in key order, starting after `after`. A new transaction is used for each batch, and the rows are
 * collected without waiting for anything else, so the transaction cannot end early however slowly the rows are uploaded.
 */
export function readBatch(db: IDBDatabase, table: string, after: IDBValidKey | undefined, size: number): Promise<Batch> {
  return new Promise<Batch>((resolve, reject) => {
    if (!db.objectStoreNames.contains(table)) {
      resolve({ rows: [], lastKey: undefined })
      return
    }
    const rows: Record<string, unknown>[] = []
    let lastKey: IDBValidKey | undefined
    const range = after === undefined ? undefined : IDBKeyRange.lowerBound(after, true)
    const request = db.transaction(table, 'readonly').objectStore(table).openCursor(range)
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor || rows.length >= size) {
        resolve({ rows, lastKey })
        return
      }
      rows.push(cursor.value as Record<string, unknown>)
      lastKey = cursor.primaryKey
      cursor.continue()
    }
    request.onerror = () => reject(request.error)
  })
}
