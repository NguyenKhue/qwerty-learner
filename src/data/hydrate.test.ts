import { toChapterRecord, toReviewRecord, toWordRecord } from './hydrate'
import { describe, expect, it } from 'vitest'

describe('hydrate', () => {
  it('rebuilds a word record with its getter and keeps the id and every field', () => {
    const record = toWordRecord({
      id: 7,
      word: 'a',
      timeStamp: 100,
      dict: 'd',
      chapter: 2,
      timing: [100, 250, 50],
      wrongCount: 1,
      mistakes: { 1: ['x'] },
    })
    expect(record.id).toBe(7)
    expect(record.totalTime).toBe(400)
    expect(record.timeStamp).toBe(100)
    expect(record.mistakes).toEqual({ 1: ['x'] })
  })

  it('rebuilds a chapter record with its getters', () => {
    const record = toChapterRecord({
      id: 3,
      dict: 'd',
      chapter: 0,
      timeStamp: 1,
      time: 60,
      correctCount: 90,
      wrongCount: 10,
      wordCount: 30,
      correctWordIndexes: [0, 1, 2],
      wordNumber: 4,
      wordRecordIds: [7, 9],
    })
    expect(record.id).toBe(3)
    expect(record.wpm).toBe(30)
    expect(record.wordAccuracy).toBe(75)
    expect(record.wordRecordIds).toEqual([7, 9])
  })

  it('rebuilds a review record that keeps its id and words', () => {
    const record = toReviewRecord({ id: 5, dict: 'd', index: 2, createTime: 9, isFinished: false, words: [] })
    expect(record.id).toBe(5)
    expect(record.index).toBe(2)
    expect(record.isFinished).toBe(false)
  })
})
