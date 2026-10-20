// The database an older version of the app kept in the browser. It is only used by the tests of the move into the data folder
// and of the export format, to build the data such a browser held; the application itself no longer has any such database.
import type {
  CustomDictRecord,
  ICardProgress,
  IChapterRecord,
  IReviewLogEntry,
  IReviewRecord,
  IRevisionDictRecord,
  IWordRecord,
} from '@/utils/db/record'
import { ChapterRecord, ReviewRecord, WordRecord } from '@/utils/db/record'
import type { Table } from 'dexie'
import Dexie from 'dexie'

class RecordDB extends Dexie {
  wordRecords!: Table<IWordRecord, number>
  chapterRecords!: Table<IChapterRecord, number>
  reviewRecords!: Table<IReviewRecord, number>

  revisionDictRecords!: Table<IRevisionDictRecord, number>
  revisionWordRecords!: Table<IWordRecord, number>

  customDicts!: Table<CustomDictRecord, string>
  cardProgress!: Table<ICardProgress, [string, string]>
  reviewLog!: Table<IReviewLogEntry, number>

  constructor() {
    super('RecordDB')
    this.version(1).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,errorCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    })
    this.version(2).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    })
    this.version(3).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
      reviewRecords: '++id,dict,createTime,isFinished',
    })
    this.version(4).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
      reviewRecords: '++id,dict,createTime,isFinished',
      customDicts: 'id,name,updatedAt,createdAt',
      cardProgress: '[dict+word],dict,due',
    })
    this.version(5).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
      reviewRecords: '++id,dict,createTime,isFinished',
      customDicts: 'id,name,updatedAt,createdAt',
      cardProgress: '[dict+word],dict,due',
      reviewLog: '++id,at,dict',
    })
  }
}

export const db = new RecordDB()

db.wordRecords.mapToClass(WordRecord)
db.chapterRecords.mapToClass(ChapterRecord)
db.reviewRecords.mapToClass(ReviewRecord)
