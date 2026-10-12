import KeyboardNotice from './KeyboardNotice'
import TypingPage from './index'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// Below 768px the typing engine is not mounted at all: no key listeners, no word loading
export default function TypingGate() {
  const wide = useMediaQuery('(min-width: 768px)')
  return wide ? <TypingPage /> : <KeyboardNotice />
}
