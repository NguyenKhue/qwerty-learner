import CopyBuiltIn from './CopyBuiltIn'
import ImportPanel from './ImportPanel'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { currentChapterAtom, currentDictIdAtom } from '@/store'
import { customDictionariesAtom } from '@/store/customDicts'
import type { Dictionary } from '@/typings'
import { customIdOf, deleteCustomDict } from '@/utils/db/custom-dict'
import { useAtomValue, useSetAtom } from 'jotai'
import { useNavigate } from 'react-router-dom'
import IconX from '~icons/tabler/x'

export default function MySetsPage() {
  const navigate = useNavigate()
  const sets = useAtomValue(customDictionariesAtom)
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)

  const onPractice = (dict: Dictionary) => {
    setCurrentDictId(dict.id)
    setCurrentChapter(0)
    navigate('/')
  }

  const onDelete = async (dict: Dictionary) => {
    if (!window.confirm(`Delete "${dict.name}"? Its study progress and typing records will be deleted too.`)) return
    await deleteCustomDict(customIdOf(dict.id))
  }

  return (
    <Layout>
      <div className="relative flex w-full flex-1 flex-col items-center overflow-y-auto px-20 pb-10 pt-16">
        <IconX className="absolute right-20 top-10 h-7 w-7 cursor-pointer text-gray-400" onClick={() => navigate('/gallery')} />
        <div className="flex w-full max-w-4xl flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-medium text-gray-800 dark:text-gray-200">My sets</h1>
            <Button onClick={() => navigate('/my-sets/new')}>New set</Button>
          </div>

          <section className="w-full rounded-lg bg-white shadow dark:bg-gray-800">
            {sets.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                You have no sets yet. Create one, import a file, or copy a built-in dictionary below.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {sets.map((dict) => (
                  <li key={dict.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg text-gray-800 dark:text-gray-200">{dict.name}</p>
                      <p className="truncate text-sm text-gray-500">
                        {dict.length} words{dict.description ? ` · ${dict.description}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" onClick={() => onPractice(dict)}>
                        Practice
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/my-sets/${customIdOf(dict.id)}`)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(dict)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ImportPanel />
          <CopyBuiltIn />
        </div>
      </div>
    </Layout>
  )
}
