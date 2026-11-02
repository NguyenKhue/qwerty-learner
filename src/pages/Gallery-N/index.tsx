import DictionaryGroup from './CategoryDicts'
import DictRequest from './DictRequest'
import { LanguageTabSwitcher } from './LanguageTabSwitcher'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { currentDictInfoAtom } from '@/store'
import { allDictionariesAtom } from '@/store/customDicts'
import type { Dictionary, LanguageCategoryType } from '@/typings'
import groupBy, { groupByDictTags } from '@/utils/groupBy'
import { useAtomValue } from 'jotai'
import { createContext, useCallback, useEffect, useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import type { Updater } from 'use-immer'
import { useImmer } from 'use-immer'
import IconInfo from '~icons/ic/outline-info'

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
    <GalleryContext.Provider value={{ state: galleryState, setState: setGalleryState }}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
        <PageHeader
          title="Library"
          subtitle="Pick the set every study mode works on."
          actions={
            <>
              <Button variant="outline" onClick={() => navigate('/my-sets')}>
                Manage my sets
              </Button>
              <DictRequest />
            </>
          }
        />
        <LanguageTabSwitcher />
        <div className="flex flex-col gap-6">
          {groupedByCategoryAndTag.map(([category, groupeByTag]) => (
            <DictionaryGroup key={category} groupedDictsByTag={groupeByTag} />
          ))}
        </div>
        <p className="flex gap-2 pb-6 pt-4 text-xs text-muted-foreground">
          <IconInfo className="h-5 w-5 shrink-0" aria-hidden />
          <span>
            The dictionary data in this project comes from several open source projects and from community contributors who provided it free
            of charge. We are deeply grateful and respectful of every contributor&apos;s intellectual property. This data is for personal
            study and research only and must not be used for any commercial purpose. If you are the copyright holder of any of the data and
            believe our use infringes your rights, please contact us at the email address at the bottom of the site. Once we receive a valid
            copyright complaint, we will remove the relevant content or seek the necessary permission as soon as possible. We also encourage
            everyone using this data to respect copyright holders&apos; rights and to comply with all relevant laws and regulations when
            using it. Please note that although we try our best to ensure the legality and accuracy of all data, we cannot guarantee the
            accuracy, completeness, legality or reliability of any data. The risks of using this data are borne entirely by the user.
          </span>
        </p>
      </div>
    </GalleryContext.Provider>
  )
}
