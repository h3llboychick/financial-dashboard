import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import Database from 'better-sqlite3-multiple-ciphers'
import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import {
  backupDatabaseBeforeEncryption,
  encryptPlaintextDatabase,
  isPlaintextSqliteDatabase,
  openEncryptedDatabase,
} from '../src/infrastructure/db/encryptedDatabase.js'

// Dummy keys and isolated temporary files only. Do not import connection.js,
// whose singleton loads the application's environment and configured database.
const testKey = Buffer.alloc(32, 41)
const wrongKey = Buffer.alloc(32, 42)
let directory
let sourcePath
let handles

beforeEach(() => {
  directory = fs.mkdtempSync(join(tmpdir(), 'financial-backup-regression-'))
  sourcePath = join(directory, 'fixture.db')
  handles = []
  const db = new Database(sourcePath)
  db.exec(`
    CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT, amount REAL, payload BLOB);
    INSERT INTO sample VALUES (9223372036854775806, 'unchanged — 😀', 2.5, X'00ff');
    INSERT INTO sample VALUES (2, NULL, -1.5, X'');
    CREATE TABLE "quoted""table" (name TEXT);
    INSERT INTO "quoted""table" VALUES ('quoted');
    CREATE VIEW sample_view AS SELECT value FROM sample;
    PRAGMA user_version = 7;
    PRAGMA application_id = 23;
  `)
  db.close()
  fs.chmodSync(sourcePath, 0o644)
})

afterEach(() => {
  for (const db of handles) if (db.open) db.close()
  fs.rmSync(directory, { recursive: true, force: true })
  jest.restoreAllMocks()
})

function trackedDatabase({ onOpen, onRekey, afterRekey, onKey, onPragma, skipRekey = false, skipKey = false } = {}) {
  return class extends Database {
    constructor(path, options) {
      onOpen?.(path, options)
      super(path, options)
      this.fixturePath = path
      this.fixtureOptions = options
      handles.push(this)
    }
    rekey(key) {
      onRekey?.(this, key)
      const result = skipRekey ? undefined : super.rekey(key)
      afterRekey?.(this)
      return result
    }
    key(key) {
      onKey?.(this, key)
      return skipKey ? undefined : super.key(key)
    }
    pragma(sql, options) {
      const next = () => super.pragma(sql, options)
      return onPragma ? onPragma(this, sql, options, next) : next()
    }
  }
}

function assertAllHandlesClosed() {
  expect(handles.every((db) => !db.open)).toBe(true)
}

function assertSourceUnchanged(original) {
  expect(fs.readFileSync(sourcePath)).toEqual(original)
  const db = new Database(sourcePath, { readonly: true })
  try {
    expect(db.prepare('SELECT value FROM sample WHERE id = 9223372036854775806').get()).toEqual({ value: 'unchanged — 😀' })
  } finally {
    db.close()
  }
  expect(fs.readdirSync(directory)).toEqual([basename(sourcePath)])
  assertAllHandlesClosed()
}

function readBackup(path, key = testKey) {
  const db = new Database(path, { readonly: true, fileMustExist: true })
  try {
    db.key(key)
    return {
      rows: db.prepare('SELECT * FROM sample ORDER BY id').safeIntegers().all(),
      integrity: db.pragma('integrity_check', { simple: true }),
      version: db.pragma('user_version', { simple: true }),
      application: db.pragma('application_id', { simple: true }),
      cipher: db.pragma('cipher', { simple: true }),
    }
  } finally {
    db.close()
  }
}

function assertUnreadableWithoutKey(path) {
  const db = new Database(path, { readonly: true })
  try {
    expect(() => db.pragma('user_version')).toThrow()
  } finally {
    db.close()
  }
}

