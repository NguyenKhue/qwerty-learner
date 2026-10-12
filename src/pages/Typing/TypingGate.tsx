import KeyboardNotice from './KeyboardNotice'
import TypingPage from './index'
import { useLatchedMediaQuery } from '@/hooks/useMediaQuery'

// Below 768px the typing engine is not mounted at all: no key listeners, no word loading.
// Once it is running, shrinking the window does not unmount it (the chapter in progress would be lost)
export default function TypingGate() {
  const wide = useLatchedMediaQuery('(min-width: 768px)')
  return wide ? <TypingPage /> : <KeyboardNotice />
}
