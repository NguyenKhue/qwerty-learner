import ChapterGroup from './ChapterGroup'
import DictionaryGroup from './DictionaryGroup'
import Header from '@/components/Header'
import Layout from '@/components/Layout'
import Tooltip from '@/components/Tooltip'
import { dictionaries } from '@/resources/dictionary'
import { currentDictInfoAtom } from '@/store'
import groupBy from '@/utils/groupBy'
import { useAtomValue } from 'jotai'
import type React from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { NavLink, useNavigate } from 'react-router-dom'

const GalleryPage: React.FC = () => {
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const groups = Object.entries(groupBy(dictionaries, (dict) => dict.category))
  const navigate = useNavigate()
  useHotkeys(
    'enter,esc',
    () => {
      navigate('/')
    },
    { preventDefault: true },
  )

  return (
    <Layout>
      <Header>
        <Tooltip content="Shortcut: Enter or Esc">
          <NavLink className="rounded-lg bg-indigo-400 px-6 py-1 text-lg text-white focus:outline-none dark:text-opacity-80" to="/">
            Done
          </NavLink>
        </Tooltip>
      </Header>
      <div className="mb-auto mt-auto flex w-auto space-x-4 overflow-y-auto">
        <div className="flex flex-col space-y-2 overflow-y-auto rounded-lg bg-indigo-50 p-6 dark:bg-slate-800">
          <h2 className="text-shadow sticky top-0 z-10 mb-2 text-lg font-bold text-gray-700 dark:text-white dark:text-opacity-70">
            Dictionary Selection
          </h2>
          <div className="customized-scrollbar overflow-y-auto">
            {groups.map(([name, items]) => (
              <DictionaryGroup key={name} title={name} dictionaries={items} />
            ))}
          </div>
        </div>
        <div className="flex flex-col overflow-y-auto rounded-lg bg-indigo-50 p-6 dark:bg-slate-800">
          <h2 className="text-shadow sticky top-0 z-10 mb-4 text-lg font-bold text-gray-700 dark:text-white dark:text-opacity-70">
            Chapter Selection
          </h2>
          <div className="customized-scrollbar overflow-y-auto">
            <ChapterGroup totalWords={currentDictInfo.length} />
          </div>
        </div>
      </div>
    </Layout>
  )
}

GalleryPage.displayName = 'GalleryPage'

export default GalleryPage