describe('verified private database conversion backups', () => {
  test('publishes only after encryption and reopen verification, with private permissions from the first byte', () => {
    const events = []
    const DatabaseClass = trackedDatabase({
      onRekey(db) {
        const stagedPath = db.fixturePath
        events.push('rekey')
        expect(fs.readdirSync(directory).filter((name) => name.includes('.encrypted-backup-'))).toEqual([])
        expect(fs.statSync(stagedPath).mode & 0o777).toBe(0o600)
        expect(fs.statSync(join(stagedPath, '..')).mode & 0o777).toBe(0o700)
      },
      onKey() { events.push('keyed reopen') },
    })
    const fileSystem = {
      ...fs,
      writeSync(fd, ...args) {
        expect(fs.fstatSync(fd).mode & 0o777).toBe(0o600)
        return fs.writeSync(fd, ...args)
      },
      linkSync(staged, published) {
        expect(events).toEqual(['rekey', 'keyed reopen'])
        assertAllHandlesClosed()
        expect(readBackup(staged).integrity).toBe('ok')
        assertUnreadableWithoutKey(staged)
        events.push('publish')
        fs.linkSync(staged, published)
      },
    }
    const original = fs.readFileSync(sourcePath)
    const backupPath = backupDatabaseBeforeEncryption(sourcePath, testKey, { DatabaseClass, fileSystem })
    expect(events).toEqual(['rekey', 'keyed reopen', 'publish'])
    expect(fs.statSync(backupPath).mode & 0o777).toBe(0o600)
    expect(fs.readFileSync(sourcePath)).toEqual(original)
    expect(isPlaintextSqliteDatabase(backupPath)).toBe(false)
    const backup = readBackup(backupPath)
    expect(backup).toMatchObject({ integrity: 'ok', version: 7, application: 23, cipher: 'chacha20' })
    expect(backup.rows).toEqual([
      { id: 2n, value: null, amount: -1.5, payload: Buffer.alloc(0) },
      { id: 9223372036854775806n, value: 'unchanged — 😀', amount: 2.5, payload: Buffer.from([0, 255]) },
    ])
    expect(() => readBackup(backupPath, wrongKey)).toThrow()
    assertUnreadableWithoutKey(backupPath)
    expect(fs.readdirSync(directory).sort()).toEqual([basename(sourcePath), basename(backupPath)].sort())
    assertAllHandlesClosed()
  })

  test.each(['copy read', 'copy write', 'copy sync', 'copy destination open', 'backup open', 'rekey', 'verification reopen', 'verification key', 'verification integrity', 'verification content', 'unkeyed reopen', 'unkeyed unexpected error', 'publish'])(
    '%s failure leaves the plaintext source untouched and removes all staging',
    (phase) => {
      const original = fs.readFileSync(sourcePath)
      const injected = new Error(`injected ${phase}`)
      const descriptors = new Set()
      const isStaged = (db) => db.fixturePath.includes('.encryption-staging-')
      let opens = 0
      const DatabaseClass = trackedDatabase({
        onOpen(path) {
          if (path.includes('.encryption-staging-')) {
            opens += 1
            if ((phase === 'backup open' && opens === 1) || (phase === 'verification reopen' && opens === 2) || (phase === 'unkeyed reopen' && opens === 3)) throw injected
          }
        },
        onRekey() { if (phase === 'rekey') throw injected },
        onKey() { if (phase === 'verification key') throw injected },
        afterRekey(db) { if (phase === 'verification content') db.exec("UPDATE sample SET value = 'changed'") },
        onPragma(db, sql, _options, next) {
          if (isStaged(db) && db.fixtureOptions?.readonly && sql === 'integrity_check' && phase === 'verification integrity') return 'corrupt'
          if (phase === 'unkeyed unexpected error' && opens === 3 && sql === 'user_version') throw injected
          return next()
        },
      })
      const fileSystem = {
        ...fs,
        openSync(path, flags, mode) {
          if (phase === 'copy destination open' && flags === 'wx') throw injected
          const descriptor = fs.openSync(path, flags, mode)
          descriptors.add(descriptor)
          return descriptor
        },
        closeSync(descriptor) { descriptors.delete(descriptor); fs.closeSync(descriptor) },
        readSync(...args) { if (phase === 'copy read') throw injected; return fs.readSync(...args) },
        writeSync(...args) { if (phase === 'copy write') throw injected; return fs.writeSync(...args) },
        fsyncSync(...args) { if (phase === 'copy sync') throw injected; return fs.fsyncSync(...args) },
        linkSync(...args) { if (phase === 'publish') throw injected; return fs.linkSync(...args) },
      }
      expect(() => backupDatabaseBeforeEncryption(sourcePath, testKey, { DatabaseClass, fileSystem })).toThrow()
      expect(descriptors.size).toBe(0)
      assertSourceUnchanged(original)
    },
  )

  test('detects a rekey operation that silently leaves the backup plaintext', () => {
    const original = fs.readFileSync(sourcePath)
    const DatabaseClass = trackedDatabase({ skipRekey: true })
    expect(() => backupDatabaseBeforeEncryption(sourcePath, testKey, { DatabaseClass })).toThrow()
    assertSourceUnchanged(original)
  })

  test('explicitly rejects a backup readable without a key even if keyed checks appear to pass', () => {
    const original = fs.readFileSync(sourcePath)
    const DatabaseClass = trackedDatabase({ skipRekey: true, skipKey: true })
    expect(() => backupDatabaseBeforeEncryption(sourcePath, testKey, { DatabaseClass })).toThrow(/without its encryption key/)
    assertSourceUnchanged(original)
  })

  test('handles partial filesystem writes without losing data', () => {
    const fileSystem = {
      ...fs,
      writeSync(fd, buffer, offset, length) {
        return fs.writeSync(fd, buffer, offset, Math.min(length, 67))
      },
    }
    const backupPath = backupDatabaseBeforeEncryption(sourcePath, testKey, { fileSystem })
    expect(readBackup(backupPath).rows).toHaveLength(2)
  })

  test('aborts a zero-byte write and removes private staging', () => {
    const original = fs.readFileSync(sourcePath)
    expect(() => backupDatabaseBeforeEncryption(sourcePath, testKey, { fileSystem: { ...fs, writeSync: () => 0 } })).toThrow(/Unable to write/)
    assertSourceUnchanged(original)
  })

  test('unique names allow multiple backups without overwriting earlier recovery files', () => {
    const first = backupDatabaseBeforeEncryption(sourcePath, testKey)
    const firstBytes = fs.readFileSync(first)
    const second = backupDatabaseBeforeEncryption(sourcePath, testKey)
    expect(second).not.toBe(first)
    expect(fs.readFileSync(first)).toEqual(firstBytes)
    expect(readBackup(second).rows).toEqual(readBackup(first).rows)
  })

  test('atomic publication refuses an existing backup name and leaves it untouched', () => {
    const original = fs.readFileSync(sourcePath)
    const occupied = []
    const fileSystem = {
      ...fs,
      linkSync(staged, published) {
        fs.writeFileSync(published, 'existing recovery file', { mode: 0o600 })
        occupied.push(published)
        fs.linkSync(staged, published)
      },
    }
    expect(() => backupDatabaseBeforeEncryption(sourcePath, testKey, { fileSystem })).toThrow(/EEXIST/)
    expect(fs.readFileSync(occupied[0], 'utf8')).toBe('existing recovery file')
    fs.unlinkSync(occupied[0])
    assertSourceUnchanged(original)
  })
})

