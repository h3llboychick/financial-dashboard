import { afterEach, describe, expect, test } from '@jest/globals'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import jwt from 'jsonwebtoken'

const workers = new Set()
const directories = new WeakMap()
const fixtureSecret = 'isolated-process-survival-test-signing-secret'
const token = jwt.sign({ user_id: 1 }, fixtureSecret)

afterEach(async () => {
  await Promise.all([...workers].map(async child => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      await once(child, 'exit')
    }
    rmSync(directories.get(child), { recursive: true, force: true })
    workers.delete(child)
  }))
})

async function startWorker() {
  const directory = mkdtempSync(join(tmpdir(), 'financial-api-security-'))
  const child = spawn(process.execPath, [new URL('./fixtures/securityWorker.js', import.meta.url).pathname], {
    env: {
      ...process.env, NODE_OPTIONS: '', NODE_ENV: 'test', SQLITE_DB_PATH: join(directory, 'fixture.db'),
      DATABASE_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      CREDENTIALS_KEK: randomBytes(32).toString('base64'), JWT_SECRET: fixtureSecret,
    },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  })
  workers.add(child)
  directories.set(child, directory)
  let stderr = ''
  child.stderr.on('data', data => { stderr += data })
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Fixture did not start')), 5000)
    child.once('message', ({ port }) => { clearTimeout(timeout); resolve({ child, url: `http://127.0.0.1:${port}` }) })
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Fixture exited (${code}): ${stderr}`)) })
  })
}

async function get(url, path) {
  try {
    const response = await fetch(`${url}${path}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(1500),
    })
    return { status: response.status, type: response.headers.get('content-type'), body: await response.json() }
  } catch (error) {
    return { connectionError: error.message }
  }
}

describe('malformed authenticated requests preserve the serving worker', () => {
  test.each([
    'target[toString]=x', 'target[]=EUR', 'target[foo]=EUR', 'target=EUR&target=USD',
    'sources[toString]=USD', 'sources[]=USD', 'sources[foo]=USD', 'sources=EUR&sources=USD',
  ])('rejects %s before a provider call and serves the next request', async query => {
    const { child, url } = await startWorker()
    expect(await get(url, `/api/exchange-rates?${query}`)).toMatchObject({ status: 400, type: expect.stringContaining('application/json') })
    expect(await get(url, '/api/exchange-rates?target=eur&sources=EUR')).toMatchObject({ status: 200, body: { target: 'EUR', rates: { EUR: 1 } } })
    expect(await get(url, '/fixture-stats')).toMatchObject({ body: { providerCalls: 0 } })
    expect(child.exitCode).toBeNull()
  })

  test('contains corrupted credential decryption, emits a generic JSON error, and stays available', async () => {
    const { child, url } = await startWorker()
    expect(await get(url, '/api/wallets/2/live-balance')).toMatchObject({ status: 500, type: expect.stringContaining('application/json'), body: { error: 'Internal server error' } })
    expect(await get(url, '/api/exchange-rates')).toMatchObject({ status: 200 })
    expect(await get(url, '/fixture-stats')).toMatchObject({ body: { providerCalls: 0 } })
    expect(child.exitCode).toBeNull()
  })
})
