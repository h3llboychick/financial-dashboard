// Called only after PM2 has stopped the application's sole database writer.
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { settings } = require('./settings.cjs')

async function databaseKey(config) {
  const { getRequiredSecretKey, assertDifferentKeys } = await import(pathToFileURL(path.join(config.appDirectory, 'server/src/shared/security/keys.js')))
  // Read keys from the root file without exporting them to PM2 or the shell.
  const keyEnv = { ...process.env }
  for (const name of ['DATABASE_ENCRYPTION_KEY', 'DB_ENCRYPTION_KEY', 'CREDENTIALS_KEK']) delete process.env[name]
  Object.assign(process.env, config.env)
  let key
  try {
    key = getRequiredSecretKey(['DATABASE_ENCRYPTION_KEY', 'DB_ENCRYPTION_KEY'], 'SQLite database encryption')
    const kek = getRequiredSecretKey('CREDENTIALS_KEK', 'Credential encryption')
    assertDifferentKeys(key, kek, 'DATABASE_ENCRYPTION_KEY', 'CREDENTIALS_KEK')
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in keyEnv)) delete process.env[name]
    Object.assign(process.env, keyEnv)
  }
  return key
}

async function validateDatabase(config) {
  const Database = config.requireFromServer('better-sqlite3-multiple-ciphers')
  const key = await databaseKey(config)
  // Refuse plaintext input instead of silently creating a plaintext backup.
  const fd = fs.openSync(config.databasePath, 'r')
  try {
    const header = Buffer.alloc(16)
    fs.readSync(fd, header, 0, header.length, 0)
    if (header.equals(Buffer.from('SQLite format 3\0'))) throw new Error('Production database must already be encrypted')
  } finally { fs.closeSync(fd) }
  const database = new Database(config.databasePath, { readonly: true, fileMustExist: true })
  try {
    database.key(key)
    if (database.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Database integrity check failed')
  } finally { database.close() }
  return key
}

async function backupDatabase(destination, config, revisions = {}) {
  const Database = config.requireFromServer('better-sqlite3-multiple-ciphers')
  const key = await validateDatabase(config)
  fs.mkdirSync(destination, { mode: 0o700 })
  const backupPath = path.join(destination, 'database.db')
  for (const suffix of ['', '-wal']) {
    const source = `${config.databasePath}${suffix}`
    if (!fs.existsSync(source)) continue
    fs.copyFileSync(source, `${backupPath}${suffix}`, fs.constants.COPYFILE_EXCL)
    fs.chmodSync(`${backupPath}${suffix}`, 0o600)
  }
  const backup = new Database(backupPath, { readonly: true, fileMustExist: true })
  try {
    backup.key(key)
    if (backup.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Database backup integrity check failed')
  } finally { backup.close() }
  fs.writeFileSync(path.join(destination, 'metadata.json'), JSON.stringify({
    ...revisions, databasePath: config.databasePath, createdAt: new Date().toISOString(),
  }, null, 2), { mode: 0o600, flag: 'wx' })
  console.log('Encrypted database backup verified.')
}

module.exports = { backupDatabase, validateDatabase }
if (require.main === module) {
  const config = settings(process.argv[2])
  const operation = process.argv[3] === '--check' ? validateDatabase(config) : backupDatabase(process.argv[3], config, {
    previousRevision: process.argv[4], targetRevision: process.argv[5],
  })
  operation.catch(() => {
    console.error('Database validation or backup failed; deployment aborted before changing the checkout.')
    process.exitCode = 1
  })
}
