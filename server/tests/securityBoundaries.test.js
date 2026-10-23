import { afterEach, describe, expect, jest, test } from '@jest/globals'
import express from 'express'
import request from 'supertest'
import { asyncHandler } from '../src/shared/middleware/asyncHandler.js'
import { errorHandler } from '../src/shared/middleware/errorHandler.js'
import { RequestValidationError, boundedString, credentialInput, currencyInput, dateInput, enumInput, money, nameInput, objectInput, positiveId, rateQueryInput } from '../src/shared/validation/financialInput.js'
import { makeExchangeRatesRouter } from '../src/modules/exchangeRates/exchangeRates.routes.js'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch; jest.restoreAllMocks() })

function appWithErrors() {
  const app = express()
  app.use(express.json())
  app.use('/rates', makeExchangeRatesRouter())
  app.get('/async-error', asyncHandler(async () => { throw new Error('private internal detail') }))
  app.get('/sync-error', asyncHandler(() => { throw new Error('private internal detail') }))
  app.get('/validation-error', asyncHandler(() => { throw new RequestValidationError('Invalid field') }))
  app.get('/fixture/:id', (req, res) => res.json({ id: req.params.id }))
  app.post('/body', (req, res) => res.json(req.body))
  app.use(errorHandler)
  return app
}

describe('security helper domain boundaries', () => {
  test('object values and IDs are checked without implicit coercion', () => {
    for (const value of [undefined, null, true, 1, '1', []]) expect(() => objectInput(value)).toThrow(RequestValidationError)
    expect(objectInput({})).toEqual({})
    expect(positiveId('00001')).toBe(1)
    expect(positiveId(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER)
    for (const value of [undefined, null, true, [], {}, 0, -1, 1.1, '1e0', ' 1 ', Number.MAX_SAFE_INTEGER + 1]) expect(() => positiveId(value)).toThrow(RequestValidationError)
  })
  test('money accepts finite decimal representations within inclusive bounds', () => {
    for (const value of [0, '-1000000000000', 1e12, ' .25 ', '+1.50', '1e3']) expect(money(value, 'amount')).toBe(Number(value))
    for (const value of [NaN, Infinity, -Infinity, 1e12 + 1, -(1e12 + 1), '1e309', true, [], null, '', ' ', '0xff']) expect(() => money(value, 'amount')).toThrow(RequestValidationError)
    expect(money('.01', 'amount', { positive: true })).toBe(.01)
    for (const value of [0, -1, '1e-999']) expect(() => money(value, 'amount', { positive: true })).toThrow(RequestValidationError)
  })
  test('strings preserve notes/credentials but normalize names and currency', () => {
    expect(nameInput(' Wallet 🌍 ')).toBe('Wallet 🌍')
    expect(currencyInput(' eur ')).toBe('EUR')
    expect(boundedString('  note  ', 'note', { max: 10 })).toBe('  note  ')
    for (const value of [undefined, null, true, {}, [], '']) expect(() => nameInput(value)).toThrow(RequestValidationError)
    expect(enumInput('fiat', new Set(['fiat']), 'type')).toBe('fiat')
    expect(() => enumInput(['fiat'], new Set(['fiat']), 'type')).toThrow(RequestValidationError)
  })
  test('dates validate calendar days including century leap rules and year boundaries', () => {
    for (const value of ['0001-01-01', '0099-12-31', '2000-02-29', '2024-02-29', '9999-12-31']) expect(dateInput(value)).toBe(value)
    for (const value of ['0000-01-01', '1900-02-29', '2026-02-29', '2024-02-30', '2026-04-31', '2026-13-01']) expect(() => dateInput(value)).toThrow(RequestValidationError)
  })
  test('credentials are own exact adapter fields and retain supplied secret bytes', () => {
    const fields = [{ name: 'api_key' }, { name: 'api_secret' }]
    const valid = { api_key: ' key ', api_secret: ' secret ' }
    expect(credentialInput(valid, fields)).toEqual(valid)
    expect(() => credentialInput(Object.create(valid), fields)).toThrow('Missing credential field')
    expect(() => credentialInput({ ...valid, extra: 'field' }, fields)).toThrow('Unknown credential field')
    expect(() => credentialInput({ ...valid, api_key: ' ' }, fields)).toThrow(RequestValidationError)
  })
  test('rate query defaults, deduplication and malformed structures', () => {
    expect(rateQueryInput({})).toEqual({ target: 'EUR', sources: [] })
    expect(rateQueryInput({ target: 'usd', sources: ' eur,EUR,gbp,, ' })).toEqual({ target: 'USD', sources: ['EUR', 'GBP'] })
    for (const value of [[], ['EUR'], {}, true, null]) {
      expect(() => rateQueryInput({ target: value })).toThrow(RequestValidationError)
      expect(() => rateQueryInput({ sources: value })).toThrow(RequestValidationError)
    }
  })
})

describe('central Express 4 error containment', () => {
  test.each(['%E0%A4%A', '%FF', '%'])('rejects malformed path encoding %s without leaking request details', async encoded => {
    const app = appWithErrors()
    const response = await request(app).get(`/fixture/${encoded}`)
    expect(response.status).toBe(400)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).toEqual({ error: 'Invalid URL encoding' })
    expect(response.text).not.toContain(encoded)
    expect(response.text).not.toContain('URIError')
    expect((await request(app).get('/fixture/healthy')).body).toEqual({ id: 'healthy' })
  })
  test.each([
    new URIError('private internal URI detail'),
    Object.assign(new Error("Failed to decode param 'private path'"), { status: 400, statusCode: 400 }),
    { name: 'URIError', message: "Failed to decode param 'private path'", status: 400, statusCode: 400 },
    Object.assign(new URIError('private internal URI detail'), { status: 400 }),
    Object.assign(new URIError('private internal URI detail'), { statusCode: 400 }),
    Object.assign(new Error('private unsupported media detail'), { status: 415, statusCode: 415 }),
    Object.assign(new Error('private unsupported charset detail'), { type: 'charset.unsupported', status: 500, statusCode: 500 }),
    Object.assign(new Error('private unsupported encoding detail'), { type: 'encoding.unsupported', status: 500, statusCode: 500 }),
  ])('keeps unclassified error %p generic despite client-like fields', error => {
    const response = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn() }
    errorHandler(error, {}, response, jest.fn())
    expect(response.status).toHaveBeenCalledWith(500)
    expect(response.json).toHaveBeenCalledWith({ error: 'Internal server error' })
  })
  test.each(['/async-error', '/sync-error'])('returns generic JSON for %s', async path => {
    const app = appWithErrors()
    const response = await request(app).get(path)
    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Internal server error' })
    expect(JSON.stringify(response.body)).not.toContain('private')
    expect((await request(app).get('/rates')).status).toBe(200)
  })
  test('preserves validation and body-parser client statuses', async () => {
    const app = appWithErrors()
    expect((await request(app).get('/validation-error')).body).toEqual({ error: 'Invalid field' })
    const invalidJson = await request(app).post('/body').set('Content-Type', 'application/json').send('{')
    expect(invalidJson.status).toBe(400)
    expect(invalidJson.body).toEqual({ error: 'Invalid JSON body' })
    const tooLarge = await request(app).post('/body').send({ note: 'n'.repeat(110000) })
    expect(tooLarge.status).toBe(413)
    expect(tooLarge.body).toEqual({ error: 'Request body too large' })
  })
  test.each([
    ['Content-Type', 'application/json; charset=koi8-r', 'Unsupported request charset'],
    ['Content-Encoding', 'compress', 'Unsupported content encoding'],
  ])('rejects unsupported %s as generic JSON415 and continues serving requests', async (header, value, message) => {
    const app = appWithErrors()
    const response = await request(app).post('/body').set('Content-Type', 'application/json').set(header, value).send('{}')
    expect(response.status).toBe(415)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).toEqual({ error: message })
    expect(response.text).not.toContain(value)
    expect((await request(app).post('/body').send({ healthy: true })).body).toEqual({ healthy: true })
  })
  test('delegates errors after headers were already sent', () => {
    const error = new Error('fixture')
    const next = jest.fn()
    errorHandler(error, {}, { headersSent: true }, next)
    expect(next).toHaveBeenCalledWith(error)
  })
})

