import { CUSTOM_URL_PREFIX, getCustomDictWords } from './db/custom-dict'
import type { Word } from '@/typings'

export async function wordListFetcher(url: string): Promise<Word[]> {
  if (url.indexOf(CUSTOM_URL_PREFIX) === 0) {
    return getCustomDictWords(url.slice(CUSTOM_URL_PREFIX.length))
  }

  const URL_PREFIX: string = REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''

  const response = await fetch(URL_PREFIX + url)
  const words: Word[] = await response.json()
  return words
}
