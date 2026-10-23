import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { randomBytes } from 'node:crypto'
import Database from 'better-sqlite3-multiple-ciphers'
import express from 'express'
import request from 'supertest'
import { makeEntriesRouter } from '../src/modules/entries/entries.routes.js'
import { makeCategoryRepo } from '../src/modules/categories/categories.repository.js'
import { makeCategoriesRouter } from '../src/modules/categories/categories.routes.js'
import { makeEntryRepo } from '../src/modules/entries/entries.repository.js'
import { makeLedgerRepo } from '../src/modules/ledgers/ledgers.repository.js'
import { makeLedgersRouter } from '../src/modules/ledgers/ledgers.routes.js'
import { makeWalletRepo } from '../src/modules/wallets/wallets.repository.js'
import { makeWalletsRouter } from '../src/modules/wallets/wallets.routes.js'
import exchangeAccountService from '../src/modules/exchanges/exchangeAccount.service.js'
import { errorHandler } from '../src/shared/middleware/errorHandler.js'
import { DEFAULT_CATEGORIES } from '../src/shared/constants.js'
import { financialSnapshot, initializeFinancialData, resetFinancialData } from './fixtures/financialData.js'

process.env.CREDENTIALS_KEK = randomBytes(32).toString('base64')
const db = new Database(':memory:')
initializeFinancialData(db)
const repos = {
  category_repo: makeCategoryRepo(db), entry_repo: makeEntryRepo(db),
  ledger_repo: makeLedgerRepo(db), wallet_repo: makeWalletRepo(db),
}
const encryptWrite = jest.spyOn(repos.wallet_repo, 'upsert_exchange_credentials')
const app = express()
app.use(express.json())
app.use((req, res, next) => { req.user = { user_id: 1 }; next() })
app.use('/entries', makeEntriesRouter(repos))
app.use('/wallets', makeWalletsRouter(repos))
app.use('/categories', makeCategoriesRouter(repos))
app.use('/ledgers', makeLedgersRouter(repos))
app.use(errorHandler)

beforeEach(() => { resetFinancialData(db); encryptWrite.mockClear() })
afterAll(() => db.close())
const validEntry = { ledger_id: 1, wallet_id: 1, category_id: 1, amount: 2.5, currency: 'EUR', date: '2026-08-04', note: 'Fixture' }
const invalidIds = [true, [], [1], {}, null, '', ' ', 0, -1, 1.5, '1e0', '0x1', '1.5', '1 OR 1=1', 9007199254740992, '9007199254740992']
const invalidMoney = [true, false, [], [1], {}, null, '', ' ', '0x10', '1e309', '-1e309', 'NaN', 'Infinity', '1_000', 1000000000001, '-1000000000001']
const invalidNames = [true, 7, [], {}, null, '', ' ', 'x'.repeat(101)]
const invalidColors = [true, [], {}, null, '', 'red', '#fff', '#1234567', '#zzzzzz']
const invalidDates = [true, [], {}, null, '', 'not-a-date', '2026-02-29', '2024-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-01', '2026-01-01T00:00:00Z', '0000-01-01']

async function expectRejected(method, path, body) {
  const before = financialSnapshot(db)
  const response = await request(app)[method](path).send(body)
  expect(response.status).toBe(400)
  expect(response.type).toBe('application/json')
  expect(response.body.error).toEqual(expect.any(String))
  expect(financialSnapshot(db)).toEqual(before)
  expect(encryptWrite).not.toHaveBeenCalled()
}

