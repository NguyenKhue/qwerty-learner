import CopyBuiltIn from './CopyBuiltIn'
import ImportPanel from './ImportPanel'
import SetActionsMenu from './SetActionsMenu'
import { Panel } from '@/components/ModePage'
import { Button } from '@/components/ui/button'
import { currentChapterAtom, currentDictIdAtom } from '@/store'
import { customDictionariesAtom } from '@/store/customDicts'
import type { Dictionary } from '@/typings'
import { customEditPath, customIdOf, customViewPath, deleteCustomDict, duplicateCustomDict } from '@/utils/db/custom-dict'
import { useAtomValue, useSetAtom } from 'jotai'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">My sets</h1>
        <Button onClick={() => navigate('/my-sets/new')}>New set</Button>
      </div>

      <Panel className="p-0">
        {sets.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            You have no sets yet. Create one, import a file, or copy a built-in dictionary below.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sets.map((dict) => {
              const viewPath = customViewPath(dict.id) ?? '/my-sets'
              return (
                <li
                  key={dict.id}
                  className="relative flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0">
                    {/* Stretched link: the ::after overlay makes the whole row clickable, the buttons below sit above it via z-10 */}
                    <Link
                      to={viewPath}
                      className="truncate text-lg font-medium after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {dict.name}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {dict.length} words{dict.description ? ` · ${dict.description}` : ''}
                    </p>
                  </div>
                  <div className="relative z-10 flex shrink-0 items-center gap-2">
                    <Button size="sm" onClick={() => onOpen(dict)}>
                      Open
                    </Button>
                    <SetActionsMenu
                      name={dict.name}
                      onOpen={() => onOpen(dict)}
                      onEdit={() => navigate(customEditPath(dict.id) ?? '/my-sets')}
                      onDuplicate={() => onDuplicate(dict)}
                      onDelete={() => onDelete(dict)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <ImportPanel />
      <CopyBuiltIn />
    </div>
  )
}
