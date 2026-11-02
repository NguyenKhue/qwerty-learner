import { Button } from '@/components/ui/button'
import type { FC } from 'react'
import { useCallback } from 'react'
import NextIcon from '~icons/ooui/next-ltr'
import PrevIcon from '~icons/ooui/next-rtl'

type IPaginationProps = {
  className?: string
  page: number
  setPage: (page: number) => void
  totalPages: number
}

export const ITEM_PER_PAGE = 20

const Pagination: FC<IPaginationProps> = ({ className, page, setPage, totalPages }) => {
  const nextPage = useCallback(() => {
    setPage(page + 1)
  }, [page, setPage])

  const prevPage = useCallback(() => {
    setPage(page - 1)
  }, [page, setPage])

  if (totalPages <= 1) return null

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={prevPage}>
        <PrevIcon aria-hidden />
      </Button>
      <span className="num text-sm text-foreground">{`${page} / ${totalPages}`}</span>
      <Button variant="outline" size="icon" aria-label="Next page" disabled={page >= totalPages} onClick={nextPage}>
        <NextIcon aria-hidden />
      </Button>
    </div>
  )
}

export default Pagination
