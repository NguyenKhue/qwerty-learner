import DropdownExport from './DropdownExport'
import ErrorRow, { ROW_GRID } from './ErrorRow'
import type { ISortType } from './HeadWrongNumber'
import HeadWrongNumber from './HeadWrongNumber'
import Pagination, { ITEM_PER_PAGE } from './Pagination'
import RowDetail from './RowDetail'
import { currentRowDetailAtom } from './store'
import type { groupedWordRecords } from './type'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { toWordRecord } from '@/data/hydrate'
import { call } from '@/data/rpc'
import { useDeleteWordRecord } from '@/utils/db'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useState } from 'react'

export function ErrorBook() {
  const [groupedRecords, setGroupedRecords] = useState<groupedWordRecords[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = useMemo(() => Math.ceil(groupedRecords.length / ITEM_PER_PAGE), [groupedRecords.length])
  const [sortType, setSortType] = useState<ISortType>('asc')
  const currentRowDetail = useAtomValue(currentRowDetailAtom)
  const { deleteWordRecord } = useDeleteWordRecord()
  const [reload, setReload] = useState(false)
  const [loaded, setLoaded] = useState(false)

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
      setLoaded(true)
    })
  }, [reload])

  const handleDelete = async (word: string, dict: string) => {
    await deleteWordRecord(word, dict)
    setReload((prev) => !prev)
  }

  return (
    <>
      <div className={`mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8 ${currentRowDetail ? 'blur-sm' : ''}`}>
        <PageHeader
          title="Error book"
          subtitle="Words you mistyped. Click one to see its mistakes."
          actions={groupedRecords.length > 0 ? <DropdownExport renderRecords={sortedRecords} /> : undefined}
        />
        {loaded && groupedRecords.length === 0 ? (
          <Card className="text-muted-foreground">No mistakes yet. Words you mistype in Typing show up here.</Card>
        ) : (
          <>
            <Card className="p-0 sm:p-0">
              <div className={`${ROW_GRID} rounded-t-xl bg-muted px-4 py-1 text-sm font-medium text-muted-foreground`}>
                <span>Word</span>
                <span className="hidden md:block">Meaning</span>
                <HeadWrongNumber sortType={sortType} setSortType={setSort} />
                <span className="hidden md:block">Dictionary</span>
              </div>
              <ul className="divide-y divide-border">
                {renderRecords.map((record) => (
                  <ErrorRow key={`${record.dict}-${record.word}`} record={record} onDelete={() => handleDelete(record.word, record.dict)} />
                ))}
              </ul>
            </Card>
            <Pagination page={currentPage} setPage={setPage} totalPages={totalPages} />
          </>
        )}
      </div>
      {currentRowDetail && <RowDetail currentRowDetail={currentRowDetail} allRecords={sortedRecords} />}
    </>
  )
}
