const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const crypto = require('node:crypto')
const { spawn, spawnSync } = require('node:child_process')
const Database = require('../../server/node_modules/better-sqlite3-multiple-ciphers')
const { checkHealth } = require('../check-health.cjs')
const repo = path.resolve(__dirname, '../..')

test('in-place deployment with isolated Git, encrypted SQLite, and a real PM2 daemon', { timeout: 180000 }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'financial-in-place-'))
  const app = path.join(root, 'app')
  const bin = path.join(root, 'bin')
  fs.mkdirSync(path.join(app, 'server'), { recursive: true })
  fs.mkdirSync(path.join(app, 'client/dist'), { recursive: true })
  fs.mkdirSync(path.join(root, '.deploy/incoming'), { recursive: true })
  fs.mkdirSync(bin)
  fs.symlinkSync(path.join(repo, 'node_modules/pm2/bin/pm2'), path.join(bin, 'pm2'))
  const npmCli = fs.realpathSync(spawnSync('which', ['npm'], { encoding: 'utf8' }).stdout.trim())
  fs.writeFileSync(path.join(bin, 'npm'), `#!/usr/bin/env node
if (require('node:fs').existsSync(${JSON.stringify(path.join(root, 'fail-install'))})) process.exit(42)
const result = require('node:child_process').spawnSync(process.execPath, [${JSON.stringify(npmCli)}, ...process.argv.slice(2)], {stdio: 'inherit'})
process.exit(result.status ?? 1)
`, { mode: 0o700 })
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, PM2_HOME: path.join(root, 'pm2'),
    PM2_DISABLE_INTERACTION: 'true', NODE_ENV: 'production',
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `url.file://${app}/.git.insteadOf`,
    GIT_CONFIG_VALUE_0: 'https://github.com/fixture/dashboard.git' }

  function run(command, args, { allowFailure = false, extraEnv = {}, cwd = app } = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, env: { ...env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = '', stderr = ''
      const timeout = setTimeout(() => child.kill('SIGTERM'), 60000)
      child.stdout.on('data', data => { stdout += data })
      child.stderr.on('data', data => { stderr += data })
      child.on('error', error => { clearTimeout(timeout); reject(error) })
      child.on('close', code => {
        clearTimeout(timeout)
        if (code !== 0 && !allowFailure) reject(new Error(`${command} failed (${code}): ${stdout.slice(-1500)} ${stderr.slice(-1500)}`))
        else resolve({ code, stdout, stderr })
      })
    })
  }
  t.after(async () => {
    await run('pm2', ['kill'], { allowFailure: true })
    fs.rmSync(root, { recursive: true, force: true })
  })

  fs.cpSync(path.join(repo, 'server/src'), path.join(app, 'server/src'), { recursive: true })
  for (const name of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(repo, 'server', name), path.join(app, 'server', name))
  // No root dependencies are needed by the fixture. Server dependencies and PM2
  // are real; only the deliberate npm failure is injected below.
  fs.writeFileSync(path.join(app, 'package.json'), '{"name":"deployment-fixture","private":true}\n')
  fs.writeFileSync(path.join(app, 'package-lock.json'), JSON.stringify({ name: 'deployment-fixture', lockfileVersion: 3, requires: true,
    packages: { '': { name: 'deployment-fixture' } } }))
  fs.writeFileSync(path.join(app, '.gitignore'), 'node_modules/\n.env*\nclient/dist/\n')
  await run('git', ['init', '-b', 'master'])
  await run('git', ['config', 'user.name', 'Deployment test'])
  await run('git', ['config', 'user.email', 'deployment@example.invalid'])
  await run('git', ['remote', 'add', 'origin', 'https://github.com/fixture/dashboard.git'])
  await run('git', ['add', '.'])
  await run('git', ['commit', '-m', 'initial application'])
  const initial = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim()
  fs.writeFileSync(path.join(app, 'deployment-marker.txt'), 'new version\n')
  await run('git', ['add', 'deployment-marker.txt'])
  await run('git', ['commit', '-m', 'next application'])
  const target = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim()
  await run('git', ['checkout', '--detach', initial])
  await run('npm', ['ci', '--prefix', path.join(app, 'server'), '--omit=dev', '--no-audit', '--no-fund'])

  const listener = net.createServer()
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
  const port = listener.address().port
  await new Promise(resolve => listener.close(resolve))
  const key = crypto.randomBytes(32)
  fs.mkdirSync(path.join(root, 'data'), { mode: 0o700 })
  const databasePath = path.join(root, 'data/financial.db')
  const db = new Database(databasePath)
  db.key(key)
  db.exec("CREATE TABLE deployment_fixture (value TEXT); INSERT INTO deployment_fixture VALUES ('preserved')")
  db.close()
  const envBytes = Object.entries({ NODE_ENV: 'production', PORT: port, DATABASE_PATH: databasePath,
    DATABASE_ENCRYPTION_KEY: key.toString('base64'), CREDENTIALS_KEK: crypto.randomBytes(32).toString('base64'),
    JWT_SECRET: crypto.randomBytes(32).toString('hex') }).map(([name, value]) => `${name}=${value}`).join('\n')
  fs.writeFileSync(path.join(root, '.env'), envBytes, { mode: 0o600 })
  fs.symlinkSync('../../.env', path.join(app, 'server/.env'))
  fs.writeFileSync(path.join(app, 'client/dist/index.html'), 'old frontend')
  fs.writeFileSync(path.join(app, 'client/dist/obsolete.js'), 'old asset')
  await run('pm2', ['start', path.join(app, 'server/src/server.js'), '--name', 'fixture-app', '--cwd', app], { extraEnv: { APP_REVISION: initial } })
  await checkHealth({ port }, initial, { attempts: 50, intervalMs: 100 })

  let attempt = 0
  async function deploy(commit, mode = '') {
    const runId = `${++attempt}-1`
    const bundle = path.join(root, `bundle-${attempt}`)
    fs.mkdirSync(path.join(bundle, 'client/dist'), { recursive: true })
    fs.cpSync(path.join(repo, 'deploy'), path.join(bundle, 'deploy'), { recursive: true,
      filter: source => !source.includes(`${path.sep}tests`) && !source.endsWith('LOCAL_SETUP.md') })
    fs.writeFileSync(path.join(bundle, 'COMMIT'), mode === 'wrong-artifact' ? '0'.repeat(40) : commit)
    fs.writeFileSync(path.join(bundle, 'client/dist/index.html'), 'tested frontend')
    if (mode === 'backup-failure') {
      const file = path.join(bundle, 'deploy/backup-database.cjs')
      fs.writeFileSync(file, "if (require.main === module && process.argv[3] !== '--check') throw new Error('Deliberate backup failure')\n" + fs.readFileSync(file, 'utf8'))
    }
    if (mode === 'health-failure') fs.writeFileSync(path.join(bundle, 'deploy/check-health.cjs'), "throw new Error('Deliberate readiness failure')\n")
    const archive = path.join(root, '.deploy/incoming', `${commit}-${runId}.tgz`)
    await run('tar', ['-czf', archive, '-C', bundle, '.'])
    const result = await run('bash', [path.join(repo, 'deploy/deploy.sh'), root, 'fixture-app', commit, runId, 'fixture/dashboard'], { allowFailure: true })
    return { ...result, backup: path.join(root, 'backups', `${commit}-${runId}`) }
  }
  const pm2App = async () => JSON.parse((await run('pm2', ['jlist'])).stdout).find(process => process.name === 'fixture-app')

  await t.test('a dirty checkout and mismatched artifact leave the running app untouched', async () => {
    fs.writeFileSync(path.join(app, 'local-change.txt'), 'preserve local changes')
    const dirty = await deploy(target)
    assert.notEqual(dirty.code, 0)
    assert.match(dirty.stderr, /uncommitted changes/)
    assert.equal((await pm2App()).pm2_env.status, 'online')
    assert.equal((await run('git', ['rev-parse', 'HEAD'])).stdout.trim(), initial)
    fs.unlinkSync(path.join(app, 'local-change.txt'))
    const mismatch = await deploy(target, 'wrong-artifact')
    assert.notEqual(mismatch.code, 0)
    assert.match(mismatch.stderr, /does not match/)
    await checkHealth({ port }, initial)
  })

  await t.test('a backup failure restarts the unchanged checkout', async () => {
    const failed = await deploy(target, 'backup-failure')
    assert.notEqual(failed.code, 0)
    assert.match(failed.stderr, /before the checkout changed/)
    assert.equal((await run('git', ['rev-parse', 'HEAD'])).stdout.trim(), initial)
    await checkHealth({ port }, initial)
  })

  await t.test('successful deployment uses the tested commit/assets and preserves root configuration and data', async () => {
    const success = await deploy(target)
    assert.equal(success.code, 0, success.stdout + success.stderr)
    assert.equal((await run('git', ['rev-parse', 'HEAD'])).stdout.trim(), target)
    assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), envBytes)
    assert.equal(fs.readlinkSync(path.join(app, 'server/.env')), '../../.env')
    assert.equal(fs.existsSync(path.join(app, 'client/dist/obsolete.js')), false)
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/`)).text(), 'tested frontend')
    const process = await pm2App()
    assert.equal(process.pm2_env.pm_exec_path, path.join(app, 'server/src/server.js'))
    assert.equal(process.pm2_env.pm_cwd, app)
    assert.equal(process.pm2_env.env.DATABASE_ENCRYPTION_KEY, undefined)
    assert.equal(fs.readFileSync(path.join(root, '.deploy/deployed-commit'), 'utf8').trim(), target)
    const metadata = JSON.parse(fs.readFileSync(path.join(success.backup, 'metadata.json'), 'utf8'))
    assert.equal(metadata.previousRevision, initial)
    assert.equal(metadata.targetRevision, target)
    const copy = new Database(path.join(success.backup, 'database.db'), { readonly: true })
    try { copy.key(key); assert.equal(copy.prepare('SELECT value FROM deployment_fixture').get().value, 'preserved') }
    finally { copy.close() }
  })

  // Prepare another forward commit without changing the currently served source.
  fs.writeFileSync(path.join(app, 'deployment-marker.txt'), 'next update\n')
  await run('git', ['add', 'deployment-marker.txt'])
  await run('git', ['commit', '-m', 'another application update'])
  const next = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim()
  await run('git', ['checkout', '--detach', target])

  await t.test('install failure after checkout preserves the backup and leaves PM2 stopped', async () => {
    fs.writeFileSync(path.join(root, 'fail-install'), '')
    const failed = await deploy(next)
    fs.unlinkSync(path.join(root, 'fail-install'))
    assert.notEqual(failed.code, 0)
    assert.match(failed.stderr, /Recover manually/)
    assert.equal((await pm2App()).pm2_env.status, 'stopped')
    assert.ok(fs.existsSync(path.join(failed.backup, 'database.db')))
    assert.equal(fs.readFileSync(path.join(root, '.deploy/deployed-commit'), 'utf8').trim(), target)
    // Explicit operator-style recovery before the next failure scenario.
    await run('git', ['checkout', '--detach', target])
    await run('pm2', ['restart', 'fixture-app', '--update-env'], { extraEnv: { APP_REVISION: target } })
    await checkHealth({ port }, target)
  })

  await t.test('readiness failure stops the new code and retains the prior successful revision', async () => {
    const failed = await deploy(next, 'health-failure')
    assert.notEqual(failed.code, 0)
    assert.equal((await pm2App()).pm2_env.status, 'stopped')
    assert.ok(fs.existsSync(path.join(failed.backup, 'database.db')))
    assert.equal(fs.readFileSync(path.join(root, '.deploy/deployed-commit'), 'utf8').trim(), target)
    assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), envBytes)
    await run('pm2', ['kill'])
    await run('pm2', ['resurrect'])
    assert.equal((await pm2App()).pm2_env.status, 'stopped')
  })
})
