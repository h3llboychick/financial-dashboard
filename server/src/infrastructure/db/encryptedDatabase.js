import Database from 'better-sqlite3-multiple-ciphers'
import * as fs from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { serialize } from 'node:v8'

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'latin1')

export function isPlaintextSqliteDatabase(dbPath, fileSystem = fs) {
  if (!fileSystem.existsSync(dbPath)) return false
  const descriptor = fileSystem.openSync(dbPath, 'r')
  try {
    const header = Buffer.alloc(SQLITE_HEADER.length)
    return fileSystem.readSync(descriptor, header, 0, header.length, 0) === header.length && header.equals(SQLITE_HEADER)
  } finally {
    fileSystem.closeSync(descriptor)
  }
}

// Create the destination with restrictive permissions before writing any bytes.
// copyFileSync preserves the source's mode, even for an existing destination.
function copyPrivateDatabase(sourcePath, destinationPath, fileSystem) {
  const source = fileSystem.openSync(sourcePath, 'r')
  let destination
  try {
    destination = fileSystem.openSync(destinationPath, 'wx', 0o600)
    const buffer = Buffer.alloc(64 * 1024)
    let length
    while ((length = fileSystem.readSync(source, buffer, 0, buffer.length, null)) !== 0) {
      let written = 0
      while (written < length) {
        const count = fileSystem.writeSync(destination, buffer, written, length - written)
        if (count === 0) throw new Error('Unable to write SQLite backup')
        written += count
      }
    }
    fileSystem.fsyncSync(destination)
  } finally {
    try {
      if (destination !== undefined) fileSystem.closeSync(destination)
    } finally {
      fileSystem.closeSync(source)
    }
  }
}

// Compare schema, metadata and every stored value, including blobs and 64-bit
// integers. Rekeying does not reorder table scans. Stream rows to bound memory.
function databaseFingerprint(db) {
  const hash = createHash('sha256')
  const schema = db.prepare('SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name').raw().all()
  hash.update(serialize(schema))
  hash.update(serialize([db.pragma('user_version', { simple: true }), db.pragma('application_id', { simple: true })]))
  for (const [, name] of schema.filter(([type]) => type === 'table')) {
    const quotedName = `"${name.replaceAll('"', '""')}"`
    for (const row of db.prepare(`SELECT * FROM ${quotedName}`).safeIntegers().raw().iterate()) {
      hash.update(serialize(row))
    }
  }
  return hash.digest('hex')
}

function verifyEncryptedBackup(backupPath, key, expectedFingerprint, DatabaseClass) {
  const encryptedDb = new DatabaseClass(backupPath, { readonly: true, fileMustExist: true })
  try {
    encryptedDb.key(key)
    if (encryptedDb.pragma('integrity_check', { simple: true }) !== 'ok') {
      throw new Error('Encrypted SQLite backup failed integrity verification')
    }
    if (databaseFingerprint(encryptedDb) !== expectedFingerprint) {
      throw new Error('Encrypted SQLite backup content differs from its source')
    }
  } finally {
    encryptedDb.close()
  }

  const unkeyedDb = new DatabaseClass(backupPath, { readonly: true, fileMustExist: true })
  let rejectedWithoutKey = false
  try {
    unkeyedDb.pragma('user_version', { simple: true })
  } catch (error) {
    if (error.code !== 'SQLITE_NOTADB') throw error
    rejectedWithoutKey = true
  } finally {
    unkeyedDb.close()
  }
  if (!rejectedWithoutKey) throw new Error('SQLite backup is readable without its encryption key')
}

export function backupDatabaseBeforeEncryption(dbPath, key, {
  fileSystem = fs,
  DatabaseClass = Database,
  uniqueId = randomUUID,
} = {}) {
  // mkdtemp creates directories as 0700, including under a permissive umask.
  const stagingDirectory = fileSystem.mkdtempSync(join(dirname(dbPath), `.${basename(dbPath)}.encryption-staging-`))
  const stagedPath = join(stagingDirectory, 'backup.db')
  try {
    copyPrivateDatabase(dbPath, stagedPath, fileSystem)
    const backupDb = new DatabaseClass(stagedPath)
    let expectedFingerprint
    try {
      // A checkpointed WAL database still records WAL mode in its header.
      // Rekey requires rollback-journal mode, and this isolated copy has no
      // concurrent clients or WAL data left to preserve.
      backupDb.pragma('journal_mode = DELETE')
      expectedFingerprint = databaseFingerprint(backupDb)
      backupDb.rekey(key)
    } finally {
      backupDb.close()
    }
    verifyEncryptedBackup(stagedPath, key, expectedFingerprint, DatabaseClass)

    const suffix = `${new Date().toISOString().replace(/[:.]/g, '-')}-${uniqueId()}`
    const backupPath = `${dbPath}.encrypted-backup-${suffix}`
    // Same-filesystem hard-link publication is atomic and refuses to replace an
    // existing name. Only a closed, verified encrypted file reaches this path.
    fileSystem.linkSync(stagedPath, backupPath)
    return backupPath
  } finally {
    // Covers caught copy/open/rekey/verification/publication failures. A hard
    // process kill can leave the private, ignored staging directory behind.
    fileSystem.rmSync(stagingDirectory, { recursive: true, force: true })
  }
}

export function encryptPlaintextDatabase(dbPath, key, dependencies = {}) {
  const { DatabaseClass = Database } = dependencies
  const checkpointDb = new DatabaseClass(dbPath)
  try {
    const [{ busy }] = checkpointDb.pragma('wal_checkpoint(FULL)')
    if (busy !== 0) throw new Error('Unable to checkpoint SQLite database before encryption')
  } finally {
    checkpointDb.close()
  }

  const backupPath = backupDatabaseBeforeEncryption(dbPath, key, dependencies)
  const plaintextDb = new DatabaseClass(dbPath)
  try {
    const journalMode = plaintextDb.pragma('journal_mode', { simple: true })
    plaintextDb.pragma('journal_mode = DELETE')
    plaintextDb.rekey(key)
    if (journalMode === 'wal') plaintextDb.pragma('journal_mode = WAL')
  } finally {
    plaintextDb.close()
  }
  return backupPath
}

export function openEncryptedDatabase(dbPath, key, dependencies = {}) {
  const { DatabaseClass = Database, fileSystem = fs } = dependencies
  if (isPlaintextSqliteDatabase(dbPath, fileSystem)) {
    const backupPath = encryptPlaintextDatabase(dbPath, key, dependencies)
    console.warn(`Encrypted plaintext SQLite database in place. Encrypted backup saved at ${backupPath}`)
  }

  const encryptedDb = new DatabaseClass(dbPath)
  try {
    encryptedDb.key(key)
    encryptedDb.pragma('user_version', { simple: true })
    encryptedDb.pragma('foreign_keys = ON')
    return encryptedDb
  } catch (error) {
    encryptedDb.close()
    throw new Error(`Unable to open encrypted SQLite database at ${dbPath}. Check DATABASE_ENCRYPTION_KEY. ${error.message}`)
  }
}
