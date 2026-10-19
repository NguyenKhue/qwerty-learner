import { InlineLoading } from '@/components/Loading'
import { currentChapterAtom, currentDictIdAtom } from '@/store'
import { classifyDictId, customDictionariesLoadedAtom, dictionaryByIdAtom } from '@/store/customDicts'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'

/** Old `/study/:dictId` style links: make that set the current one, then continue to the page that reads the current set. */
export default function SelectDictRedirect({ mode }: { mode: 'study' | 'quiz' | 'match' | 'sentences' }) {
  // React Router has already decoded the param
  const { dictId = '' } = useParams()
  const byId = useAtomValue(dictionaryByIdAtom)
  const customLoaded = useAtomValue(customDictionariesLoadedAtom)
  const [currentId, setCurrentId] = useAtom(currentDictIdAtom)
  const setChapter = useSetAtom(currentChapterAtom)
  const status = classifyDictId(dictId, customLoaded, byId)

  useEffect(() => {
    if (status !== 'valid' || currentId === dictId) return
    setCurrentId(dictId)
    setChapter(0)
  }, [status, dictId, currentId, setCurrentId, setChapter])

  if (status === 'pending') return <InlineLoading />
  if (status === 'unknown') return <Navigate to="/gallery" replace />
  // Wait one render for the effect above so the next page reads the new current set
  if (currentId !== dictId) return <InlineLoading />
  return <Navigate to={`/${mode}`} replace />
}
