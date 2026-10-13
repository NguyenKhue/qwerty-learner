import CopyBuiltIn from './CopyBuiltIn'
import ImportPanel from './ImportPanel'
import SetActionsMenu from './SetActionsMenu'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { currentChapterAtom, currentDictIdAtom } from '@/store'
import { customDictionariesAtom } from '@/store/customDicts'
import type { Dictionary } from '@/typings'
import { customEditPath, customIdOf, customViewPath, deleteCustomDict, duplicateCustomDict } from '@/utils/db/custom-dict'
import { useAtomValue, useSetAtom } from 'jotai'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import IconBooks from '~icons/tabler/books'

export default function MySetsPage() {
  const navigate = useNavigate()
  const sets = useAtomValue(customDictionariesAtom)
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)
  const [error, setError] = useState('')

  // Every mode is one click away on the dashboard, so opening a set just makes it the current one
  const onOpen = (dict: Dictionary) => {
    setCurrentDictId(dict.id)
    setCurrentChapter(0)
    navigate('/')
  }

  const onDelete = async (dict: Dictionary) => {
    if (!window.confirm(`Delete "${dict.name}"? Its study progress and typing records will be deleted too.`)) return
    setError('')
    try {
      await deleteCustomDict(customIdOf(dict.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the set')
    }
  }

  const onDuplicate = async (dict: Dictionary) => {
    setError('')
    try {
      await duplicateCustomDict(customIdOf(dict.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not duplicate the set')
    }
  }

  return (
    <div className="stagger mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 md:px-8 md:py-8">
      <div style={{ '--i': 0 } as CSSProperties}>
        <PageHeader title="My sets" actions={<Button onClick={() => navigate('/my-sets/new')}>New set</Button>} />
      </div>

      <div style={{ '--i': 1 } as CSSProperties}>
        {sets.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 border-dashed p-8 text-center">
            <IconBooks className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              You have no sets yet. Create one, import a file, or copy a built-in dictionary below.
            </p>
            <Button onClick={() => navigate('/my-sets/new')}>New set</Button>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {sets.map((dict) => {
              const viewPath = customViewPath(dict.id) ?? '/my-sets'
              return (
                <li key={dict.id}>
                  <Card interactive className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="min-w-0">
                      {/* Stretched link: the ::after overlay makes the whole row clickable, the buttons below sit above it via z-10 */}
                      <Link
                        to={viewPath}
                        className="truncate text-base font-semibold text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {dict.name}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">
                        {dict.length} words{dict.description ? ` · ${dict.description}` : ''}
                      </p>
                    </div>
                    <div className="relative z-10 flex shrink-0 items-center gap-2">
                      <Button onClick={() => onOpen(dict)}>Open</Button>
                      <SetActionsMenu
                        name={dict.name}
                        onOpen={() => onOpen(dict)}
                        onEdit={() => navigate(customEditPath(dict.id) ?? '/my-sets')}
                        onDuplicate={() => onDuplicate(dict)}
                        onDelete={() => onDelete(dict)}
                      />
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div style={{ '--i': 2 } as CSSProperties}>
        <ImportPanel />
      </div>
      <div style={{ '--i': 3 } as CSSProperties}>
        <CopyBuiltIn />
      </div>
    </div>
  )
}
