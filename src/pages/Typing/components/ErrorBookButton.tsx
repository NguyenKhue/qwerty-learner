import { recordErrorBookAction } from '@/utils'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import IconBook from '~icons/bxs/book'

const ErrorBookButton = () => {
  const navigate = useNavigate()

  const toErrorBook = useCallback(() => {
    navigate('/error-book')
    recordErrorBookAction('open')
  }, [navigate])

  return (
    <button
      type="button"
      onClick={toErrorBook}
      className={`flex items-center justify-center rounded p-[2px] text-lg text-indigo-500 outline-none transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white`}
      title="View mistake book"
    >
      <IconBook className="icon" />
    </button>
  )
}

export default ErrorBookButton
