import { createCustomDict } from './db/custom-dict'
import { wordListFetcher } from './wordListFetcher'
import { describe, expect, it } from 'vitest'

describe('wordListFetcher', () => {
  it('reads a custom set through an idb: url', async () => {
    const rec = await createCustomDict({ name: 'S', words: [{ name: 'a', trans: ['b'], usphone: '', ukphone: '' }] })
    const words = await wordListFetcher(`idb:${rec.id}`)
    expect(words).toEqual([{ name: 'a', trans: ['b'], usphone: '', ukphone: '' }])
  })

  it('rejects for an unknown custom set', async () => {
    await expect(wordListFetcher('idb:missing')).rejects.toThrow()
  })
})
