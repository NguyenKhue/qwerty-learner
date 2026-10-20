import type { LegacyCounts } from '../gate'

/**
 * The old browser database. The real reader and migrator arrive with the migration task; until then no browser is reported as
 * holding old data, so the gate never offers a migration.
 */
export async function detectLegacy(): Promise<LegacyCounts | null> {
  return null
}

export async function runMigration(): Promise<{ counts: LegacyCounts }> {
  throw new Error('The migration is not available yet')
}

export async function deleteLegacyCopy(): Promise<void> {
  // Nothing to delete yet
}
