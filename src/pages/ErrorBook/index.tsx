import DropdownExport from './DropdownExport'
import ErrorRow from './ErrorRow'
import type { ISortType } from './HeadWrongNumber'
import HeadWrongNumber from './HeadWrongNumber'
import Pagination, { ITEM_PER_PAGE } from './Pagination'
import RowDetail from './RowDetail'
import { currentRowDetailAtom } from './store'
import type { groupedWordRecords } from './type'
import { toWordRecord } from '@/data/hydrate'
import { call } from '@/data/rpc'
import { useDeleteWordRecord } from '@/utils/db'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IconX from '~icons/tabler/x'

export function ErrorBook() {
  const [groupedRecords, setGroupedRecords] = useState<groupedWordRecords[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = useMemo(() => Math.ceil(groupedRecords.length / ITEM_PER_PAGE), [groupedRecords.length])
  const [sortType, setSortType] = useState<ISortType>('asc')
  const navigate = useNavigate()
  const currentRowDetail = useAtomValue(currentRowDetailAtom)
  const { deleteWordRecord } = useDeleteWordRecord()
  const [reload, setReload] = useState(false)

  const onBack = useCallback(() => {
    navigate('/typing')
  }, [navigate])

  const setPage = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return
      setCurrentPage(page)
    },
    [totalPages],
  )

  const setSort = useCallback(
    (sortType: ISortType) => {
      setSortType(sortType)
      setPage(1)
    },
    [setPage],
  )

  const sortedRecords = useMemo(() => {
    if (sortType === 'none') return groupedRecords
    return [...groupedRecords].sort((a, b) => {
      if (sortType === 'asc') {
        return a.wrongCount - b.wrongCount
      } else {
        return b.wrongCount - a.wrongCount
      }
    })
  }, [groupedRecords, sortType])

  const renderRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEM_PER_PAGE
    const end = start + ITEM_PER_PAGE
    return sortedRecords.slice(start, end)
  }, [currentPage, sortedRecords])

  useEffect(() => {
    call('words.wrong').then((rows) => {
      const records = rows.map(toWordRecord)
      const groups: groupedWordRecords[] = []

      records.forEach((record) => {
        let group = groups.find((g) => g.word === record.word && g.dict === record.dict)
        if (!group) {
          group = { word: record.word, dict: record.dict, records: [], wrongCount: 0 }
          groups.push(group)
        }
        group.records.push(record)
      })

      groups.forEach((group) => {
        group.wrongCount = group.records.reduce((acc, cur) => {
          acc += cur.wrongCount
          return acc
        }, 0)
      })

      setGroupedRecords(groups)
    })
  }, [reload])

  const handleDelete = async (word: string, dict: string) => {
    await deleteWordRecord(word, dict)
    setReload((prev) => !prev)
  }

  return (
    <>
      <div
        className={`relative mx-auto flex h-full w-full max-w-5xl animate-enter-up flex-col gap-4 px-4 pb-4 pt-6 ease-in md:px-8 ${
          currentRowDetail && 'blur-sm'
        }`}
      >
        <div className="flex w-auto items-center justify-end gap-4 self-end">
          <h1 className="font-lighter mr-4 w-auto self-end text-muted-foreground opacity-70">
            Tip: click a misspelled word to see details{' '}
          </h1>
          <IconX className="h-7 w-7 cursor-pointer text-muted-foreground" onClick={onBack} />
        </div>

        {/* On a phone the table keeps a readable width and scrolls sideways inside its own box instead of squeezing its columns */}
        <div className="flex w-full flex-1 select-text items-start justify-start overflow-x-auto overflow-y-hidden md:justify-center">
          <div className="flex h-full w-full min-w-[38rem] flex-col rounded-xl border border-border bg-card p-4 shadow-1 sm:p-6 md:w-5/6">
            <div className="flex w-full justify-between rounded-lg bg-muted px-4 py-3 text-sm font-medium text-muted-foreground">
              <span className="basis-2/12">Word</span>
              <span className="basis-6/12">Meaning</span>
              <HeadWrongNumber className="basis-1/12" sortType={sortType} setSortType={setSort} />
              <span className="basis-1/12">Dictionary</span>
              <DropdownExport renderRecords={sortedRecords} />
            </div>
            <ScrollArea.Root className="flex-1 overflow-y-auto pt-5">
              <ScrollArea.Viewport className="h-full  ">
                <div className="flex flex-col gap-3">
                  {renderRecords.map((record) => (
                    <ErrorRow
                      key={`${record.dict}-${record.word}`}
                      record={record}
                      onDelete={() => handleDelete(record.word, record.dict)}
                    />
                  ))}
                </div>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent" orientation="vertical"></ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </div>
        </div>
        <Pagination className="pt-3" page={currentPage} setPage={setPage} totalPages={totalPages} />
      </div>
      {currentRowDetail && <RowDetail currentRowDetail={currentRowDetail} allRecords={sortedRecords} />}
    </>
  )
}
