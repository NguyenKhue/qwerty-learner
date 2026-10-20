import type { Config } from './config'
import { openFolder, runBackups } from './folder'
import type { Role } from './folder'
import { startServer } from './http'
import { ensureSchema } from './schema'

export type RunningServer = { port: number; url: string; dir: string; role: Role; stop(): Promise<void> }

const HOUR_MS = 60 * 60 * 1000

/**
 * Opens the data folder (taking its lock, checking the database, bringing the schema up to date), makes the backup of the day, and
 * starts serving. A backup is tried again every hour while the server stays up. The folder is released again if anything fails.
 */
export async function start(
  config: Config,
  opts: { now?: () => number; backupEveryMs?: number; log?: (line: string) => void } = {},
): Promise<RunningServer> {
  const now = opts.now ?? Date.now
  const log = opts.log ?? ((line: string) => console.log(line))
  const folder = openFolder({ dir: config.dir, role: config.role, ensureSchema, now })

  const backup = () => {
    try {
      const result = runBackups(folder, now())
      if (result.created) log(`Backup written: backups/${result.created}`)
    } catch (error) {
      // The server keeps serving: a failed backup is reported loudly, it is not a reason to stop the learner's work
      log(`WARNING: the backup failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  try {
    backup()
    const server = await startServer({
      db: folder.db,
      role: config.role,
      dir: folder.dir,
      staticDir: config.staticDir,
      now,
      port: config.port,
    })
    const timer = setInterval(backup, opts.backupEveryMs ?? HOUR_MS)
    timer.unref()
    return {
      port: server.port,
      url: `http://127.0.0.1:${server.port}`,
      dir: folder.dir,
      role: config.role,
      async stop() {
        clearInterval(timer)
        try {
          await server.close()
        } finally {
          folder.close()
        }
      },
    }
  } catch (error) {
    folder.close()
    throw error
  }
}