describe('exchange rates preserve valid results and upstream status semantics', () => {
  test('converts provider rates, includes same-currency identity, deduplicates, and caches', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [{ quote: 'GBP', rate: 2, date: '2026-10-23' }] })
    const app = appWithErrors()
    for (let i = 0; i < 2; i += 1) {
      const response = await request(app).get('/rates?target=chf&sources=GBP,CHF,GBP')
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ target: 'CHF', rates: { GBP: .5, CHF: 1 }, date: '2026-10-23' })
    }
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const url = globalThis.fetch.mock.calls[0][0]
    expect(url.origin).toBe('https://api.frankfurter.dev')
    expect(url.searchParams.get('base')).toBe('CHF')
    expect(url.searchParams.get('quotes')).toBe('GBP')
  })
  test('expires stale cache entries before refetching', async () => {
    let now = 100000000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [{ quote: 'PLN', rate: 2 }] })
    const app = appWithErrors()
    expect((await request(app).get('/rates?target=CHF&sources=PLN')).body.date).toBeNull()
    now += 6 * 60 * 60 * 1000 + 1
    expect((await request(app).get('/rates?target=CHF&sources=PLN')).status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
  test.each([
    ['HTTP error', { ok: false, status: 503 }],
    ['invalid rate', { ok: true, json: async () => [{ quote: 'USD', rate: 0 }] }],
    ['malformed rows', { ok: true, json: async () => ({}) }],
    ['missing rate', { ok: true, json: async () => [] }],
  ])('contains provider %s as JSON 502', async (label, response) => {
    globalThis.fetch = jest.fn().mockResolvedValue(response)
    const result = await request(appWithErrors()).get('/rates?target=BGN&sources=USD')
    expect(result.status).toBe(502)
    expect(result.body.error).toEqual(expect.any(String))
  })
  test('contains provider rejection without a message', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue({})
    const result = await request(appWithErrors()).get('/rates?target=RON&sources=USD')
    expect(result.status).toBe(502)
    expect(result.body).toEqual({ error: 'Failed to fetch exchange rates' })
  })
})
