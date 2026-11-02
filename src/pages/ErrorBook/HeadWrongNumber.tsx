import classNames from 'classnames'
import type { FC } from 'react'
import { useCallback } from 'react'
import DownIcon from '~icons/fa/sort-down'
import UPIcon from '~icons/fa/sort-up'

type IHeadWrongNumberProps = {
  className?: string
  sortType: ISortType
  setSortType: (sortType: ISortType) => void
}

export type ISortType = 'asc' | 'desc' | 'none'

const HeadWrongNumber: FC<IHeadWrongNumberProps> = ({ className, sortType, setSortType }) => {
  const onClick = useCallback(() => {
    const sortTypes: Record<ISortType, ISortType> = {
      asc: 'desc',
      desc: 'none',
      none: 'asc',
    }
    setSortType(sortTypes[sortType])
  }, [setSortType, sortType])

  return (
    <button
      type="button"
      aria-label="Sort by error count"
      className={`flex min-h-[44px] items-center gap-1 whitespace-nowrap rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        className ?? ''
      }`}
      onClick={onClick}
    >
      Errors
      <span className="flex flex-col items-center justify-center text-[12px]" aria-hidden>
        <UPIcon
          className={classNames('-mb-2 ', {
            'text-primary': sortType === 'asc',
            'text-muted-foreground': sortType !== 'asc',
          })}
        />
        <DownIcon
          className={classNames({
            'text-primary': sortType === 'desc',
            'text-muted-foreground': sortType !== 'desc',
          })}
        />
      </span>
    </button>
  )
}

export default HeadWrongNumber
