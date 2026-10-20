import type { Db } from './adapter'

/** The schema version this server knows; `PRAGMA user_version` holds the version of a file. */
export const SCHEMA_VERSION = 1

/** Version 1: every table and index of the app's data. */
const SCHEMA_V1 = `
  CREATE TABLE word_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    dict TEXT NOT NULL,
    chapter INTEGER,
    wrong_count INTEGER NOT NULL,
    timing TEXT NOT NULL,
    mistakes TEXT NOT NULL
  );
  CREATE INDEX idx_word_records_timestamp ON word_records (timestamp);
  CREATE INDEX idx_word_records_dict_word ON word_records (dict, word);
  CREATE INDEX idx_word_records_wrong_count ON word_records (wrong_count);
  CREATE INDEX idx_word_records_dict_chapter ON word_records (dict, chapter);

  CREATE TABLE chapter_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dict TEXT NOT NULL,
    chapter INTEGER,
    timestamp INTEGER NOT NULL,
    time REAL NOT NULL,
    correct_count INTEGER NOT NULL,
    wrong_count INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    correct_word_indexes TEXT NOT NULL,
    word_number INTEGER NOT NULL,
    word_record_ids TEXT NOT NULL
  );
  CREATE INDEX idx_chapter_records_dict_chapter ON chapter_records (dict, chapter);
  CREATE INDEX idx_chapter_records_timestamp ON chapter_records (timestamp);

  CREATE TABLE review_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dict TEXT NOT NULL,
    position INTEGER NOT NULL,
    create_time INTEGER NOT NULL,
    is_finished INTEGER NOT NULL,
    words TEXT NOT NULL
  );
  CREATE INDEX idx_review_records_dict ON review_records (dict);

  CREATE TABLE custom_dicts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    words TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_custom_dicts_created_at ON custom_dicts (created_at);

  CREATE TABLE card_progress (
    dict TEXT NOT NULL,
    word TEXT NOT NULL,
    state TEXT NOT NULL,
    due INTEGER NOT NULL,
    interval REAL NOT NULL,
    ease REAL NOT NULL,
    reps INTEGER NOT NULL,
    lapses INTEGER NOT NULL,
    first_seen INTEGER NOT NULL,
    last_reviewed INTEGER NOT NULL,
    PRIMARY KEY (dict, word)
  );
  CREATE INDEX idx_card_progress_dict_due ON card_progress (dict, due);

  CREATE TABLE review_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    dict TEXT NOT NULL,
    word TEXT NOT NULL,
    kind TEXT NOT NULL,
    grade TEXT
  );
  CREATE INDEX idx_review_log_at ON review_log (at);
  CREATE INDEX idx_review_log_dict ON review_log (dict);

  CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`

/**
 * Creates the tables of a fresh database and moves an older one forward.
 * A file written by a newer server is refused with `NEWER_SCHEMA`.
 */
export function ensureSchema(db: Db): void {
  const version = db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0
  if (version > SCHEMA_VERSION) throw new Error('NEWER_SCHEMA')
  if (version === SCHEMA_VERSION) return
  if (version === 0) {
    db.transaction(() => {
      db.exec(SCHEMA_V1)
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
    })
    return
  }
  // forward-only migrations for versions 1..SCHEMA_VERSION-1 belong here, one transaction each
  throw new Error('NEWER_SCHEMA')
}