describe('financial mutations reject malformed data without changing any records', () => {
  const entryCases = [
    ...['ledger_id', 'wallet_id', 'category_id'].flatMap(field => invalidIds.map((value, i) => [`${field} invalid ${i}`, { ...validEntry, [field]: value }])),
    ...[...invalidMoney, 0, -1].map((value, i) => [`amount invalid ${i}`, { ...validEntry, amount: value }]),
    ...invalidDates.map((value, i) => [`date invalid ${i}`, { ...validEntry, date: value }]),
    ...[true, [], {}, null, '', 'BTC'].map((value, i) => [`currency invalid ${i}`, { ...validEntry, currency: value }]),
    ...[true, [], {}, null, 7, 'n'.repeat(2001)].map((value, i) => [`note invalid ${i}`, { ...validEntry, note: value }]),
  ]
  test.each(entryCases)('entry create rejects %s', async (label, body) => expectRejected('post', '/entries', body))
  test.each(entryCases)('entry update rejects %s', async (label, body) => expectRejected('patch', '/entries/1', body))
  test.each([['entries', validEntry], ['wallets', { name: 'New', currency: 'EUR', type: 'fiat' }], ['categories', { ledger_id: 1, name: 'New', color: '#123456' }], ['ledgers', { name: 'New', type: 'expense', color: '#123456' }]])('%s rejects an array request body', async (path, body) => expectRejected('post', `/${path}`, [body]))

  test.each(invalidNames.map((value, i) => [i, value]))('wallet create rejects name %s', async (i, name) => expectRejected('post', '/wallets', { name, type: 'fiat', currency: 'EUR' }))
  test.each(invalidNames.map((value, i) => [i, value]))('wallet update rejects name %s', async (i, name) => expectRejected('patch', '/wallets/1', { name, initial_balance: 0 }))
  test.each(invalidMoney.map((value, i) => [i, value]))('wallet create rejects balance %s', async (i, initial_balance) => expectRejected('post', '/wallets', { name: 'New', type: 'fiat', currency: 'EUR', initial_balance }))
  test.each(invalidMoney.map((value, i) => [i, value]))('wallet update rejects balance %s without resetting the anchor', async (i, initial_balance) => expectRejected('patch', '/wallets/1', { initial_balance }))
  test.each([true, [], {}, null, '', 'BTC'].map((value, i) => [i, value]))('wallet rejects currency %s', async (i, currency) => expectRejected('post', '/wallets', { name: 'New', type: 'fiat', currency }))
  test.each([true, [], {}, null, '', 'cash'].map((value, i) => [i, value]))('wallet rejects type %s', async (i, type) => expectRejected('post', '/wallets', { name: 'New', type, currency: 'EUR' }))

  for (const path of ['categories', 'ledgers']) {
    const valid = path === 'categories' ? { ledger_id: 1, name: 'New', color: '#123456' } : { name: 'New', type: 'expense', color: '#123456' }
    test.each(invalidNames.map((value, i) => [i, value]))(`${path} reject name %s`, async (i, name) => expectRejected('post', `/${path}`, { ...valid, name }))
    test.each(invalidColors.map((value, i) => [i, value]))(`${path} reject color %s`, async (i, color) => expectRejected('post', `/${path}`, { ...valid, color }))
  }
  test.each(invalidIds.map((value, i) => [i, value]))('category rejects ledger ID %s', async (i, ledger_id) => expectRejected('post', '/categories', { ledger_id, name: 'New', color: '#123456' }))
  test.each([true, [], {}, null, '', 'cash'].map((value, i) => [i, value]))('ledger rejects type %s', async (i, type) => expectRejected('post', '/ledgers', { name: 'New', type, color: '#123456' }))

  const invalidCredentials = [true, [], null, {}, { api_key: 'key' }, { api_secret: 'secret' }, { api_key: true, api_secret: 'secret' }, { api_key: 'key', api_secret: [] }, { api_key: '', api_secret: 'secret' }, { api_key: 'key', api_secret: ' ' }, { api_key: 'k'.repeat(4097), api_secret: 'secret' }, { api_key: 'key', api_secret: 's'.repeat(4097) }, { api_key: 'key', api_secret: 'secret', unknown: 'field' }]
  test.each(invalidCredentials.map((value, i) => [i, value]))('credentials reject malformed object %s before encryption', async (i, credentials) => expectRejected('put', '/wallets/2/credentials', { slug: 'kraken', credentials }))
  test.each([true, [], {}, null, '', 'unknown'].map((value, i) => [i, value]))('credentials reject slug %s', async (i, slug) => expectRejected('put', '/wallets/2/credentials', { slug, credentials: { api_key: 'key', api_secret: 'secret' } }))
  test('credentials reject an array request body', async () => expectRejected('put', '/wallets/2/credentials', [{ slug: 'kraken', credentials: { api_key: 'key', api_secret: 'secret' } }]))
})

describe('IDs are validated consistently at API boundaries', () => {
  test.each(['0', '-1', '1.5', '1e0', '0x1', '9007199254740992', '1 OR 1=1'])('rejects malformed path ID %s before mutation', async id => {
    for (const path of ['entries', 'wallets', 'categories', 'ledgers']) await expectRejected('delete', `/${path}/${encodeURIComponent(id)}`)
    await expectRejected('patch', `/entries/${encodeURIComponent(id)}`, validEntry)
    await expectRejected('patch', `/wallets/${encodeURIComponent(id)}`, { initial_balance: 0 })
    await expectRejected('put', `/wallets/${encodeURIComponent(id)}/credentials`, { slug: 'kraken', credentials: { api_key: 'key', api_secret: 'secret' } })
  })
  test.each(['ledger_id[]=1', 'ledger_id[a]=1', 'ledger_id=1&ledger_id=2', 'ledger_id=', 'ledger_id=true', 'ledger_id=1.5', 'ledger_id=9007199254740992'])('rejects invalid filter %s', async query => {
    await expectRejected('get', `/entries?${query}`)
    await expectRejected('get', `/categories?${query}`)
  })
})

