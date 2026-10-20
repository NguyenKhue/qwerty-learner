import type { LegacyCounts } from '../gate'

/** The database an older version of the app kept in the browser, and its tables in the order they are moved. */
export const LEGACY_DB = 'RecordDB'
export const LEGACY_TABLES = ['wordRecords', 'chapterRecords', 'reviewRecords', 'customDicts', 'cardProgress', 'reviewLog'] as const

/** Whether the browser has the old database: true or false when it can say, null in a browser that cannot list databases. */
async function legacyExists(): Promise<boolean | null> {
  const factory = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> }
  if (typeof factory.databases !== 'function') return null
  const list = await factory.databases()
  return list.some((entry) => entry.name === LEGACY_DB)
}

/**
 * Opens the old database with the plain IndexedDB API (no library), or returns null when this browser has none. Opening a database
 * that does not exist would create it, so it is looked for first, and where the browser cannot say, the creation step is aborted.
 */
export async function openLegacy(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null
  const exists = await legacyExists()
  if (exists === false) return null
  return new Promise<IDBDatabase | null>((resolve, reject) => {
    let existed = true
    const request = indexedDB.open(LEGACY_DB)
    request.onupgradeneeded = () => {
      existed = false
      request.transaction?.abort()
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => (existed ? reject(request.error) : resolve(null))
  })
}

function countStore(db: IDBDatabase, name: string): Promise<number> {
  if (!db.objectStoreNames.contains(name)) return Promise.resolve(0)
  return new Promise<number>((resolve, reject) => {
    const request = db.transaction(name, 'readonly').objectStore(name).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** The number of rows in each table of an open old database. */
export async function countLegacy(db: IDBDatabase): Promise<LegacyCounts> {
  const counts: LegacyCounts = {}
  for (const table of LEGACY_TABLES) counts[table] = await countStore(db, table)
  return counts
}

/** What this browser holds in the old database, or null when it has no such database or every table is empty. */
export async function detectLegacy(): Promise<LegacyCounts | null> {
  const db = await openLegacy()
  if (!db) return null
  try {
    const counts = await countLegacy(db)
    return LEGACY_TABLES.some((table) => counts[table] > 0) ? counts : null
  } finally {
    db.close()
  }
}
