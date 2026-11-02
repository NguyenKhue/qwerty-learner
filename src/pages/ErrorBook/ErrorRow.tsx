import { LoadingWordUI } from './LoadingWordUI'
import useGetWord from './hooks/useGetWord'
import { currentRowDetailAtom } from './store'
import type { groupedWordRecords } from './type'
import { dictionaryByIdAtom } from '@/store/customDicts'
import { recordErrorBookAction } from '@/utils'
import { useAtomValue, useSetAtom } from 'jotai'
import type { FC } from 'react'
import { useCallback } from 'react'
import DeleteIcon from '~icons/weui/delete-filled'

/** The columns of a row and of the header above the rows. On a phone a row stacks: word and count, then its meaning and dictionary */
export const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto_2.75rem] items-center gap-x-3 md:grid-cols-[10rem_minmax(0,1fr)_6rem_8rem_2.75rem]'

type IErrorRowProps = {
  record: groupedWordRecords
  onDelete: () => void
}

const ErrorRow: FC<IErrorRowProps> = ({ record, onDelete }) => {
  const setCurrentRowDetail = useSetAtom(currentRowDetailAtom)
  const dictionaryById = useAtomValue(dictionaryByIdAtom)
  const dictInfo = dictionaryById[record.dict]
  const { word, isLoading, hasError } = useGetWord(record.word, dictInfo)

  const onClick = useCallback(() => {
    setCurrentRowDetail(record)
    recordErrorBookAction('detail')
  }, [record, setCurrentRowDetail])

  return (
    <li className={`${ROW_GRID} cursor-pointer gap-y-1 px-4 py-3 text-card-foreground hover:bg-muted/50`} onClick={onClick}>
      <button
        type="button"
        className="col-start-1 row-start-1 min-w-0 break-words rounded text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {record.word}
      </button>
      <span className="col-span-2 col-start-1 row-start-2 min-w-0 text-sm text-muted-foreground md:col-span-1 md:col-start-2 md:row-start-1">
        {word ? word.trans.join('; ') : <LoadingWordUI isLoading={isLoading} hasError={hasError} />}
      </span>
      <span className="num col-start-2 row-start-1 text-right text-sm md:col-start-3 md:text-left">
        <span className="sr-only">Errors: </span>
        {record.wrongCount}
      </span>
      <span className="col-span-2 col-start-1 row-start-3 min-w-0 truncate text-xs text-muted-foreground md:col-span-1 md:col-start-4 md:row-start-1 md:text-sm">
        {dictInfo?.name}
      </span>
      <button
        type="button"
        aria-label={`Delete the records of ${record.word}`}
        title="Delete records"
        className="col-start-3 row-span-3 row-start-1 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:col-start-5 md:row-span-1"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
      >
        <DeleteIcon aria-hidden />
      </button>
    </li>
  )
}

export default ErrorRow
