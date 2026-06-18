import '../../config/env.js'
import Database from 'better-sqlite3-multiple-ciphers'
import { copyFileSync, existsSync, readFileSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { assertDifferentKeys, getRequiredSecretKey } from '../../shared/security/keys.js'
import {
  getCredentialKek,
} from '../../shared/security/envelopeEncryption.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'latin1')
const databaseKey = getRequiredSecretKey(
  ['DATABASE_ENCRYPTION_KEY', 'DB_ENCRYPTION_KEY'],
  'SQLite database encryption',
)
const credentialKek = getCredentialKek()

assertDifferentKeys(databaseKey, credentialKek, 'DATABASE_ENCRYPTION_KEY', 'CREDENTIALS_KEK')

function resolveDatabasePath() {
  return process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH || join(__dirname, '../../../spendings.db')
}

function isPlaintextSqliteDatabase(dbPath) {
  if (!existsSync(dbPath)) return false
  const stats = statSync(dbPath)
  if (stats.size < SQLITE_HEADER.length) return false

  return readFileSync(dbPath).subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER)
}

function checkpointPlaintextDatabase(dbPath) {
  const plaintextDb = new Database(dbPath)
  try {
    plaintextDb.pragma('wal_checkpoint(FULL)')
  } finally {
    plaintextDb.close()
  }
}

function backupDatabaseBeforeEncryption(dbPath) {
  const suffix = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${dbPath}.encrypted-backup-${suffix}`

  copyFileSync(dbPath, backupPath)
  const backupDb = new Database(backupPath)
  try {
    backupDb.rekey(databaseKey)
  } finally {
    backupDb.close()
  }

  return backupPath
}

function encryptPlaintextDatabase(dbPath) {
  checkpointPlaintextDatabase(dbPath)
  const backupPath = backupDatabaseBeforeEncryption(dbPath)
  const plaintextDb = new Database(dbPath)

  try {
    plaintextDb.rekey(databaseKey)
    console.warn(`Encrypted plaintext SQLite database in place. Encrypted backup saved at ${backupPath}`)
  } finally {
    plaintextDb.close()
  }
}

function openEncryptedDatabase(dbPath) {
  if (isPlaintextSqliteDatabase(dbPath)) {
    encryptPlaintextDatabase(dbPath)
  }

  const encryptedDb = new Database(dbPath)
  encryptedDb.key(databaseKey)

  try {
    encryptedDb.pragma('user_version', { simple: true })
  } catch (error) {
    encryptedDb.close()
    throw new Error(`Unable to open encrypted SQLite database at ${dbPath}. Check DATABASE_ENCRYPTION_KEY. ${error.message}`)
  }

  encryptedDb.pragma('foreign_keys = ON')
  return encryptedDb
}

export const db = openEncryptedDatabase(resolveDatabasePath())
