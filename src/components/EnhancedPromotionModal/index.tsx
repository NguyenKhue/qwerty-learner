import noop from '../../utils/noop'
import { hasSeenEnhancedPromotionAtom } from '@/store'
import { trackPromotionEvent } from '@/utils/trackEvent'
import { Dialog, Transition } from '@headlessui/react'
import { useAtom } from 'jotai'
import type React from 'react'
import { Fragment, useEffect, useState } from 'react'
import IconStar from '~icons/heroicons/star-solid'
import IconX from '~icons/tabler/x'

const EnhancedPromotionModal: React.FC = () => {
  const [hasSeenPromotion, setHasSeenPromotion] = useAtom(hasSeenEnhancedPromotionAtom)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Only show modal if user hasn't seen it before
    if (!hasSeenPromotion) {
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 2000) // Show after 2 seconds to let the page load

      return () => clearTimeout(timer)
    }
  }, [hasSeenPromotion])

  const handleTryNow = () => {
    trackPromotionEvent('promotion_event', {
      from: 'promotion_modal',
      action: 'open',
      action_detail: 'promotion_modal_open',
    })
    setHasSeenPromotion(true)
    // setIsOpen(false)
    // Open in new tab
    window.open('https://qwertylearner.ai', '_blank')
  }

  const handleDismiss = () => {
    trackPromotionEvent('promotion_event', {
      from: 'promotion_modal',
      action: 'close',
      action_detail: 'promotion_modal_close',
    })
    setHasSeenPromotion(true)
    setIsOpen(false)
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={noop}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="dark:via-gray-850 relative transform overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-white via-blue-50 to-indigo-100 p-0 text-left shadow-2xl transition-all dark:border-gray-700 dark:from-gray-800 dark:to-gray-900 sm:my-8 sm:w-full sm:max-w-xl">
                {/* Header with close button */}
                <div className="absolute right-4 top-4 z-10">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground"
                    title="Close"
                  >
                    <IconX className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-8 pb-8 pt-10">
                  {/* Icon and title */}
                  <div className="mb-6 text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg">
                      <IconStar className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-3xl font-bold text-transparent">
                      Try QwertyLearner.ai
                    </h3>

                    <p className="mt-2 text-sm text-muted-foreground">Unlock a more powerful learning experience ✨</p>
                  </div>

                  {/* Main content */}
                  <div className="space-y-4 py-2 text-sm text-foreground">
                    <p className="text-center font-medium text-foreground">
                      Not a programmer? Want your own dedicated study dictionary? Simple to use, upload with one click, ready right away
                      <br />
                      <div className="my-2"></div>
                      Then we recommend trying QwertyLearner.ai, developed and operated by the professional team of DeepLearningAI in the UK
                    </p>

                    <div className="rounded-lg bg-card p-4 shadow-sm">
                      <h4 className="mb-3 font-semibold text-foreground">🚀 Professional features</h4>
                      <ul className="space-y-2.5">
                        <li className="flex items-start">
                          <span className="mr-2 mt-0.5 text-blue-500">•</span>
                          <span>
                            <strong>AI-powered word lists</strong> - One-click upload, with definitions and parts of speech generated
                            automatically to build your own custom word list
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2 mt-0.5 text-blue-500">•</span>
                          <span>
                            <strong>Article practice</strong> - Use your own article content to build real-world skills
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2 mt-0.5 text-blue-500">•</span>
                          <span>
                            <strong>Cloud sync</strong> - Practice history and mistake book synced across devices
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2 mt-0.5 text-blue-500">•</span>
                          <span>
                            <strong>Dictionary choice</strong> - A wider range of professional word lists
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      <p>
                        <strong>Note:</strong> QwertyLearner.ai is developed and operated independently by DeepLearningAI in the UK. It is a
                        separate derivative of the open-source QwertyLearner, which will stay open source and independently operated.
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-8 space-y-3">
                    <button
                      type="button"
                      onClick={handleTryNow}
                      className="w-full transform rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:from-blue-600 hover:to-purple-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      🚀 Try QwertyLearner.ai now
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

export default EnhancedPromotionModal
