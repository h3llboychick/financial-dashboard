import '../../config/env.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { assertDifferentKeys, getRequiredSecretKey } from '../../shared/security/keys.js'
import {
  getCredentialKek,
} from '../../shared/security/envelopeEncryption.js'
import { openEncryptedDatabase } from './encryptedDatabase.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const databaseKey = getRequiredSecretKey(
  ['DATABASE_ENCRYPTION_KEY', 'DB_ENCRYPTION_KEY'],
  'SQLite database encryption',
)
const credentialKek = getCredentialKek()

assertDifferentKeys(databaseKey, credentialKek, 'DATABASE_ENCRYPTION_KEY', 'CREDENTIALS_KEK')

function resolveDatabasePath() {
  return process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH || join(__dirname, '../../../spendings.db')
}

export const db = openEncryptedDatabase(resolveDatabasePath(), databaseKey)
