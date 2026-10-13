import DictionaryGroup from './CategoryDicts'
import DictRequest from './DictRequest'
import { LanguageTabSwitcher } from './LanguageTabSwitcher'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { currentDictInfoAtom } from '@/store'
import { allDictionariesAtom } from '@/store/customDicts'
import type { Dictionary, LanguageCategoryType } from '@/typings'
import groupBy, { groupByDictTags } from '@/utils/groupBy'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { useAtomValue } from 'jotai'
import { createContext, useCallback, useEffect, useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import type { Updater } from 'use-immer'
import { useImmer } from 'use-immer'
import IconInfo from '~icons/ic/outline-info'
import IconX from '~icons/tabler/x'

export type GalleryState = {
  currentLanguageTab: LanguageCategoryType
}

const initialGalleryState: GalleryState = {
  currentLanguageTab: 'en',
}

export const GalleryContext = createContext<{
  state: GalleryState
  setState: Updater<GalleryState>
} | null>(null)

export default function GalleryPage() {
  const [galleryState, setGalleryState] = useImmer<GalleryState>(initialGalleryState)
  const navigate = useNavigate()
  const currentDictInfo = useAtomValue(currentDictInfoAtom)
  const allDictionaries = useAtomValue(allDictionariesAtom)

  const { groupedByCategoryAndTag } = useMemo(() => {
    const currentLanguageCategoryDicts = allDictionaries.filter((dict) => dict.languageCategory === galleryState.currentLanguageTab)
    const groupedByCategory = Object.entries(groupBy(currentLanguageCategoryDicts, (dict) => dict.category))
    const groupedByCategoryAndTag = groupedByCategory.map(
      ([category, dicts]) => [category, groupByDictTags(dicts)] as [string, Record<string, Dictionary[]>],
    )

    return {
      groupedByCategoryAndTag,
    }
  }, [allDictionaries, galleryState.currentLanguageTab])

  const onBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  // Esc closes the library unless a dialog (the set details) is open and handles it itself. Enter is left alone so buttons can be activated
  useHotkeys('esc', onBack, { preventDefault: true, ignoreEventWhen: () => document.querySelector('[role="dialog"]') !== null })

  useEffect(() => {
    if (currentDictInfo) {
      setGalleryState((state) => {
        state.currentLanguageTab = currentDictInfo.languageCategory
      })
    }
  }, [currentDictInfo, setGalleryState])

  return (
    <Layout>
      <GalleryContext.Provider value={{ state: galleryState, setState: setGalleryState }}>
        <div className="relative flex w-full min-w-0 flex-1 flex-col overflow-y-auto px-4 md:px-8">
          <button
            type="button"
            aria-label="Close library"
            onClick={onBack}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconX className="h-6 w-6" aria-hidden />
          </button>
          <div className="mt-14 flex w-full min-w-0 flex-1 flex-col overflow-y-auto">
            <div className="flex h-full min-w-0 flex-col overflow-y-auto">
              <div className="flex w-full flex-wrap items-center justify-between gap-3 pb-6">
                <LanguageTabSwitcher />
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={() => navigate('/my-sets')}>
                    Manage my sets
                  </Button>
                  <DictRequest />
                </div>
              </div>
              <ScrollArea.Root className="flex-1 overflow-y-auto">
                <ScrollArea.Viewport className="h-full w-full ">
                  <div className="mr-4 flex flex-1 flex-col items-start justify-start gap-14 overflow-y-auto">
                    {groupedByCategoryAndTag.map(([category, groupeByTag]) => (
                      <DictionaryGroup key={category} groupedDictsByTag={groupeByTag} />
                    ))}
                  </div>
                  <div className="flex items-center justify-center pb-10 pt-10 text-muted-foreground">
                    <IconInfo className="mr-1 h-5 w-5" />
                    <p className="mr-5 w-10/12 text-xs">
                      The dictionary data in this project comes from several open source projects and from community contributors who
                      provided it free of charge. We are deeply grateful and respectful of every contributor&apos;s intellectual property.
                      This data is for personal study and research only and must not be used for any commercial purpose. If you are the
                      copyright holder of any of the data and believe our use infringes your rights, please contact us at the email address
                      at the bottom of the site. Once we receive a valid copyright complaint, we will remove the relevant content or seek
                      the necessary permission as soon as possible. We also encourage everyone using this data to respect copyright
                      holders&apos; rights and to comply with all relevant laws and regulations when using it. Please note that although we
                      try our best to ensure the legality and accuracy of all data, we cannot guarantee the accuracy, completeness, legality
                      or reliability of any data. The risks of using this data are borne entirely by the user.
                    </p>
                  </div>
                </ScrollArea.Viewport>
                <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent " orientation="vertical"></ScrollArea.Scrollbar>
              </ScrollArea.Root>
              {/* todo: add navigation */}
              {/* <div className="mt-20 h-40 w-40 text-center ">
                <CategoryNavigation />
              </div> */}
            </div>
          </div>
        </div>
      </GalleryContext.Provider>
    </Layout>
  )
}