describe('automatic conversion and existing database compatibility', () => {
  test('starts source rekeying only after a verified recovery backup exists', () => {
    const DatabaseClass = trackedDatabase({
      onRekey(db) {
        if (db.fixturePath === sourcePath) {
          const backups = fs.readdirSync(directory).filter((name) => name.includes('.encrypted-backup-'))
          expect(backups).toHaveLength(1)
          expect(readBackup(join(directory, backups[0])).integrity).toBe('ok')
          assertUnreadableWithoutKey(join(directory, backups[0]))
        }
      },
    })
    const backupPath = encryptPlaintextDatabase(sourcePath, testKey, { DatabaseClass })
    expect(readBackup(sourcePath)).toEqual(readBackup(backupPath))
    assertUnreadableWithoutKey(sourcePath)
    assertAllHandlesClosed()
  })

  test('backup failure prevents source rekeying', () => {
    const original = fs.readFileSync(sourcePath)
    const rekeys = []
    const DatabaseClass = trackedDatabase({
      onRekey(db) {
        rekeys.push(db.fixturePath)
        throw new Error('failed backup rekey')
      },
    })
    expect(() => encryptPlaintextDatabase(sourcePath, testKey, { DatabaseClass })).toThrow('failed backup rekey')
    expect(rekeys).toHaveLength(1)
    expect(rekeys[0]).not.toBe(sourcePath)
    assertSourceUnchanged(original)
  })

  test('a failed source rekey retains a verified recoverable backup and closes handles', () => {
    const DatabaseClass = trackedDatabase({
      onRekey(db) {
        if (db.fixturePath === sourcePath) throw new Error('injected source rekey')
      },
    })
    expect(() => encryptPlaintextDatabase(sourcePath, testKey, { DatabaseClass })).toThrow('injected source rekey')
    const backup = fs.readdirSync(directory).find((name) => name.includes('.encrypted-backup-'))
    expect(readBackup(join(directory, backup)).integrity).toBe('ok')
    assertAllHandlesClosed()
  })

  test('source open failure after backup publication retains a valid recovery file', () => {
    let sourceOpens = 0
    const original = fs.readFileSync(sourcePath)
    const DatabaseClass = trackedDatabase({
      onOpen(path) {
        if (path === sourcePath && ++sourceOpens === 2) throw new Error('injected source open')
      },
    })
    expect(() => encryptPlaintextDatabase(sourcePath, testKey, { DatabaseClass })).toThrow('injected source open')
    expect(fs.readFileSync(sourcePath)).toEqual(original)
    const backup = fs.readdirSync(directory).find((name) => name.includes('.encrypted-backup-'))
    expect(readBackup(join(directory, backup)).integrity).toBe('ok')
    assertAllHandlesClosed()
  })

  test('busy checkpoints fail before copying or source rekeying', () => {
    const original = fs.readFileSync(sourcePath)
    const DatabaseClass = trackedDatabase({
      onPragma(_db, sql, _options, next) { return sql === 'wal_checkpoint(FULL)' ? [{ busy: 1 }] : next() },
    })
    expect(() => encryptPlaintextDatabase(sourcePath, testKey, { DatabaseClass })).toThrow(/checkpoint/)
    assertSourceUnchanged(original)
  })

  test('checkpoints committed WAL data before creating the backup', () => {
    const writer = new Database(sourcePath)
    writer.pragma('journal_mode = WAL')
    writer.exec("INSERT INTO sample VALUES (3, 'committed WAL data', 4, NULL)")
    // Leave the header in WAL mode after closing the last writer.
    writer.close()
    const backupPath = encryptPlaintextDatabase(sourcePath, testKey)
    expect(readBackup(backupPath).rows.find(({ id }) => id === 3n).value).toBe('committed WAL data')
    const encryptedDb = new Database(sourcePath)
    encryptedDb.key(testKey)
    try { expect(encryptedDb.pragma('journal_mode', { simple: true })).toBe('wal') } finally { encryptedDb.close() }
  })

  test('checkpoints an outstanding WAL before reading the main database for the backup', () => {
    const writer = new Database(sourcePath)
    writer.pragma('journal_mode = WAL')
    writer.exec("INSERT INTO sample VALUES (3, 'outstanding WAL data', 4, NULL)")
    expect(fs.statSync(sourcePath + '-wal').size).toBeGreaterThan(0)
    let checkpointed = false
    const DatabaseClass = trackedDatabase({
      onPragma(db, sql, _options, next) {
        if (db.fixturePath === sourcePath && sql === 'wal_checkpoint(FULL)') {
          const result = next()
          expect(result[0].busy).toBe(0)
          checkpointed = true
          return result
        }
        // Let the last independent reader leave before the source's mode
        // transition; the fixture writer stayed open through the backup copy.
        if (db.fixturePath === sourcePath && sql === 'journal_mode = DELETE') writer.close()
        return next()
      },
    })
    const fileSystem = {
      ...fs,
      openSync(path, ...args) {
        if (path === sourcePath) expect(checkpointed).toBe(true)
        return fs.openSync(path, ...args)
      },
    }
    try {
      const backupPath = encryptPlaintextDatabase(sourcePath, testKey, { DatabaseClass, fileSystem })
      expect(readBackup(backupPath).rows.find(({ id }) => id === 3n).value).toBe('outstanding WAL data')
    } finally {
      if (writer.open) writer.close()
    }
    assertAllHandlesClosed()
  })

  test('opens and converts plaintext through the same production entry point', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const db = openEncryptedDatabase(sourcePath, testKey)
    try {
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
      expect(db.prepare('SELECT COUNT(*) AS count FROM sample').get().count).toBe(2)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Encrypted backup saved at'))
    } finally {
      db.close()
    }
  })

  test('already encrypted files keep their existing key, cipher and contents, without conversion backups', () => {
    const existingDb = new Database(sourcePath)
    existingDb.rekey(testKey)
    existingDb.close()
    const original = fs.readFileSync(sourcePath)
    const db = openEncryptedDatabase(sourcePath, testKey)
    try {
      expect(db.pragma('cipher', { simple: true })).toBe('chacha20')
      expect(db.prepare('SELECT COUNT(*) AS count FROM sample').get().count).toBe(2)
    } finally {
      db.close()
    }
    expect(fs.readFileSync(sourcePath)).toEqual(original)
    expect(fs.readdirSync(directory)).toEqual([basename(sourcePath)])
  })

  test('wrong keys fail with a closed handle and leave encrypted source bytes unchanged', () => {
    const existingDb = new Database(sourcePath)
    existingDb.rekey(testKey)
    existingDb.close()
    const original = fs.readFileSync(sourcePath)
    const DatabaseClass = trackedDatabase()
    expect(() => openEncryptedDatabase(sourcePath, wrongKey, { DatabaseClass })).toThrow(/Check DATABASE_ENCRYPTION_KEY/)
    expect(fs.readFileSync(sourcePath)).toEqual(original)
    assertAllHandlesClosed()
  })

  test('key setup errors also close the database handle', () => {
    const DatabaseClass = trackedDatabase({ onKey() { throw new Error('injected key error') } })
    const newPath = join(directory, 'new.db')
    expect(() => openEncryptedDatabase(newPath, testKey, { DatabaseClass })).toThrow('injected key error')
    assertAllHandlesClosed()
  })

  test('a new database is encrypted without generating a conversion backup', () => {
    const newPath = join(directory, 'new.db')
    const db = openEncryptedDatabase(newPath, testKey)
    db.exec('CREATE TABLE created (id INTEGER)')
    db.close()
    expect(isPlaintextSqliteDatabase(newPath)).toBe(false)
    assertUnreadableWithoutKey(newPath)
    expect(fs.readdirSync(directory).sort()).toEqual(['fixture.db', 'new.db'])
  })

  test('header detection handles absent, short and plaintext files and closes descriptors on read errors', () => {
    expect(isPlaintextSqliteDatabase(join(directory, 'absent'))).toBe(false)
    const shortPath = join(directory, 'short')
    fs.writeFileSync(shortPath, 'short')
    expect(isPlaintextSqliteDatabase(shortPath)).toBe(false)
    expect(isPlaintextSqliteDatabase(sourcePath)).toBe(true)
    const closed = []
    expect(() => isPlaintextSqliteDatabase(sourcePath, {
      ...fs,
      readSync() { throw new Error('injected header read') },
      closeSync(fd) { closed.push(fd); fs.closeSync(fd) },
    })).toThrow('injected header read')
    expect(closed).toHaveLength(1)
  })
})
