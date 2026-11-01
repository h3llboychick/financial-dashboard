const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const Database = require('../../server/node_modules/better-sqlite3-multiple-ciphers')
const { settings } = require('../settings.cjs')
const { backupDatabase, validateDatabase } = require('../backup-database.cjs')
const { checkPm2 } = require('../check-pm2.cjs')
const { checkHealth } = require('../check-health.cjs')
const repo = path.resolve(__dirname, '../..')

function fixture(t, { plaintext = false, wal = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'financial-deployment-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const server = path.join(directory, 'app/server')
  fs.mkdirSync(server, { recursive: true })
  fs.symlinkSync(path.join(repo, 'server/src'), path.join(server, 'src'), 'dir')
  fs.symlinkSync(path.join(repo, 'server/node_modules'), path.join(server, 'node_modules'), 'dir')
  fs.copyFileSync(path.join(repo, 'server/package.json'), path.join(server, 'package.json'))
  fs.symlinkSync('../../.env', path.join(server, '.env'))
  const key = crypto.randomBytes(32)
  const databasePath = path.join(directory, 'financial.db')
  const db = new Database(databasePath)
  if (!plaintext) db.key(key)
  if (wal) db.pragma('journal_mode = WAL')
  db.exec("CREATE TABLE fixture (value TEXT); INSERT INTO fixture VALUES ('preserve financial data')")
  if (!wal) db.close()
  else t.after(() => db.close())
  const env = {
    DATABASE_PATH: databasePath,
    DATABASE_ENCRYPTION_KEY: key.toString('base64'),
    CREDENTIALS_KEK: crypto.randomBytes(32).toString('base64'),
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  }
  const writeEnv = () => fs.writeFileSync(path.join(directory, '.env'), Object.entries(env).map(([name, value]) => `${name}=${value}`).join('\n'), { mode: 0o600 })
  writeEnv()
  return { directory, env, key, databasePath, writeEnv }
}

test('deployment settings refuse a relative, missing, or conflicting database path', t => {
  const f = fixture(t)
  f.env.DATABASE_PATH = 'financial.db'
  f.writeEnv()
  assert.throws(() => settings(f.directory), /absolute path/)
  f.env.DATABASE_PATH = path.join(f.directory, 'missing.db')
  f.writeEnv()
  assert.throws(() => settings(f.directory), /ENOENT/)
  f.env.DATABASE_PATH = f.databasePath
  f.env.SQLITE_DB_PATH = path.join(f.directory, 'other.db')
  f.writeEnv()
  assert.throws(() => settings(f.directory), /same database/)
})

test('settings read the private root configuration and refuse development mode', t => {
  const f = fixture(t)
  const config = settings(f.directory)
  assert.equal(config.env.NODE_ENV, 'production')
  assert.equal(config.databasePath, f.databasePath)
  f.env.NODE_ENV = 'dev'
  f.writeEnv()
  assert.throws(() => settings(f.directory), /NODE_ENV=production/)
})

test('settings reject a copied environment file, broad permissions, and a database inside app/', t => {
  const f = fixture(t)
  fs.chmodSync(path.join(f.directory, '.env'), 0o644)
  assert.throws(() => settings(f.directory), /private file/)
  fs.chmodSync(path.join(f.directory, '.env'), 0o600)
  const link = path.join(f.directory, 'app/server/.env')
  fs.unlinkSync(link)
  fs.copyFileSync(path.join(f.directory, '.env'), link)
  assert.throws(() => settings(f.directory), /must link/)
  fs.unlinkSync(link)
  fs.symlinkSync('../../.env', link)
  const inside = path.join(f.directory, 'app/financial.db')
  fs.copyFileSync(f.databasePath, inside)
  f.env.DATABASE_PATH = inside
  f.writeEnv()
  assert.throws(() => settings(f.directory), /outside app/)
})

test('encrypted deployment backup preserves data and requires the existing key', async t => {
  const f = fixture(t)
  const directory = path.join(f.directory, 'backup')
  await backupDatabase(directory, settings(f.directory), { previousRevision: 'a'.repeat(40), targetRevision: 'b'.repeat(40) })
  const backupPath = path.join(directory, 'database.db')
  assert.equal(fs.statSync(directory).mode & 0o777, 0o700)
  assert.equal(fs.statSync(backupPath).mode & 0o777, 0o600)
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'metadata.json'), 'utf8'))
  assert.equal(metadata.previousRevision, 'a'.repeat(40))
  assert.equal(metadata.targetRevision, 'b'.repeat(40))
  const unkeyed = new Database(backupPath, { readonly: true })
  try { assert.throws(() => unkeyed.prepare('SELECT * FROM fixture').all()) } finally { unkeyed.close() }
  const keyed = new Database(backupPath, { readonly: true })
  try {
    keyed.key(f.key)
    assert.deepEqual(keyed.prepare('SELECT * FROM fixture').all(), [{ value: 'preserve financial data' }])
  } finally { keyed.close() }
  await assert.rejects(backupDatabase(directory, settings(f.directory)), /EEXIST/)
})

