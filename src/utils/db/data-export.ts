import { getCurrentDate, recordDataAction } from '..'
import { emit } from '@/data/events'
import { call } from '@/data/rpc'

export type ExportProgress = {
  totalRows?: number
  completedRows: number
  done: boolean
}

export type ImportProgress = {
  totalRows?: number
  completedRows: number
  done: boolean
}

export async function exportDatabase(callback: (exportProgress: ExportProgress) => boolean) {
  callback({ completedRows: 0, done: false })

  const response = await fetch('/api/export/json')
  if (!response.ok) throw new Error('The export failed')
  const blob = await response.blob()

  const { saveAs } = await import('file-saver')
  saveAs(blob, `Qwerty-Learner-User-Data-${getCurrentDate()}.gz`)
  callback({ completedRows: 1, totalRows: 1, done: true })

  const { chapterCount, wordCount } = await call('stats.summary')
  recordDataAction({ type: 'export', size: blob.size, wordCount, chapterCount })
}

export async function importDatabase(onStart: () => void, callback: (importProgress: ImportProgress) => boolean) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/gzip'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return

    onStart()

    const response = await fetch('/api/import', { method: 'POST', body: file })
    if (!response.ok) {
      let message = 'The import failed'
      try {
        const body = (await response.json()) as { error?: { message?: string } }
        if (body.error?.message) message = body.error.message
      } catch {
        // Keep the default message when the answer has no readable body
      }
      throw new Error(message)
    }

    emit('*')
    callback({ completedRows: 1, totalRows: 1, done: true })

    const { chapterCount, wordCount } = await call('stats.summary')
    recordDataAction({ type: 'import', size: file.size, wordCount, chapterCount })
  })

  input.click()
}
