import { dictionaryByIdAtom } from '@/store/customDicts'
import { wordListFetcher } from '@/utils/wordListFetcher'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { saveAs } from 'file-saver'
import { useAtomValue } from 'jotai'
import type { FC } from 'react'
import { useState } from 'react'
import * as XLSX from 'xlsx'

type DropdownProps = {
  renderRecords: any
}

const DropdownExport: FC<DropdownProps> = ({ renderRecords }) => {
  const [isExporting, setIsExporting] = useState(false)
  const dictionaryById = useAtomValue(dictionaryByIdAtom)

  const formatTimestamp = (date: any) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0') // month index starts at 0
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`
  }

  const handleExport = async (bookType: string) => {
    setIsExporting(true)

    try {
      // Fetch all the dictionary data we need
      const dictUrls: string[] = []
      renderRecords.forEach((item: any) => {
        const dictInfo = dictionaryById[item.dict]
        if (dictInfo?.url && !dictUrls.includes(dictInfo.url)) {
          dictUrls.push(dictInfo.url)
        }
      })

      // Fetch every dictionary in parallel
      const dictDataPromises = dictUrls.map(async (url) => {
        try {
          const data = await wordListFetcher(url)
          return { url, data }
        } catch (error) {
          console.error(`Failed to fetch dictionary data from ${url}:`, error)
          return { url, data: [] }
        }
      })

      const dictDataResults = await Promise.all(dictDataPromises)
      const dictDataMap = new Map(dictDataResults.map((result) => [result.url, result.data]))

      const ExportData: Array<{ Word: string; Definition: string; WrongCount: number; Dictionary: string }> = []

      renderRecords.forEach((item: any) => {
        const dictInfo = dictionaryById[item.dict]
        let translation = ''

        if (dictInfo?.url && dictDataMap.has(dictInfo.url)) {
          const wordList = dictDataMap.get(dictInfo.url) || []
          const word = wordList.find((w: any) => w.name === item.word)
          translation = word ? word.trans.join(';') : ''
        }

        ExportData.push({
          Word: item.word,
          Definition: translation,
          WrongCount: item.wrongCount,
          Dictionary: dictInfo?.name || item.dict,
        })
      })

      let blob: Blob

      if (bookType === 'txt') {
        const content = ExportData.map((item: any) => `${item.Word}: ${item.Definition}`).join('\n')
        blob = new Blob([content], { type: 'text/plain' })
      } else {
        const worksheet = XLSX.utils.json_to_sheet(ExportData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
        const excelBuffer = XLSX.write(workbook, { bookType: bookType as XLSX.BookType, type: 'array' })
        blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
      }

      const timestamp = formatTimestamp(new Date())
      const fileName = `ErrorBook_${timestamp}.${bookType}`

      if (blob && fileName) {
        saveAs(blob, fileName)
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed, please try again')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="z-10">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="my-btn-primary h-8 shadow transition hover:bg-primary disabled:opacity-50" disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="mt-1 rounded bg-primary text-primary-foreground shadow-lg">
          <DropdownMenu.Item
            className="hover:bg-primary-foreground/15 focus:bg-primary-foreground/15 cursor-pointer rounded px-4 py-2 focus:outline-none"
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
          >
            .xlsx
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="hover:bg-primary-foreground/15 focus:bg-primary-foreground/15 cursor-pointer rounded px-4 py-2 focus:outline-none"
            onClick={() => handleExport('csv')}
            disabled={isExporting}
          >
            .csv
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  )
}

export default DropdownExport
