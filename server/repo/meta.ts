import type { Db } from '../adapter'

/** Every flag in the file as a plain object. */
export function getAll(db: Db): Record<string, string> {
  const result: Record<string, string> = {}
  for (const row of db.all<{ key: string; value: string }>('SELECT key, value FROM meta ORDER BY key')) result[row.key] = row.value
  return result
}

/** Writes one flag, replacing an existing value. */
export function set(db: Db, key: string, value: string): void {
  db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, value])
}