test('backup includes committed WAL data', async t => {
  // Keep the fixture connection idle so SQLite retains the WAL file.
  const f = fixture(t, { wal: true })
  const directory = path.join(f.directory, 'backup')
  await backupDatabase(directory, settings(f.directory))
  const keyed = new Database(path.join(directory, 'database.db'), { readonly: true })
  try {
    keyed.key(f.key)
    assert.equal(keyed.prepare('SELECT COUNT(*) AS count FROM fixture').get().count, 1)
  } finally { keyed.close() }
})

test('preflight refuses plaintext and incorrect encryption keys', async t => {
  const plain = fixture(t, { plaintext: true })
  await assert.rejects(validateDatabase(settings(plain.directory)), /already be encrypted/)
  const encrypted = fixture(t)
  encrypted.env.DATABASE_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')
  encrypted.writeEnv()
  await assert.rejects(validateDatabase(settings(encrypted.directory)))
})

test('SSH deployment rejects shell metacharacters before making a connection', () => {
  const result = spawnSync('bash', ['.github/scripts/deploy-ssh.sh'], {
    cwd: repo, encoding: 'utf8',
    env: { ...process.env, DEPLOY_HOST: 'example.com;unexpected-command', DEPLOY_USER: 'fixture-user',
      DEPLOY_SSH_KEY: 'unused-test-value', DEPLOY_KNOWN_HOSTS: 'unused-test-value',
      DEPLOY_ROOT: '/srv/fixture-app',
      DEPLOY_PM2_NAME: 'fixture-app' },
  })
  assert.equal(result.status, 2)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
})

test('deployment runs only for master pushes/manual runs after both CI jobs succeed', () => {
  const yaml = require('../../node_modules/js-yaml')
  const workflow = yaml.load(fs.readFileSync(path.join(repo, '.github/workflows/ci.yml'), 'utf8'))
  assert.deepEqual(workflow.jobs.deploy.needs, ['test-and-build', 'secret-scan'])
  assert.match(workflow.jobs.deploy.if, /github.event_name == 'push'/)
  assert.match(workflow.jobs.deploy.if, /refs\/heads\/master/)
  assert.match(workflow.jobs.deploy.if, /DEPLOY_ENABLED == 'true'/)
  assert.equal(workflow.jobs.deploy.concurrency['cancel-in-progress'], false)
  assert.equal(workflow.jobs.deploy.environment, 'production')
  assert.deepEqual(workflow.permissions, { contents: 'read' })
  assert.equal(workflow.jobs.deploy.env, undefined)
  const connection = workflow.jobs.deploy.steps.find(step => step.name === 'Deploy and verify')
  for (const name of ['DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_ROOT', 'DEPLOY_PM2_NAME', 'DEPLOY_SSH_KEY', 'DEPLOY_KNOWN_HOSTS']) {
    assert.equal(connection.env[name], '${{ secrets.' + name + ' }}')
  }
  assert.ok(workflow.on.workflow_dispatch !== undefined || Object.hasOwn(workflow.on, 'workflow_dispatch'))
})

test('PM2 preflight rejects incorrect paths, duplicate processes, and conflicting secrets', t => {
  const f = fixture(t)
  const config = settings(f.directory)
  const app = { name: 'fixture-app', pm2_env: { status: 'online', exec_mode: 'fork_mode', watch: false,
    pm_exec_path: path.join(config.appDirectory, 'server/src/server.js'), pm_cwd: config.appDirectory, env: {} } }
  assert.doesNotThrow(() => checkPm2([app], app.name, config))
  assert.throws(() => checkPm2([app, app], app.name, config), /exactly one/)
  assert.throws(() => checkPm2([app, { ...app, name: 'another-writer' }], app.name, config), /Another PM2 process/)
  assert.throws(() => checkPm2([{ ...app, pm2_env: { ...app.pm2_env, pm_cwd: f.directory } }], app.name, config), /working directory/)
  assert.throws(() => checkPm2([{ ...app, pm2_env: { ...app.pm2_env, watch: true } }], app.name, config), /watch disabled/)
  const wrongSecret = { ...app, pm2_env: { ...app.pm2_env, env: { JWT_SECRET: 'conflicting-test-value' } } }
  assert.throws(() => checkPm2([wrongSecret], app.name, config), /conflicting JWT_SECRET/)
})

test('readiness requires the expected commit, a successful response, and a working database', async () => {
  const target = 'b'.repeat(40)
  let calls = 0
  await checkHealth({ port: 3001 }, target, { attempts: 2, intervalMs: 0, fetchImpl: async () => ({
    ok: true, json: async () => ({ status: 'ok', revision: ++calls === 1 ? 'a'.repeat(40) : target }),
  }) })
  assert.equal(calls, 2)
  for (const response of [
    { ok: true, json: async () => ({ status: 'ok', revision: 'a'.repeat(40) }) },
    { ok: false, json: async () => ({ status: 'ok', revision: target }) },
    { ok: true, json: async () => ({ status: 'unavailable', revision: target }) },
  ]) {
    await assert.rejects(checkHealth({ port: 3001 }, target, { attempts: 1, fetchImpl: async () => response }), /did not become healthy/)
  }
})
