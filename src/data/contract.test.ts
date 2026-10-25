import { topicsOf } from './contract'
import type { ProcedureName } from './contract'
import { describe, expect, it } from 'vitest'

describe('topicsOf', () => {
  it('names the card topic of the set and the review log for a flashcard or quiz review', () => {
    expect(topicsOf('cards.review', ['custom:a', 'w', 'good'])).toEqual(['cards:custom:a', 'reviewLog'])
    expect(topicsOf('cards.reviewQuiz', ['cet4', 'w', true])).toEqual(['cards:cet4', 'reviewLog'])
  })

  it('names everything a deleted set takes with it', () => {
    expect(topicsOf('sets.delete', ['a'])).toEqual(['customDicts', 'cards:custom:a', 'wordRecords', 'chapterRecords', 'reviewRecords'])
  })

  it('announces the set list when a set is created or updated, and typing records when they are written', () => {
    expect(topicsOf('sets.create', [{ name: 'n', words: [] }])).toEqual(['customDicts'])
    expect(topicsOf('sets.update', ['a', { name: 'n', words: [] }])).toEqual(['customDicts'])
    expect(topicsOf('words.add', [{}])).toEqual(['wordRecords'])
    expect(topicsOf('words.deleteByWord', ['w', 'd'])).toEqual(['wordRecords'])
    expect(topicsOf('chapters.add', [{}])).toEqual(['chapterRecords'])
    expect(topicsOf('reviews.put', [{}])).toEqual(['reviewRecords'])
    expect(topicsOf('meta.set', ['k', 'v'])).toEqual(['meta'])
  })

  it('announces every kind of data when the built-in personal set is moved, with both dictionary ids', () => {
    const topics = topicsOf('personal.migrate', [{ builtInId: 'myVocab', customId: 'myvocab' }])
    expect(topics).toEqual(
      expect.arrayContaining([
        'customDicts',
        'cards:myVocab',
        'cards:custom:myvocab',
        'reviewLog',
        'wordRecords',
        'chapterRecords',
        'reviewRecords',
      ]),
    )
  })

  it('announces what the other personal-set operations change', () => {
    expect(topicsOf('personal.backfill', ['myvocab', {}])).toEqual(['customDicts'])
    expect(topicsOf('personal.fixNames', ['myvocab', []])).toEqual(['customDicts', 'cards:custom:myvocab', 'reviewLog', 'wordRecords'])
  })

  it('announces nothing for a read', () => {
    const reads: [ProcedureName, unknown[]][] = [
      ['cards.byDict', ['d']],
      ['log.hardWordsSince', ['d', 1]],
      ['activity.times', [1]],
      ['sets.list', []],
      ['sets.get', ['a']],
      ['words.between', [1, 2]],
      ['words.wrong', []],
      ['words.wrongByDict', ['d']],
      ['words.revisionCount', ['d']],
      ['chapters.byDict', ['d']],
      ['chapters.byDictChapter', ['d', 1]],
      ['stats.summary', []],
      ['reviews.latestUnfinished', ['d']],
      ['meta.getAll', []],
    ]
    reads.forEach(([name, args]) => expect(topicsOf(name, args)).toEqual([]))
  })

  it('does not accept a name that is not in the contract', () => {
    // @ts-expect-error not a procedure
    expect(() => topicsOf('nope', [])).not.toThrow()
  })

  it('announces the dictation list and the video for the dictation writes, and nothing for the reads', () => {
    expect(topicsOf('dictation.prepare', ['abcdefghijk'])).toEqual(['dictation', 'dictation:abcdefghijk'])
    expect(topicsOf('dictation.saveProgress', ['abcdefghijk', {}])).toEqual(['dictation', 'dictation:abcdefghijk'])
    expect(topicsOf('dictation.remove', ['abcdefghijk'])).toEqual(['dictation', 'dictation:abcdefghijk'])
    expect(topicsOf('dictation.videos', [])).toEqual([])
    expect(topicsOf('dictation.get', ['abcdefghijk'])).toEqual([])
    expect(topicsOf('dictation.status', ['abcdefghijk'])).toEqual([])
  })
})