describe('normal financial flows retain behavior', () => {
  test('accepts digit-string IDs, decimal money, lowercase currency, leap days and bounded text', async () => {
    const response = await request(app).post('/entries').send({ ...validEntry, ledger_id: '1', wallet_id: '01', category_id: '1', amount: '1000000000000.00', currency: ' eur ', date: '2024-02-29', note: 'n'.repeat(2000) })
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ amount: 1e12, currency: 'EUR', date: '2024-02-29', note: 'n'.repeat(2000) })
  })
  test('uses documented omitted entry currency/note defaults', async () => {
    const { currency, note, ...body } = validEntry
    const response = await request(app).post('/entries').send(body)
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ currency: 'EUR', note: '' })
  })
  test('wallet creation keeps signed/zero balances and omitted default', async () => {
    for (const [i, balance] of [undefined, 0, '-1000000000000', '12.25'].entries()) {
      const body = { name: ` Wallet ${i} `, currency: 'eur', type: 'fiat' }
      if (balance !== undefined) body.initial_balance = balance
      const response = await request(app).post('/wallets').send(body)
      expect(response.status).toBe(201)
      expect(response.body).toMatchObject({ name: `Wallet ${i}`, currency: 'EUR', initial_balance: Number(balance ?? 0), balance_anchor_entry_id: 1 })
    }
  })
  test('wallet name-only edit preserves anchor and balance; explicit balance resets only fiat anchor', async () => {
    expect((await request(app).patch('/wallets/1').send({ name: ' Renamed ' })).body).toMatchObject({ name: 'Renamed', initial_balance: 100, balance_anchor_entry_id: 1, balance_anchor_at: null })
    const fiat = await request(app).patch('/wallets/1').send({ initial_balance: '0' })
    expect(fiat.status).toBe(200)
    expect(fiat.body).toMatchObject({ initial_balance: 0, balance_anchor_entry_id: 1, balance_anchor_at: expect.any(String) })
    const exchange = await request(app).patch('/wallets/2').send({ initial_balance: '-2' })
    expect(exchange.status).toBe(200)
    expect(exchange.body).toMatchObject({ initial_balance: -2, balance_anchor_entry_id: 0, balance_anchor_at: null })
  })
  test('valid credentials encrypt, can be replaced, and are never exposed in list responses', async () => {
    for (const api_key of ['fixture-one', 'k'.repeat(4096)]) {
      const response = await request(app).put('/wallets/2/credentials').send({ slug: 'kraken', credentials: { api_key, api_secret: 'fixture-secret' } })
      expect(response.status).toBe(201)
      expect(repos.wallet_repo.get_exchange_credentials({ wallet_id: 2, user_id: 1 }).credentials.api_key).toBe(api_key)
    }
    expect(db.prepare('SELECT COUNT(*) AS n FROM exchange_credentials').get().n).toBe(1)
    const response = await request(app).get('/wallets')
    expect(response.status).toBe(200)
    expect(JSON.stringify(response.body)).not.toContain('fixture-secret')
    expect(response.body.find(wallet => wallet.id === 2)).toMatchObject({ has_credentials: true, slug: 'kraken', balance: null })
  })
  test('creates a ledger with categories of its type and keeps creation conflicts', async () => {
    const body = { name: ' Vacation ', type: 'income', color: '#ABCDEF' }
    const response = await request(app).post('/ledgers').send(body)
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ name: 'Vacation', color: '#ABCDEF' })
    const categories = repos.category_repo.list_for_ledger({ ledger_id: response.body.id, user_id: 1 })
    expect(categories.map(({ name }) => name).sort()).toEqual(DEFAULT_CATEGORIES.income.map(([name]) => name).sort())
    expect(categories.every(category => category.is_default === 0 && category.user_id === 1)).toBe(true)
    expect((await request(app).post('/ledgers').send(body)).status).toBe(409)
    expect((await request(app).post('/wallets').send({ name: 'Main EUR', currency: 'EUR', type: 'fiat' })).status).toBe(409)
    expect((await request(app).post('/categories').send({ ledger_id: 1, name: 'Food', color: '#123456' })).status).toBe(409)
  })
  test('accepts 100-character names and valid category colors', async () => {
    expect((await request(app).post('/categories').send({ ledger_id: '1', name: 'x'.repeat(100), color: '#abcdef' })).status).toBe(201)
    expect((await request(app).post('/wallets').send({ name: 'x'.repeat(100), currency: 'usd', type: 'exchange' })).status).toBe(201)
  })
  test('preserves ownership 404s and category/ledger relationship rejection', async () => {
    for (const path of ['entries', 'wallets', 'categories', 'ledgers']) expect((await request(app).delete(`/${path}/3`)).status).toBe(404)
    expect((await request(app).patch('/entries/2').send(validEntry)).status).toBe(404)
    expect((await request(app).patch('/wallets/3').send({ name: 'No' })).status).toBe(404)
    expect((await request(app).post('/entries').send({ ...validEntry, wallet_id: 3 })).status).toBe(404)
    expect((await request(app).post('/entries').send({ ...validEntry, ledger_id: 3 })).status).toBe(404)
    expect((await request(app).post('/entries').send({ ...validEntry, category_id: 3 })).status).toBe(404)
    expect((await request(app).post('/entries').send({ ...validEntry, category_id: 2 })).status).toBe(400)
    expect((await request(app).put('/wallets/3/credentials').send({ slug: 'kraken', credentials: { api_key: 'key', api_secret: 'secret' } })).status).toBe(404)
  })
  test('lists with/without valid filters and rejects foreign ledger filters', async () => {
    for (const path of ['entries', 'categories', 'ledgers', 'wallets']) expect((await request(app).get(`/${path}`)).status).toBe(200)
    for (const path of ['entries', 'categories']) {
      expect((await request(app).get(`/${path}?ledger_id=1`)).status).toBe(200)
      expect((await request(app).get(`/${path}?ledger_id=3`)).status).toBe(404)
    }
  })
  test('keeps default and used category/ledger protections and allows unused deletes', async () => {
    expect((await request(app).delete('/categories/1')).status).toBe(403)
    expect((await request(app).delete('/ledgers/1')).status).toBe(403)
    db.prepare('UPDATE ledger_categories SET is_default = 0 WHERE id = 1').run()
    db.prepare('UPDATE ledgers SET is_default = 0 WHERE id = 1').run()
    expect((await request(app).delete('/categories/1')).status).toBe(409)
    expect((await request(app).delete('/ledgers/1')).status).toBe(409)
    expect((await request(app).delete('/categories/4')).status).toBe(204)
    expect((await request(app).delete('/ledgers/4')).status).toBe(204)
    expect((await request(app).delete('/wallets/4')).status).toBe(204)
    expect((await request(app).delete('/entries/1')).status).toBe(204)
  })
})


