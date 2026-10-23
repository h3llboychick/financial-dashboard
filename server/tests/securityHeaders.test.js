import { afterAll, afterEach, describe, expect, jest, test } from '@jest/globals'
import Database from 'better-sqlite3-multiple-ciphers'
import request from 'supertest'
import { initializeFinancialData } from './fixtures/financialData.js'

// Exercise the real app without opening a developer's database or loading keys.
const db = new Database(':memory:')
initializeFinancialData(db)
jest.unstable_mockModule('../src/infrastructure/db/connection.js', () => ({ db }))
const { createApp } = await import('../src/app.js')

const originalEnv = { NODE_ENV: process.env.NODE_ENV, DEV_AUTH_USER_ID: process.env.DEV_AUTH_USER_ID }
afterEach(() => {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})
afterAll(() => db.close())

function appFor(environment) {
  process.env.NODE_ENV = environment
  process.env.DEV_AUTH_USER_ID = '1'
  return createApp()
}

function expectSecurityHeaders(response) {
  expect(response.headers['x-content-type-options']).toBe('nosniff')
  expect(response.headers['x-frame-options']).toBe('SAMEORIGIN')
  expect(response.headers['referrer-policy']).toBe('no-referrer')
  expect(response.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups')
  expect(response.headers['cross-origin-resource-policy']).toBe('same-origin')
  expect(response.headers['x-powered-by']).toBeUndefined()
  expect(response.headers['content-security-policy']).toContain("object-src 'none'")
}

describe('Helmet headers on the real Express application', () => {
  test('protects production responses and permits only the required Telegram script and frame origins', async () => {
    const response = await request(appFor('production')).get('/api/config').expect(200)
    expectSecurityHeaders(response)
    expect(response.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains')
    const policy = response.headers['content-security-policy'].split(';')
    expect(policy).toContain('upgrade-insecure-requests')
    expect(policy).toContain("script-src 'self' https://telegram.org 'unsafe-eval'")
    expect(policy).toContain("script-src-attr 'none'")
    expect(policy).toContain("frame-src 'self' https://oauth.telegram.org")
    expect(policy).toContain("connect-src 'self'")
    expect(policy).toContain("style-src 'self' 'unsafe-inline'")
  })

  test.each(['dev', 'development', 'test'])('keeps HTTP usable in %s without dropping other protections', async environment => {
    const response = await request(appFor(environment)).get('/api/config').expect(200)
    expectSecurityHeaders(response)
    expect(response.headers['strict-transport-security']).toBeUndefined()
    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests')
  })

  test('protects authentication failures and body-parser errors', async () => {
    const app = appFor('production')
    const unauthorized = await request(app).get('/api/wallets').expect(401)
    expectSecurityHeaders(unauthorized)
    const invalidJson = await request(app).post('/api/auth/telegram')
      .set('Content-Type', 'application/json').send('{').expect(400)
    expectSecurityHeaders(invalidJson)
    expect(invalidJson.body).toEqual({ error: 'Invalid JSON body' })
  })

  test('protects CORS preflight responses without preventing them', async () => {
    const response = await request(appFor('production')).options('/api/wallets')
      .set('Origin', 'https://client.example')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization').expect(204)
    expectSecurityHeaders(response)
    expect(response.headers['access-control-allow-origin']).toBe('*')
    expect(response.headers['access-control-allow-headers']).toBe('authorization')
  })

  test('serves development Swagger HTML and scripts under the same-origin script policy', async () => {
    const app = appFor('dev')
    const page = await request(app).get('/api/docs/').expect(200)
    expectSecurityHeaders(page)
    const scripts = [...page.text.matchAll(/<script src="([^"]+)"/g)].map(match => match[1])
    expect(scripts).toEqual(['./swagger-ui-bundle.js', './swagger-ui-standalone-preset.js', './swagger-ui-init.js'])
    for (const script of scripts) {
      const response = await request(app).get(`/api/docs/${script.slice(2)}`).expect(200)
      expectSecurityHeaders(response)
    }
  })
})
