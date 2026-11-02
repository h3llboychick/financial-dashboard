import { afterAll, beforeEach, describe, expect, test } from '@jest/globals'
import Database from 'better-sqlite3-multiple-ciphers'
import express from 'express'
import request from 'supertest'
import { makeCategoryRepo } from '../src/modules/categories/categories.repository.js'
import { makeEntryRepo } from '../src/modules/entries/entries.repository.js'
import { makeLedgerRepo } from '../src/modules/ledgers/ledgers.repository.js'
import { makeWalletRepo } from '../src/modules/wallets/wallets.repository.js'
import { makeRecurringRepo } from '../src/modules/recurring/recurring.repository.js'
import { makeRecurringRouter } from '../src/modules/recurring/recurring.routes.js'
import { makeRecurringInternalRouter } from '../src/modules/recurring/internal.routes.js'
import { makeRecurringService } from '../src/modules/recurring/recurring.service.js'

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE ledgers (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT NOT NULL,
    is_default INTEGER DEFAULT 0
  );
  CREATE TABLE wallets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL,
    type TEXT NOT NULL,
    initial_balance REAL NOT NULL DEFAULT 0,
    balance_anchor_entry_id INTEGER NOT NULL DEFAULT 0,
    balance_anchor_at TEXT
  );
  CREATE TABLE ledger_categories (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    ledger_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    is_default INTEGER DEFAULT 0
  );
  CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ledger_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    category_id INTEGER,
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    wallet_id INTEGER
  );
  CREATE TABLE recurring_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    ledger_id INTEGER NOT NULL,
    wallet_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    note TEXT DEFAULT '',
    frequency TEXT NOT NULL DEFAULT 'monthly',
    interval_count INTEGER NOT NULL DEFAULT 1,
    day_of_month INTEGER NOT NULL DEFAULT 1 CHECK(day_of_month BETWEEN 1 AND 31),
    last_day INTEGER NOT NULL DEFAULT 0,
    weekday INTEGER,
    month_of_year INTEGER,
    start_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    last_generated_on TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`)

const TOKEN = 'a'.repeat(64)

const repos = {
  ledger_repo: makeLedgerRepo(db),
  wallet_repo: makeWalletRepo(db),
  category_repo: makeCategoryRepo(db),
  entry_repo: makeEntryRepo(db),
  recurring_repo: makeRecurringRepo(db),
}

function buildApp({ today = () => new Date('2026-06-15T12:00:00.000Z'), token = TOKEN } = {}) {
  const recurring_service = makeRecurringService({
    db,
    recurring_repo: repos.recurring_repo,
    entry_repo: repos.entry_repo,
    today,
  })
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => {
    req.user = { user_id: Number(req.header('x-user-id') || 1) }
    next()
  })
  app.use('/internal/recurring', makeRecurringInternalRouter({ recurring_service, token }))
  app.use('/recurring', makeRecurringRouter({ ...repos, recurring_service }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }))
  return app
}

const rule = {
  name: 'Scholarship',
  ledger_id: 1,
  wallet_id: 1,
  category_id: 1,
  amount: 500,
  day_of_month: 28,
  start_date: '2026-01-01',
}

function seedRows() {
  db.exec(`
    DELETE FROM recurring_rules;
    DELETE FROM entries;
    DELETE FROM ledger_categories;
    DELETE FROM wallets;
    DELETE FROM ledgers;

    INSERT INTO ledgers (id, user_id, name, type, color) VALUES
      (1, 1, 'Earnings', 'income', '#22c55e'),
      (2, 1, 'Spending', 'expense', '#ef4444'),
      (3, 2, 'Private', 'income', '#6b7280');

    INSERT INTO wallets (id, user_id, name, currency, type) VALUES
      (1, 1, 'Bank', 'EUR', 'fiat'),
      (2, 1, 'Dollars', 'USD', 'fiat'),
      (3, 1, 'Kraken', 'USD', 'exchange'),
      (4, 2, 'Private wallet', 'EUR', 'fiat');

    INSERT INTO ledger_categories (id, user_id, ledger_id, name, color) VALUES
      (1, 1, 1, 'Scholarship', '#22c55e'),
      (2, 1, 2, 'Food', '#f97316'),
      (3, 2, 3, 'Private category', '#6b7280');
  `)
}

function generatedEntries() {
  return db.prepare('SELECT date, amount, note, ledger_id, wallet_id, category_id FROM entries ORDER BY date').all()
}

beforeEach(seedRows)
afterAll(() => db.close())

describe('POST /recurring', () => {
  test('creates a rule and returns its names', async () => {
    const app = buildApp()
    const response = await request(app).post('/recurring').set('x-user-id', '1').send(rule)

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      name: 'Scholarship',
      ledger_name: 'Earnings',
      wallet_name: 'Bank',
      category_name: 'Scholarship',
      amount: 500,
      currency: 'EUR',
      day_of_month: 28,
      active: 1,
    })
  })

  test('refuses a category that belongs to another ledger', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ ...rule, category_id: 2 })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/belong to ledger_id/i)
  })

  test('refuses an exchange wallet', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ ...rule, wallet_id: 3 })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/fiat/i)
  })

  test('refuses an explicit currency that differs from the wallet', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ ...rule, currency: 'USD' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/match the wallet currency/i)
  })

  test('refuses a wallet owned by another user', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ ...rule, wallet_id: 4 })

    expect(response.status).toBe(404)
  })

  test('refuses a day outside 1-31', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ ...rule, day_of_month: 32 })

    expect(response.status).toBe(400)
  })
})

describe('materialising due occurrences', () => {
  test('creates the entries that are due and nothing else', async () => {
    const app = buildApp()
    await request(app).post('/recurring').set('x-user-id', '1').send(rule)

    const response = await request(app).get('/recurring').set('x-user-id', '1')

    expect(response.status).toBe(200)
    expect(response.body[0].last_generated_on).toBe('2026-05-28')
    expect(generatedEntries().map(entry => entry.date)).toEqual([
      '2026-01-28',
      '2026-02-28',
      '2026-03-28',
      '2026-04-28',
      '2026-05-28',
    ])
  })

  test('does not create the occurrence that has not arrived yet', async () => {
    const app = buildApp({ today: () => new Date('2026-06-27T12:00:00.000Z') })
    await request(app).post('/recurring').set('x-user-id', '1').send(rule)

    await request(app).get('/recurring').set('x-user-id', '1')

    expect(generatedEntries().some(entry => entry.date === '2026-06-28')).toBe(false)
  })

  test('is idempotent across repeated runs', async () => {
    const app = buildApp()
    await request(app).post('/recurring').set('x-user-id', '1').send(rule)

    const first = await request(app).post('/recurring/run').set('x-user-id', '1')
    const second = await request(app).post('/recurring/run').set('x-user-id', '1')

    expect(first.body.entries_created).toBe(5)
    expect(second.body.entries_created).toBe(0)
    expect(generatedEntries()).toHaveLength(5)
  })

  test('clamps a rule on the 31st to the last day of shorter months', async () => {
    const app = buildApp({ today: () => new Date('2026-03-31T12:00:00.000Z') })
    await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ ...rule, day_of_month: 31, start_date: '2026-01-01' })

    await request(app).get('/recurring').set('x-user-id', '1')

    expect(generatedEntries().map(entry => entry.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ])
  })

  test('creates nothing for a rule that starts in the future', async () => {
    const app = buildApp({ today: () => new Date('2026-06-15T12:00:00.000Z') })
    await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ ...rule, start_date: '2026-09-01' })

    await request(app).get('/recurring').set('x-user-id', '1')

    expect(generatedEntries()).toHaveLength(0)
  })

  test('copies ledger, wallet, category and amount onto the generated entry', async () => {
    const app = buildApp()
    await request(app).post('/recurring').set('x-user-id', '1').send(rule)

    await request(app).post('/recurring/run').set('x-user-id', '1')

    const [entry] = generatedEntries()
    expect(entry).toMatchObject({
      amount: 500,
      ledger_id: 1,
      wallet_id: 1,
      category_id: 1,
      note: 'Scholarship',
    })
  })

  test('stops generating once the rule is deactivated', async () => {
    const app = buildApp()
    const created = await request(app).post('/recurring').set('x-user-id', '1').send(rule)

    await request(app)
      .patch(`/recurring/${created.body.id}`)
      .set('x-user-id', '1')
      .send({ active: false })
    const response = await request(app).post('/recurring/run').set('x-user-id', '1')

    expect(response.body.entries_created).toBe(0)
  })
})

describe('last-day-of-month rules', () => {
  test('accepts a rule without day_of_month and stores 31', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ name: 'Scholarship', ledger_id: 1, wallet_id: 1, category_id: 1, amount: 500, last_day: true, start_date: '2026-01-01' })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ last_day: 1, day_of_month: 31 })
  })

  test('creates the entry on the last day of every month, short ones included', async () => {
    const app = buildApp({ today: () => new Date('2026-06-15T12:00:00.000Z') })
    await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ name: 'Scholarship', ledger_id: 1, wallet_id: 1, category_id: 1, amount: 500, last_day: true, start_date: '2026-01-01' })

    await request(app).post('/recurring/run').set('x-user-id', '1')

    expect(generatedEntries().map(entry => entry.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ])
  })

  test('switches an existing rule to the last day', async () => {
    const app = buildApp({ today: () => new Date('2026-02-01T12:00:00.000Z') })
    const created = await request(app).post('/recurring').set('x-user-id', '1').send(rule)

    const updated = await request(app)
      .patch(`/recurring/${created.body.id}`)
      .set('x-user-id', '1')
      .send({ last_day: true })
    await request(app).post('/recurring/run').set('x-user-id', '1')

    expect(updated.body.last_day).toBe(1)
    expect(generatedEntries().map(entry => entry.date)).toEqual(['2026-01-31'])
  })
})

describe('cadences', () => {
  test('creates an entry every week on the chosen weekday', async () => {
    const app = buildApp({ today: () => new Date('2026-01-26T12:00:00.000Z') })
    await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ name: 'Cleaner', ledger_id: 2, wallet_id: 1, category_id: 2, amount: 40, frequency: 'weekly', weekday: 1, start_date: '2026-01-05' })

    await request(app).post('/recurring/run').set('x-user-id', '1')

    expect(generatedEntries().map(entry => entry.date)).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
      '2026-01-26',
    ])
  })

  test('creates an entry every N days', async () => {
    const app = buildApp({ today: () => new Date('2026-02-01T12:00:00.000Z') })
    await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ name: 'Gym', ledger_id: 2, wallet_id: 1, category_id: 2, amount: 3, frequency: 'daily', interval_count: 14, start_date: '2026-01-01' })

    await request(app).post('/recurring/run').set('x-user-id', '1')

    expect(generatedEntries().map(entry => entry.date)).toEqual([
      '2026-01-01',
      '2026-01-15',
      '2026-01-29',
    ])
  })

  test('creates one entry a year on the chosen date', async () => {
    const app = buildApp({ today: () => new Date('2027-06-15T12:00:00.000Z') })
    await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ name: 'Insurance', ledger_id: 2, wallet_id: 1, category_id: 2, amount: 120, frequency: 'yearly', month_of_year: 3, day_of_month: 15, start_date: '2026-01-01' })

    await request(app).post('/recurring/run').set('x-user-id', '1')

    expect(generatedEntries().map(entry => entry.date)).toEqual(['2026-03-15', '2027-03-15'])
  })

  test('describes the schedule in the response', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ name: 'Scholarship', ledger_id: 1, wallet_id: 1, category_id: 1, amount: 500, last_day: true, start_date: '2026-01-01' })

    expect(response.body.schedule).toBe('Monthly on the last day')
    expect(response.body.frequency).toBe('monthly')
    expect(response.body.interval_count).toBe(1)
  })

  test('refuses weekly rules without a weekday', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ name: 'Cleaner', ledger_id: 2, wallet_id: 1, category_id: 2, amount: 40, frequency: 'weekly', start_date: '2026-01-05' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/weekday/i)
  })

  test('refuses yearly rules without a month', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ name: 'Insurance', ledger_id: 2, wallet_id: 1, category_id: 2, amount: 120, frequency: 'yearly', day_of_month: 15, start_date: '2026-01-01' })

    expect(response.status).toBe(400)
    expect(response.body.error).toMatch(/month_of_year/i)
  })

  test('refuses an interval below one', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/recurring')
      .set('x-user-id', '1')
      .send({ ...rule, interval_count: 0 })

    expect(response.status).toBe(400)
  })
})

describe('DELETE /recurring/:id', () => {
  test('keeps entries the rule already created', async () => {
    const app = buildApp()
    const created = await request(app).post('/recurring').set('x-user-id', '1').send(rule)
    await request(app).post('/recurring/run').set('x-user-id', '1')

    const response = await request(app).delete(`/recurring/${created.body.id}`).set('x-user-id', '1')

    expect(response.status).toBe(204)
    expect(generatedEntries()).toHaveLength(5)
  })
})

describe('internal runner endpoint', () => {
  test('rejects a request without the service token', async () => {
    const app = buildApp()
    const response = await request(app).post('/internal/recurring/run')

    expect(response.status).toBe(401)
  })

  test('rejects a wrong service token', async () => {
    const app = buildApp()
    const response = await request(app)
      .post('/internal/recurring/run')
      .set('x-service-token', 'b'.repeat(64))

    expect(response.status).toBe(401)
  })

  test('runs for every user and returns counts only', async () => {
    const app = buildApp()
    await request(app).post('/recurring').set('x-user-id', '1').send(rule)

    const response = await request(app)
      .post('/internal/recurring/run')
      .set('x-service-token', TOKEN)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ rules_checked: 1, entries_created: 5 })
    expect(response.body.entries_created).toBeDefined()
    expect(JSON.stringify(response.body)).not.toMatch(/Scholarship|amount/)
  })

  test('answers 503 when no token is configured', async () => {
    const app = buildApp({ token: null })
    const response = await request(app)
      .post('/internal/recurring/run')
      .set('x-service-token', TOKEN)

    expect(response.status).toBe(503)
  })
})