describe('controlled storage/provider error paths', () => {
  test.each([
    ['categories', 'category_repo', { ledger_id: 1, name: 'New', color: '#123456' }],
    ['wallets', 'wallet_repo', { name: 'New', currency: 'EUR', type: 'fiat' }],
    ['ledgers', 'ledger_repo', { name: 'New', type: 'income', color: '#123456' }],
  ])('%s storage errors are generic JSON 500', async (path, repo, body) => {
    const spy = jest.spyOn(repos[repo], 'create').mockImplementationOnce(() => { throw new Error('private storage detail') })
    const response = await request(app).post(`/${path}`).send(body)
    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Internal server error' })
    spy.mockRestore()
  })
  test('live balance preserves wallet ownership, wallet type, missing credentials, success and provider failures', async () => {
    expect((await request(app).get('/wallets/3/live-balance')).status).toBe(404)
    expect((await request(app).get('/wallets/1/live-balance')).status).toBe(400)
    expect((await request(app).get('/wallets/2/live-balance')).status).toBe(400)
    expect((await request(app).get('/wallets/0/live-balance')).status).toBe(400)
    expect((await request(app).put('/wallets/1/credentials').send({ slug: 'kraken', credentials: {} })).status).toBe(400)
    repos.wallet_repo.upsert_exchange_credentials({ user_id: 1, wallet_id: 2, slug: 'kraken', credentials: { api_key: 'fixture-key', api_secret: 'fixture-secret' } })
    const spy = jest.spyOn(exchangeAccountService, 'get_live_balance')
      .mockResolvedValueOnce({ portfolio_value: { amount: 10, currency: 'USD' } })
      .mockRejectedValueOnce(new Error('Fixture provider unavailable'))
      .mockRejectedValueOnce(Object.assign(new Error('Unsupported exchange'), { status: 400 }))
      .mockRejectedValueOnce({})
    const success = await request(app).get('/wallets/2/live-balance')
    expect(success.status).toBe(200)
    expect(success.body).toEqual({ portfolio_value: { amount: 10, currency: 'USD' } })
    expect((await request(app).get('/wallets/2/live-balance')).status).toBe(502)
    expect((await request(app).get('/wallets/2/live-balance')).status).toBe(400)
    expect((await request(app).get('/wallets/2/live-balance')).body).toEqual({ error: 'Failed to fetch exchange balance' })
    spy.mockRestore()
  })
})
