import InfoPanel from '@/components/InfoPanel'
import { trackPromotionEvent } from '@/utils/trackEvent'
import { useCallback, useState } from 'react'
import IconBook2 from '~icons/tabler/book-2'

export default function DictRequest() {
  const [showPanel, setShowPanel] = useState(false)

  const onOpenPanel = useCallback(() => {
    setShowPanel(true)
    trackPromotionEvent('promotion_event', {
      from: 'dict_request_button',
      action: 'open',
      action_detail: 'dict_request_button_open',
    })
  }, [])

  const onClosePanel = useCallback(() => {
    setShowPanel(false)
    trackPromotionEvent('promotion_event', {
      from: 'dict_request_panel',
      action: 'close',
      action_detail: 'dict_request_panel_close',
    })
  }, [])

  return (
    <>
      {showPanel && (
        <InfoPanel
          openState={showPanel}
          title="Want to add more dictionaries?"
          icon={IconBook2}
          buttonClassName="bg-primary hover:bg-primary"
          iconClassName="text-primary bg-primary/10"
          onClose={onClosePanel}
        >
          <p className="text-sm text-muted-foreground">
            If you have some programming skills, please refer to our
            <a
              href="https://github.com/RealKai42/qwerty-learner/blob/master/docs/toBuildDict.md"
              className="mx-1 font-medium text-blue-500 hover:text-blue-600"
              target="_blank"
              rel="noreferrer"
            >
              dictionary contribution guide
            </a>
            and follow the instructions to contribute new dictionary content to this open source project. Community contributions are very
            welcome!
          </p>

          {/* 
  <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm dark:from-gray-800 dark:to-gray-700">
  <h4 className="mb-3 font-semibold text-foreground">🚀 Try QwertyLearner.ai</h4>
  <p className="mb-3 text-sm text-muted-foreground">
  No programming skills? Want a dictionary of your very own? Simple to use: upload in one click, ready to use right away
  <br />
  <div className="my-2"></div>
  Then we recommend you try QwertyLearner.ai, developed and operated by the professional team at DeepLearningAI in the UK
  <span className="mx-1 font-semibold text-blue-600 dark:text-blue-400">QwertyLearner.ai</span>
  </p>
  <div className="space-y-2 text-sm">
  <div className="flex items-center">
  <span className="mr-2 text-blue-500">•</span>
  <span className="text-foreground">
  <strong>AI-powered word database</strong> - Upload in one click, get definitions and parts of speech generated automatically, and build your
  own custom word list
  </span>
  </div>
  <div className="flex items-center">
  <span className="mr-2 text-blue-500">•</span>
  <span className="text-foreground">
  <strong>Article practice</strong> - Bring your own text and sharpen your real-world skills
  </span>
  </div>
  <div className="flex items-center">
  <span className="mr-2 text-blue-500">•</span>
  <span className="text-foreground">
  <strong>Cloud sync</strong> - Practice history and mistake book synced across devices
  </span>
  </div>
  <div className="flex items-center">
  <span className="mr-2 text-blue-500">•</span>
  <span className="text-foreground">
  <strong>Dictionary selection</strong> - A much richer set of specialized word lists
  </span>
  </div>
  </div>
  <button
  onClick={() => {
  window.open('https://qwertylearner.ai','_blank')
  onClosePanel()
}}
  className="mt-4 w-full transform rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:from-blue-600 hover:to-purple-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
  >
  🚀 Experience QwertyLearner.ai
  </button>
  </div>

  <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
  <p>
  <strong>Note:</strong> QwertyLearner.ai is independently developed and operated by DeepLearningAI in the UK. It is a separate derivative of
  the open source QwertyLearner, which will remain open source and openly operated.
  </p>
  </div>
  */}
        </InfoPanel>
      )}
      <button
        type="button"
        onClick={onOpenPanel}
        className="group flex items-center space-x-2 rounded-lg border border-primary bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-2.5 text-sm font-medium text-primary shadow-sm transition-all duration-200 hover:scale-105 hover:border-primary hover:from-indigo-100 hover:to-blue-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2  dark:from-gray-800 dark:to-gray-700  dark:hover:from-gray-700 dark:hover:to-gray-600"
      >
        <IconBook2 className="h-4 w-4" />
        <span>Find more dictionaries</span>
        <span className="transform transition-transform group-hover:translate-x-1">✨</span>
      </button>
    </>
  )
}
