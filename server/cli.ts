import { ConfigError, parseConfig } from './config'
import type { Config } from './config'
import { FolderError } from './folder'
import { start } from './main'
import type { RunningServer } from './main'

/** The command line entry of the data server (the file that is bundled and started). */
async function run() {
  let config: Config
  try {
    config = parseConfig(process.argv.slice(2), process.env, { cwd: process.cwd() })
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Cannot start: ${error.message}`)
      process.exit(2)
    }
    throw error
  }

  let server: RunningServer
  try {
    server = await start(config)
  } catch (error) {
    if (error instanceof FolderError) {
      console.error(`Cannot open the data folder (${error.code}): ${error.message}`)
      process.exit(1)
    }
    throw error
  }

  console.log(`Data server (${server.role}) is serving ${server.dir} at ${server.url}`)
  const stop = () => {
    server
      .stop()
      .catch((error: unknown) => console.error('Error while stopping', error))
      .finally(() => process.exit(0))
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
